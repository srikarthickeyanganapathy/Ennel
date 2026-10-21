import { useLogout } from '@/features/auth/hooks/use-auth-mutations';
import { AppButton } from '@/shared/components/AppButton';
import { Screen } from '@/shared/components/Screen';
import { StepHeader } from '@/shared/components/StepHeader';
import { confirmAction } from '@/shared/utils/confirm-action';

/** Placeholder for Spec §9; for now it offers Logout with confirmation (Spec §14). */
export function ProfileScreen() {
  const logout = useLogout();

  const confirmLogout = async () => {
    const isConfirmed = await confirmAction({
      title: 'Log out?',
      message: 'You will need your reference number and password to log in again.',
      cancelLabel: 'Stay Logged In',
      confirmLabel: 'Log Out',
      isDestructive: true,
    });
    // The signed-out session sends the student to Login (SessionGate); no navigation here.
    if (isConfirmed) logout.mutate();
  };

  return (
    <Screen>
      <StepHeader title="Profile" subtitle="Your details and settings will appear here." />
      <AppButton
        label="Log Out"
        variant="danger"
        onPress={() => void confirmLogout()}
        isLoading={logout.isPending}
      />
    </Screen>
  );
}
