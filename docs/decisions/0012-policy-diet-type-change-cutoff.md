# ADR-0012: Policy `dietTypeChangeCutoffMinutes` (Veg / Non-Veg)

- Status: Accepted (default), pending institutional approval
- Date: 2026-10-19

## Context

Spec §18.4 asks whether Veg/Non-Veg can change after booking and until when. The brief named the flag `mealTypeChangeCutoffMinutes`. In code, `MealType` means Breakfast/Lunch/Dinner (it is used that way in `AttendanceProvider.getAttendance`), so Veg/Non-Veg is named `DietType`. UI copy keeps the spec's "Meal type: Veg / Non-Veg".

## Decision

- The flag is renamed to `dietTypeChangeCutoffMinutes` (approved 2026-10-19), default **60**, the same as cancellation, so the kitchen's Veg/Non-Veg split is settled when cancellations close.
- A change is allowed while `now < slotStart − cutoff`.
- From Home or Plan Ahead the change applies only to that date. From Default Booking it changes the recurring preference. The UI states which one (Spec §4.3).

## Consequences

One word, one meaning in code. Docs and UI copy map "meal type (Veg/Non-Veg)" to `DietType`.
