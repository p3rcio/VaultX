// tag routes — set or remove tags on a file (tags are generated client-side, only stored here)
import { Router, Request, Response } from "express";
import { setTagsSchema } from "@vaultx/shared";
import { pool } from "../db";
import { requireAuth } from "../middleware/auth";

const router = Router();

/* ── POST /files/:id/tags — replace all tags on a file ── */

router.post("/:fileId/tags", requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = setTagsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const fileId = req.params.fileId;
    const userId = req.auth!.userId;

    // check the file belongs to the requesting user
    const fileRes = await pool.query(
      `SELECT id FROM files WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL`,
      [fileId, userId]
    );
    if (fileRes.rows.length === 0) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    // replace all existing tags with the new list — simpler than diffing
    await pool.query(`DELETE FROM file_tags WHERE file_id = $1`, [fileId]);

    for (const { name, confidence } of parsed.data.tags) {
      // upsert the tag name — if it already exists just return its ID
      const tagRes = await pool.query(
        `INSERT INTO tags (name) VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [name.toLowerCase().trim()]
      );
      const tagId = tagRes.rows[0].id;

      await pool.query(
        `INSERT INTO file_tags (file_id, tag_id, confidence) VALUES ($1, $2, $3)`,
        [fileId, tagId, confidence]
      );
    }

    res.json({ ok: true });
  } catch (err: any) {
    console.error("[tags/set]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ── DELETE /files/:fileId/tags/:tagId — remove a single tag */

router.delete(
  "/:fileId/tags/:tagId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { fileId, tagId } = req.params;
      const userId = req.auth!.userId;

      // verify ownership before deleting
      const fileRes = await pool.query(
        `SELECT id FROM files WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL`,
        [fileId, userId]
      );
      if (fileRes.rows.length === 0) {
        res.status(404).json({ error: "File not found" });
        return;
      }

      await pool.query(
        `DELETE FROM file_tags WHERE file_id = $1 AND tag_id = $2`,
        [fileId, tagId]
      );

      res.json({ ok: true });
    } catch (err: any) {
      console.error("[tags/remove]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;
