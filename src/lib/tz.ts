// Angola (Africa/Luanda) is UTC+1 all year, no daylight saving.
export const TZ_OFFSET = "+01:00";
const OFFSET_MS = 60 * 60 * 1000;

/** ISO instant for the start of a YYYY-MM-DD day in Angola time. */
export const dayStartIso = (d: string) => new Date(`${d}T00:00:00${TZ_OFFSET}`).toISOString();
/** ISO instant for the end of a YYYY-MM-DD day in Angola time. */
export const dayEndIso = (d: string) => new Date(`${d}T23:59:59.999${TZ_OFFSET}`).toISOString();

/** Today's date (YYYY-MM-DD) in Angola time. */
export function todayAngola() {
  return new Date(Date.now() + OFFSET_MS).toISOString().slice(0, 10);
}

/** Calendar parts of an instant, in Angola time. */
export function angolaParts(when: string | Date) {
  const d = new Date(new Date(when).getTime() + OFFSET_MS);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}
