export function formatMinutes(minutes: number): string {
  const absM = Math.abs(minutes);
  const h = Math.floor(absM / 60);
  const m = absM % 60;
  const sign = minutes < 0 ? '-' : '';

  if (h === 0) return `${sign}${m}m`;
  if (m === 0) return `${sign}${h}h`;
  return `${sign}${h}h ${m}m`;
}
