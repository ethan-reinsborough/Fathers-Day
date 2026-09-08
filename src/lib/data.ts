import type { Latest, History, Stations } from "./types";
import { fetchJSON } from "./network.ts";
import { readStored, writeStored } from "./storage.ts";
// Bundled snapshots make the first render independent of the network.
import bundledLatest from "../../public/data/latest.json" with { type: "json" };
import bundledHistory from "../../public/data/history.json" with { type: "json" };
import bundledStations from "../../public/data/stations.json" with { type: "json" };

export interface AppData {
  latest: Latest | null;
  history: History | null;
  stations: Stations | null;
}
export type DataKey = keyof AppData;
const KEYS: DataKey[] = ["latest", "history", "stations"];
const BASE = import.meta.env?.BASE_URL ?? "/";
export function validData(key: DataKey, value: any): boolean {
  if (!value || !Number.isFinite(Date.parse(value.generatedAt))) return false;
  const price = (n: unknown) =>
    typeof n === "number" && Number.isFinite(n) && n > 30 && n < 500;
  if (key === "latest") {
    const p = value.prediction;
    const validPrediction =
      p == null ||
      ([
        "currentRegular",
        "predictedRegular",
        "confidenceLow",
        "confidenceHigh",
      ].every((k) => price(p[k])) &&
        ["deltaCents", "confidenceHalfWidth", "observedFraction"].every((k) =>
          Number.isFinite(p[k]),
        ) &&
        typeof p.nextChangeDate === "string" &&
        typeof p.benchmark?.latestNyHarborDate === "string" &&
        Number.isFinite(p.benchmark?.momentumCents));
    return (
      validPrediction &&
      price(value.regulated?.regularSelfServe) &&
      /^\d{4}-\d{2}-\d{2}$/.test(value.regulated?.effectiveDate)
    );
  }
  if (key === "history")
    return (
      Array.isArray(value.series) &&
      value.series.length > 0 &&
      value.series.every(
        (p: any) => price(p.regular) && /^\d{4}-\d{2}-\d{2}$/.test(p.date),
      )
    );
  return (
    Array.isArray(value.stations) &&
    value.stations.every(
      (s: any) =>
        typeof s.id === "string" &&
        typeof s.name === "string" &&
        typeof s.locality === "string" &&
        price(s.regular),
    )
  );
}
export function initialData(): AppData {
  const bundled = {
    latest: bundledLatest,
    history: bundledHistory,
    stations: bundledStations,
  } as AppData;
  const result: AppData = { latest: null, history: null, stations: null };
  for (const key of KEYS) {
    const saved = readStored<any>(`gg-data-v2-${key}`, null);
    const candidates = [saved, bundled[key]].filter((v) => validData(key, v));
    candidates.sort(
      (a, b) => Date.parse(b.generatedAt) - Date.parse(a.generatedAt),
    );
    (result as any)[key] = candidates[0] ?? null;
  }
  return result;
}
/** Publish each section separately; optional data must never block the price. */
export async function refreshData(
  onData: (key: DataKey, value: any) => void,
  fetcher: typeof fetch = fetch,
  timeoutMs = 6500,
): Promise<DataKey[]> {
  const failures: DataKey[] = [];
  await Promise.all(
    KEYS.map(async (key) => {
      try {
        const value = await fetchJSON<any>(
          `${BASE}data/${key}.json`,
          timeoutMs,
          fetcher,
        );
        if (!validData(key, value)) throw new Error("Invalid price data");
        const saved = readStored<any>(`gg-data-v2-${key}`, null);
        if (
          !validData(key, saved) ||
          Date.parse(value.generatedAt) >= Date.parse(saved.generatedAt)
        )
          writeStored(`gg-data-v2-${key}`, value);
        onData(key, value);
      } catch {
        failures.push(key);
      }
    }),
  );
  return failures;
}
