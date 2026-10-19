# ADR-0008: Policy `complaintPrivacyMode`

- Status: Accepted (default), pending institutional approval
- Date: 2026-10-19

## Context

Spec §12 warns: "do not promise anonymity if the backend retains identifying data". Rule 12 requires that in anonymous mode the admin API never returns _or stores_ the identity. Spec §18.8 lists the choice as open.

## Decision

- `mess_policy.complaint_privacy_mode` ∈ `PRIVATE_IDENTIFIED | ANONYMOUS`, default **`PRIVATE_IDENTIFIED`**.
- `PRIVATE_IDENTIFIED`: `student_id` is stored and visible to staff with `complaints:read`, never to other students. Status changes notify the student.
- `ANONYMOUS`: `student_id` and `hostel_block_id` are stored as NULL. Request logs for the submit route omit the actor. The student app gets a random receipt token, which is stored on the device and kept as a hash on the server, so it can show status. No status notifications are possible.
- The mode is snapshotted on each complaint (`privacy_mode`). Switching modes does not change existing complaints.
- The submit screen states which model applies, in plain words.

## Consequences

In anonymous mode, hostel filters and per-student counts exclude anonymous complaints. Photo EXIF metadata is stripped in both modes.
