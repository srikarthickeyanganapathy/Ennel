import { type AuthSession } from '@ennel/shared';
import { create } from 'zustand';
import { deleteRefreshToken, writeRefreshToken } from './token-storage';

export type SessionStatus = 'restoring' | 'signedOut' | 'signedIn';

interface SessionState {
  status: SessionStatus;
  accessToken: string | null;
  isOnboardingComplete: boolean;
  /** Stores tokens after login, registration or refresh. */
  setSession: (session: AuthSession) => Promise<void>;
  markOnboardingComplete: () => void;
  signOut: () => Promise<void>;
}

export const useSessionStore = create<SessionState>((set) => ({
  status: 'restoring',
  accessToken: null,
  isOnboardingComplete: false,
  setSession: async (session) => {
    await writeRefreshToken(session.refreshToken);
    set({
      status: 'signedIn',
      accessToken: session.accessToken,
      isOnboardingComplete: session.isOnboardingComplete,
    });
  },
  markOnboardingComplete: () => set({ isOnboardingComplete: true }),
  signOut: async () => {
    await deleteRefreshToken();
    set({ status: 'signedOut', accessToken: null, isOnboardingComplete: false });
  },
}));
