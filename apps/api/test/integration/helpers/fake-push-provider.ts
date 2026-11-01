import {
  type PushMessage,
  PushNotificationProvider,
  type PushResult,
} from '../../../src/infrastructure/push/push-notification.provider';

/** Records pushes; tokens in `rejected` fail and those in `gone` are reported unregistered. */
export class FakePushProvider extends PushNotificationProvider {
  readonly isEnabled = true;
  sent: PushMessage[] = [];
  rejected = new Set<string>();
  gone = new Set<string>();

  send(messages: readonly PushMessage[]): Promise<PushResult[]> {
    this.sent.push(...messages);
    return Promise.resolve(
      messages.map((message) => {
        const isGone = this.gone.has(message.token);
        const isDelivered = !isGone && !this.rejected.has(message.token);
        return {
          token: message.token,
          isDelivered,
          error: isDelivered ? null : 'Rejected',
          isTokenInvalid: isGone,
        };
      }),
    );
  }

  reset(): void {
    this.sent = [];
    this.rejected.clear();
    this.gone.clear();
  }
}
