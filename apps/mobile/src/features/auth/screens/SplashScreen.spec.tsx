import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SplashScreen } from './SplashScreen';

describe('SplashScreen', () => {
  it('shows the brand, tagline and a labelled start button', async () => {
    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}
      >
        <SplashScreen />
      </SafeAreaProvider>,
    );
    expect(screen.getByRole('header', { name: 'ENNEL' })).toBeTruthy();
    expect(screen.getByText('Good Food. Better You.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Get Started' })).toBeDisabled();
  });
});
