import { Injectable } from '@nestjs/common';
import { type Prisma, type StaffStatus } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { type TransactionClient } from '../../../../infrastructure/database/transaction-runner';
import { type LoginLockState } from '../../../auth/domain/login-lockout';

export interface StaffCredentials extends LoginLockState {
  id: string;
  email: string;
  fullName: string;
  passwordHash: string;
  status: StaffStatus;
  isDeleted: boolean;
  mustChangePassword: boolean;
  totpEnabled: boolean;
  totpSecretEnc: string | null;
}

export abstract class StaffAuthRepository {
  abstract findByEmail(email: string): Promise<StaffCredentials | null>;
  abstract findById(id: string): Promise<StaffCredentials | null>;
  abstract saveLoginState(staffId: string, state: LoginLockState): Promise<void>;
  abstract setPassword(
    staffId: string,
    passwordHash: string,
    now: Date,
    tx: TransactionClient,
  ): Promise<void>;
  abstract setPendingTotpSecret(staffId: string, sealedSecret: string): Promise<void>;
  abstract enableTotp(staffId: string, tx: TransactionClient): Promise<void>;
}

const CREDENTIAL_SELECT = {
  id: true,
  email: true,
  fullName: true,
  passwordHash: true,
  status: true,
  deletedAt: true,
  mustChangePassword: true,
  totpEnabled: true,
  totpSecretEnc: true,
  failedLoginCount: true,
  lockedUntil: true,
} satisfies Prisma.StaffUserSelect;

type CredentialRow = Prisma.StaffUserGetPayload<{ select: typeof CREDENTIAL_SELECT }>;

function toCredentials({ deletedAt, ...row }: CredentialRow): StaffCredentials {
  return { ...row, isDeleted: deletedAt !== null };
}

@Injectable()
export class PrismaStaffAuthRepository extends StaffAuthRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findByEmail(email: string): Promise<StaffCredentials | null> {
    const row = await this.prisma.staffUser.findUnique({
      where: { email },
      select: CREDENTIAL_SELECT,
    });
    return row ? toCredentials(row) : null;
  }

  async findById(id: string): Promise<StaffCredentials | null> {
    const row = await this.prisma.staffUser.findUnique({
      where: { id },
      select: CREDENTIAL_SELECT,
    });
    return row ? toCredentials(row) : null;
  }

  async saveLoginState(staffId: string, state: LoginLockState): Promise<void> {
    await this.prisma.staffUser.update({ where: { id: staffId }, data: state });
  }

  async setPassword(
    staffId: string,
    passwordHash: string,
    now: Date,
    tx: TransactionClient,
  ): Promise<void> {
    await tx.staffUser.update({
      where: { id: staffId },
      data: {
        passwordHash,
        mustChangePassword: false,
        passwordChangedAt: now,
        failedLoginCount: 0,
        lockedUntil: null,
        version: { increment: 1 },
      },
    });
  }

  async setPendingTotpSecret(staffId: string, sealedSecret: string): Promise<void> {
    // Enrolment only stores the secret; 2FA turns on after the first valid code.
    await this.prisma.staffUser.update({
      where: { id: staffId, totpEnabled: false },
      data: { totpSecretEnc: sealedSecret },
    });
  }

  async enableTotp(staffId: string, tx: TransactionClient): Promise<void> {
    await tx.staffUser.update({
      where: { id: staffId },
      data: { totpEnabled: true, version: { increment: 1 } },
    });
  }
}
