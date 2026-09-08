import type { Latest, Prediction, Station, Stations } from "./types";
export function ageHours(
  iso: string | null | undefined,
  now = Date.now(),
): number {
  const stamp = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(stamp)
    ? Math.max(0, (now - stamp) / 3600000)
    : Infinity;
}
export function atlanticDate(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "America/Moncton" });
}
export function pricesAreOld(latest: Latest, now = Date.now()): boolean {
  return (
    ageHours(latest.generatedAt, now) > 36 ||
    (latest.regulated.effectiveDateVerified !== false &&
      ageHours(latest.regulated.effectiveDate, now) > 8 * 24)
  );
}
export function currentPrediction(
  latest: Latest | null,
  now = Date.now(),
): Prediction | null {
  const p = latest?.prediction;
  if (
    !latest ||
    !p ||
    pricesAreOld(latest, now) ||
    latest.regulated.effectiveDateVerified === false
  )
    return null;
  if (p.nextChangeDate <= atlanticDate(new Date(now))) return null;
  if (ageHours(p.benchmark.latestNyHarborDate, now) > 7 * 24) return null;
  return p;
}
export function stationIsOld(
  station: Station,
  data: Stations | null,
  now = Date.now(),
): boolean {
  return (
    Boolean(station.stale || data?.stale) ||
    ageHours(station.postedAt, now) > 48
  );
}
export function gradeTimestamp(
  station: Station,
  grade: "regular" | "premium" | "diesel",
): string | null {
  return grade === "regular"
    ? (station.postedByGrade?.regular ?? station.postedAt)
    : (station.postedByGrade?.[grade] ?? null);
}
