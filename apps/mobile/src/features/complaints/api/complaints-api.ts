import {
  type ComplaintReceipt,
  complaintReceiptSchema,
  type CreateComplaintRequest,
  type StudentComplaint,
  studentComplaintListSchema,
  type StudentComplaintList,
  studentComplaintSchema,
} from '@ennel/shared';
import { z } from 'zod';
import { apiRequest } from '@/shared/api-client/api-client';

export interface PickedComplaintPhoto {
  uri: string;
  mimeType: string;
  fileName: string;
  /** Present on web, where the picker returns a File. */
  file?: File;
}

export function listMyComplaints(): Promise<StudentComplaintList> {
  return apiRequest('/api/v1/complaints', { schema: studentComplaintListSchema });
}

export async function lookupComplaints(receiptTokens: string[]): Promise<StudentComplaint[]> {
  if (receiptTokens.length === 0) return [];
  const result = await apiRequest('/api/v1/complaints/lookup', {
    method: 'POST',
    body: { receiptTokens },
    schema: z.object({ items: z.array(studentComplaintSchema) }),
  });
  return result.items;
}

export function getComplaint(id: string): Promise<StudentComplaint> {
  return apiRequest(`/api/v1/complaints/${id}`, { schema: studentComplaintSchema });
}

export function submitComplaint(
  request: CreateComplaintRequest,
  photos: readonly PickedComplaintPhoto[],
  idempotencyKey: string,
): Promise<ComplaintReceipt> {
  const formData = new FormData();
  for (const [name, value] of Object.entries(request)) {
    if (value !== undefined) formData.append(name, String(value));
  }
  photos.forEach((photo) => {
    if (photo.file) {
      formData.append('photos', photo.file, photo.fileName);
      return;
    }
    // React Native's FormData accepts a { uri, name, type } descriptor for files.
    formData.append('photos', {
      uri: photo.uri,
      name: photo.fileName,
      type: photo.mimeType,
    } as unknown as Blob);
  });
  return apiRequest('/api/v1/complaints', {
    method: 'POST',
    formData,
    headers: { 'Idempotency-Key': idempotencyKey },
    schema: complaintReceiptSchema,
  });
}
