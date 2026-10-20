import { Injectable } from '@nestjs/common';
import { type PermissionKey } from '@ennel/shared';
import { Clock } from '../../../../infrastructure/clock/clock';
import {
  type StaffAccessRecord,
  StaffAccessRepository,
} from '../repositories/staff-access.repository';

const CACHE_TTL_MS = 30_000;

interface CachedAccess {
  access: StaffAccessRecord | null;
  expiresAt: number;
}

/**
 * Resolves a staff member's roles and permissions per request (ADR-0015: tokens carry no
 * permissions). A short cache keeps this cheap; role, status and permission changes call
 * `invalidate` so they apply at once in this process.
 */
@Injectable()
export class StaffPermissionsService {
  private readonly cache = new Map<string, CachedAccess>();

  constructor(
    private readonly repository: StaffAccessRepository,
    private readonly clock: Clock,
  ) {}

  async getAccess(staffId: string): Promise<StaffAccessRecord | null> {
    const now = this.clock.now().getTime();
    const cached = this.cache.get(staffId);
    if (cached && cached.expiresAt > now) return cached.access;
    const access = await this.repository.findAccess(staffId);
    this.cache.set(staffId, { access, expiresAt: now + CACHE_TTL_MS });
    return access;
  }

  async hasAll(staffId: string, required: readonly PermissionKey[]): Promise<boolean> {
    const access = await this.getAccess(staffId);
    if (!access?.isActive) return false;
    const granted = new Set(access.permissions);
    return required.every((key) => granted.has(key));
  }

  /** Clears one staff member, or everyone when a role's permissions change. */
  invalidate(staffId?: string): void {
    if (staffId) this.cache.delete(staffId);
    else this.cache.clear();
  }
}
