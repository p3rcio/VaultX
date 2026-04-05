import path from "path";
import fs from "fs";

function env(key: string, fallback?: string): string {
  const v = process.env[key] ?? fallback;
  if (v === undefined) throw new Error(`Missing env var: ${key}`);
  return v;
}

const envPath = path.resolve(__dirname, "../../../.env");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

export const config = {
  port: parseInt(env("API_PORT", "4000"), 10),
  databaseUrl: env("DATABASE_URL", "postgresql://vaultx:vaultx_secret@localhost:5432/vaultx"),
  jwtSecret: env("JWT_SECRET", "dev-jwt-secret"),
  corsOrigin: env("CORS_ORIGIN", "http://localhost:3000"),

  minio: {
    endpoint: env("MINIO_ENDPOINT", "localhost"),
    port: parseInt(env("MINIO_PORT", "9000"), 10),
    accessKey: env("MINIO_ACCESS_KEY", "minioadmin"),
    secretKey: env("MINIO_SECRET_KEY", "minioadmin"),
    bucket: env("MINIO_BUCKET", "vaultx-files"),
    useSSL: env("MINIO_USE_SSL", "false") === "true",
  },
};
