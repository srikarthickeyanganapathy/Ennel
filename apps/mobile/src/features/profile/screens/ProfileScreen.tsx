import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { useLogout } from '@/features/auth/hooks/use-auth-mutations';
import { AppButton } from '@/shared/components/AppButton';
import { Screen } from '@/shared/components/Screen';
import { StepHeader } from '@/shared/components/StepHeader';

/** Placeholder for Spec §9; for now it offers Logout with confirmation (Spec §14). */
export function ProfileScreen() {
  const router = useRouter();
  const logout = useLogout();

  const confirmLogout = () => {
    Alert.alert('Log out?', 'You will need your reference number and password to log in again.', [
      { text: 'Stay Logged In', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: () => logout.mutate(undefined, { onSettled: () => router.replace('/') }),
      },
    ]);
  };

  return (
    <Screen>
      <StepHeader title="Profile" subtitle="Your details and settings will appear here." />
      <AppButton
        label="Log Out"
        variant="danger"
        onPress={confirmLogout}
        isLoading={logout.isPending}
      />
    </Screen>
  );
}
