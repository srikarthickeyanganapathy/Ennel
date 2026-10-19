import { screen } from '@testing-library/react-native';
import { useSessionStore } from '@/shared/store/session.store';
import { mockRouter, renderWithProviders } from '@/test-utils/render';
import { SplashScreen } from './SplashScreen';

jest.mock('@/shared/api-client/api-client', () => ({
  refreshSessionOnce: jest.fn(async () => false),
}));

describe('SplashScreen (Spec §3 Screen 1)', () => {
  it('shows a loading state while the session is checked', async () => {
    useSessionStore.setState({ status: 'restoring' });
    await renderWithProviders(<SplashScreen />);
    expect(screen.getByRole('header', { name: 'ENNEL' })).toBeTruthy();
    expect(screen.getByText('Good Food. Better You.')).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Get Started' })).toBeTruthy();
  });

  it('sends a signed-in student who has not finished setup to the profile step', async () => {
    useSessionStore.setState({
      status: 'signedIn',
      isOnboardingComplete: false,
      accessToken: 'token',
    });
    await renderWithProviders(<SplashScreen />);
    expect(mockRouter.replace).toHaveBeenCalledWith('/(onboarding)/profile');
  });
});
