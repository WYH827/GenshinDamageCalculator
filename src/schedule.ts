/** First trigger is after one interval; include the range endpoint. */
export function scheduledCount(
  duration: number | null,
  interval: number,
): number {
  if (!(interval > 0) || !Number.isFinite(interval)) return 0;
  if (duration === null) return Infinity;
  const n = duration / interval;
  return Math.max(0, Math.floor(n + 8 * Number.EPSILON * Math.max(1, n)));
}
export function scheduledCountLabel(duration: number | null, interval: number) {
  const count = scheduledCount(duration, interval);
  return Number.isFinite(count) ? String(count) : "∞";
}
export function boundedActiveFor(
  kind: string,
  duration: number | null,
  activeFor?: number | null,
) {
  return kind === "sharedPeriodic" && duration !== null
    ? Math.min(activeFor ?? duration, duration)
    : (activeFor ?? null);
}
