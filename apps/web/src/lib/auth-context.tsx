// auth context — holds the logged-in user, the UMK, and exposes login/register/logout
"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
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

// reads the user's saved preference, falling back to 30 minutes
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

interface AuthState {
  user: User | null;
  umk: CryptoKey | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  umk: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [umk, setUmk] = useState<CryptoKey | null>(null);
  const [loading, setLoading] = useState(true);

  /* ── Inactivity timer ─────────────────────────────── */
  useEffect(() => {
    if (!user) return;

    let timer: ReturnType<typeof setTimeout>;

    // resets the countdown every time the user interacts with the page
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        doLogout();
      }, getInactivityTimeout());
    };

    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, reset));
    reset(); // start the timer immediately

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

        // both the JWT and the UMK must be present to restore the session
        const storedUmk = await loadUMKFromSession();
        if (!storedUmk) {
          clearToken();
          return;
        }

        // JWTs are header.payload.signature — decode the middle part to get user info
        // signature verification happens server-side on every API call
        const payload = JSON.parse(atob(token.split(".")[1]));
        setUser({ id: payload.userId, email: payload.email, created_at: "" });
        setUmk(storedUmk);
      } catch {
        // something went wrong restoring state — start fresh
        clearToken();
        clearUMKFromSession();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ── Register ─────────────────────────────────────── */
  const register = useCallback(async (email: string, password: string) => {
    // all crypto runs in the browser — server never sees the KEK or the raw UMK
    const salt = generateSalt();
    const kek = await deriveKEK(password, salt, KDF_ITERATIONS);
    const newUmk = await generateUMK();
    const wrappedUmk = await wrapUMK(newUmk, kek);

    // server only receives: email, bcryptjs hash of password, wrapped UMK, and KDF params
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

  /* ── Login ────────────────────────────────────────── */
  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login({ email, password });
    const kb: KeyBundle = res.key_bundle;

    // re-derive the KEK from the password using the stored salt and iteration count
    const salt = fromBase64(kb.kdf_salt);
    const kek = await deriveKEK(password, salt, kb.kdf_iterations);
    // wrong password → wrong KEK → unwrapKey throws
    const recoveredUmk = await unwrapUMK(kb.wrapped_umk, kek);

    setToken(res.token);
    await storeUMKInSession(recoveredUmk);
    setUser(res.user);
    setUmk(recoveredUmk);
  }, []);

  /* ── Logout ───────────────────────────────────────── */
  const doLogout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // ignore — token may already be expired or invalid
    }
    clearToken();
    clearUMKFromSession();
    setUser(null);
    setUmk(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, umk, loading, login, register, logout: doLogout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
