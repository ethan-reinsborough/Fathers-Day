export interface Regulated {
  regularSelfServe: number;
  regularFullServe?: number | null;
  midGrade?: number | null;
  premium?: number | null;
  diesel?: number | null;
  furnace?: number | null;
  propane?: number | null;
  source: string;
  sourceUrl: string;
  effectiveDate: string;
}

export interface BenchmarkInfo {
  publishedCents: number | null;
  publishedDate: string;
  computedRecentCents: number;
  computedBaselineCents: number;
  latestNyHarborDate: string;
  fixedComponentCents: number | null;
  momentumCents: number;
}

export type Direction = "up" | "down" | "flat";

export interface Prediction {
  nextChangeDate: string;
  effectiveDate: string;
  currentRegular: number;
  predictedRegular: number;
  deltaCents: number;
  direction: Direction;
  confidenceLow: number;
  confidenceHigh: number;
  confidenceHalfWidth: number;
  daysObserved: number;
  observedFraction: number;
  interrupterRisk: boolean;
  interrupterNote: string;
  benchmark: BenchmarkInfo;
  volatilityCentsPerDay: number;
  method: string;
}

export interface BenchPoint {
  date: string;
  usdGal: number;
  fx: number;
  bcad: number;
}

export interface Latest {
  generatedAt: string;
  area: string;
  regulated: Regulated;
  prediction: Prediction | null;
  benchmarkSeries: BenchPoint[];
  notes: { regulatedMeaning: string; schedule: string };
}

export interface HistPoint {
  date: string;
  regular: number;
  benchmark: number | null;
}

export interface History {
  generatedAt: string;
  series: HistPoint[];
  full: number;
  sourceUrl: string;
}

export interface Station {
  id: string;
  name: string;
  brand: string | null;
  address: string;
  locality: string;
  lat: number | null;
  lng: number | null;
  regular: number;
  midgrade: number | null;
  premium: number | null;
  diesel: number | null;
  postedAt: string | null;
}

export interface Stations {
  generatedAt: string;
  lastLiveAt?: string;
  area: string;
  source: string;
  sourceUrl: string;
  stale: boolean;
  staleReason?: string;
  lowestRegular: number | null;
  highestRegular?: number;
  count?: number;
  stations: Station[];
}
