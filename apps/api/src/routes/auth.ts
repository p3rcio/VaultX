// register, login, and logout — bcryptjs for password hashing, JWT on success
import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { registerSchema, loginSchema } from "@vaultx/shared";
import { pool } from "../db";
import { config } from "../config";
import { requireAuth, AuthPayload } from "../middleware/auth";
import { authLimiter } from "../middleware/rateLimit";
import { logAudit } from "../middleware/audit";

const router = Router();

const BCRYPT_ROUNDS = 12; // cost factor 12 is roughly 300ms per hash — slow enough to deter brute force
const JWT_EXPIRY = "24h"; // token valid for 24h, but the client auto-logs out after 30 min inactivity

// lockout doubles after each block of 5 failed attempts
// 5 fails = 1 min, 10 = 2 min, 15 = 4 min, etc.
function lockoutDuration(failedAttempts: number): number {
  if (failedAttempts < 5) return 0;
  const tier = Math.floor(failedAttempts / 5);
  return Math.pow(2, tier - 1) * 60 * 1000; // 2^(tier-1) minutes in ms
}

/* ── POST /auth/register ─────────────────────────────── */

router.post("/register", authLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const { email, password, wrapped_umk, kdf_salt, kdf_iterations } = parsed.data;

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    // never store plaintext passwords
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const userRes = await pool.query(
      `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
      [email, passwordHash]
    );
    const userId = userRes.rows[0].id;

    // store the wrapped UMK and KDF params — server can't use them without the user's password
    await pool.query(
      `INSERT INTO keys (user_id, wrapped_umk, kdf_salt, kdf_iterations)
       VALUES ($1, $2, $3, $4)`,
      [userId, wrapped_umk, kdf_salt, kdf_iterations]
    );

    await logAudit(req, "register");

    const token = jwt.sign(
      { userId, email } as AuthPayload,
      config.jwtSecret,
      { expiresIn: JWT_EXPIRY }
    );

    res.status(201).json({
      token,
      user: { id: userId, email, created_at: new Date().toISOString() },
      key_bundle: { wrapped_umk, kdf_salt, kdf_iterations },
    });
  } catch (err: any) {
    console.error("[auth/register]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ── POST /auth/login ────────────────────────────────── */

router.post("/login", authLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const { email, password } = parsed.data;

    const userRes = await pool.query(
      `SELECT u.id, u.email, u.password_hash, u.failed_attempts, u.locked_until,
              k.wrapped_umk, k.kdf_salt, k.kdf_iterations
       FROM users u
       LEFT JOIN keys k ON k.user_id = u.id
       WHERE u.email = $1`,
      [email]
    );

    // same error for wrong email or wrong password — don't reveal which one failed
    if (userRes.rows.length === 0) {
      await logAudit(req, "login_failed");
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const user = userRes.rows[0];

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const remaining = Math.ceil(
        (new Date(user.locked_until).getTime() - Date.now()) / 1000
      );
      await logAudit(req, "login_failed");
      res.status(429).json({
        error: `Account locked. Try again in ${remaining} seconds`,
      });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      const newFailed = user.failed_attempts + 1;
      const lockMs = lockoutDuration(newFailed); // 0 if not enough failures yet
      const lockedUntil = lockMs > 0 ? new Date(Date.now() + lockMs) : null;

      await pool.query(
        `UPDATE users SET failed_attempts = $1, locked_until = $2 WHERE id = $3`,
        [newFailed, lockedUntil, user.id]
      );

      await logAudit(req, "login_failed");
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    // login succeeded — reset the failure counter
    await pool.query(
      `UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = $1`,
      [user.id]
    );

    const token = jwt.sign(
      { userId: user.id, email } as AuthPayload,
      config.jwtSecret,
      { expiresIn: JWT_EXPIRY }
    );

    await logAudit(req, "login");

    res.json({
      token,
      user: { id: user.id, email, created_at: user.created_at },
      key_bundle: {
        wrapped_umk: user.wrapped_umk,
        kdf_salt: user.kdf_salt,
        kdf_iterations: user.kdf_iterations,
      },
    });
  } catch (err: any) {
    console.error("[auth/login]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ── POST /auth/logout ───────────────────────────────── */

router.post("/logout", requireAuth, async (req: Request, res: Response) => {
  await logAudit(req, "logout");
  res.json({ ok: true });
});

export default router;
