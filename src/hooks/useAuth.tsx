/**
 * useAuth — authentication context
 * PUSH-LINK-001 (2026-06-11): OneSignal login/logout wired to auth lifecycle
 *   so the server can target push notifications to specific users by externalId.
 *
 * LILCKY STUDIO LIMITED
 */
import React, {
  createContext, useCallback, useContext,
  useEffect, useRef, useState, type ReactNode,
} from 'react';
import { ENDPOINTS } from '@/constants/api';
import { clearAll, getToken, getStoredUser, setToken, setStoredUser } from '@/lib/storage';
import { apiFetch } from '@/lib/api-client';

export type LoopUser = {
  id: string;
  phone: string | null;
  email: string | null;
};

export type LoopProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_verified: boolean;
  is_creator: boolean;
  onboarded: boolean;
  state_id: string | null;
  country_id: string | null;
  followers_count: number;
  following_count: number;
};

type AuthState = {
  user: LoopUser | null;
  profile: LoopProfile | null;
  loading: boolean;
  signInWithOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, otp: string) => Promise<{ isNewUser: boolean }>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<LoopProfile>) => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

// ── OneSignal helpers ────────────────────────────────────────────────────────
// Lazy-require so the module error is contained when the native module
// isn't linked (Expo Go managed workflow, unit tests, etc.).

function getOneSignal(): { login(externalId: string): void; logout(): void } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { OneSignal } = require('react-native-onesignal');
    return OneSignal as { login(externalId: string): void; logout(): void };
  } catch {
    return null;
  }
}

/**
 * PUSH-LINK-001: Tell OneSignal which user is logged in.
 * Called after successful OTP verification and on session restore.
 * Without this, OneSignal can't match the device to externalIds in
 * the server's notification targeting payload.
 */
function oneSignalLogin(userId: string) {
  try { getOneSignal()?.login(userId); } catch { /* non-fatal */ }
}

/** Called on sign-out so the device stops receiving this user's notifications. */
function oneSignalLogout() {
  try { getOneSignal()?.logout(); } catch { /* non-fatal */ }
}

// ── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LoopUser | null>(null);
  const [profile, setProfile] = useState<LoopProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Boot: restore session from SecureStore ────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [token, stored] = await Promise.all([getToken(), getStoredUser()]);
        if (token && stored) {
          const u = stored as LoopUser;
          setUser(u);
          await fetchProfile(token);
          // PUSH-LINK-001: re-link OneSignal on every app boot so the
          // device stays associated even after app updates or reinstalls.
          oneSignalLogin(u.id);
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => { if (refreshTimer.current) clearTimeout(refreshTimer.current); };
  }, []);

  async function fetchProfile(token: string) {
    try {
      const res = await apiFetch(ENDPOINTS.profile.me, { method: 'GET' });
      if (!res.ok) return;
      const data = await res.json() as { profile?: LoopProfile };
      if (data.profile) setProfile(data.profile);
    } catch { /* silent */ }
  }

  const signInWithOtp = useCallback(async (phone: string) => {
    const res = await apiFetch(ENDPOINTS.auth.sendOtp, {
      method: 'POST',
      body: JSON.stringify({ phone }),
      skipAuth: true,
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({})) as any;
      throw new Error(d.error ?? 'Failed to send OTP');
    }
  }, []);

  const verifyOtp = useCallback(async (phone: string, otp: string): Promise<{ isNewUser: boolean }> => {
    const res = await apiFetch(ENDPOINTS.auth.verifyOtp, {
      method: 'POST',
      body: JSON.stringify({ phone, otp }),
      skipAuth: true,
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({})) as any;
      throw new Error(d.error ?? 'Invalid OTP');
    }
    const data = await res.json() as {
      access_token: string;
      user: LoopUser;
      is_new_user?: boolean;
    };
    await setToken(data.access_token);
    await setStoredUser(data.user as unknown as Record<string, unknown>);
    setUser(data.user);
    await fetchProfile(data.access_token);
    // PUSH-LINK-001: link OneSignal device to this user immediately after login
    oneSignalLogin(data.user.id);
    return { isNewUser: data.is_new_user ?? false };
  }, []);

  const refreshProfile = useCallback(async () => {
    const token = await getToken();
    if (token) await fetchProfile(token);
  }, []);

  const updateProfile = useCallback(async (data: Partial<LoopProfile>) => {
    const res = await apiFetch(ENDPOINTS.profile.update, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({})) as any;
      throw new Error(d.error ?? 'Failed to update profile');
    }
    await refreshProfile();
  }, [refreshProfile]);

  const signOut = useCallback(async () => {
    try {
      await apiFetch(ENDPOINTS.auth.signout, { method: 'POST' });
    } catch { /* best-effort */ }
    // PUSH-LINK-001: unlink device so this user stops receiving push on sign-out
    oneSignalLogout();
    await clearAll();
    setUser(null);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      signInWithOtp, verifyOtp, refreshProfile, signOut, updateProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
