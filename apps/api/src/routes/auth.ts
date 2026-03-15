// register, login, logout, and TOTP setup/activation/login
import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
// otplib v13 has a different API — no more authenticator object, functions are standalone
import { generateSecret, generate as totpGenerate, verify as totpVerify, generateURI } from "otplib";
import QRCode from "qrcode";
import { registerSchema, loginSchema } from "@vaultx/shared";
import { pool } from "../db";
import { config } from "../config";
import { requireAuth, AuthPayload } from "../middleware/auth";
import { authLimiter } from "../middleware/rateLimit";
import { logAudit } from "../middleware/audit";

const router = Router();

const BCRYPT_ROUNDS = 12;
const JWT_EXPIRY = "24h";
// pending tokens are short-lived — 5 minutes is plenty of time to grab your phone
const TOTP_PENDING_EXPIRY = "5m";

// lockout doubles after each block of 5 failed attempts
function lockoutDuration(failedAttempts: number): number {
  if (failedAttempts < 5) return 0;
  const tier = Math.floor(failedAttempts / 5);
  return Math.pow(2, tier - 1) * 60 * 1000;
}

// helper so we don't repeat the JWT signing config everywhere
function signFullToken(userId: string, email: string, totpEnabled: boolean): string {
  return jwt.sign(
    { userId, email, totp_enabled: totpEnabled } as AuthPayload,
    config.jwtSecret,
    { expiresIn: JWT_EXPIRY }
  );
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

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const userRes = await pool.query(
      `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
      [email, passwordHash]
    );
    const userId = userRes.rows[0].id;

    await pool.query(
      `INSERT INTO keys (user_id, wrapped_umk, kdf_salt, kdf_iterations) VALUES ($1, $2, $3, $4)`,
      [userId, wrapped_umk, kdf_salt, kdf_iterations]
    );

    await logAudit(req, "register");

    // totp_enabled is false until they complete setup — JWT carries this so the frontend knows
    const token = signFullToken(userId, email, false);

    res.status(201).json({
      token,
      user: { id: userId, email, created_at: new Date().toISOString(), totp_enabled: false },
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
              u.totp_secret, u.totp_enabled,
              k.wrapped_umk, k.kdf_salt, k.kdf_iterations
       FROM users u
       LEFT JOIN keys k ON k.user_id = u.id
       WHERE u.email = $1`,
      [email]
    );

    if (userRes.rows.length === 0) {
      await logAudit(req, "login_failed");
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const user = userRes.rows[0];

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const remaining = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 1000);
      await logAudit(req, "login_failed");
      res.status(429).json({ error: `Account locked. Try again in ${remaining} seconds` });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      const newFailed = user.failed_attempts + 1;
      const lockMs = lockoutDuration(newFailed);
      const lockedUntil = lockMs > 0 ? new Date(Date.now() + lockMs) : null;
      await pool.query(
        `UPDATE users SET failed_attempts = $1, locked_until = $2 WHERE id = $3`,
        [newFailed, lockedUntil, user.id]
      );
      await logAudit(req, "login_failed");
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    await pool.query(`UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = $1`, [user.id]);

    // password is correct — check if TOTP is required before issuing a full token
    if (user.totp_enabled) {
      // return a short-lived pending token — the client exchanges it + a TOTP code for a real JWT
      const pendingToken = jwt.sign(
        { type: "totp_pending", userId: user.id, email },
        config.jwtSecret,
        { expiresIn: TOTP_PENDING_EXPIRY }
      );
      res.json({ totp_required: true, pending_token: pendingToken });
      return;
    }

    // no 2FA yet — issue the full token (frontend will redirect to setup)
    await logAudit(req, "login");
    const token = signFullToken(user.id, email, false);

    res.json({
      token,
      user: { id: user.id, email, created_at: user.created_at, totp_enabled: false },
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

/* ── POST /auth/totp/login — exchange pending token + code for a full JWT ── */

router.post("/totp/login", authLimiter, async (req: Request, res: Response) => {
  try {
    const { pending_token, code } = req.body;
    if (!pending_token || !code) {
      res.status(400).json({ error: "pending_token and code are required" });
      return;
    }

    // verify the pending token — it must be signed by us and have the right type
    let payload: any;
    try {
      payload = jwt.verify(pending_token, config.jwtSecret);
    } catch {
      res.status(401).json({ error: "Invalid or expired session. Please log in again." });
      return;
    }

    if (payload.type !== "totp_pending") {
      res.status(401).json({ error: "Invalid token type" });
      return;
    }

    const userRes = await pool.query(
      `SELECT u.id, u.email, u.totp_secret, u.created_at,
              k.wrapped_umk, k.kdf_salt, k.kdf_iterations
       FROM users u
       LEFT JOIN keys k ON k.user_id = u.id
       WHERE u.id = $1 AND u.totp_enabled = true`,
      [payload.userId]
    );

    if (userRes.rows.length === 0) {
      res.status(401).json({ error: "Invalid or expired session. Please log in again." });
      return;
    }

    const user = userRes.rows[0];

    const result = await totpVerify({ token: String(code).trim(), secret: user.totp_secret });
    if (!result.valid) {
      await logAudit(req, "login_failed");
      res.status(401).json({ error: "Invalid authentication code" });
      return;
    }

    await logAudit(req, "login");
    const token = signFullToken(user.id, user.email, true);

    res.json({
      token,
      user: { id: user.id, email: user.email, created_at: user.created_at, totp_enabled: true },
      key_bundle: {
        wrapped_umk: user.wrapped_umk,
        kdf_salt: user.kdf_salt,
        kdf_iterations: user.kdf_iterations,
      },
    });
  } catch (err: any) {
    console.error("[auth/totp/login]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ── GET /auth/totp/setup — generate a secret and return a QR code ────── */

router.get("/totp/setup", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth!.userId;

    const userRes = await pool.query(
      `SELECT email, totp_enabled FROM users WHERE id = $1`,
      [userId]
    );

    if (userRes.rows[0]?.totp_enabled) {
      res.status(409).json({ error: "2FA is already enabled" });
      return;
    }

    // generate a fresh secret every time setup is called — fine since it's not activated yet
    const secret = generateSecret();
    const email = userRes.rows[0].email;
    // label is the per-account identifier shown in the app, issuer is the service name
    const otpauthUri = generateURI({ type: "totp", label: email, issuer: "VaultX", secret });

    // generate the QR code as a base64 PNG so the frontend can just drop it in an <img>
    const qrDataUrl = await QRCode.toDataURL(otpauthUri);

    // store the secret immediately — it gets confirmed when /totp/activate is called
    await pool.query(`UPDATE users SET totp_secret = $1 WHERE id = $2`, [secret, userId]);

    res.json({ qr_data_url: qrDataUrl, secret, otpauth_uri: otpauthUri });
  } catch (err: any) {
    console.error("[auth/totp/setup]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ── POST /auth/totp/activate — verify the first code and turn 2FA on ─── */

router.post("/totp/activate", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth!.userId;
    const { code } = req.body;

    if (!code) {
      res.status(400).json({ error: "code is required" });
      return;
    }

    const userRes = await pool.query(
      `SELECT email, totp_secret, totp_enabled FROM users WHERE id = $1`,
      [userId]
    );
    const user = userRes.rows[0];

    if (user.totp_enabled) {
      res.status(409).json({ error: "2FA is already enabled" });
      return;
    }

    if (!user.totp_secret) {
      res.status(400).json({ error: "Run setup first" });
      return;
    }

    const result = await totpVerify({ token: String(code).trim(), secret: user.totp_secret });
    if (!result.valid) {
      res.status(401).json({ error: "Invalid code — make sure your authenticator app is synced" });
      return;
    }

    await pool.query(`UPDATE users SET totp_enabled = true WHERE id = $1`, [userId]);
    await logAudit(req, "2fa_enabled");

    // issue a fresh JWT with totp_enabled: true so the frontend state updates immediately
    const token = signFullToken(userId, user.email, true);

    res.json({ ok: true, token });
  } catch (err: any) {
    console.error("[auth/totp/activate]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ── POST /auth/logout ───────────────────────────────── */

router.post("/logout", requireAuth, async (req: Request, res: Response) => {
  await logAudit(req, "logout");
  res.json({ ok: true });
});

export default router;
