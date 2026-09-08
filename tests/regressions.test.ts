import test from "node:test";
import assert from "node:assert/strict";
import { fetchJSON } from "../src/lib/network.ts";
import { initialData, refreshData, validData } from "../src/lib/data.ts";
import {
  currentPrediction,
  stationIsOld,
  atlanticDate,
  gradeTimestamp,
} from "../src/lib/freshness.ts";
import {
  nearbyStations,
  LOCATIONS,
  distanceKm,
  normalize,
  validLocation,
  gasBuddyURL,
} from "../src/lib/locations.ts";
import { predict } from "../scripts/lib/predict.mjs";
import type { Latest, Stations } from "../src/lib/types.ts";

const now = Date.parse("2026-09-08T12:00:00Z");
const latest = (): Latest => ({
  generatedAt: "2026-09-08T10:00:00Z",
  area: "New Brunswick",
  regulated: {
    regularSelfServe: 170,
    effectiveDate: "2026-09-04",
    source: "NBEUB",
    sourceUrl: "https://nbeub.ca",
  },
  prediction: {
    nextChangeDate: "2026-09-11",
    currentRegular: 170,
    predictedRegular: 168,
    confidenceLow: 166,
    confidenceHigh: 170,
    confidenceHalfWidth: 2,
    deltaCents: -2,
    direction: "down",
    observedFraction: 0.4,
    benchmark: { latestNyHarborDate: "2026-09-04", momentumCents: -2 },
  } as any,
  benchmarkSeries: [],
  notes: { regulatedMeaning: "", schedule: "" },
});
const reports = (): Stations => ({
  generatedAt: "2026-09-08T10:00:00Z",
  area: "NB",
  source: "GasBuddy",
  sourceUrl: "https://www.gasbuddy.com",
  stale: false,
  lowestRegular: 160,
  stations: [
    {
      id: "freddy",
      name: "Fredericton station",
      address: "",
      locality: "Fredericton",
      lat: null,
      lng: null,
      regular: 160,
      midgrade: null,
      premium: 170,
      diesel: null,
      postedAt: "2026-09-08T10:00:00Z",
    },
    {
      id: "moncton",
      name: "Moncton station",
      address: "",
      locality: "Moncton",
      lat: 46.0878,
      lng: -64.7782,
      regular: 159,
      midgrade: null,
      premium: 170,
      diesel: null,
      postedAt: "2026-09-08T10:00:00Z",
    },
    {
      id: "unknown",
      name: "Unknown location",
      address: "",
      locality: "",
      lat: null,
      lng: null,
      regular: 150,
      midgrade: null,
      premium: null,
      diesel: null,
      postedAt: null,
    },
  ],
});

test("a request that never resolves is bounded and aborted", async () => {
  let signal: AbortSignal | undefined;
  const stuck = ((_url: any, options: any) => {
    signal = options.signal;
    return new Promise(() => {});
  }) as typeof fetch;
  await assert.rejects(fetchJSON("/stuck", 20, stuck), /timed out/);
  assert.equal(signal?.aborted, true);
});
test("a response body that stalls is also bounded", async () => {
  const stuck = (async () => ({
    ok: true,
    json: () => new Promise(() => {}),
  })) as typeof fetch;
  await assert.rejects(fetchJSON("/body", 20, stuck), /timed out/);
});
test("the price publishes before stalled optional station/history requests", async () => {
  const received: string[] = [];
  const fetcher = (async (url: any) =>
    String(url).endsWith("latest.json")
      ? new Response(JSON.stringify(latest()))
      : new Promise(() => {})) as typeof fetch;
  const refresh = refreshData((key) => received.push(key), fetcher, 40);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(received, ["latest"]);
  assert.deepEqual((await refresh).sort(), ["history", "stations"]);
});
test("HTTP errors and malformed payloads settle without erasing saved data", async () => {
  const before = initialData();
  const failures = await refreshData(
    () => assert.fail("invalid data was published"),
    (async () =>
      new Response("<html>oops</html>", { status: 503 })) as typeof fetch,
    30,
  );
  assert.equal(failures.length, 3);
  assert.deepEqual(initialData(), before);
  assert.equal(
    validData("latest", { ...latest(), regulated: { regularSelfServe: null } }),
    false,
  );
  assert.equal(
    validData("latest", { ...latest(), prediction: { predictedRegular: 175 } }),
    false,
  );
  assert.equal(
    validData("history", {
      generatedAt: "2026-09-08",
      series: [{ date: "oops", regular: 170 }],
    }),
    false,
  );
});
test("bundled data renders with unavailable, corrupt, or throwing browser storage", () => {
  const descriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );
  try {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("storage denied");
      },
    });
    assert.ok(initialData().latest?.regulated.regularSelfServe);
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: { getItem: () => "{broken" },
    });
    assert.ok(initialData().history?.series.length);
  } finally {
    if (descriptor)
      Object.defineProperty(globalThis, "localStorage", descriptor);
    else delete (globalThis as any).localStorage;
  }
});
test("forecasts expire on the Atlantic reset date and reject stale benchmarks", () => {
  assert.ok(currentPrediction(latest(), now));
  const expired = latest();
  expired.prediction!.nextChangeDate = "2026-09-08";
  assert.equal(currentPrediction(expired, now), null);
  const stale = latest();
  stale.prediction!.benchmark.latestNyHarborDate = "2026-08-20";
  assert.equal(currentPrediction(stale, now), null);
  assert.equal(atlanticDate(new Date("2026-09-11T02:30:00Z")), "2026-09-10");
});
test("a successful fetch never makes an old station report fresh", () => {
  const data = reports();
  data.stations[0].postedAt = "2026-08-01";
  assert.equal(stationIsOld(data.stations[0], data, now), true);
  assert.equal(stationIsOld(data.stations[1], data, now), false);
  data.stations[1].stale = true;
  assert.equal(stationIsOld(data.stations[1], data, now), true);
});
test("a fresh regular report does not falsely refresh premium or diesel", () => {
  const station = reports().stations[0];
  assert.equal(gradeTimestamp(station, "regular"), station.postedAt);
  assert.equal(gradeTimestamp(station, "premium"), null);
  station.postedByGrade = { premium: "2026-09-01" };
  assert.equal(
    stationIsOld(
      { ...station, postedAt: gradeTimestamp(station, "premium") },
      reports(),
      now,
    ),
    true,
  );
});
test("Hanwell includes nearby Fredericton, while Moncton gets its own results", () => {
  const hanwell = LOCATIONS.find((p) => p.name === "Hanwell")!;
  const moncton = LOCATIONS.find((p) => p.name === "Moncton")!;
  const local = nearbyStations(reports(), hanwell, 25, now);
  assert.deepEqual(
    local.map((s) => s.id),
    ["freddy"],
  );
  assert.equal(local[0].approximate, true);
  const away = nearbyStations(reports(), moncton, 25, now);
  assert.deepEqual(
    away.map((s) => s.id),
    ["moncton"],
  );
  assert.equal(away[0].approximate, false);
});
test("coordinates, radius, accents and destination URLs are handled safely", () => {
  const hanwell = LOCATIONS[0];
  assert.equal(distanceKm(hanwell, hanwell), 0);
  assert.equal(normalize("Lamèque"), normalize("Lameque"));
  assert.equal(validLocation({ ...hanwell, lat: "45.8" }), false);
  assert.equal(validLocation({ ...hanwell, lat: 0, lng: 0 }), false);
  assert.equal(nearbyStations(reports(), hanwell, 1, now).length, 0);
  const url = new URL(gasBuddyURL({ ...hanwell, name: "Saint Andrews" }, 4));
  assert.equal(url.searchParams.get("search"), "Saint Andrews, NB");
  assert.equal(url.searchParams.get("fuel"), "4");
});
test("the predictor refuses a stale or mismatched current-price baseline", () => {
  const benchmark = Array.from({ length: 6 }, (_, i) => ({
    date: `2026-09-0${i + 1}`,
    bcad: 100 + i,
  }));
  const history = {
    latestDate: "2026-09-04",
    series: [{ date: "2026-09-04", regular: 170, benchmark: 100 }],
  };
  assert.equal(
    predict({
      regulated: { regularSelfServe: 190 },
      history,
      benchmark,
      today: new Date(now),
    }),
    null,
  );
  assert.equal(
    predict({
      regulated: { regularSelfServe: 170 },
      history: { ...history, latestDate: "2026-06-19" },
      benchmark,
      today: new Date(now),
    }),
    null,
  );
});
