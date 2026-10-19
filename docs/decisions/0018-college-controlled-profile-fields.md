# ADR-0018: College-controlled profile fields

- Status: Accepted (default), pending college confirmation
- Date: 2026-10-19

## Context

Spec §3 Screen 5 and §9: prefill authorized college data and let students edit only permitted fields. Spec §18.11 lists which fields as open.

## Decision

- `mess_policy.college_controlled_fields` (string array). Default: `fullName`, `department`, `academicYear`. `referenceNumber` is always read-only and is not configurable.
- Students can edit hostel/block, room number, phone, parent phone, email and photo.
- The student API rejects edits to controlled fields with `VALIDATION_FAILED` (`details.field`), and the UI shows them read-only.
- Staff with `students:update` can edit any profile field with a reason (audited).
- On roster re-import, controlled fields on `students` are overwritten from the roster. Student-editable fields are not.

## Consequences

When the college answers, only the policy value changes, not code.
