/**
 * "Viewed just now", "Viewed 5 min ago", "Viewed yesterday", "Viewed 3 days
 * ago". Coarse on purpose: this is a memory jog for a browsing guest, not a
 * log. `at` of 0 means the time was never stored (the first storage format).
 */
export function viewedAgo(at: number, now: number = Date.now()): string | null {
  if (!at) return null;
  const minutes = Math.max(0, Math.round((now - at) / 60_000));
  if (minutes < 1) return "Viewed just now";
  if (minutes < 60) return `Viewed ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Viewed ${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Viewed yesterday";
  if (days < 7) return `Viewed ${days} days ago`;
  const weeks = Math.round(days / 7);
  return `Viewed ${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
}
