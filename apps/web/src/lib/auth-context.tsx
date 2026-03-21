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

interface PendingTotp {
  pendingToken: string;
  password: string;
}

interface AuthState {
  user: User | null;
  umk: CryptoKey | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ totp_required: boolean }>;
  totpLogin: (code: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
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

  const pendingTotpRef = useRef<PendingTotp | null>(null);

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
  }, [user]);

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

  const login = useCallback(async (email: string, password: string): Promise<{ totp_required: boolean }> => {
    const res = await api.login({ email, password });

    if (res.totp_required) {
      pendingTotpRef.current = { pendingToken: res.pending_token, password };
      return { totp_required: true };
    }

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

  const totpLogin = useCallback(async (code: string) => {
    const pending = pendingTotpRef.current;
    if (!pending) throw new Error("No pending login — call login() first");

    const res = await api.totpLogin(pending.pendingToken, code);
    pendingTotpRef.current = null;

    const kb: KeyBundle = res.key_bundle;
    const salt = fromBase64(kb.kdf_salt);
    const kek = await deriveKEK(pending.password, salt, kb.kdf_iterations);
    const recoveredUmk = await unwrapUMK(kb.wrapped_umk, kek);

    setToken(res.token);
    await storeUMKInSession(recoveredUmk);
    setUser(res.user);
    setUmk(recoveredUmk);
  }, []);

  const refreshToken = useCallback((newToken: string) => {
    setToken(newToken);
    try {
      const payload = JSON.parse(atob(newToken.split(".")[1]));
      setUser((prev) =>
        prev ? { ...prev, totp_enabled: payload.totp_enabled ?? true } : prev
      );
    } catch {
    }
  }, []);

  const doLogout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
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
