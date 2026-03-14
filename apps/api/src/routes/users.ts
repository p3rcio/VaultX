// user account management — profile, display name, password change, and account deletion
import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../db";
import { requireAuth } from "../middleware/auth";
import { logAudit } from "../middleware/audit";
import { listObjects, deleteObject } from "../s3";

const router = Router();

const BCRYPT_ROUNDS = 12;

/* ── GET /users/me ───────────────────────────────────── */

router.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth!.userId;
    const result = await pool.query(
      `SELECT id, email, display_name, created_at FROM users WHERE id = $1`,
      [userId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ user: result.rows[0] });
  } catch (err: any) {
    console.error("[users/me]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ── PATCH /users/me — update display name ───────────── */

router.patch("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth!.userId;
    const { display_name } = req.body;

    // allow empty string to clear the display name
    if (typeof display_name !== "string" || display_name.trim().length > 100) {
      res.status(400).json({ error: "Display name must be 100 characters or fewer" });
      return;
    }

    const result = await pool.query(
      `UPDATE users SET display_name = $1 WHERE id = $2
       RETURNING id, email, display_name, created_at`,
      [display_name.trim() || null, userId]
    );
    res.json({ user: result.rows[0] });
  } catch (err: any) {
    console.error("[users/patch]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ── POST /users/me/change-password ──────────────────── */

router.post("/me/change-password", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth!.userId;
    const { current_password, new_password, new_wrapped_umk, new_kdf_salt, new_kdf_iterations } = req.body;

    if (!current_password || !new_password || !new_wrapped_umk || !new_kdf_salt || !new_kdf_iterations) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    if (typeof new_password !== "string" || new_password.length < 12) {
      res.status(400).json({ error: "New password must be at least 12 characters" });
      return;
    }

    const userRes = await pool.query(
      `SELECT password_hash FROM users WHERE id = $1`,
      [userId]
    );
    if (userRes.rows.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // verify the current password before allowing the key re-wrap
    const valid = await bcrypt.compare(current_password, userRes.rows[0].password_hash);
    if (!valid) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }

    const newHash = await bcrypt.hash(new_password, BCRYPT_ROUNDS);

    // update both the password hash and the UMK wrapped with the new KEK
    await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [newHash, userId]);
    await pool.query(
      `UPDATE keys SET wrapped_umk = $1, kdf_salt = $2, kdf_iterations = $3 WHERE user_id = $4`,
      [new_wrapped_umk, new_kdf_salt, new_kdf_iterations, userId]
    );

    await logAudit(req, "password_changed");
    res.json({ ok: true });
  } catch (err: any) {
    console.error("[users/change-password]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ── DELETE /users/me — permanent account deletion ───── */

router.delete("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth!.userId;

    // get every file so its S3 chunks can be deleted
    const filesRes = await pool.query(
      `SELECT id FROM files WHERE owner_id = $1`,
      [userId]
    );

    // delete all chunks from S3 for every file — each file's chunks live under "fileId/chunk_xxxxx"
    for (const file of filesRes.rows) {
      const keys = await listObjects(file.id);
      for (const key of keys) {
        await deleteObject(key);
      }
    }

    // deleting the user cascades to: keys, files, file_keys, file_tags, shares
    // audit rows have ON DELETE SET NULL so history stays but is anonymised
    await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);

    await logAudit(req, "account_deleted");
    res.json({ ok: true });
  } catch (err: any) {
    console.error("[users/delete]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
