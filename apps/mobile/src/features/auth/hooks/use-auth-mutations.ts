import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  type AuthSession,
  type LoginRequest,
  type RegisterRequest,
  type RosterCheckRequest,
  type RosterCheckResponse,
} from '@ennel/shared';
import { type ApiError } from '@/shared/api-client/api-error';
import { useSessionStore } from '@/shared/store/session.store';
import { readRefreshToken } from '@/shared/store/token-storage';
import { checkRoster, loginStudent, logoutStudent, registerStudent } from '../api/auth-api';

export function useRosterCheck() {
  return useMutation<RosterCheckResponse, ApiError, RosterCheckRequest>({
    mutationFn: checkRoster,
  });
}

export function useRegister() {
  const setSession = useSessionStore((state) => state.setSession);
  return useMutation<AuthSession, ApiError, RegisterRequest>({
    mutationFn: registerStudent,
    onSuccess: setSession,
  });
}

export function useLogin() {
  const setSession = useSessionStore((state) => state.setSession);
  return useMutation<AuthSession, ApiError, LoginRequest>({
    mutationFn: loginStudent,
    onSuccess: setSession,
  });
}

/** Spec §9 Logout. The local session ends even if the server cannot be reached. */
export function useLogout() {
  const signOut = useSessionStore((state) => state.signOut);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const refreshToken = await readRefreshToken();
      if (refreshToken) await logoutStudent(refreshToken).catch(() => undefined);
    },
    onSettled: async () => {
      queryClient.clear();
      await signOut();
    },
  });
}
