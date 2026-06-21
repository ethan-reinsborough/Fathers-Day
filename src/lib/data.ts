import type { Latest, History, Stations } from "./types";

const BASE = import.meta.env.BASE_URL; // "/" or "/gas-guru/" etc.

async function loadJSON<T>(name: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}data/${name}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export interface AppData {
  latest: Latest | null;
  history: History | null;
  stations: Stations | null;
}

export async function loadAll(): Promise<AppData> {
  const [latest, history, stations] = await Promise.all([
    loadJSON<Latest>("latest.json"),
    loadJSON<History>("history.json"),
    loadJSON<Stations>("stations.json"),
  ]);
  return { latest, history, stations };
}
