import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import { ApiError } from '@/shared/api-client/api-error';
import { mockRouter, renderWithProviders } from '@/test-utils/render';
import { resetPasswordWithCode } from '../api/auth-api';
import { ResetWithCodeScreen } from './ResetWithCodeScreen';

jest.mock('../api/auth-api');
const mockedReset = jest.mocked(resetPasswordWithCode);

const SESSION = {
  accessToken: 'access',
  accessTokenExpiresAt: '2026-10-20T06:00:00.000Z',
  refreshToken: 'refresh-token-value-long-enough',
  refreshTokenExpiresAt: '2026-11-19T06:00:00.000Z',
  isOnboardingComplete: true,
};

async function fillForm(code: string) {
  await fireEvent.changeText(screen.getByLabelText('Reset code'), code);
  await fireEvent.changeText(screen.getByLabelText('New password'), 'longenough1');
  await fireEvent.changeText(screen.getByLabelText('Confirm password'), 'longenough1');
  await fireEvent.press(screen.getByRole('button', { name: 'Set New Password' }));
}

describe('ResetWithCodeScreen (ADR-0019)', () => {
  beforeEach(() => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ referenceNumber: '24900417' });
  });

  it('checks the code format before calling the API', async () => {
    await renderWithProviders(<ResetWithCodeScreen />);
    await fillForm('ABC');

    expect(
      await screen.findByText('Enter the 10-character code from the mess office'),
    ).toBeTruthy();
    expect(mockedReset).not.toHaveBeenCalled();
  });

  it('sets the new password, normalizes the code and signs the student in', async () => {
    mockedReset.mockResolvedValue(SESSION);
    await renderWithProviders(<ResetWithCodeScreen />);
    await fillForm(' abcd23efgh ');

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)'));
    expect(mockedReset).toHaveBeenCalledTimes(1);
    expect(mockedReset.mock.calls[0]?.[0]).toMatchObject({
      referenceNumber: '24900417',
      code: 'ABCD23EFGH',
    });
  });

  it('shows the server message for a wrong or expired code', async () => {
    mockedReset.mockRejectedValue(
      new ApiError('INVALID_CREDENTIALS', 'The code or reference number is not valid.', 401),
    );
    await renderWithProviders(<ResetWithCodeScreen />);
    await fillForm('ABCD23EFGH');

    expect(await screen.findByText(/The code or reference number is not valid./)).toBeTruthy();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});
