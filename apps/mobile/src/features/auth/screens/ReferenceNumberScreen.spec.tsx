import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ApiError } from '@/shared/api-client/api-error';
import { useSessionStore } from '@/shared/store/session.store';
import { mockRouter, renderWithProviders } from '@/test-utils/render';
import { checkRoster } from '../api/auth-api';
import { ReferenceNumberScreen } from './ReferenceNumberScreen';

jest.mock('../api/auth-api');
const mockedCheckRoster = jest.mocked(checkRoster);

describe('ReferenceNumberScreen (Spec §3 Screen 2)', () => {
  it('keeps the student on the page with an understandable error for unknown numbers', async () => {
    mockedCheckRoster.mockRejectedValue(
      new ApiError('ROSTER_NOT_FOUND', 'We could not find this reference number.', 404),
    );
    await renderWithProviders(<ReferenceNumberScreen />);
    await fireEvent.changeText(screen.getByLabelText('Reference number'), '11112222');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText(/We could not find this reference number./)).toBeTruthy();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('opens Create Your Password for a new, valid number', async () => {
    mockedCheckRoster.mockResolvedValue({ status: 'NEW' });
    await renderWithProviders(<ReferenceNumberScreen />);
    await fireEvent.changeText(screen.getByLabelText('Reference number'), '24 900 417');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() =>
      expect(mockRouter.push).toHaveBeenCalledWith({
        pathname: '/(auth)/create-password',
        params: { referenceNumber: '24900417', isExisting: 'false' },
      }),
    );
  });

  it('sends a registered number to login', async () => {
    mockedCheckRoster.mockResolvedValue({ status: 'REGISTERED' });
    await renderWithProviders(<ReferenceNumberScreen />);
    await fireEvent.changeText(screen.getByLabelText('Reference number'), '24900417');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() =>
      expect(mockRouter.push).toHaveBeenCalledWith(
        expect.objectContaining({ pathname: '/(auth)/login' }),
      ),
    );
  });

  it('validates the format before calling the API', async () => {
    await renderWithProviders(<ReferenceNumberScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Enter your college reference number')).toBeTruthy();
    expect(mockedCheckRoster).not.toHaveBeenCalled();
  });

  it('sends a signed-in student back to setup (Back from Account Created)', async () => {
    useSessionStore.setState({ status: 'signedIn', isOnboardingComplete: false, accessToken: 't' });
    await renderWithProviders(<ReferenceNumberScreen />);
    expect(mockRouter.replace).toHaveBeenCalledWith('/(onboarding)/profile');
    useSessionStore.setState({ status: 'signedOut', accessToken: null });
  });
});
