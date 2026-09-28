/** The SAT dates students can pick from, as local dates. */
export const SAT_DATES = [
  { date: '2026-10-03', label: 'October 3' },
  { date: '2026-11-07', label: 'November 7' },
  { date: '2026-12-05', label: 'December 5' },
] as const;

/** Test centres open their doors at 8:00 in the morning, so that's what the countdown runs to. */
export function satStart(date: string): Date {
  return new Date(`${date}T08:00:00`);
}

/** The dates still to come. */
export function upcomingSatDates(now = new Date()) {
  return SAT_DATES.filter((d) => satStart(d.date) > now);
}

export function satLabel(date: string): string {
  return SAT_DATES.find((d) => d.date === date)?.label ?? date;
}
