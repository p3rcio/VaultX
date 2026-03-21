import { Router, Request, Response } from "express";
import { pool } from "../db";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth!.userId;
    const limit = Math.min(parseInt((req.query.limit as string) || "50", 10), 200);
    const offset = parseInt((req.query.offset as string) || "0", 10);

    const result = await pool.query(
      `SELECT id, user_id, action, file_id, ip, user_agent, ts
       FROM audit
       WHERE user_id = $1
       ORDER BY ts DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.json({ entries: result.rows });
  } catch (err: any) {
    console.error("[audit/list]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
