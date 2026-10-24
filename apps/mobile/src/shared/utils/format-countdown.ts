/**
 * "1 hr 5 min" until a deadline (Spec §4.5), or null once it has passed. Rounded up so the app
 * never says "0 min" while the action is still open.
 */
export function formatTimeLeft(deadlineAt: string, now: Date): string | null {
  const msLeft = new Date(deadlineAt).getTime() - now.getTime();
  if (msLeft <= 0) return null;
  const totalMinutes = Math.ceil(msLeft / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return hours > 0 ? `${days} d ${hours} hr` : `${days} d`;
  if (hours > 0) return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
  return `${minutes} min`;
}
