import { type PermissionKey, type StaffMe, type StaffSession } from '@ennel/shared';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { configureSession, refreshOnce, setAccessToken } from '@/shared/api-client/api-client';
import { getMe, logout as logoutRequest } from './api/auth-api';

type AuthStatus = 'restoring' | 'signedOut' | 'signedIn';

interface AuthContextValue {
  status: AuthStatus;
  me: StaffMe | null;
  permissions: ReadonlySet<PermissionKey>;
  /** Called after login, TOTP verification or password change. */
  startSession: (session: StaffSession) => Promise<void>;
  signOut: () => Promise<void>;
  reloadMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Staff session state: restores from the refresh cookie on load and loads /auth/me. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>('restoring');
  const [me, setMe] = useState<StaffMe | null>(null);

  const clear = useCallback(() => {
    setAccessToken(null);
    setMe(null);
    setStatus('signedOut');
    queryClient.clear();
  }, [queryClient]);

  const reloadMe = useCallback(async () => {
    setMe(await getMe());
    setStatus('signedIn');
  }, []);

  const startSession = useCallback(
    async (session: StaffSession) => {
      setAccessToken(session.accessToken);
      await reloadMe();
    },
    [reloadMe],
  );

  const signOut = useCallback(async () => {
    await logoutRequest().catch(() => undefined);
    clear();
  }, [clear]);

  useEffect(() => {
    configureSession({ onSession: () => undefined, onSignedOut: clear });
    refreshOnce()
      .then((session) => (session ? reloadMe() : clear()))
      .catch(clear);
  }, [clear, reloadMe]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      me,
      permissions: new Set(me?.permissions ?? []),
      startSession,
      signOut,
      reloadMe,
    }),
    [status, me, startSession, signOut, reloadMe],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

/** True when the signed-in staff member holds every listed permission. */
export function usePermissions(): (...keys: PermissionKey[]) => boolean {
  const { permissions } = useAuth();
  return useCallback(
    (...keys: PermissionKey[]) => keys.every((key) => permissions.has(key)),
    [permissions],
  );
}
