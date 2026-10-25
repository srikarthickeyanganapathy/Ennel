# ADR-0026: Leave start, resume, extension and staff changes

- Status: Accepted (default), pending confirmation with mess management
- Date: 2026-10-25

## Context

Spec §11 and BR-LEAVE-1..8 define leave ranges, approval (ADR-0007) and booking pausing. Not settled: how soon a leave may start, what "subject to the college's rules" means for resuming, how an extension works when approval is required, and how staff-created leaves behave (Admin §K).

## Decision

- **Earliest start and resume point:** a student's leave may start, and a student may resume, only at a meal whose cut-off has not passed. The cut-off is the cancellation deadline of the student's booked slot, or the meal's service start when nothing is booked. Otherwise leave would work as a late cancellation without a No-show (BR-NS-2). Staff may use any meal that has not started yet.
- **Ending:** "End leave / Resume meals" takes the first meal to book again. The leave then ends at the meal before it. Choosing the first meal of the leave, or earlier, withdraws the whole leave (`CANCELLED`).
- **Extension with approval on:** extending an approved leave creates a separate `PENDING` request for the extra days, so meals that are already paused stay paused. With approval off, or for a pending request, the end date is moved directly.
- **Bookings:** after every change the student's upcoming meals are recomputed from the approved leaves (`LeaveBookingSync`). Covered Booked meals become Paused. Paused meals that are no longer covered are restored through the resolver with the full-slot fallback (`BookingRestorer`, shared with closure removal). If nothing wants such a meal booked it is cancelled by the system; if its slot is full under `ASK_STUDENT`, the student is notified. Meals whose slot has started are never changed (BR-LEAVE-8).
- **Staff:** leaves created by staff are approved at once. Create, end and correct need a reason and are audited as overrides; approve and reject are audited, and reject needs a reason. The student is notified of approval, rejection and every staff change.
- **Limits:** a leave may cover at most 366 days. This is a technical bound, not a business rule.
- **Retries:** applying for leave is idempotent (ADR-0016). Extend and end send the version shown, so a repeated request is refused instead of applied twice.

## Consequences

Mess management should confirm the earliest-start rule and the separate-request behaviour for extensions. Tests: `apps/api/test/integration/leaves.int.spec.ts`, `leave-rules.spec.ts`, `meal-range.spec.ts`.
