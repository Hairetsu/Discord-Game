export function formatDollars(amount: number): string {
  return `$${Math.max(0, Math.floor(amount)).toLocaleString("en-US")}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function nowMs(): number {
  return Date.now();
}

export function localDateKey(timestamp: number, timezone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  return formatter.format(new Date(timestamp));
}

export function remainingSeconds(until: number, now: number): number {
  return Math.max(0, Math.ceil((until - now) / 1000));
}
