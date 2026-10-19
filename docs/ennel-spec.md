# ENNEL — Complete Student App Functional Specification

> Every page • Every important button • Examples • Expected system behaviour
>
> Scope: Student/User side only — excludes the Mess Admin Dashboard
>
> Converted verbatim from `docs/source/ENNEL_Full_Student_Side_Functional_Specification.docx`. Section numbers are preserved and are what code comments cite as "Spec §n". If this file and the .docx ever disagree, the .docx is the original.

## 1. Purpose and Overall Idea

ENNEL is a student-facing smart mess application for hostel and college students. It lets each student decide which meals they usually eat, automatically reserve their usual meal slots, make one-day or weekday-specific changes, cancel meals before the allowed deadline, record attendance through the college's existing face-verification process if integration is approved, apply for leave, see meal history, receive announcements, and send private complaints or feedback.

The key goal is to give students control while helping the mess estimate meal demand more accurately, reduce avoidable food waste, and reduce queues. This document describes what the student sees and what every important control should do. It does not specify the admin dashboard.

## 2. Main Navigation and Supporting Screens

| Navigation item       | Purpose                                                                                       | How opened                            |
| --------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------- |
| Home                  | Today's meal status, book/change/cancel actions, deadline countdowns, warnings and shortcuts. | Bottom navigation                     |
| My Bookings           | Historical meal records, completion, verification, cancellation and No-show details.          | Bottom navigation                     |
| Default Booking       | Recurring automatic booking preferences and per-meal controls.                                | Bottom navigation                     |
| Profile               | Personal and hostel details, meal preference, leave status, No-show counts and settings.      | Bottom navigation                     |
| Complaints & Feedback | Private food/mess complaints, meal feedback and optional photo upload.                        | Bottom navigation or Profile shortcut |
| Notifications         | Announcements, booking reminders, warnings and updates.                                       | Bell icon on Home                     |
| Slot Selection        | Choose time slot and meal type; see capacity and recommendations.                             | Book or Change Slot                   |
| Plan Ahead            | Change/book meals for a future date or recurring selected weekdays.                           | Home shortcut                         |
| Leave Management      | Apply, extend, end and review leave.                                                          | Home shortcut or Profile              |

The five main student navigation sections are Home, My Bookings, Default Booking, Profile, and Complaints & Feedback. Notifications are reached from the Home bell. Slot Selection, Plan Ahead and Leave Management are supporting screens.

## 3. Account Creation and First Login

### Screen 1 — Splash Screen

Show the ENNEL logo and tagline, such as “Good Food. Better You.” A short loading state may appear while the app checks the session.

- **Continue / Get Started** — Opens the reference-number login screen.

### Screen 2 — Enter Reference Number

The student enters the unique college-issued reference number. Example: 24 900 417 (the exact format depends on the college). The app must validate the number against authorized college records rather than accepting any typed number.

- **Reference Number field** — Accepts the student's college reference number.
- **Continue** — If valid and not yet registered, opens Create Your Password. If invalid, shows an understandable error and keeps the student on the page. If already registered, direct the student to normal login/reset flow.
- **Help / Contact Support (if included)** — Explains where to find the college reference number or how to get help.

### Screen 3 — Create Your Password

- **New Password field** — Accepts the new password; password is hidden by default.
- **Show/Hide password icon** — Toggles password visibility.
- **Confirm Password field** — Requires the same password to be entered again.
- **Create Account** — Validates the password rules and match, securely creates the account, and opens Account Created.

Example: if the password and confirmation differ, show “Passwords do not match.” Passwords must be securely hashed by the backend, never stored as plain text.

### Screen 4 — Account Created

- **Continue** — Starts the profile-completion flow. Do not send a first-time user straight to Home.

### Screen 5 — Complete Your Profile

Fields: profile photo (optional if college data already provides one), full name, department, academic year, hostel name/block, room number, student's contact number, parent's contact number and email address. Prefill authorized college data where possible and let the student correct only fields the college permits them to edit.

- **Add / Change Photo** — Opens photo selection or camera permission flow, if supported.
- **Continue** — Validates required fields and moves to Hostel & Room Details or the next setup step.

### Screen 6 — Hostel & Room Details

- **Hostel dropdown** — Selects the assigned hostel or block from valid options.
- **Room Number field** — Enters or confirms the student's room.
- **Contact Number fields** — Stores student and parent contact details.
- **Continue** — Validates details and moves to Meal Preferences / Default Booking setup.

### Screen 7 — Meal Preferences and Default Booking Setup

This is a required first-time setup step before Home. Students choose the meals they want to book automatically, the preferred slot for lunch/dinner, and Veg or Non-Veg preference where available.

- **Breakfast checkbox / toggle** — Enables or disables recurring breakfast booking.
- **Lunch checkbox / toggle** — Enables or disables recurring lunch booking.
- **Dinner checkbox / toggle** — Enables or disables recurring dinner booking.
- **Meal type: Veg / Non-Veg** — Sets the preferred type for that meal, subject to the actual menu and availability.
- **Default Lunch Slot** — Selects one of the five lunch slots.
- **Default Dinner Slot** — Selects one of the seven dinner slots.
- **Default Booking ON/OFF** — Controls automatic recurring booking; students can later adjust the overall and per-meal settings.
- **Continue / Review Details** — Moves to the review screen.

### Screen 8 — Review Your Details

- **Back / Edit** — Returns to the relevant setup screen without losing entered information.
- **Save & Continue** — Saves the profile and recurring preferences, generates eligible future default bookings, and opens Home.

Important: creating a one-time manual booking later should not silently switch recurring Default Booking ON.

## 4. Home Page — Main Student Dashboard

The Home page is the main screen students see after setup and whenever they open the app.

### 4.1 Header and student identity

- **Student profile photo** — Opens Profile, or a profile shortcut if desired.
- **Greeting and student name** — Displays a time-appropriate greeting and the student's name, for example “Good Morning, Ashwin!”
- **Hostel block and room** — Displays the student's current hostel/block and room, for example “Hostel Block A • Room 323.”
- **Bell icon** — Opens Notifications. A badge/dot indicates unread notifications.

### 4.2 Date selector and Today's Meals

- **Date / Calendar control** — Opens a calendar or date picker. Selecting another date loads that date's meals and eligible actions. It must be clear when the student is viewing a future date rather than today.
- **Previous / Next date (if provided)** — Moves one date backward/forward within the allowed booking horizon.

Each Breakfast, Lunch and Dinner card shows the meal name, date, serving time or selected slot, meal type, booking status and actions allowed at that moment.

### 4.3 Meal-card buttons and states

- **Book Breakfast / Book Meal** — Opens Slot Selection for the selected meal/date. Breakfast has one serving window rather than multiple lunch/dinner slots; student chooses meal type and confirms.
- **Change Slot** — Opens Slot Selection for that meal/date. The selected new slot applies only to the chosen date when launched from Home or Plan Ahead; it does not overwrite recurring defaults.
- **Cancel** — Opens a confirmation dialog and cancels that meal only if the one-hour-before-start cancellation deadline has not passed.
- **Meal type selector (Veg / Non-Veg)** — Lets the student choose or change the meal type if changes are still allowed. It must show whether the change affects only the selected date or the recurring preference.
- **Booking status label** — Informational status such as Not Booked — Default Off, Booked (Default), Booked Once, Changed for This Day, Cancelled, Booking Paused or No-show. It is not necessarily a button.

### 4.4 Cancel Today's Whole Meal

- **Cancel Today's Meals** — Opens a confirmation summary of Breakfast, Lunch and Dinner and identifies which are still eligible to cancel. On confirmation, cancels only eligible meals; it must not bypass deadlines.
- **Confirm cancellation** — Applies cancellation to eligible meals and updates Home and My Bookings as appropriate.
- **Keep Meals / Go Back** — Closes the confirmation dialog without changing bookings.

### 4.5 Countdown and Important Note

Show a countdown near each eligible Cancel and Change Slot action. For cancellation, the deadline is one hour before that meal/slot begins. For changing a slot, the deadline is the start of the currently booked slot. Example: if lunch starts at 11:00 AM, cancellation closes at 10:00 AM. At 9:00 AM, show approximately “Cancellation closes in 1 hour.” When the deadline passes, disable the action and explain why.

### 4.6 Plan Ahead and Leave cards

- **Plan Ahead** — Opens the Plan Ahead flow to choose Today, Tomorrow, a specific calendar date, or selected recurring weekdays.
- **Leave / Apply for Leave** — Opens Leave Management so the student can apply for absence or review an existing leave.

### 4.7 No-show warning popup

When a meal-specific No-show count reaches three within the rolling 30-day period, show a small yellow warning on Home and/or a dismissible popup. It should identify the meal and explain that two additional No-shows will disable automatic Default Booking for that meal. Do not block the entire app.

- **View Details** — Opens Profile or the meal-specific No-show details.
- **Got It / Close** — Dismisses the popup; the warning remains available in the appropriate status area until it is no longer relevant.

## 5. Slot Selection Screen

This shared screen is opened by Book Meal or Change Slot. It displays the selected date and meal, all valid slots, capacity information, meal-type selection, and a confirmation button.

### 5.1 Slot cards

- **Slot card** — Selects a slot if the policy permits it. A selected card is visually highlighted.
- **Availability indicator** — Shows Available, Filling Fast, Full, Recommended or Over Capacity, based on live booking counts and configured thresholds.
- **Booked count / capacity** — Shows values such as 320 / 500 booked and occupancy percentage. Capacity values in mockups are examples and must be replaced by the mess's actual configured capacities.
- **Recommended label** — Suggests a less-crowded slot. It should not automatically change the student's choice.
- **Meal Type: Veg / Non-Veg** — Selects the meal type for the booking.
- **Confirm Slot / Save Changes** — Validates the slot, deadline, meal-type availability and capacity policy; saves the booking and returns to the relevant date's Home/Plan Ahead view.
- **Back** — Returns to the previous screen without saving a new choice.

Lunch slots: 11:00–11:30 AM; 11:30 AM–12:00 PM; 12:00–12:30 PM; 12:30–1:00 PM; 1:00–1:30 PM. Dinner slots: 6:45–7:00 PM; 7:00–7:15 PM; 7:15–7:30 PM; 7:30–7:45 PM; 7:45–8:00 PM; 8:00–8:15 PM; 8:15–8:30 PM. Breakfast has one serving window, currently shown in mockups as 7:00–8:30 AM; confirm the actual timetable.

### 5.2 Full slot and over-capacity rule

The requested behaviour allows a student to book a slot even after its displayed capacity is reached, because some booked students may not attend. If the mess approves this, do not label the slot simply “Full” and silently block it. Show a clear message such as “Official capacity reached — additional bookings are being accepted under the mess policy” and show the accepted booking count separately from official capacity. Example: 500 / 500 capacity plus 7 additional bookings becomes 507 accepted bookings; occupancy is 100% of official capacity, with 7 over-capacity bookings. This can increase crowding, so the institution must explicitly approve this rule.

If the policy does not permit over-capacity bookings, the Full slot must be disabled instead. The app needs one consistent approved rule.

## 6. Plan Ahead — One-Day and Recurring Exceptions

### 6.1 Choose a date

- **Today** — Opens today's meal view so the student can review or change today's eligible meals.
- **Tomorrow** — Opens tomorrow's meal view.
- **Choose a Date** — Opens a calendar. Selecting a date opens that date's Breakfast, Lunch and Dinner cards.
- **Calendar previous/next month** — Moves between months within the allowed planning horizon.
- **Select date** — Confirms the date and opens that day's meal-management view.
- **Back** — Returns to the Plan Ahead choice screen.

On the selected date, the student sees the same meal cards as Home, but the date is explicitly displayed. A change here affects only that date and does not rewrite normal Default Booking.

### 6.2 Choose a Day — recurring weekday exception

- **Choose a Day** — Opens weekday selection for a repeating exception.
- **Weekday checkboxes** — Selects one or more weekdays, such as Monday, Wednesday, Friday and Sunday.
- **Meal selection** — Chooses which meal(s) the weekday rule applies to.
- **Slot selection** — Chooses the alternative slot for those weekdays.
- **Meal type** — Sets the type for those affected bookings, subject to availability.
- **Save Rule** — Stores the repeating exception while leaving other weekdays on the normal Default Booking.
- **Edit / Delete Rule** — Changes or removes a saved weekday exception.

Example: normal lunch default is 12:30–1:00 PM. The student creates a rule for Monday, Wednesday, Friday and Sunday to use 1:00–1:30 PM. Tuesday, Thursday and Saturday continue using 12:30–1:00 PM. This is an exception rule, not a change to the global default.

If a one-day exception and a weekday rule overlap, the app needs a defined priority. Recommended clear behaviour: the date-specific choice wins for that date, and the app shows which rule is being applied.

## 7. My Bookings Page

My Bookings is the student's history. Upcoming meals remain on Home; once a meal is completed, cancelled or its attendance window expires, its final record appears here.

- **Date filter / Calendar icon** — Filters the history to a selected date or date range.
- **Meal filter** — Shows Breakfast, Lunch or Dinner records only.
- **Status filter** — Filters Completed, Cancelled and No-show records.
- **Booking record / View Details** — Opens the detailed record: meal date, selected slot, meal type, booking source (default/manual/Plan Ahead), final status and relevant timestamps.
- **Face Verified details** — Shows that the existing attendance system verified the student and displays the verification time, if that data is available and authorized.
- **Cancelled at timestamp** — Shows when the student cancelled the booking.
- **No-show record** — Shows that the meal window ended without valid attendance, with a way to report a possible attendance-system error.
- **Back to Home** — Returns to Home.

Example: Breakfast — Meal Completed, Face Verified at 8:05 AM; Lunch — Cancelled at 10:15 AM; Dinner — No-show, meal window ended without recorded attendance. The app should never fabricate a verification timestamp.

## 8. Default Booking Page

This page controls recurring meal bookings. It must clearly distinguish the global automatic-booking switch from each meal's own switch.

### 8.1 Overall Default Booking toggle

- **Overall ON** — Enables automatic booking for the meals whose individual switches are ON, using their saved preferences.
- **Overall OFF** — Pauses automatic booking for all meals. It should not erase each meal's saved slot or meal-type preferences.
- **Information icon** — Explains how automatic booking works and how the student can override one date.

### 8.2 Current Default Slots cards

Show one card each for Breakfast, Lunch and Dinner. Each card displays the preferred time, meal type, whether recurring booking is ON/OFF and an availability status.

- **Breakfast card / arrow** — Opens Breakfast settings only.
- **Lunch card / arrow** — Opens Lunch settings only.
- **Dinner card / arrow** — Opens Dinner settings only.
- **Per-meal ON/OFF** — Enables or disables recurring booking for that meal without affecting the other meals.
- **Edit slot** — Opens the slot choices for that meal.
- **Meal type selector** — Changes the recurring meal-type preference for that meal.
- **Save Changes** — Saves only the edited meal's recurring preference and shows confirmation.

### 8.3 Change Slots — all meals together

- **Change Slots** — Opens a screen showing Breakfast, Lunch and Dinner settings together.
- **Expand/collapse meal section** — Shows or hides the options for that meal.
- **Slot card** — Selects the recurring preferred time for that meal.
- **Meal type option** — Selects Veg or Non-Veg for the recurring preference.
- **Save and Continue Default Booking** — Saves all changed recurring preferences and returns to Default Booking. It should show a summary of what changed.

Example: Breakfast OFF, Lunch ON at 12:00–12:30 PM with Non-Veg, Dinner ON at 7:30–7:45 PM with Veg. Only enabled meals are automatically booked. If the student turns Breakfast OFF, Lunch and Dinner remain unchanged.

### 8.4 Full-slot fallback

A mockup suggests assigning the next available slot if a preferred slot is full. This must be an explicit rule: tell the student whether the app will automatically choose an alternative or ask the student to select one. Recommended: display the fallback choice clearly and notify the student, rather than silently changing their slot.

## 9. Profile Page

Profile is the student's central place to review identity details, account settings, meal preferences, No-show counts and leave status.

- **Edit Profile** — Opens editable fields. College-controlled fields may be read-only or require verification.
- **Personal Information** — Opens name, department, year, phone and email details.
- **Hostel & Room Details** — Shows or requests changes to hostel/block and room information.
- **Meal Preference** — Opens meal-type preferences; explain whether the change affects future recurring bookings, individual bookings or both.
- **No-show count tile** — Shows counts separately for Breakfast, Lunch and Dinner within the rolling 30-day window.
- **Leave Status tile** — Shows Not on Leave, Upcoming Leave or On Leave and links to Leave Management.
- **Leave Management** — Opens leave application and history.
- **Help & Support** — Opens FAQs and support contact methods.
- **About ENNEL** — Shows app version, terms and privacy policy.
- **Settings icon** — Opens account/security settings, notification preferences if offered, and related controls.
- **Logout** — Asks for confirmation, ends the session and returns to Login.

Example profile summary: Breakfast No-shows: 1; Lunch: 3; Dinner: 0. Counts are independent per meal, not added into one total for the penalty rule.

## 10. No-show Rules and Warnings

The user's latest rule is five No-shows per meal in a rolling 30-day period. Breakfast, Lunch and Dinner are counted separately. At five No-shows for a meal, Default Booking is disabled for that meal only; the student may still manually book subject to normal rules.

| No-shows for one meal in rolling 30 days | Student-facing behaviour                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1–2                                      | Record the events and show the count in Profile.                                           |
| 3                                        | Yellow warning on Home: two more No-shows will disable Default Booking for that meal.      |
| 4                                        | Keep a visible warning and current count.                                                  |
| 5                                        | Disable recurring Default Booking for that meal; show why and how to make manual bookings. |

A No-show is recorded only after the allowed attendance window ends and no valid face verification/attendance is recorded. Approved leave and timely cancellations must not count as No-show. Include a process to report incorrect records or a face-verification outage. The institution should approve this policy before launch.

## 11. Leave Management Page

### 11.1 Apply for Leave form

- **From Date** — Selects the first date of leave.
- **To Date** — Selects the last date of leave; it cannot be earlier than From Date.
- **From Meal** — Selects the first affected meal, such as Breakfast, Lunch or Dinner.
- **To Meal** — Selects the final affected meal. The system must calculate the exact inclusive meal range across the dates.
- **Reason (optional)** — Allows the student to add a short reason if the institution wants this field.
- **Leave Summary** — Updates automatically with dates, number of days and meals that will be skipped.
- **Apply Leave** — Validates the range, shows a final confirmation and submits the leave request. The app must show whether the request is immediately active or pending approval.
- **Cancel / Back** — Leaves the form without submitting.

Example: From 22 May to 31 May, Breakfast through Dinner. The summary shows 10 days and 30 meals skipped, if all three meals are included each day.

### 11.2 Current leave status and leave history

- **Current Leave Status** — Shows Not on Leave, Upcoming Leave, On Leave or Pending, along with the affected dates and meals.
- **Leave History / View All** — Shows previous leave requests with dates, meal range and status.
- **Leave request row** — Opens the details of that request.
- **Extend Leave** — Allows the student to add dates/meals to an active or upcoming leave, validates the new range and updates the summary.
- **Cancel Leave / Resume Meals** — Lets the student end a leave early and select the date/meal from which normal booking should resume, subject to the college's rules.
- **Go to Leave Management** — From the Home leave banner, opens this page directly.

While leave is active, Home should display “Booking Paused Due to Leave”, the leave dates and affected meals. Those meal cards show “Not Available” or “Booking Paused — On Leave.” The app should not create bookings or No-shows for meals covered by approved leave. Default booking resumes after leave ends, unless another restriction applies.

## 12. Complaints & Feedback Page

Students need a private way to report food-quality issues, cleanliness concerns, service problems or provide general feedback. The page should not operate as an open public chat where other students can see personal submissions.

- **Submission type** — Lets the student choose Complaint or Feedback.
- **Related meal/date** — Optionally links the submission to Breakfast, Lunch or Dinner and the date.
- **Category** — Examples: food quality, foreign object in food, cleanliness, service, menu or other.
- **Description text box** — Accepts the student's explanation.
- **Upload Photo** — Allows a student to attach a photo as evidence, with permission and file-size/type validation.
- **Remove Photo** — Removes an attached photo before submission.
- **Submit** — Sends the report securely and shows a reference number or confirmation.
- **My Reports / Status (if included)** — Lets the student see their own submissions and status without exposing them to other students.
- **Back** — Returns without submitting; warn if unsaved text or photos would be lost.

Example: “There was a foreign object in today's lunch.” The student selects Complaint, Lunch, today's date, adds a description and photo, then submits. Other students must not see the student's identity or report. Decide whether the submission is fully anonymous or identity is stored privately for authorized follow-up; do not promise anonymity if the backend retains identifying data.

## 13. Notifications Page

Opened by tapping the bell icon on Home.

- **Notification row** — Opens the full message and its related context.
- **Mark as Read** — Marks a notification read and updates the unread badge.
- **Mark All as Read** — Marks all notifications read.
- **Filter (if included)** — Filters announcements, bookings, warnings, leave updates and complaint updates.
- **Related action button** — Opens the relevant screen, such as View Booking, View Leave or View Announcement.

Notification examples: booking confirmed, cancellation deadline approaching, menu changed, leave request updated, third No-show warning, or complaint submitted. Notifications should be relevant, not duplicated, and must not disclose sensitive information on a lock screen unless the student has allowed previews.

## 14. Button and State Rules Shared Across the App

- Every button must perform the action its label promises; avoid decorative buttons that do nothing.
- Show loading state during save/submit and prevent duplicate submissions.
- Show success messages after booking, cancellation, profile save, leave submission and complaint submission.
- Show clear error messages for invalid dates, unavailable meal types, expired deadlines, network errors and failed saves.
- Use confirmation dialogs for destructive actions such as cancelling a booking, cancelling all eligible meals, ending leave early or logging out.
- Use text labels in addition to colour; do not communicate Available, Filling Fast, Full, warning or No-show by colour alone.
- Disable controls that are no longer allowed and explain why, rather than letting the user tap and fail without context.
- Use the backend as the final authority for deadlines, capacity, booking state, attendance and No-show calculations.

## 15. Core Data and System Behaviour

- **Student account:** reference number, profile details, secure authentication status and permitted editable fields.
- **Recurring preference:** global Default Booking state plus per-meal ON/OFF, preferred slot and meal type.
- **One-day booking exception:** date-specific booking, slot, meal type and action history; it must not overwrite recurring preferences.
- **Recurring weekday exception:** chosen weekdays, affected meal(s), slot and meal type, with edit/delete controls.
- **Booking record:** date, meal, slot, type, source, timestamps and final state.
- **Attendance record:** verification result and timestamp from the authorized existing attendance system.
- **Leave record:** date range, meal range, status, extensions and early termination/resumption details.
- **No-show record:** meal-specific event date, rolling-window status and any review outcome.
- **Complaint/feedback record:** content, optional photos, privacy mode, submission time and status.
- **Notification record:** category, content, read/unread state and related item.

## 16. Example End-to-End Student Journeys

### Example A — First-time student

1. Student enters a valid college reference number.
2. Creates and confirms a password.
3. Completes profile and hostel details.
4. Sets Breakfast OFF, Lunch ON at 12:00–12:30 PM with Veg, and Dinner ON at 7:30–7:45 PM with Non-Veg.
5. Reviews details and taps Save & Continue.
6. Home opens and shows the meals based on the saved settings.

### Example B — Change lunch only for today

1. Home shows today's Lunch booked for 12:00–12:30 PM.
2. Student taps Change Slot before 12:00 PM.
3. Slot Selection displays all lunch slots, booked counts, statuses and recommendations.
4. Student selects 12:30–1:00 PM and the desired meal type.
5. Student taps Confirm Slot.
6. Home shows “Changed for This Day”; the normal Default Booking remains 12:00–12:30 PM for future days.

### Example C — Recurring weekday exception

1. Default lunch is 12:30–1:00 PM.
2. Student opens Plan Ahead → Choose a Day.
3. Selects Monday, Wednesday, Friday and Sunday, then Lunch and 1:00–1:30 PM.
4. Student saves the rule.
5. Those selected weekdays use 1:00–1:30 PM; other days continue using the regular default.

### Example D — Leave for ten days

1. Student opens Leave Management.
2. Chooses 22 May through 31 May and Breakfast through Dinner.
3. Summary shows 10 days / 30 meals skipped.
4. Student taps Apply Leave and confirms.
5. Home displays Booking Paused Due to Leave and affected meal cards are unavailable.
6. Student can view the request, extend it, or end it early using the allowed controls.

### Example E — Meal-specific No-show limit

1. Student accumulates three lunch No-shows in the rolling 30-day window.
2. Home shows a yellow warning explaining that two more Lunch No-shows disable Lunch Default Booking.
3. At five Lunch No-shows, only Lunch Default Booking turns OFF; Breakfast and Dinner preferences remain unchanged.
4. Student can still manually book Lunch, subject to normal booking rules, and can report an incorrect attendance record.

### Example F — Submit a food-quality complaint

1. Student opens Complaints & Feedback.
2. Selects Complaint → Food Quality → Lunch and chooses the date.
3. Enters the description and uploads a photo.
4. Presses Submit and receives confirmation.
5. The submission is available only to the student and authorized staff, according to the chosen privacy model.

## 17. Design and Accessibility

Use the supplied ENNEL reference screens as the visual guide: mobile-first layout, clear hierarchy, rounded cards, accessible touch targets, consistent spacing, and icons paired with text. Suggested palette: Deep Green #0B5D46, Soft Mint #E7F4EC, white and light grey; yellow for warnings and red for cancellations or critical states. Inter or Roboto are suitable fonts.

- Use the same wording for the same status on Home, My Bookings and Profile.
- Keep dates and times explicit, including AM/PM.
- Make confirmation dialogs understandable and brief.
- Support small screens and larger text sizes.
- Provide accessible labels for icons and inputs.

## 18. Decisions to Confirm Before Development

1. Confirm exact breakfast serving window and actual meal timetable.
2. Approve whether full slots may accept bookings above official capacity. The example capacity 500 is illustrative, not a confirmed value.
3. Define thresholds for Available, Filling Fast and Recommended.
4. Confirm whether meal type can be changed after booking and the deadline for changing it.
5. Define what happens if a default slot is full: automatic fallback or ask the student.
6. Confirm whether leave is automatically active or requires approval.
7. Approve the rolling 30-day, five-No-show-per-meal policy and the review/appeal process.
8. Choose fully anonymous complaints or identity hidden from other students but retained privately for authorized staff.
9. Define priority when a one-day exception overlaps a recurring weekday rule.
10. Confirm permission/API access for the college's existing face-verification system.
11. Confirm which student profile fields are college-controlled and cannot be edited freely.

## Final Summary

ENNEL's student side is a complete meal-booking and student self-service experience. The five main sections are Home, My Bookings, Default Booking, Profile, and Complaints & Feedback; Notifications open from the Home bell. The most important implementation rule is to keep recurring Default Booking, one-day Plan Ahead changes, and recurring weekday exceptions separate. This document is a detailed functional specification for discussion and implementation planning; the open decisions above should be approved before developers treat them as final business rules.
