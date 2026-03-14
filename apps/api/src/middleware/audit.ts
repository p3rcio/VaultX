// writes a single row to the audit log — called from routes whenever something important happens
import { Request } from "express";
import { pool } from "../db";

export async function logAudit(
  req: Request,
  action: string,
  fileId?: string | null
): Promise<void> {
  // userId is null for unauthenticated actions like share_accessed
  const userId = req.auth?.userId ?? null;
  // x-forwarded-for can hold a comma-separated list when behind a proxy — take the first one
  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
    req.socket.remoteAddress ??
    "unknown";
  const ua = req.headers["user-agent"] ?? "unknown";

  await pool.query(
    `INSERT INTO audit (user_id, action, file_id, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, action, fileId ?? null, ip, ua]
  );
}
