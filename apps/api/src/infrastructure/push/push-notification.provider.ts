export interface PushMessage {
  token: string;
  /** Kept neutral: lock screens show it without the app open (Spec §13, ADR-0028). */
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushResult {
  token: string;
  isDelivered: boolean;
  /** Why it failed, without the token or message content. */
  error: string | null;
  /** The push service says this device is gone, so the token should be forgotten. */
  isTokenInvalid: boolean;
}

/** Port for push delivery (architecture §3.3). In-app notifications never depend on it. */
export abstract class PushNotificationProvider {
  abstract readonly isEnabled: boolean;
  abstract send(messages: readonly PushMessage[]): Promise<PushResult[]>;
}

/** Default: push is off, so every message is reported as not delivered. */
export class DisabledPushProvider extends PushNotificationProvider {
  readonly isEnabled = false;

  send(messages: readonly PushMessage[]): Promise<PushResult[]> {
    return Promise.resolve(
      messages.map((message) => ({
        token: message.token,
        isDelivered: false,
        error: 'Push is not configured',
        isTokenInvalid: false,
      })),
    );
  }
}
