import { registerSchema, loginSchema } from "@vaultx/shared";

describe("Auth validation", () => {
  describe("registerSchema", () => {
    const valid = {
      email: "alice@example.com",
      password: "SuperSecret!123",
      wrapped_umk: "base64wrappedkey==",
      kdf_salt: "base64salt==",
      kdf_iterations: 600000,
    };

    it("accepts valid input", () => {
      expect(registerSchema.safeParse(valid).success).toBe(true);
    });

    it("rejects password shorter than 12 chars", () => {
      const res = registerSchema.safeParse({ ...valid, password: "Short!1" });
      expect(res.success).toBe(false);
    });

    it("rejects password without special character", () => {
      const res = registerSchema.safeParse({
        ...valid,
        password: "NoSpecialChars123",
      });
      expect(res.success).toBe(false);
    });

    it("rejects invalid email", () => {
      const res = registerSchema.safeParse({ ...valid, email: "not-an-email" });
      expect(res.success).toBe(false);
    });

    it("rejects missing wrapped_umk", () => {
      const res = registerSchema.safeParse({ ...valid, wrapped_umk: "" });
      expect(res.success).toBe(false);
    });

    it("rejects kdf_iterations below 100000", () => {
      const res = registerSchema.safeParse({ ...valid, kdf_iterations: 1000 });
      expect(res.success).toBe(false);
    });
  });

  describe("loginSchema", () => {
    it("accepts valid input", () => {
      const res = loginSchema.safeParse({
        email: "alice@example.com",
        password: "anything",
      });
      expect(res.success).toBe(true);
    });

    it("rejects empty password", () => {
      const res = loginSchema.safeParse({
        email: "alice@example.com",
        password: "",
      });
      expect(res.success).toBe(false);
    });
  });
});

describe("Lockout duration calculation", () => {
  function lockoutDuration(failedAttempts: number): number {
    if (failedAttempts < 5) return 0;
    const tier = Math.floor(failedAttempts / 5);
    return Math.pow(2, tier - 1) * 60 * 1000;
  }

  it("no lockout for < 5 failures", () => {
    expect(lockoutDuration(0)).toBe(0);
    expect(lockoutDuration(4)).toBe(0);
  });

  it("1 minute lockout at 5 failures", () => {
    expect(lockoutDuration(5)).toBe(60000);
  });

  it("2 minute lockout at 10 failures", () => {
    expect(lockoutDuration(10)).toBe(120000);
  });

  it("4 minute lockout at 15 failures", () => {
    expect(lockoutDuration(15)).toBe(240000);
  });

  it("doubles each tier", () => {
    expect(lockoutDuration(20)).toBe(480000);
  });
});
