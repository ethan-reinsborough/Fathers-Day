// Data-source layer for Gas Guru.
// All sources are free and require no API key:
//   - NBEUB current-prices HTML  -> regulated maximum ceiling (per grade)
//   - NBEUB Historical xls        -> weekly history of max price + benchmark (2006->now)
//   - FRED DGASNYH (CSV)          -> NY Harbor gasoline spot, the NBEUB benchmark driver
//   - Bank of Canada Valet (JSON) -> USD/CAD daily
import * as cheerio from "cheerio";
import xlsx from "xlsx";
import { readFileSync, existsSync } from "node:fs";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// cents/L of CAD per (USD/gallon): 100 cents / 3.785411784 L-per-gal, times FX.
export const GAL_TO_CENTS = 100 / 3.785411784; // 26.41720524

export async function fetchText(url, { headers = {}, tries = 3 } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, ...headers } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }
  throw lastErr;
}

export async function fetchBuffer(url, { tries = 3 } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }
  throw lastErr;
}

const NBEUB_HTML = "https://nbeub.ca/current-petroleum-prices-2";
const NBEUB_XLS =
  "https://nbeub.ca/images/documents/petroleum_pricing/Historical%20Petroleum%20Prices.xls";

// ---- NBEUB current regulated maximums (HTML table) ----
export async function fetchRegulated() {
  const html = await fetchText(NBEUB_HTML, { headers: { Accept: "text/html" } });
  const $ = cheerio.load(html);
  const map = {};
  $("tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 2) return;
    // Labels join two words with <br> (e.g. "Regular Gasoline<br>Self-serve") —
    // turn the break into a space so keyword matching works.
    $(tds[0]).find("br").replaceWith(" ");
    const label = $(tds[0]).text().replace(/\s+/g, " ").trim().toLowerCase();
    const priceTxt = $(tds[1]).text().replace(/[^\d.]/g, "");
    const price = parseFloat(priceTxt);
    if (!label || !isFinite(price) || price < 30 || price > 400) return;
    if (!(label in map)) map[label] = price;
  });

  const pick = (...keys) => {
    for (const k of keys) {
      const hit = Object.keys(map).find((l) => l.includes(k));
      if (hit) return map[hit];
    }
    return null;
  };

  return {
    regularSelfServe: pick("regular gasoline self", "regular self"),
    regularFullServe: pick("regular gasoline full", "regular full"),
    midGrade: pick("mid-grade gasoline self", "mid-grade self", "mid-grade"),
    premium: pick("premium gasoline self", "premium self", "premium"),
    diesel: pick("diesel self", "low sulphur diesel", "diesel"),
    furnace: pick("furnace"),
    propane: pick("propane"),
    source: "NBEUB",
    sourceUrl: NBEUB_HTML,
  };
}

// ---- Excel serial -> ISO date (yyyy-mm-dd) ----
function serialToISO(serial) {
  // Excel epoch is 1899-12-30 (accounts for the 1900 leap-year bug).
  const ms = Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

// ---- NBEUB historical xls -> { series, latestDate } ----
// Each yearly sheet is transposed: a "Date" row of Excel serials across columns,
// then product rows. "Regular Unleaded" appears 4x in order:
// [benchmark, wholesale, retail, max-total]. We take benchmark + max.
export function parseHistory(buf) {
  const wb = xlsx.read(buf, { type: "buffer" });
  const byDate = new Map(); // iso -> { date, regular, benchmark }

  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });

    // Find the serial-date row (col0 === "Date").
    let dateRowIdx = rows.findIndex(
      (r) => r && String(r[0] ?? "").trim().toLowerCase() === "date"
    );
    if (dateRowIdx < 0) continue;
    const dateRow = rows[dateRowIdx];

    const dateCols = [];
    for (let c = 1; c < dateRow.length; c++) {
      const v = dateRow[c];
      if (typeof v === "number" && v > 30000 && v < 60000) {
        dateCols.push({ col: c, iso: serialToISO(v) });
      }
    }
    if (!dateCols.length) continue;

    // Rows are labelled with full bilingual descriptions, e.g.
    //   "Regular Unleaded Benchmark Price (New York) / ..."
    //   "Regular Unleaded Maximum with Delivery / ..."   <- the pump ceiling
    const findRow = (...needles) =>
      rows.find((r) => {
        const l = String(r?.[0] ?? "").toLowerCase();
        return needles.every((n) => l.includes(n));
      });
    // Match on load-bearing tokens only, so minor NBEUB rewording (e.g. dropping
    // "Unleaded") doesn't silently drop a whole year. "regular" appears only in
    // the Regular rows (the French side says "ordinaire"); "delivery" picks the
    // pump-ceiling row over the delivery-less "Maximum price" (retail) row.
    const benchRow = findRow("regular", "benchmark");
    const maxRow = findRow("regular", "maximum", "delivery");
    if (!maxRow) continue;

    for (const { col, iso } of dateCols) {
      const regular = Number(maxRow[col]);
      const benchmark = benchRow ? Number(benchRow[col]) : NaN;
      if (!isFinite(regular) || regular < 30) continue;
      byDate.set(iso, {
        date: iso,
        regular: round1(regular),
        benchmark: isFinite(benchmark) ? round1(benchmark) : null,
      });
    }
  }

  const series = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  return { series, latestDate: series.length ? series[series.length - 1].date : null };
}

export async function fetchHistory(localFallback) {
  // Try the live download, but a 200-with-changed-markup yields an EMPTY parse
  // (no exception) — so treat empty as failure and fall back to the bundled
  // snapshot. Then keep whichever series has more rows, so a partial live parse
  // (e.g. the current-year sheet broke) never regresses below the snapshot.
  let live = null;
  try {
    live = parseHistory(await fetchBuffer(NBEUB_XLS));
  } catch {
    live = null;
  }
  let local = null;
  if (localFallback && existsSync(localFallback)) {
    try {
      local = parseHistory(readFileSync(localFallback));
    } catch {
      local = null;
    }
  }
  const candidates = [live, local].filter((r) => r && r.series.length);
  if (!candidates.length) throw new Error("No history available (live and fallback both empty).");
  candidates.sort((a, b) => b.series.length - a.series.length);
  return candidates[0];
}

// ---- FRED DGASNYH: NY Harbor conventional gasoline spot (USD/gal), daily ----
export async function fetchNyHarbor() {
  const csv = await fetchText(
    "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGASNYH"
  );
  const out = [];
  for (const line of csv.trim().split("\n").slice(1)) {
    const [date, val] = line.split(",");
    const v = parseFloat(val);
    if (isFinite(v) && v > 0) out.push({ date, usdGal: v });
  }
  return out; // ascending by date
}

// ---- Bank of Canada Valet: USD/CAD daily ----
export async function fetchUsdCad(recent = 120) {
  const json = JSON.parse(
    await fetchText(
      `https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?recent=${recent}`,
      { headers: { Accept: "application/json" } }
    )
  );
  return (json.observations || [])
    .map((o) => ({ date: o.d, rate: parseFloat(o.FXUSDCAD?.v) }))
    .filter((o) => isFinite(o.rate));
}

export function round1(n) {
  return Math.round(n * 10) / 10;
}
export function round2(n) {
  return Math.round(n * 100) / 100;
}
