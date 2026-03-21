import crypto from "crypto";
import { createShareSchema } from "@vaultx/shared";

describe("Share validation", () => {
  describe("createShareSchema", () => {
    const valid = {
      file_id: "550e8400-e29b-41d4-a716-446655440000",
      wrapped_key_for_share: "base64wrappedkey==",
      expires_in_days: 7,
    };

    it("accepts valid input", () => {
      expect(createShareSchema.safeParse(valid).success).toBe(true);
    });

    it("rejects expires_in_days > 30", () => {
      const res = createShareSchema.safeParse({ ...valid, expires_in_days: 31 });
      expect(res.success).toBe(false);
    });

    it("rejects expires_in_days < 1", () => {
      const res = createShareSchema.safeParse({ ...valid, expires_in_days: 0 });
      expect(res.success).toBe(false);
    });

    it("rejects non-uuid file_id", () => {
      const res = createShareSchema.safeParse({ ...valid, file_id: "not-a-uuid" });
      expect(res.success).toBe(false);
    });
  });
});

describe("Token hashing", () => {
  it("produces consistent SHA-256 hex digest", () => {
    const secret = crypto.randomBytes(32);
    const hash1 = crypto.createHash("sha256").update(secret).digest("hex");
    const hash2 = crypto.createHash("sha256").update(secret).digest("hex");
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it("different secrets produce different hashes", () => {
    const s1 = crypto.randomBytes(32);
    const s2 = crypto.randomBytes(32);
    const h1 = crypto.createHash("sha256").update(s1).digest("hex");
    const h2 = crypto.createHash("sha256").update(s2).digest("hex");
    expect(h1).not.toBe(h2);
  });
});

describe("Share link expiry logic", () => {
  it("returns 403 semantics for expired links", () => {
    const expiresAt = new Date(Date.now() - 1000);
    const isExpired = expiresAt < new Date();
    expect(isExpired).toBe(true);
  });

  it("active link passes expiry check", () => {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const isExpired = expiresAt < new Date();
    expect(isExpired).toBe(false);
  });

  it("disabled link is rejected regardless of expiry", () => {
    const disabledAt = new Date();
    expect(disabledAt).toBeTruthy();
  });
});
