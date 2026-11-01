import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { registerPushToken } from '../api/notifications-api';

/** Expo issues push tokens per EAS project; without one (local development) push stays off. */
function easProjectId(): string | null {
  const extra: unknown = Constants.expoConfig?.extra;
  if (typeof extra !== 'object' || extra === null || !('eas' in extra)) return null;
  const eas: unknown = extra.eas;
  if (typeof eas !== 'object' || eas === null || !('projectId' in eas)) return null;
  return typeof eas.projectId === 'string' ? eas.projectId : null;
}

async function registerDevice(): Promise<void> {
  const projectId = easProjectId();
  if (!Device.isDevice || !projectId) return;
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return;
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  await registerPushToken(data, Platform.OS === 'ios' ? 'ios' : 'android');
}

/**
 * Registers this phone for pushes once signed in (ADR-0028). Pushes only say there is a new
 * notice; failures are ignored because the notification centre works without them.
 */
export function usePushRegistration(isSignedIn: boolean): void {
  useEffect(() => {
    if (!isSignedIn) return;
    registerDevice().catch(() => undefined);
  }, [isSignedIn]);
}
