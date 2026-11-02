# ADR-0029: Forecast and report definitions

- Status: Accepted (default), some points pending confirmation (see Consequences)
- Date: 2026-11-02

## Context

Admin §N, §O and §Q ask for a kitchen forecast, reports and system health, and the Figma frames show more than the system records. Reports only help if every number has one meaning, so these definitions are written down rather than left in queries.

## Decision

- **What a report counts.** Bookings `COMPLETED` are served, `NO_SHOW` are No-shows, `CANCELLED` are cancelled and `BOOKED` are "not finished". Total is those four. `CANCELLED_BY_CLOSURE` and `PAUSED_LEAVE` are left out: nobody was expected for those meals.
- **No-show rate** is No-shows ÷ (served + No-shows), the same as the dashboard, and is empty rather than 0% when no meals have finished.
- **Waste is an estimate, in plates.** Admin §O defines it as booked-and-prepared minus attended. The system records neither how much was cooked nor what a plate weighs, so waste is plates booked on finished meals that nobody came for, and the design's kilograms are not shown. Days without attendance data are skipped, so a missing feed never looks like a kitchen that wasted everything (BR-FC-2).
- **Early and late arrival are not reported.** The design has these columns, but no rule defines them, manual and imported marks do not carry a true arrival time, and the face-verification provider is not connected.
- **Locked and open in the forecast.** A meal on a date is locked once its last slot's cancellation deadline has passed, because cancellations can no longer lower the booked number.
- **Expected plates** follow BR-FC-1 per slot and diet, each rounded up, then added for the meal, so the kitchen is never a plate short because of rounding.
- **Slot utilization** is seats taken ÷ capacity (BR-CAP-1) over days the meal was open. It is hidden when filtered to one hostel, because one hostel's seats cannot be set against a whole slot's capacity.
- **Report ranges.** Past days and today only, up to 366 days. Exports up to 31 days download straight away; longer ones run as a background job checked every minute. Only the staff member who asked can see or download a background export.
- **Running a job by hand** needs `system:manage` and a reason, and is audited as an override. Its audit entry commits only if the job was queued. `job_runs` still stops a finished date from running twice.
- **Left out of the design, for now.** "Food waste" and "Inventory" pages: no requirement or data behind them beyond the estimate above.

## Consequences

To confirm with the mess: an average plate weight, or a way to record plates cooked, if waste in kilograms is wanted; and whether early and late arrival matter once the provider is connected, which would need a rule for what counts as each.

A dinner with only No-shows in its short history can forecast 0 expected plates. The low-confidence note covers this until 7 days of history exist; staff should read expected plates with it in mind during the first week.

Reports read live tables with indexed aggregates. If a real year of data proves slow, summary tables can be added behind the same `AdminReportsRepository` without changing the API.
