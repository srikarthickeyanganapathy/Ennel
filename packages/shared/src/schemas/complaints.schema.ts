import { z } from 'zod';
import { ComplaintCategory, ComplaintStatus, ComplaintType } from '../enums/complaint.js';
import { ComplaintPrivacyMode } from '../enums/policy.js';
import { businessDateSchema, uuidSchema } from './common.schema.js';
import { mealTypeSchema } from './meal-config.schema.js';

export const COMPLAINT_MAX_PHOTOS = 3;
export const COMPLAINT_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

/**
 * `POST /api/v1/complaints` fields (multipart, with up to three `photos`). Meal and date are
 * optional but go together (Spec §12 "Related meal/date").
 */
export const createComplaintRequestSchema = z
  .object({
    type: z.enum(ComplaintType),
    category: z.enum(ComplaintCategory),
    mealType: mealTypeSchema.optional(),
    mealDate: businessDateSchema.optional(),
    description: z
      .string()
      .trim()
      .min(10, 'Describe what happened in a few words')
      .max(2000, 'Keep it under 2000 characters'),
  })
  .refine((body) => (body.mealType === undefined) === (body.mealDate === undefined), {
    message: 'Choose both the meal and the date, or neither',
    path: ['mealDate'],
  });
export type CreateComplaintRequest = z.input<typeof createComplaintRequestSchema>;

/** What the student sees of their own report; never internal notes (BR-CMP-1). */
export const studentComplaintSchema = z.object({
  id: uuidSchema,
  referenceCode: z.string(),
  type: z.enum(ComplaintType),
  category: z.enum(ComplaintCategory),
  mealType: mealTypeSchema.nullable(),
  mealDate: businessDateSchema.nullable(),
  description: z.string(),
  status: z.enum(ComplaintStatus),
  /** The mess office's reply, visible to the student. */
  response: z.string().nullable(),
  photoCount: z.number().int(),
  privacyMode: z.enum(ComplaintPrivacyMode),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type StudentComplaint = z.infer<typeof studentComplaintSchema>;

/** After submitting. `receiptToken` is only set in anonymous mode and is shown once (ADR-0008). */
export const complaintReceiptSchema = z.object({
  complaint: studentComplaintSchema,
  receiptToken: z.string().nullable(),
});
export type ComplaintReceipt = z.infer<typeof complaintReceiptSchema>;

export const studentComplaintListSchema = z.object({
  items: z.array(studentComplaintSchema),
  /** The current mode, so the form can say in plain words who can see the report. */
  privacyMode: z.enum(ComplaintPrivacyMode),
});
export type StudentComplaintList = z.infer<typeof studentComplaintListSchema>;

/** `POST /api/v1/complaints/lookup`: anonymous reports by the receipt tokens on the device. */
export const complaintLookupRequestSchema = z.object({
  receiptTokens: z.array(z.string().min(20).max(200)).min(1).max(50),
});
