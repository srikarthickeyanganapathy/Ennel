import { ErrorCode } from '@ennel/shared';
import { describe, expect, it, vi } from 'vitest';
import { FakeClock } from '../../../../infrastructure/clock/fake-clock';
import { type TransactionRunner } from '../../../../infrastructure/database/transaction-runner';
import { type NotifyStudentsService } from '../../../notifications/services/notify-students.service';
import { type AuditWriter } from '../../audit-log/services/audit-writer.service';
import { type AdminMenusRepository, type StoredMenu } from '../repositories/admin-menus.repository';
import { PublishMenuService } from './publish-menu.service';

const menu: StoredMenu = {
  id: 'menu-1',
  mealDate: '2026-10-22',
  mealId: 'meal-1',
  mealType: 'LUNCH',
  status: 'PUBLISHED',
  isSpecial: false,
  specialTitle: null,
  items: [{ name: 'Rice', dietType: 'VEG' }],
  publishedItems: [{ name: 'Dal', dietType: 'VEG' }],
  contentHash: 'older-hash',
  publishedAt: null,
  version: 3,
};

describe('PublishMenuService (Admin §E)', () => {
  it('refuses to publish when the menu changed after it was read', async () => {
    const notify = { notifyWithin: vi.fn() };
    const audit = { write: vi.fn() };
    const menus = {
      findById: vi.fn().mockResolvedValue(menu),
      // A colleague's save bumped the version between the read and the publish.
      publish: vi.fn().mockResolvedValue(false),
      bookedStudentIds: vi.fn().mockResolvedValue(['student-1']),
    };
    const transactions = { run: (work: (tx: object) => Promise<unknown>) => work({}) };
    const service = new PublishMenuService(
      menus as unknown as AdminMenusRepository,
      notify as unknown as NotifyStudentsService,
      transactions as unknown as TransactionRunner,
      audit as unknown as AuditWriter,
      new FakeClock('2026-10-21T04:30:00.000Z'),
    );

    await expect(service.execute('menu-1', 3)).rejects.toMatchObject({
      code: ErrorCode.VERSION_CONFLICT,
    });
    expect(menus.publish).toHaveBeenCalledWith('menu-1', 3, expect.anything(), {});
    expect(notify.notifyWithin).not.toHaveBeenCalled();
    expect(audit.write).not.toHaveBeenCalled();
  });
});
