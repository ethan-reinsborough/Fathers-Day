// Gas Guru — actual pump prices (GasBuddy), via Playwright.
//
// GasBuddy is behind Cloudflare and its GraphQL gateway rejects ad-hoc queries,
// so we drive a real headless browser to the public search page and:
//   1) read station NAMES/addresses from the page's Apollo cache (__APOLLO_STATE__)
//   2) INTERCEPT the site's own GraphQL PRICE response off the wire
//   3) JOIN the two by station id.
// This passes Cloudflare from a residential IP (your machine, or his) and
// usually from CI.
//
// Best-effort: if Cloudflare blocks (e.g. a datacenter IP) we keep the previous
// stations.json and mark it stale, so the app still works and shows a
// "tap to view live" link. The regulated max + forecast never depend on this.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "public", "data", "stations.json");

const AREAS = (process.env.GG_AREAS || "Fredericton, NB;Oromocto, NB;Nackawic, NB")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const priceOf = (prices, product) => {
  const p = (prices || []).find((x) => x.fuelProduct === product);
  const v = p?.credit?.price ?? p?.cash?.price ?? null;
  return typeof v === "number" && v > 30 && v < 400 ? v : null; // reject 0 / outliers
};
const postedOf = (prices) => {
  const p = (prices || []).find((x) => x.fuelProduct === "regular_gas") || (prices || [])[0];
  return p?.credit?.postedTime ?? p?.cash?.postedTime ?? null;
};

function writeStale(reason) {
  let prev = null;
  if (existsSync(OUT)) {
    try {
      prev = JSON.parse(readFileSync(OUT, "utf8"));
    } catch {}
  }
  const out = {
    generatedAt: new Date().toISOString(),
    area: AREAS.join(" · "),
    source: "GasBuddy",
    sourceUrl: "https://www.gasbuddy.com/gasprices/canada/new-brunswick/fredericton",
    stale: true,
    staleReason: reason,
    stations: prev?.stations || [],
    lowestRegular: prev?.lowestRegular ?? null,
    lastLiveAt: prev?.lastLiveAt ?? prev?.generatedAt ?? null,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.warn(`stations.json kept STALE (${reason}); ${out.stations.length} cached station(s).`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: UA, locale: "en-CA" });
  const page = await ctx.newPage();

  const meta = new Map(); // id -> { name, address, locality, brand, lat, lng }
  const prices = new Map(); // id -> { regular, midgrade, premium, diesel, postedAt }

  page.on("response", async (resp) => {
    if (!/graphql/i.test(resp.url())) return;
    let j;
    try {
      j = await resp.json();
    } catch {
      return;
    }
    const results = j?.data?.locationBySearchTerm?.stations?.results;
    if (!Array.isArray(results)) return;
    for (const s of results) {
      const id = String(s.id);
      const regular = priceOf(s.prices, "regular_gas");
      if (regular == null) continue;
      prices.set(id, {
        regular,
        midgrade: priceOf(s.prices, "midgrade_gas"),
        premium: priceOf(s.prices, "premium_gas"),
        diesel: priceOf(s.prices, "diesel"),
        postedAt: postedOf(s.prices),
      });
    }
  });

  // Pull station name/address/brand out of the page's Apollo cache.
  async function harvestMeta() {
    const entities = await page.evaluate(() => {
      const s = window.__APOLLO_STATE__ || {};
      const out = [];
      for (const [k, v] of Object.entries(s)) {
        if (!k.startsWith("Station:") || !v || typeof v !== "object") continue;
        out.push({
          id: String(v.id ?? k.split(":")[1]),
          name: v.name || null,
          line1: v.address?.line1 || null,
          locality: v.address?.locality || null,
          brand:
            (v.brands || []).find((b) => b.brandingType === "fuel")?.name ||
            (v.brands || [])[0]?.name ||
            null,
          lat: v.latitude ?? null,
          lng: v.longitude ?? null,
        });
      }
      return out;
    });
    for (const e of entities) {
      const cur = meta.get(e.id) || {};
      meta.set(e.id, {
        name: cur.name || e.name,
        address: cur.address || e.line1,
        locality: cur.locality || e.locality,
        brand: cur.brand || e.brand,
        lat: cur.lat ?? e.lat,
        lng: cur.lng ?? e.lng,
      });
    }
  }

  for (const area of AREAS) {
    const url = `https://www.gasbuddy.com/home?search=${encodeURIComponent(area)}&fuel=1&method=all`;
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      for (let i = 0; i < 12; i++) {
        if (!/just a moment/i.test(await page.title())) break;
        await page.waitForTimeout(1500);
      }
      await page.waitForTimeout(2500);
      await page.mouse.wheel(0, 3000);
      await page.waitForTimeout(2500);
      await harvestMeta();
    } catch (e) {
      console.warn(`  ${area} failed: ${e.message}`);
    }
    console.log(`searched "${area}" — priced:${prices.size} named:${meta.size}`);
  }

  await browser.close();

  const stations = [...prices.entries()]
    .map(([id, p]) => {
      const m = meta.get(id) || {};
      return {
        id,
        name: m.name || m.brand || m.locality || "Station",
        brand: m.brand || null,
        address: m.address || "",
        locality: m.locality || "",
        lat: m.lat ?? null,
        lng: m.lng ?? null,
        ...p,
      };
    })
    .sort((a, b) => a.regular - b.regular);

  if (!stations.length) {
    writeStale("no stations captured (Cloudflare block or no data)");
    return;
  }

  const now = new Date().toISOString();
  const out = {
    generatedAt: now,
    lastLiveAt: now,
    area: AREAS.join(" · "),
    source: "GasBuddy",
    sourceUrl: "https://www.gasbuddy.com/gasprices/canada/new-brunswick/fredericton",
    stale: false,
    lowestRegular: stations[0].regular,
    highestRegular: stations[stations.length - 1].regular,
    count: stations.length,
    stations,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(
    `\n✓ ${stations.length} stations. Cheapest regular: ${out.lowestRegular}¢ ` +
      `(${stations[0].name}, ${stations[0].locality}).`
  );
}

main().catch((e) => {
  console.error("stations scrape error:", e.message);
  writeStale(`error: ${e.message}`);
  process.exit(0); // never fail the overall build on actuals
});
