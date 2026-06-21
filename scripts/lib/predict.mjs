// Gas Guru prediction engine.
//
// Why this works: NB's regulated maximum is a PUBLISHED FORMULA, not a market.
//   max_price = benchmark + (fixed margins + taxes + delivery + HST)
// The only moving part is the benchmark = a trailing average of the daily
// "New York Harbour" gasoline price. The fixed part (K) only changes on rare
// regulatory updates. So:
//   predicted_next_max = current_max + (benchmark_now - benchmark_at_last_setting)
// i.e. the pump price moves ~1:1 with the NY-Harbour benchmark. We read the
// benchmark momentum from FRED's NY-Harbour spot series (in CAD c/L) and carry
// it onto the current ceiling. Everything is transparent and calibrated to the
// real published numbers — no black-box ML.

import { GAL_TO_CENTS, round1, round2 } from "./sources.mjs";

const DAY = 86400000;
const toDate = (iso) => new Date(iso + "T00:00:00Z");
const toISO = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * DAY);

function nextFriday(from) {
  // 0=Sun..5=Fri..6=Sat — first Friday strictly after `from`.
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  do {
    d.setUTCDate(d.getUTCDate() + 1);
  } while (d.getUTCDay() !== 5);
  return d;
}

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
function stdev(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(mean(a.map((x) => (x - m) ** 2)));
}
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// Build a daily NY-Harbour benchmark series in CAD cents/L (FX forward-filled).
export function buildBenchmark(nyHarbor, usdcad) {
  const fx = [...usdcad].sort((a, b) => a.date.localeCompare(b.date));
  const fxFor = (iso) => {
    let r = fx.length ? fx[0].rate : 1.36;
    for (const o of fx) {
      if (o.date <= iso) r = o.rate;
      else break;
    }
    return r;
  };
  return nyHarbor.map((p) => ({
    date: p.date,
    usdGal: p.usdGal,
    fx: round2(fxFor(p.date)),
    bcad: round2(p.usdGal * fxFor(p.date) * GAL_TO_CENTS),
  }));
}

/**
 * @param regulated  output of fetchRegulated()
 * @param history    output of parseHistory() (has published benchmark + max)
 * @param benchmark  output of buildBenchmark()
 * @param today      Date (scrape time)
 */
export function predict({ regulated, history, benchmark, today }) {
  const effectiveISO = history.latestDate; // the Friday the current price was set
  const D0 = toDate(effectiveISO);
  const currentMax = regulated.regularSelfServe ?? history.series.at(-1)?.regular;
  const publishedBench = history.series.at(-1)?.benchmark ?? null;

  const bdates = benchmark.map((b) => b.date);
  const latestBenchISO = bdates.at(-1);
  const inRange = (lo, hi) => benchmark.filter((b) => b.date >= lo && b.date <= hi).map((b) => b.bcad);

  // Window that set the CURRENT price: ~5 weekdays before D0.
  const baseline = inRange(toISO(addDays(D0, -9)), toISO(addDays(D0, -1)));
  // Most recent benchmark level we can observe.
  const recent = benchmark.slice(-5).map((b) => b.bcad);

  const baselineLevel = baseline.length ? mean(baseline) : mean(recent);
  const recentLevel = mean(recent);
  const momentum = recentLevel - baselineLevel; // c/L the benchmark has moved

  const predictedMax = round1(currentMax + momentum);
  const deltaCents = round1(predictedMax - currentMax);

  // How much of the NEW window (D0 -> next Fri) have we actually observed?
  const daysObserved = benchmark.filter((b) => b.date > effectiveISO).length;
  const observedFraction = clamp(daysObserved / 5, 0, 1);

  // Recent daily volatility of the benchmark (c/L/day).
  const diffs = [];
  for (let i = benchmark.length - 11; i < benchmark.length; i++) {
    if (i > 0 && benchmark[i] && benchmark[i - 1]) diffs.push(benchmark[i].bcad - benchmark[i - 1].bcad);
  }
  const vol = stdev(diffs);

  // Band: wide early in the cycle / when volatile, tightening as data arrives.
  const halfWidth = round1(clamp(0.8 + (1 - observedFraction) * 2.6 + vol * 0.9, 0.8, 6));

  // Interrupter watch: a big single-day benchmark swing can force an
  // out-of-cycle change (~6 c/L is the reported NB trigger).
  const maxDaySwing = diffs.length ? Math.max(...diffs.map(Math.abs)) : 0;
  const interrupterRisk = Math.abs(deltaCents) >= 6 || maxDaySwing >= 6;

  const direction = deltaCents > 0.15 ? "up" : deltaCents < -0.15 ? "down" : "flat";

  const nextChange = nextFriday(today > D0 ? today : D0);

  return {
    nextChangeDate: toISO(nextChange),
    effectiveDate: effectiveISO,
    currentRegular: round1(currentMax),
    predictedRegular: predictedMax,
    deltaCents,
    direction,
    confidenceLow: round1(predictedMax - halfWidth),
    confidenceHigh: round1(predictedMax + halfWidth),
    confidenceHalfWidth: halfWidth,
    daysObserved,
    observedFraction: round2(observedFraction),
    interrupterRisk,
    interrupterNote: interrupterRisk
      ? "The benchmark is moving fast — NB's interrupter clause could force an out-of-cycle change."
      : "",
    benchmark: {
      publishedCents: publishedBench,
      publishedDate: effectiveISO,
      computedRecentCents: round1(recentLevel),
      computedBaselineCents: round1(baselineLevel),
      latestNyHarborDate: latestBenchISO,
      fixedComponentCents: publishedBench != null ? round1(currentMax - publishedBench) : null,
      momentumCents: round1(momentum),
    },
    volatilityCentsPerDay: round2(vol),
    method:
      "Predicted = current ceiling + NY-Harbour benchmark momentum (FRED DGASNYH × USD/CAD). " +
      "NB sets the max weekly (Fri 12:01am AT) as benchmark + fixed margins/taxes/delivery.",
  };
}
