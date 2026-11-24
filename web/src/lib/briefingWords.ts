const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function parseIsoParts(iso: string): { year: number; month: number; day: number; utcDate: Date } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || iso.startsWith("0000")) {
    throw new Error(`Invalid calendar date: ${iso}`);
  }
  const [year, month, day] = iso.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year!, month! - 1, day!));
  if (!Number.isFinite(utcDate.getTime()) || utcDate.toISOString().slice(0, 10) !== iso) {
    throw new Error(`Invalid calendar date: ${iso}`);
  }
  return { year: year!, month: month!, day: day!, utcDate };
}

export function formatReleaseDate(iso: string): string {
  const { year, month, day, utcDate } = parseIsoParts(iso);
  const weekday = WEEKDAYS[utcDate.getUTCDay()];
  const monthName = MONTHS[month - 1];
  return `${weekday}, ${monthName} ${day}, ${year}`;
}

export function daysUntil(iso: string, todayIso: string): number {
  const target = parseIsoParts(iso).utcDate.getTime();
  const today = parseIsoParts(todayIso).utcDate.getTime();
  return Math.round((target - today) / 86_400_000);
}

export function periodTitle(target: string, periodIso: string): string {
  const { year, month } = parseIsoParts(periodIso);
  if (target === "gdp") {
    const quarter = Math.floor((month - 1) / 3) + 1;
    return `Q${quarter} ${year}`;
  }
  return `${MONTHS[month - 1]} ${year}`;
}
