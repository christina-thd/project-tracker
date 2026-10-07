const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** How long ago, short: "now", "5m", "3h", "2d", "3w", then the date ("12 Mar"). */
export function ago(time, now = Date.now()) {
  const elapsed = Math.max(0, now - time);
  if (elapsed < MINUTE) return 'now';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h`;
  if (elapsed < 7 * DAY) return `${Math.floor(elapsed / DAY)}d`;
  if (elapsed < 8 * 7 * DAY) return `${Math.floor(elapsed / (7 * DAY))}w`;
  return new Date(time).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** A full date and time, for the item sheet. */
export const dateTime = (time) => new Date(time).toLocaleString(undefined, {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

/** "1 item", "3 items". */
export const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
