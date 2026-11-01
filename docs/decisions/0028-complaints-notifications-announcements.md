# ADR-0028: Complaints, notification centre, push and announcements

- Status: Accepted (default), some points pending confirmation (see Consequences)
- Date: 2026-11-01

## Context

Spec §12–13 and Admin §L–§M describe complaints with photos, a notification centre with a bell and push, and announcements with an audience and a schedule. ADR-0008 already chose the privacy modes. Still open: how push is delivered, what a push may show on a lock screen, how anonymous submissions stay anonymous end to end, how photos are cleaned, how strict the status flow is, and how scheduled sends avoid going out twice.

## Decision

- **Push is a port.** `PushNotificationProvider` has two adapters chosen by `PUSH_PROVIDER`: `none` (default, every push is reported as not delivered) and `expo` (Expo push service, batches of 100, optional `EXPO_ACCESS_TOKEN`, built-in `fetch`, no new library). In-app notices never depend on push.
- **Neutral lock-screen text.** Every push says only "ENNEL" / "You have a new notice. Open the app to read it." The content stays in the app behind sign-in (Spec §13 "must not disclose sensitive information on a lock screen"). Pushes go out after the database commit; a token the service reports as `DeviceNotRegistered` is deleted.
- **Which notices push.** Announcements with the Push channel push now. Other notices (bookings, leave, No-shows, complaints) stay in-app only for the MVP; adding push to them is a later change through the same dispatcher.
- **Push registration.** The phone registers its Expo token (`PUT /push-tokens`) after sign-in, only on a real device and only when the app has an EAS project ID. A token that moves to another student is re-assigned.
- **Anonymous complaints stay anonymous.** Under `ANONYMOUS` the complaint stores no student or hostel, photos are stored under the complaint (not the student), and the receipt token is stored as a SHA-256 hash. The idempotent replay record is keyed by the random `Idempotency-Key` alone (actor `anonymous-complaint`), so it cannot tie the student to the report either. Request logs never include the actor.
- **Mode changes hide identity.** Staff see a submitter only when the report was identified _and_ the mess is still in identified mode; switching to anonymous also hides earlier submitters (Admin §L "in anonymous mode, identity fields are not returned"). Identified students are still notified, because the link is kept internally.
- **Photo cleaning.** Type is checked from the file content. JPEG APP1 (EXIF/XMP), APP12–13 and comments; PNG `eXIf`/`tEXt`/`iTXt`/`zTXt`/`tIME`; and WebP `EXIF`/`XMP ` chunks are removed without re-encoding. A JPEG's orientation tag is kept so photos are not shown sideways. HEIC is accepted (BR-CMP-3) but not cleaned, because that needs an image library; the app always uploads JPEG.
- **Strict status flow.** `NEW → IN_REVIEW → RESOLVED | REJECTED`; no skipping review, no going back, no reopening. Closing needs a reply the student sees. Edits are version-checked.
- **Audit without personal data.** Note audits keep the note ID and length, not the text. Announcement audits keep the count of a custom reference list, not the numbers.
- **Announcements.** States `DRAFT → SCHEDULED → SENDING → SENT`, or `CANCELLED`. Drafts and scheduled ones can be edited. A schedule must be at least a minute ahead. Sending claims the row with a status-checked update, so "Send now" and the worker job can never both send. In-app notices, delivery rows, the status change and the audit commit together; pushes follow. The worker job (`send-scheduled-announcements`, every minute) sends due announcements and retries pushes for any send still `SENDING` after five minutes. The audience is resolved at send time: every student who is not deactivated and matches the hostel, block, academic year or reference-number list.

## Consequences

To confirm: whether HEIC should be cleaned with an image library such as `sharp`, the push wording, and whether other notice types should push. Real pushes need an EAS project ID in the app and `PUSH_PROVIDER=expo` on the server. Tests: `apps/api/test/integration/complaints.int.spec.ts`, `announcements.int.spec.ts`, `image-metadata.spec.ts`, `complaint-rules.spec.ts`, `announcement-rules.spec.ts`.
