import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import { mockRouter, renderWithProviders } from '@/test-utils/render';
import { registerStudent } from '../api/auth-api';
import { CreatePasswordScreen } from './CreatePasswordScreen';

jest.mock('../api/auth-api');
const mockedRegister = jest.mocked(registerStudent);

const SESSION = {
  accessToken: 'access',
  accessTokenExpiresAt: '2026-10-19T06:00:00.000Z',
  refreshToken: 'refresh-token-value-long-enough',
  refreshTokenExpiresAt: '2026-11-18T06:00:00.000Z',
  isOnboardingComplete: false,
};

describe('CreatePasswordScreen (Spec §3 Screen 3)', () => {
  beforeEach(() => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ referenceNumber: '24900417' });
  });

  it('shows "Passwords do not match." and does not submit', async () => {
    await renderWithProviders(<CreatePasswordScreen />);
    await fireEvent.changeText(screen.getByLabelText('New password'), 'longenough1');
    await fireEvent.changeText(screen.getByLabelText('Confirm password'), 'different1');
    await fireEvent.press(screen.getByRole('button', { name: 'Create Account' }));

    expect(await screen.findByText('Passwords do not match.')).toBeTruthy();
    expect(mockedRegister).not.toHaveBeenCalled();
  });

  it('hides the password until Show is pressed', async () => {
    await renderWithProviders(<CreatePasswordScreen />);
    const input = screen.getByLabelText('New password');
    expect(input.props.secureTextEntry).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Show new password' }));
    expect(screen.getByLabelText('New password').props.secureTextEntry).toBe(false);
  });

  it('creates the account once and opens Account Created', async () => {
    mockedRegister.mockResolvedValue(SESSION);
    await renderWithProviders(<CreatePasswordScreen />);
    await fireEvent.changeText(screen.getByLabelText('New password'), 'longenough1');
    await fireEvent.changeText(screen.getByLabelText('Confirm password'), 'longenough1');
    await fireEvent.press(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/(auth)/account-created'));
    expect(mockedRegister).toHaveBeenCalledTimes(1);
    expect(mockedRegister.mock.calls[0]?.[0]).toEqual({
      referenceNumber: '24900417',
      password: 'longenough1',
      confirmPassword: 'longenough1',
    });
  });
});
