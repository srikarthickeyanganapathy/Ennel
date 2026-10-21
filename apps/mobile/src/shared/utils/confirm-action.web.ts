// Type-only import: erased at build time, so it does not resolve back to this file on web.
import type { ConfirmOptions } from './confirm-action';

// Web build only (Metro picks this file for `expo start --web`): react-native-web's Alert.alert
// does nothing, so a confirmation built on it would never show and the action could never run.
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  return Promise.resolve(window.confirm(`${options.title}\n\n${options.message}`));
}
