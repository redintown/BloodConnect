/** Whole-blood interval used to derive `donor_profiles.is_eligible`. */
export const MIN_DAYS_BETWEEN_DONATIONS = 56;

function startOfUtcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function parseIsoDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function nextEligibleDate(lastDonationDate: string): string | null {
  const parsed = parseIsoDateOnly(lastDonationDate);
  if (!parsed) return null;
  parsed.setUTCDate(parsed.getUTCDate() + MIN_DAYS_BETWEEN_DONATIONS);
  return parsed.toISOString().slice(0, 10);
}

export function isEligibleFromLastDonation(
  lastDonationDate: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!lastDonationDate) return true;
  const next = nextEligibleDate(lastDonationDate);
  if (!next) return false;
  const nextDate = parseIsoDateOnly(next);
  if (!nextDate) return false;
  return startOfUtcDay(now) >= startOfUtcDay(nextDate);
}
