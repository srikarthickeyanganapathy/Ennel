import { Injectable } from '@nestjs/common';
import { type AdminHostel } from '@ennel/shared';
import { TransactionRunner } from '../../../../infrastructure/database/transaction-runner';
import { AuditWriter } from '../../audit-log/services/audit-writer.service';
import { AdminMessConfigRepository } from '../repositories/admin-mess-config.repository';
import { invalid, notFound } from './config-errors';

interface NameOrStatus {
  name?: string;
  isActive?: boolean;
}

/**
 * Hostels and blocks used by roster import, student profiles and announcements. They are
 * deactivated rather than deleted so history keeps pointing at them.
 */
@Injectable()
export class ManageHostelsService {
  constructor(
    private readonly config: AdminMessConfigRepository,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
  ) {}

  list(): Promise<AdminHostel[]> {
    return this.config.listHostels();
  }

  async createHostel(name: string): Promise<AdminHostel[]> {
    if (await this.config.hostelNameExists(name))
      throw invalid('name', 'A hostel with this name already exists');
    await this.transactions.run(async (tx) => {
      const id = await this.config.createHostel(name, tx);
      await this.audit.write(tx, {
        action: 'hostel.create',
        entityType: 'hostel',
        entityId: id,
        after: { name },
      });
    });
    return this.list();
  }

  async updateHostel(id: string, changes: NameOrStatus): Promise<AdminHostel[]> {
    const before = await this.config.findHostel(id);
    if (!before) throw notFound('Hostel');
    if (changes.name && (await this.config.hostelNameExists(changes.name, id))) {
      throw invalid('name', 'A hostel with this name already exists');
    }
    await this.transactions.run(async (tx) => {
      await this.config.updateHostel(id, changes, tx);
      await this.audit.write(tx, {
        action: 'hostel.update',
        entityType: 'hostel',
        entityId: id,
        before,
        after: changes,
      });
    });
    return this.list();
  }

  async createBlock(hostelId: string, name: string): Promise<AdminHostel[]> {
    if (!(await this.config.findHostel(hostelId))) throw notFound('Hostel');
    if (await this.config.blockNameExists(hostelId, name))
      throw invalid('name', 'This hostel already has a block with this name');
    await this.transactions.run(async (tx) => {
      const id = await this.config.createBlock(hostelId, name, tx);
      await this.audit.write(tx, {
        action: 'hostel-block.create',
        entityType: 'hostel_block',
        entityId: id,
        after: { hostelId, name },
      });
    });
    return this.list();
  }

  async updateBlock(id: string, changes: NameOrStatus): Promise<AdminHostel[]> {
    const before = await this.config.findBlock(id);
    if (!before) throw notFound('Block');
    if (changes.name && (await this.config.blockNameExists(before.hostelId, changes.name, id))) {
      throw invalid('name', 'This hostel already has a block with this name');
    }
    await this.transactions.run(async (tx) => {
      await this.config.updateBlock(id, changes, tx);
      await this.audit.write(tx, {
        action: 'hostel-block.update',
        entityType: 'hostel_block',
        entityId: id,
        before,
        after: changes,
      });
    });
    return this.list();
  }
}
