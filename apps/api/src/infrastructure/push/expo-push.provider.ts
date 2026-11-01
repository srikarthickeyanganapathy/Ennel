import { Logger } from '@nestjs/common';
import {
  type PushMessage,
  PushNotificationProvider,
  type PushResult,
} from './push-notification.provider';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Expo accepts at most 100 messages per request. */
const BATCH_SIZE = 100;
const TIMEOUT_MS = 15_000;

interface ExpoTicket {
  status: 'ok' | 'error';
  details?: { error?: string };
}

/**
 * Sends through Expo's push service with the built-in fetch (no extra library). Each batch is
 * independent: a failed batch marks only its own messages as failed.
 */
export class ExpoPushProvider extends PushNotificationProvider {
  readonly isEnabled = true;
  private readonly logger = new Logger(ExpoPushProvider.name);

  constructor(private readonly accessToken: string | null) {
    super();
  }

  async send(messages: readonly PushMessage[]): Promise<PushResult[]> {
    const results: PushResult[] = [];
    for (let start = 0; start < messages.length; start += BATCH_SIZE) {
      results.push(...(await this.sendBatch(messages.slice(start, start + BATCH_SIZE))));
    }
    return results;
  }

  private async sendBatch(batch: readonly PushMessage[]): Promise<PushResult[]> {
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(this.accessToken && { Authorization: `Bearer ${this.accessToken}` }),
        },
        body: JSON.stringify(
          batch.map((message) => ({
            to: message.token,
            title: message.title,
            body: message.body,
            data: message.data ?? {},
            sound: 'default',
          })),
        ),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) return failAll(batch, `Push service answered ${response.status}`);
      const payload = (await response.json()) as { data?: ExpoTicket[] };
      return batch.map((message, index) => {
        const ticket = payload.data?.[index];
        return {
          token: message.token,
          isDelivered: ticket?.status === 'ok',
          // Expo's `details.error` is a code (e.g. DeviceNotRegistered); `message` can echo the token.
          error: ticket?.status === 'ok' ? null : (ticket?.details?.error ?? 'Not accepted'),
          isTokenInvalid: ticket?.details?.error === 'DeviceNotRegistered',
        };
      });
    } catch (error) {
      this.logger.warn(`Push batch failed: ${error instanceof Error ? error.name : 'error'}`);
      return failAll(batch, 'Push service unreachable');
    }
  }
}

function failAll(batch: readonly PushMessage[], error: string): PushResult[] {
  return batch.map((message) => ({
    token: message.token,
    isDelivered: false,
    error,
    isTokenInvalid: false,
  }));
}
