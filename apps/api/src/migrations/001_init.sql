-- 001_init.sql — database schema: creates all tables, foreign keys, and indexes for users, files, keys, shares, tags, and audit log
-- VaultX schema (idempotent)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  totp_secret VARCHAR(255),
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS keys (
  user_id        UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  wrapped_umk    TEXT NOT NULL,
  kdf_salt       TEXT NOT NULL,
  kdf_iterations INT  NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS files (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  object_key      VARCHAR(512) NOT NULL,
  size            BIGINT NOT NULL,
  mime            VARCHAR(255) NOT NULL DEFAULT 'application/octet-stream',
  total_chunks    INT NOT NULL DEFAULT 1,
  chunks_uploaded INT NOT NULL DEFAULT 0,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  version         INT NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS file_keys (
  file_id     UUID PRIMARY KEY REFERENCES files(id) ON DELETE CASCADE,
  wrapped_key TEXT NOT NULL,
  algo        VARCHAR(50) NOT NULL DEFAULT 'AES-GCM-256',
  meta_json   JSONB
);

CREATE TABLE IF NOT EXISTS shares (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id               UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  created_by            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role                  VARCHAR(20) NOT NULL DEFAULT 'viewer',
  link_token_hash       VARCHAR(64) NOT NULL UNIQUE,
  wrapped_key_for_share TEXT NOT NULL,
  expires_at            TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  disabled_at           TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS tags (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS file_tags (
  file_id    UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  tag_id     UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  confidence REAL NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (file_id, tag_id)
);

CREATE TABLE IF NOT EXISTS audit (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  action     VARCHAR(50) NOT NULL,
  file_id    UUID,
  ip         VARCHAR(45),
  user_agent TEXT,
  ts         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_files_owner   ON files(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_files_status  ON files(status);
CREATE INDEX IF NOT EXISTS idx_shares_file   ON shares(file_id);
CREATE INDEX IF NOT EXISTS idx_shares_token  ON shares(link_token_hash);
CREATE INDEX IF NOT EXISTS idx_audit_user    ON audit(user_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_file_tags_file ON file_tags(file_id);

-- added display name support for account page
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(100);

-- 2FA flag — set to true once the user has scanned the QR code and verified their first code
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT false;

-- added user preferences: default share expiry and auto logout timeout
ALTER TABLE users ADD COLUMN IF NOT EXISTS default_share_expiry_days INT NOT NULL DEFAULT 7;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auto_logout_minutes INT NOT NULL DEFAULT 30;

-- tracks which share links a logged-in user has accessed (for the "Shared With Me" view)
CREATE TABLE IF NOT EXISTS share_accesses (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  share_id              UUID NOT NULL REFERENCES shares(id) ON DELETE CASCADE,
  file_name_snapshot    VARCHAR(255) NOT NULL,
  sharer_email_snapshot VARCHAR(255) NOT NULL,
  accessed_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, share_id)
);

CREATE INDEX IF NOT EXISTS idx_share_accesses_user ON share_accesses(user_id, accessed_at DESC);
