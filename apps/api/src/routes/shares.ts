import { Router, Request, Response } from "express";
import crypto from "crypto";
import { createShareSchema } from "@vaultx/shared";
import { pool } from "../db";
import { requireAuth, optionalAuth } from "../middleware/auth";
import { shareLimiter } from "../middleware/rateLimit";
import { logAudit } from "../middleware/audit";
import { presignedGet, chunkKey } from "../s3";

const router = Router();

router.post(
  "/:fileId/share",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const body = { ...req.body, file_id: req.params.fileId };
      const parsed = createShareSchema.safeParse(body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0].message });
        return;
      }

      const { file_id, wrapped_key_for_share, expires_in_days } = parsed.data;
      const userId = req.auth!.userId;

      const fileRes = await pool.query(
        `SELECT id FROM files WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL`,
        [file_id, userId]
      );
      if (fileRes.rows.length === 0) {
        res.status(404).json({ error: "File not found" });
        return;
      }

      const linkTokenHash = req.body.link_token_hash as string;
      if (!linkTokenHash || linkTokenHash.length !== 64) {
        res.status(400).json({ error: "link_token_hash required (64-char hex)" });
        return;
      }

      const expiresAt = new Date(
        Date.now() + expires_in_days * 24 * 60 * 60 * 1000
      );

      const shareRes = await pool.query(
        `INSERT INTO shares (file_id, created_by, link_token_hash, wrapped_key_for_share, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, expires_at, created_at`,
        [file_id, userId, linkTokenHash, wrapped_key_for_share, expiresAt]
      );

      await logAudit(req, "share_created", file_id);

      const share = shareRes.rows[0];
      res.status(201).json({
        share_id: share.id,
        expires_at: share.expires_at,
        created_at: share.created_at,
      });
    } catch (err: any) {
      if (err.code === "23505") {
        res.status(409).json({ error: "Token collision, please retry" });
        return;
      }
      console.error("[shares/create]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.get(
  "/by-token/:hash",
  shareLimiter,
  optionalAuth,
  async (req: Request, res: Response) => {
    try {
      const tokenHash = req.params.hash;

      const shareRes = await pool.query(
        `SELECT s.*, f.name, f.size, f.mime, f.total_chunks, f.status, f.owner_id
         FROM shares s
         JOIN files f ON f.id = s.file_id
         WHERE s.link_token_hash = $1`,
        [tokenHash]
      );

      if (shareRes.rows.length === 0) {
        res.status(404).json({ error: "Share link not found" });
        return;
      }

      const share = shareRes.rows[0];

      if (share.disabled_at) {
        res.status(403).json({ error: "This share link has been disabled" });
        return;
      }

      if (new Date(share.expires_at) < new Date()) {
        res.status(403).json({ error: "This share link has expired" });
        return;
      }

      if (share.status !== "complete") {
        res.status(404).json({ error: "File not available" });
        return;
      }

      const download_urls: { index: number; url: string }[] = [];
      for (let i = 0; i < share.total_chunks; i++) {
        const url = await presignedGet(chunkKey(share.file_id, i));
        download_urls.push({ index: i, url });
      }

      await logAudit(req, "share_accessed", share.file_id);

      const viewerId = req.auth?.userId;
      if (viewerId && viewerId !== share.owner_id) {
        const sharerRes = await pool.query(
          `SELECT email FROM users WHERE id = $1`,
          [share.created_by]
        );
        const sharerEmail = sharerRes.rows[0]?.email ?? "unknown";
        await pool.query(
          `INSERT INTO share_accesses (user_id, share_id, file_name_snapshot, sharer_email_snapshot)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, share_id) DO NOTHING`,
          [viewerId, share.id, share.name, sharerEmail]
        );
      }

      res.json({
        file: {
          id: share.file_id,
          name: share.name,
          size: share.size,
          mime: share.mime,
          total_chunks: share.total_chunks,
        },
        wrapped_key_for_share: share.wrapped_key_for_share,
        download_urls,
      });
    } catch (err: any) {
      console.error("[shares/validate]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.get("/mine", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth!.userId;

    const result = await pool.query(
      `SELECT s.id, s.file_id, f.name as file_name, s.role, s.expires_at, s.created_at, s.disabled_at
       FROM shares s
       JOIN files f ON f.id = s.file_id
       WHERE s.created_by = $1
       ORDER BY s.created_at DESC
       LIMIT 100`,
      [userId]
    );

    res.json({ shares: result.rows });
  } catch (err: any) {
    console.error("[shares/mine]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/shared-with-me", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth!.userId;

    const result = await pool.query(
      `SELECT
         sa.id,
         sa.share_id,
         sa.file_name_snapshot,
         sa.sharer_email_snapshot,
         sa.accessed_at,
         s.file_id,
         s.expires_at,
         s.disabled_at
       FROM share_accesses sa
       JOIN shares s ON s.id = sa.share_id
       WHERE sa.user_id = $1
       ORDER BY sa.accessed_at DESC
       LIMIT 100`,
      [userId]
    );

    res.json({ shares: result.rows });
  } catch (err: any) {
    console.error("[shares/shared-with-me]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const shareId = req.params.id;
    const userId = req.auth!.userId;

    const result = await pool.query(
      `UPDATE shares SET disabled_at = now()
       WHERE id = $1 AND created_by = $2 AND disabled_at IS NULL
       RETURNING id, file_id`,
      [shareId, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Share not found" });
      return;
    }

    await logAudit(req, "share_disabled", result.rows[0].file_id);
    res.json({ ok: true });
  } catch (err: any) {
    console.error("[shares/disable]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
