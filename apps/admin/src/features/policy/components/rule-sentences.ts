/** "90 minutes", "1 hour", "2 hours": deadlines are stored in minutes but read better as hours. */
export function formatDuration(minutes: number): string {
  if (minutes % 60 !== 0) return `${minutes} minutes`;
  const hours = minutes / 60;
  return hours === 1 ? '1 hour' : `${hours} hours`;
}

export function formatOrdinal(value: number): string {
  const lastTwo = value % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${value}th`;
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[value % 10] ?? 'th';
  return `${value}${suffix}`;
}

const beforeSlot = (minutes: number) =>
  minutes === 0 ? 'the moment their slot starts' : `${formatDuration(minutes)} before their slot`;

/*
 * Each setting says in plain words what its current value does (Figma "Settings & rules"). These
 * follow the draft as it is typed. An emptied number field is NaN, and the row asks for a value.
 */
const ASK_FOR_NUMBER = 'Enter a number to see what this does.';

export const cancelSentence = (minutes: number) =>
  Number.isNaN(minutes) ? ASK_FOR_NUMBER : `Students can cancel until ${beforeSlot(minutes)}.`;

export const dietSentence = (minutes: number) =>
  Number.isNaN(minutes)
    ? ASK_FOR_NUMBER
    : `Students can change Veg or Non-Veg until ${beforeSlot(minutes)}.`;

export const horizonSentence = (days: number) =>
  Number.isNaN(days) ? ASK_FOR_NUMBER : `Students can view and book meals ${days} days ahead.`;

export const disableSentence = (count: number, windowDays: number) =>
  Number.isNaN(count) || Number.isNaN(windowDays)
    ? ASK_FOR_NUMBER
    : `${count} No-shows for a meal within any rolling ${windowDays} days turns that meal’s Default Booking off.`;

export const warningSentence = (count: number) =>
  Number.isNaN(count)
    ? ASK_FOR_NUMBER
    : `Students get a warning on Home and a notification at their ${formatOrdinal(count)} No-show for a meal.`;

export const forecastSentence = (days: number) =>
  Number.isNaN(days)
    ? ASK_FOR_NUMBER
    : `Kitchen forecasts use the last ${days} days of attendance.`;
