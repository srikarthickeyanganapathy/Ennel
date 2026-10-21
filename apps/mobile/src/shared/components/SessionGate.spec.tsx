import { screen } from '@testing-library/react-native';
import { Redirect } from 'expo-router';
import { Text } from 'react-native';
import { useSessionStore } from '@/shared/store/session.store';
import { renderWithProviders } from '@/test-utils/render';
import { SessionGate } from './SessionGate';

jest.mock('expo-router', () => ({ Redirect: jest.fn(() => null) }));

describe('SessionGate', () => {
  it('sends a signed-out student to Login, never to the ambiguous "/" (Spec §9 Logout)', async () => {
    useSessionStore.setState({ status: 'signedOut' });
    await renderWithProviders(
      <SessionGate redirectTo={null}>
        <Text>Home</Text>
      </SessionGate>,
    );
    expect(jest.mocked(Redirect).mock.calls[0]?.[0]).toMatchObject({ href: '/(auth)/login' });
    expect(screen.queryByText('Home')).toBeNull();
  });

  it('waits while the session is being restored', async () => {
    useSessionStore.setState({ status: 'restoring' });
    await renderWithProviders(
      <SessionGate redirectTo={null}>
        <Text>Home</Text>
      </SessionGate>,
    );
    expect(screen.getByLabelText('Checking your session')).toBeTruthy();
    expect(Redirect).not.toHaveBeenCalled();
  });

  it('shows the group to a signed-in student', async () => {
    useSessionStore.setState({ status: 'signedIn' });
    await renderWithProviders(
      <SessionGate redirectTo={null}>
        <Text>Home</Text>
      </SessionGate>,
    );
    expect(screen.getByText('Home')).toBeTruthy();
  });
});
