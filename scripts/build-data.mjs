// Gas Guru data builder.
// Fetches every source, runs the predictor, and writes the JSON the app reads:
//   public/data/latest.json   - current regulated prices + benchmark + forecast
//   public/data/history.json  - weekly max-price + benchmark series (chart)
// Designed to run in GitHub Actions on a schedule. Every source is free / keyless.
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  fetchRegulated,
  fetchHistory,
  fetchNyHarbor,
  fetchUsdCad,
} from "./lib/sources.mjs";
import { buildBenchmark, predict } from "./lib/predict.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT = resolve(ROOT, "public", "data");
const XLS_FALLBACK = resolve(ROOT, "nb_hist.xls");

async function safe(label, fn, fallback = null) {
  try {
    const v = await fn();
    console.log(`✓ ${label}`);
    return v;
  } catch (e) {
    console.warn(`✗ ${label}: ${e.message}`);
    return fallback;
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const today = new Date();

  const [regulated, history, nyHarbor, usdcad] = await Promise.all([
    safe("NBEUB regulated prices", fetchRegulated),
    safe("NBEUB historical xls", () => fetchHistory(XLS_FALLBACK)),
    safe("FRED NY-Harbour benchmark", fetchNyHarbor, []),
    safe("Bank of Canada USD/CAD", () => fetchUsdCad(150), []),
  ]);

  let previous = null;
  try {
    previous = JSON.parse(readFileSync(resolve(OUT, "latest.json"), "utf8"));
  } catch {}
  if (!history?.series?.length) {
    if (previous?.regulated?.regularSelfServe) {
      console.warn(
        "No history available; retaining last known data without changing its timestamp.",
      );
      return;
    }
    throw new Error("No history or saved prices available.");
  }
  if (
    !regulated &&
    previous &&
    history.latestDate <= previous.regulated.effectiveDate
  ) {
    console.warn(
      "Live prices unavailable; preserving last successful snapshot and its original timestamp.",
    );
    return;
  }
  // Loud signal if the parsed history looks stale — almost always means NBEUB
  // changed its spreadsheet labels and our row-matching silently missed rows.
  const ageDays = (Date.now() - Date.parse(history.latestDate)) / 86400000;
  if (ageDays > 14)
    console.warn(
      `⚠ history latestDate ${history.latestDate} is ${Math.round(ageDays)} days old — ` +
        `NBEUB xls labels may have changed; forecast baseline could be stale.`,
    );
  // If the live HTML scrape failed, fall back to the latest xls row.
  const reg = regulated || {
    regularSelfServe: history.series.at(-1).regular,
    source: "NBEUB (xls fallback)",
    sourceUrl: "https://nbeub.ca/current-petroleum-prices-2",
  };

  const benchmark = usdcad.length ? buildBenchmark(nyHarbor, usdcad) : [];
  const prediction =
    benchmark.length >= 5
      ? predict({ regulated: reg, history, benchmark, today })
      : null;

  const latest = {
    generatedAt: today.toISOString(),
    area: "New Brunswick (province-wide regulated maximum)",
    regulated: {
      ...reg,
      effectiveDate: history.latestDate,
      effectiveDateVerified:
        Math.abs(reg.regularSelfServe - history.series.at(-1).regular) < 0.11,
    },
    prediction,
    benchmarkSeries: benchmark.slice(-45), // recent NY-Harbour for a sparkline
    notes: {
      regulatedMeaning:
        "The regulated maximum applies across New Brunswick. Individual station prices may be lower.",
      schedule:
        "Set weekly, Fridays 12:01am Atlantic, with a mid-week 'interrupter' on big swings.",
    },
  };

  // Trim very old history a little for payload size but keep a long view.
  const series = history.series.filter((p) => p.date >= "2015-01-01");
  const historyOut = {
    generatedAt: today.toISOString(),
    series,
    full: history.series.length,
    sourceUrl:
      "https://nbeub.ca/images/documents/petroleum_pricing/Historical%20Petroleum%20Prices.xls",
  };

  writeFileSync(resolve(OUT, "latest.json"), JSON.stringify(latest, null, 2));
  writeFileSync(resolve(OUT, "history.json"), JSON.stringify(historyOut));

  console.log("\n— Gas Guru data —");
  console.log(
    "Regular max:",
    latest.regulated.regularSelfServe,
    "¢/L  (eff",
    history.latestDate + ")",
  );
  if (prediction)
    console.log(
      `Forecast ${prediction.nextChangeDate}: ${prediction.predictedRegular}¢/L ` +
        `(${prediction.deltaCents >= 0 ? "+" : ""}${prediction.deltaCents}, ${prediction.direction}) ` +
        `band ±${prediction.confidenceHalfWidth}  interrupter=${prediction.interrupterRisk}`,
    );
  console.log("History points:", series.length, "of", history.series.length);
  console.log("Wrote", resolve(OUT, "latest.json"), "and history.json");
}

main().catch((e) => {
  console.error("BUILD FAILED:", e);
  process.exit(1);
});
