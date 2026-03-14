// file upload init, chunk completion, listing, download URL generation, and soft deletion
import { Router, Request, Response } from "express";
import { initUploadSchema } from "@vaultx/shared";
import { pool } from "../db";
import { requireAuth } from "../middleware/auth";
import { logAudit } from "../middleware/audit";
import { presignedPut, presignedGet, chunkKey, objectExists } from "../s3";

const router = Router();

/* ── POST /files/init — start a new upload ───────────── */

router.post("/init", requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = initUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const { name, size, mime, total_chunks, wrapped_key } = parsed.data;
    const userId = req.auth!.userId;

    // row starts as 'uploading' and only moves to 'complete' once all chunks are confirmed
    const fileRes = await pool.query(
      `INSERT INTO files (owner_id, name, object_key, size, mime, total_chunks, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'uploading')
       RETURNING id`,
      [userId, name, "", size, mime, total_chunks]
    );
    const fileId: string = fileRes.rows[0].id;

    // use the file UUID as the S3 prefix so chunks live under "uuid/chunk_xxxxx"
    await pool.query(`UPDATE files SET object_key = $1 WHERE id = $2`, [
      fileId,
      fileId,
    ]);

    // wrapped key goes to the DB — server stores it but can't decrypt it without the UMK
    await pool.query(
      `INSERT INTO file_keys (file_id, wrapped_key) VALUES ($1, $2)`,
      [fileId, wrapped_key]
    );

    // generate one presigned PUT URL per chunk so the browser uploads directly to MinIO
    const upload_urls: { index: number; url: string }[] = [];
    for (let i = 0; i < total_chunks; i++) {
      const url = await presignedPut(chunkKey(fileId, i));
      upload_urls.push({ index: i, url });
    }

    res.status(201).json({ file_id: fileId, upload_urls });
  } catch (err: any) {
    console.error("[files/init]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ── POST /files/:id/upload-urls — fresh URLs for a resumed upload */

router.post("/:id/upload-urls", requireAuth, async (req: Request, res: Response) => {
  try {
    const fileId = req.params.id;
    const userId = req.auth!.userId;

    const fileRes = await pool.query(
      `SELECT * FROM files WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL`,
      [fileId, userId]
    );
    if (fileRes.rows.length === 0) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const file = fileRes.rows[0];

    // check which chunks are already in S3 — only generate new URLs for the missing ones
    const chunks_uploaded: number[] = [];
    const upload_urls: { index: number; url: string }[] = [];

    for (let i = 0; i < file.total_chunks; i++) {
      const exists = await objectExists(chunkKey(fileId, i));
      if (exists) {
        chunks_uploaded.push(i);
      } else {
        const url = await presignedPut(chunkKey(fileId, i));
        upload_urls.push({ index: i, url });
      }
    }

    res.json({ upload_urls, chunks_uploaded });
  } catch (err: any) {
    console.error("[files/upload-urls]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ── POST /files/:id/complete — mark upload as done ─────── */

router.post("/:id/complete", requireAuth, async (req: Request, res: Response) => {
  try {
    const fileId = req.params.id;
    const userId = req.auth!.userId;

    const fileRes = await pool.query(
      `SELECT * FROM files WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL`,
      [fileId, userId]
    );
    if (fileRes.rows.length === 0) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const file = fileRes.rows[0];

    // verify all chunks are actually in S3 before marking as complete
    let uploaded = 0;
    for (let i = 0; i < file.total_chunks; i++) {
      if (await objectExists(chunkKey(fileId, i))) uploaded++;
    }

    if (uploaded < file.total_chunks) {
      res.status(400).json({
        error: `Only ${uploaded}/${file.total_chunks} chunks uploaded`,
      });
      return;
    }

    await pool.query(
      `UPDATE files SET status = 'complete', chunks_uploaded = $1 WHERE id = $2`,
      [uploaded, fileId]
    );

    await logAudit(req, "upload", fileId);
    res.json({ ok: true, file_id: fileId });
  } catch (err: any) {
    console.error("[files/complete]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ── GET /files — list the user's files ──────────────── */

router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth!.userId;
    const search = (req.query.q as string) || "";
    const tag = (req.query.tag as string) || "";

    let query = `
      SELECT f.*, fk.wrapped_key
      FROM files f
      JOIN file_keys fk ON fk.file_id = f.id
      WHERE f.owner_id = $1 AND f.deleted_at IS NULL AND f.status = 'complete'
    `;
    const params: any[] = [userId];

    // ILIKE is case-insensitive LIKE in postgres
    if (search) {
      params.push(`%${search}%`);
      query += ` AND f.name ILIKE $${params.length}`;
    }

    // subquery checks if the file has a tag with this name
    if (tag) {
      params.push(tag);
      query += ` AND EXISTS (
        SELECT 1 FROM file_tags ft JOIN tags t ON t.id = ft.tag_id
        WHERE ft.file_id = f.id AND t.name = $${params.length}
      )`;
    }

    query += ` ORDER BY f.created_at DESC LIMIT 100`;

    const result = await pool.query(query, params);

    // fetch tags for all returned files in one query rather than N+1
    const fileIds = result.rows.map((r: any) => r.id);
    let tagsMap: Record<string, { tag_id: string; tag_name: string; confidence: number }[]> = {};

    if (fileIds.length > 0) {
      const tagsRes = await pool.query(
        `SELECT ft.file_id, t.id as tag_id, t.name as tag_name, ft.confidence
         FROM file_tags ft JOIN tags t ON t.id = ft.tag_id
         WHERE ft.file_id = ANY($1)`,
        [fileIds]
      );
      for (const row of tagsRes.rows) {
        if (!tagsMap[row.file_id]) tagsMap[row.file_id] = [];
        tagsMap[row.file_id].push({
          tag_id: row.tag_id,
          tag_name: row.tag_name,
          confidence: row.confidence,
        });
      }
    }

    const files = result.rows.map((f: any) => ({
      ...f,
      tags: tagsMap[f.id] || [],
    }));

    res.json({ files });
  } catch (err: any) {
    console.error("[files/list]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ── GET /files/:id — single file with metadata ──────── */

router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const fileId = req.params.id;
    const userId = req.auth!.userId;

    const fileRes = await pool.query(
      `SELECT f.*, fk.wrapped_key
       FROM files f
       JOIN file_keys fk ON fk.file_id = f.id
       WHERE f.id = $1 AND f.owner_id = $2 AND f.deleted_at IS NULL`,
      [fileId, userId]
    );
    if (fileRes.rows.length === 0) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const file = fileRes.rows[0];

    const tagsRes = await pool.query(
      `SELECT t.id as tag_id, t.name as tag_name, ft.confidence
       FROM file_tags ft JOIN tags t ON t.id = ft.tag_id
       WHERE ft.file_id = $1`,
      [fileId]
    );

    res.json({ file: { ...file, tags: tagsRes.rows } });
  } catch (err: any) {
    console.error("[files/get]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ── GET /files/:id/download — presigned URLs for each chunk */

router.get("/:id/download", requireAuth, async (req: Request, res: Response) => {
  try {
    const fileId = req.params.id;
    const userId = req.auth!.userId;

    const fileRes = await pool.query(
      `SELECT f.*, fk.wrapped_key
       FROM files f
       JOIN file_keys fk ON fk.file_id = f.id
       WHERE f.id = $1 AND f.owner_id = $2 AND f.deleted_at IS NULL AND f.status = 'complete'`,
      [fileId, userId]
    );
    if (fileRes.rows.length === 0) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const file = fileRes.rows[0];
    const download_urls: { index: number; url: string }[] = [];

    for (let i = 0; i < file.total_chunks; i++) {
      const url = await presignedGet(chunkKey(fileId, i));
      download_urls.push({ index: i, url });
    }

    await logAudit(req, "download", fileId);

    res.json({
      file,
      wrapped_key: file.wrapped_key,
      download_urls,
    });
  } catch (err: any) {
    console.error("[files/download]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ── DELETE /files/:id — soft delete ─────────────────── */

router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const fileId = req.params.id;
    const userId = req.auth!.userId;

    // soft delete sets deleted_at rather than removing the row — keeps audit history intact
    const result = await pool.query(
      `UPDATE files SET deleted_at = now()
       WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [fileId, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    res.json({ ok: true });
  } catch (err: any) {
    console.error("[files/delete]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
