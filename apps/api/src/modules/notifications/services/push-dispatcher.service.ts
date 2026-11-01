import { Injectable, Logger } from '@nestjs/common';
import { PushNotificationProvider } from '../../../infrastructure/push/push-notification.provider';
import { NotificationRepository } from '../repositories/notification.repository';

/**
 * Lock screens show pushes to anyone holding the phone, so a push only says there is something to
 * read; the content stays in the app behind sign-in (ADR-0028).
 */
export const NEUTRAL_PUSH = {
  title: 'ENNEL',
  body: 'You have a new notice. Open the app to read it.',
} as const;

export interface PushOutcome {
  /** Students with at least one device that accepted the push. */
  delivered: Set<string>;
  /** Students who have no device or whose devices all failed. */
  failed: Set<string>;
}

/** Sends pushes after the in-app notices are committed; a push failure never undoes them. */
@Injectable()
export class PushDispatcher {
  private readonly logger = new Logger(PushDispatcher.name);

  constructor(
    private readonly notifications: NotificationRepository,
    private readonly provider: PushNotificationProvider,
  ) {}

  async send(studentIds: readonly string[], data: Record<string, string>): Promise<PushOutcome> {
    const outcome: PushOutcome = { delivered: new Set(), failed: new Set(studentIds) };
    if (!this.provider.isEnabled || studentIds.length === 0) return outcome;
    const tokens = await this.notifications.pushTokensFor(studentIds);
    const owner = new Map(tokens.map((row) => [row.token, row.studentId]));
    const results = await this.provider.send(
      tokens.map((row) => ({ token: row.token, ...NEUTRAL_PUSH, data })),
    );
    for (const result of results) {
      const studentId = owner.get(result.token);
      if (!studentId || !result.isDelivered) continue;
      outcome.delivered.add(studentId);
      outcome.failed.delete(studentId);
    }
    const invalid = results.filter((result) => result.isTokenInvalid).map((r) => r.token);
    await this.notifications.removePushTokens(invalid);
    this.logger.log(`Push sent: ${outcome.delivered.size} delivered, ${outcome.failed.size} not`);
    return outcome;
  }
}
