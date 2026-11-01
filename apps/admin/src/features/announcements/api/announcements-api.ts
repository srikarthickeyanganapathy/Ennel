import {
  type Announcement,
  type AnnouncementAudience,
  type AnnouncementList,
  type AnnouncementListQuery,
  announcementListResponseSchema,
  announcementSchema,
  type AudiencePreview,
  audiencePreviewSchema,
  type CreateAnnouncementRequest,
} from '@ennel/shared';
import { apiRequest } from '@/shared/api-client/api-client';

// Paths are relative to /api/v1/admin, which apiRequest adds.
export const listAnnouncements = (query: AnnouncementListQuery): Promise<AnnouncementList> =>
  apiRequest('/announcements', { query: { ...query }, schema: announcementListResponseSchema });

export const createAnnouncement = (body: CreateAnnouncementRequest): Promise<Announcement> =>
  apiRequest('/announcements', { method: 'POST', body, schema: announcementSchema });

export const updateAnnouncement = (
  id: string,
  body: CreateAnnouncementRequest & { version: number },
): Promise<Announcement> =>
  apiRequest(`/announcements/${id}`, { method: 'PUT', body, schema: announcementSchema });

export const previewAudience = (audience: AnnouncementAudience): Promise<AudiencePreview> =>
  apiRequest('/announcements/audience-preview', {
    method: 'POST',
    body: audience,
    schema: audiencePreviewSchema,
  });

const act = (id: string, action: 'send' | 'cancel' | 'schedule', body: object) =>
  apiRequest(`/announcements/${id}/${action}`, {
    method: 'POST',
    body,
    schema: announcementSchema,
  });

export const sendAnnouncement = (id: string, version: number) => act(id, 'send', { version });
export const cancelAnnouncement = (id: string, version: number) => act(id, 'cancel', { version });
export const scheduleAnnouncement = (id: string, scheduledFor: string, version: number) =>
  act(id, 'schedule', { scheduledFor, version });
