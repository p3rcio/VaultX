// Zod validation schemas shared between the API and the frontend
// defining the rules once here means both sides stay in sync automatically

import { z } from "zod";

// password must be at least 12 chars with at least 1 special character
// the regex matches anything that isn't a letter or digit
export const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .regex(
    /[^A-Za-z0-9]/,
    "Password must contain at least 1 special character"
  );

export const emailSchema = z
  .string()
  .email("Invalid email address")
  .max(255);

/* ── Auth schemas ─────────────────────────────────────── */

// registration includes the crypto params so the server can return them on login
// the server stores wrapped_umk and kdf_salt but can't do anything useful with them
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  wrapped_umk: z.string().min(1),
  kdf_salt: z.string().min(1),
  kdf_iterations: z.number().int().min(100000), // OWASP minimum for PBKDF2-SHA256
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

/* ── File schemas ─────────────────────────────────────── */

const ONE_GB = 1024 * 1024 * 1024;

export const initUploadSchema = z.object({
  name: z.string().min(1).max(255),
  size: z.number().int().min(1).max(ONE_GB),
  mime: z.string().max(255).default("application/octet-stream"),
  total_chunks: z.number().int().min(1).max(210), // ceil(1GB / 5MB chunk size)
  wrapped_key: z.string().min(1),
});

/* ── Share schemas ────────────────────────────────────── */

export const createShareSchema = z.object({
  file_id: z.string().uuid(),
  wrapped_key_for_share: z.string().min(1),
  expires_in_days: z.number().int().min(1).max(30), // max 30 days, no permanent links
});

/* ── Tag schemas ──────────────────────────────────────── */

export const setTagsSchema = z.object({
  tags: z.array(
    z.object({
      name: z.string().min(1).max(100),
      confidence: z.number().min(0).max(1), // 0 = not confident, 1 = certain
    })
  ),
});
