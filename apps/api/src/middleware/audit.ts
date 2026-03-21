import { Request } from "express";
import { pool } from "../db";

export async function logAudit(
  req: Request,
  action: string,
  fileId?: string | null
): Promise<void> {
  const userId = req.auth?.userId ?? null;
  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
    req.socket.remoteAddress ??
    "unknown";
  const ua = req.headers["user-agent"] ?? "unknown";

  try {
    await pool.query(
      `INSERT INTO audit (user_id, action, file_id, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, action, fileId ?? null, ip, ua]
    );
  } catch (err) {
    console.error("[audit] failed to write entry:", err);
  }
}
