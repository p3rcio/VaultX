// auth context — holds the logged-in user, the UMK, and exposes login/register/logout
"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { api, setToken, clearToken, getToken } from "./api";
import {
  deriveKEK,
  unwrapUMK,
  storeUMKInSession,
  loadUMKFromSession,
  clearUMKFromSession,
  generateSalt,
  generateUMK,
  wrapUMK,
  toBase64,
  fromBase64,
} from "./crypto";
import type { User, KeyBundle } from "@vaultx/shared";

function getInactivityTimeout(): number {
  try {
    const saved = localStorage.getItem("vaultx_auto_logout_minutes");
    const minutes = saved ? parseInt(saved, 10) : 30;
    return (isNaN(minutes) ? 30 : minutes) * 60 * 1000;
  } catch {
    return 30 * 60 * 1000;
  }
}
const KDF_ITERATIONS = 600_000;

// stored between the two login steps so totpLogin can finish the job
interface PendingTotp {
  pendingToken: string;
  password: string;
}

interface AuthState {
  user: User | null;
  umk: CryptoKey | null;
  loading: boolean;
  // returns { totp_required: true } if the account has 2FA — caller should then show the code input
  login: (email: string, password: string) => Promise<{ totp_required: boolean }>;
  // second step — call after login returns totp_required: true
  totpLogin: (code: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  // call after TOTP setup to swap in the new token that has totp_enabled: true
  refreshToken: (newToken: string) => void;
}

const AuthContext = createContext<AuthState>({
  user: null,
  umk: null,
  loading: true,
  login: async () => ({ totp_required: false }),
  totpLogin: async () => {},
  register: async () => {},
  logout: async () => {},
  refreshToken: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [umk, setUmk] = useState<CryptoKey | null>(null);
  const [loading, setLoading] = useState(true);

  // kept in a ref so it doesn't trigger re-renders — only used for the brief gap between step 1 and step 2
  const pendingTotpRef = useRef<PendingTotp | null>(null);

  /* ── Inactivity timer ─────────────────────────────── */
  useEffect(() => {
    if (!user) return;

    let timer: ReturnType<typeof setTimeout>;

    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        doLogout();
      }, getInactivityTimeout());
    };

    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, reset));
    reset();

    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /* ── Restore session on mount ─────────────────────── */
  useEffect(() => {
    (async () => {
      try {
        const token = getToken();
        if (!token) return;

        const storedUmk = await loadUMKFromSession();
        if (!storedUmk) {
          clearToken();
          return;
        }

        const payload = JSON.parse(atob(token.split(".")[1]));
        setUser({
          id: payload.userId,
          email: payload.email,
          created_at: "",
          totp_enabled: payload.totp_enabled ?? false,
        });
        setUmk(storedUmk);
      } catch {
        clearToken();
        clearUMKFromSession();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ── Register ─────────────────────────────────────── */
  const register = useCallback(async (email: string, password: string) => {
    const salt = generateSalt();
    const kek = await deriveKEK(password, salt, KDF_ITERATIONS);
    const newUmk = await generateUMK();
    const wrappedUmk = await wrapUMK(newUmk, kek);

    const res = await api.register({
      email,
      password,
      wrapped_umk: wrappedUmk,
      kdf_salt: toBase64(salt),
      kdf_iterations: KDF_ITERATIONS,
    });

    setToken(res.token);
    await storeUMKInSession(newUmk);
    setUser(res.user);
    setUmk(newUmk);
  }, []);

  /* ── Login — step 1 ───────────────────────────────── */
  const login = useCallback(async (email: string, password: string): Promise<{ totp_required: boolean }> => {
    const res = await api.login({ email, password });

    // account has 2FA — stash the pending token and password for step 2
    if (res.totp_required) {
      pendingTotpRef.current = { pendingToken: res.pending_token, password };
      return { totp_required: true };
    }

    // no 2FA — finish login right now
    const kb: KeyBundle = res.key_bundle;
    const salt = fromBase64(kb.kdf_salt);
    const kek = await deriveKEK(password, salt, kb.kdf_iterations);
    const recoveredUmk = await unwrapUMK(kb.wrapped_umk, kek);

    setToken(res.token);
    await storeUMKInSession(recoveredUmk);
    setUser(res.user);
    setUmk(recoveredUmk);

    return { totp_required: false };
  }, []);

  /* ── Login — step 2 (TOTP code) ───────────────────── */
  const totpLogin = useCallback(async (code: string) => {
    const pending = pendingTotpRef.current;
    if (!pending) throw new Error("No pending login — call login() first");

    // exchange the pending token + code for a real JWT + key bundle
    const res = await api.totpLogin(pending.pendingToken, code);
    pendingTotpRef.current = null;

    const kb: KeyBundle = res.key_bundle;
    const salt = fromBase64(kb.kdf_salt);
    // re-derive using the password we held onto from step 1
    const kek = await deriveKEK(pending.password, salt, kb.kdf_iterations);
    const recoveredUmk = await unwrapUMK(kb.wrapped_umk, kek);

    setToken(res.token);
    await storeUMKInSession(recoveredUmk);
    setUser(res.user);
    setUmk(recoveredUmk);
  }, []);

  /* ── Refresh token (called after TOTP setup) ──────── */
  // the activation endpoint returns a new JWT with totp_enabled: true — swap it in
  const refreshToken = useCallback((newToken: string) => {
    setToken(newToken);
    try {
      const payload = JSON.parse(atob(newToken.split(".")[1]));
      setUser((prev) =>
        prev ? { ...prev, totp_enabled: payload.totp_enabled ?? true } : prev
      );
    } catch {
      // malformed token — just ignore the user update
    }
  }, []);

  /* ── Logout ───────────────────────────────────────── */
  const doLogout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    }
    pendingTotpRef.current = null;
    clearToken();
    clearUMKFromSession();
    setUser(null);
    setUmk(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, umk, loading, login, totpLogin, register, logout: doLogout, refreshToken }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
