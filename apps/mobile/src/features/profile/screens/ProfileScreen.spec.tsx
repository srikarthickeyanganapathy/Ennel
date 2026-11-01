import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';
import { logoutStudent } from '@/features/auth/api/auth-api';
import { useOnboardingDraft } from '@/features/onboarding/store/onboarding-draft.store';
import { useSessionStore } from '@/shared/store/session.store';
import { writeRefreshToken } from '@/shared/store/token-storage';
import { renderWithProviders } from '@/test-utils/render';
import { ProfileScreen } from './ProfileScreen';

jest.mock('@/features/auth/api/auth-api');
jest.mock('@/features/no-shows/api/no-shows-api');

/** Answers the next confirmation dialog by pressing the button with this label. */
function answerDialogWith(label: string): void {
  jest.spyOn(Alert, 'alert').mockImplementationOnce((_title, _message, buttons?: AlertButton[]) => {
    buttons?.find((button) => button.text === label)?.onPress?.();
  });
}

describe('ProfileScreen logout (Spec §9, §14)', () => {
  beforeEach(async () => {
    jest.mocked(logoutStudent).mockResolvedValue(undefined);
    await writeRefreshToken('refresh-token-value-0123456789');
    useSessionStore.setState({ status: 'signedIn', accessToken: 'token' });
  });

  it('keeps the student signed in when they choose to stay', async () => {
    answerDialogWith('Stay Logged In');
    await renderWithProviders(<ProfileScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Log Out' }));
    expect(logoutStudent).not.toHaveBeenCalled();
    expect(useSessionStore.getState().status).toBe('signedIn');
  });

  it('ends the session after confirmation and clears the unfinished setup draft', async () => {
    useOnboardingDraft.getState().updateProfile({ phone: '9876543210' });
    answerDialogWith('Log Out');
    await renderWithProviders(<ProfileScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Log Out' }));

    await waitFor(() => expect(useSessionStore.getState().status).toBe('signedOut'));
    expect(logoutStudent).toHaveBeenCalledWith('refresh-token-value-0123456789');
    expect(useOnboardingDraft.getState().profile.phone).toBe('');
  });
});
