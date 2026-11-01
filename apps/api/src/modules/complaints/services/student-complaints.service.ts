import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  type ComplaintReceipt,
  complaintReceiptSchema,
  type createComplaintRequestSchema,
  ErrorCode,
  type StudentComplaint,
  type StudentComplaintList,
} from '@ennel/shared';
import { type z } from 'zod';
import { AppError } from '../../../common/errors/app-error';
import { type TransactionClient } from '../../../infrastructure/database/transaction-runner';
import { IdempotencyService } from '../../idempotency/services/idempotency.service';
import { GetMessPolicyService } from '../../mess-config/services/get-mess-policy.service';
import { referenceCodeFrom, submitterSnapshot } from '../domain/complaint-rules';
import { ComplaintsRepository } from '../repositories/complaints.repository';
import { type CheckedPhoto, ComplaintPhotos } from './complaint-photos.service';
import { hashReceiptToken, toStudentComplaint } from './complaint-views';

type CreateRequest = z.output<typeof createComplaintRequestSchema>;

/**
 * In anonymous mode the stored idempotent response must not point back at the student, so the
 * replay is keyed by the random Idempotency-Key alone (ADR-0028).
 */
const ANONYMOUS_ACTOR = 'anonymous-complaint';

/** Spec §12: submit a complaint or feedback, see own reports and their status. */
@Injectable()
export class StudentComplaintsService {
  constructor(
    private readonly complaints: ComplaintsRepository,
    private readonly photos: ComplaintPhotos,
    private readonly policy: GetMessPolicyService,
    private readonly idempotency: IdempotencyService,
  ) {}

  async submit(
    studentId: string,
    request: CreateRequest,
    files: readonly Buffer[],
    key: string,
  ): Promise<ComplaintReceipt> {
    const checked = this.photos.check(files);
    const mode = (await this.policy.execute()).complaintPrivacyMode;
    const student = await this.complaints.submitter(studentId);
    if (!student) throw new AppError(ErrorCode.NOT_FOUND, 'Your account was not found.');
    const isAnonymous = mode === 'ANONYMOUS';
    return this.idempotency.run({
      context: {
        actorKey: isAnonymous ? ANONYMOUS_ACTOR : `student:${studentId}`,
        key,
        route: 'POST /complaints',
        request: { ...request, photos: checked.map((photo) => photo.digest) },
      },
      responseCode: 201,
      responseSchema: complaintReceiptSchema,
      work: async (tx) => {
        const receiptToken = isAnonymous ? randomBytes(32).toString('base64url') : null;
        const id = await this.complaints.create(
          {
            referenceCode: referenceCodeFrom(randomBytes(6)),
            ...submitterSnapshot(mode, student),
            privacyMode: mode,
            submitterTokenHash: receiptToken && hashReceiptToken(receiptToken),
            type: request.type,
            category: request.category,
            mealType: request.mealType ?? null,
            mealDate: request.mealDate ?? null,
            description: request.description,
          },
          tx,
        );
        await this.storePhotos(id, checked, tx);
        await this.complaints.addHistory(
          { complaintId: id, fromStatus: null, toStatus: 'NEW', actorId: null },
          tx,
        );
        return { complaint: await this.view(id, tx), receiptToken };
      },
    });
  }

  async list(studentId: string): Promise<StudentComplaintList> {
    const [rows, policy] = await Promise.all([
      this.complaints.listForStudent(studentId),
      this.policy.execute(),
    ]);
    return { items: rows.map(toStudentComplaint), privacyMode: policy.complaintPrivacyMode };
  }

  async get(studentId: string, id: string): Promise<StudentComplaint> {
    const row = await this.complaints.find(id);
    if (!row || row.studentId !== studentId) {
      throw new AppError(ErrorCode.NOT_FOUND, 'This report was not found.');
    }
    return toStudentComplaint(row);
  }

  /** Anonymous reports, found only by the receipt tokens the device holds (ADR-0008). */
  async lookup(tokens: readonly string[]): Promise<StudentComplaint[]> {
    const rows = await this.complaints.listByTokenHashes(tokens.map(hashReceiptToken));
    return rows.map(toStudentComplaint);
  }

  private async storePhotos(
    complaintId: string,
    checked: readonly CheckedPhoto[],
    tx: TransactionClient,
  ): Promise<void> {
    // A failed transaction can leave files without a row; they are never linked or served.
    const saved = await this.photos.save(complaintId, checked);
    await this.complaints.addPhotos(complaintId, saved, tx);
  }

  private async view(id: string, tx: TransactionClient): Promise<StudentComplaint> {
    const row = await this.complaints.find(id, tx);
    if (!row) throw new Error(`Complaint ${id} vanished inside its own transaction`);
    return toStudentComplaint(row);
  }
}
