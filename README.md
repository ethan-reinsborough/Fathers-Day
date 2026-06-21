# ⛽ Gas Guru

A sleek iPhone-installable web app that tracks **New Brunswick regulated gas prices** for the
Fredericton area — current prices, the cheapest pumps nearby, **and a forecast of the next price
change**. Built as a Father's Day gift; an evolution of the original Android gas-tracker.

> **Why a forecast is actually possible here:** New Brunswick *regulates* fuel prices. The Energy &
> Utilities Board (NBEUB) sets one province-wide **maximum** every Friday at 12:01 AM Atlantic using a
> published formula — `benchmark + fixed margins, taxes & delivery`. Only the **benchmark** (an average
> of the daily *New York Harbour* gasoline price) moves. So next Friday's price is largely knowable from
> today's wholesale prices. Gas Guru reads that benchmark and carries it onto the cap — accurate to a
> couple of cents in a normal week.

## What it shows

- **The cap** — today's regulated maximum on an animated gauge (Fredericton, Nackawic, Oromocto and
  Saint John all share one province-wide number).
- **The Guru's call** — predicted price at the next Friday reset, with direction, a confidence band, and
  an ⚡ *interrupter watch* when the benchmark is swinging fast enough to force a mid-week change.
- **Actual pump prices** — the cheapest stations near you (via GasBuddy), with how far each sits under
  the cap.
- **History** — the regulated max back to 2015, with the forecast drawn as a dashed extension.
- **Every grade** — regular, mid, premium, diesel, furnace oil, propane.

## Data sources (all free, no API keys)

| Layer | Source |
| --- | --- |
| Regulated max + history | [NBEUB](https://nbeub.ca/current-petroleum-prices-2) (HTML table + historical `.xls`) |
| Benchmark driver | [FRED `DGASNYH`](https://fred.stlouisfed.org/series/DGASNYH) — NY-Harbour gasoline spot (EIA) |
| Exchange rate | [Bank of Canada Valet](https://www.bankofcanada.ca/valet/) — USD/CAD |
| Actual pump prices | [GasBuddy](https://www.gasbuddy.com) (headless browser) |

## Tech

Svelte 5 + Vite, static build, no backend. Animations use Svelte's built-in motion (the gauge needle
spring + price count-up); the chart and gauge are hand-rolled SVG. PWA via `vite-plugin-pwa` so it
installs to the iPhone Home Screen and works offline. A scheduled GitHub Action refreshes the data and
deploys to GitHub Pages — **$0 to host**.

```
scripts/
  build-data.mjs       # NBEUB + FRED + BoC  -> public/data/latest.json, history.json
  scrape-stations.mjs  # GasBuddy (Playwright) -> public/data/stations.json
  gen-icons.mjs        # branded PWA / iOS icons + splash
  lib/{sources,predict}.mjs
src/                   # Svelte app
.github/workflows/deploy.yml
```

## Run it locally

```bash
npm install
npm run data            # fetch regulated prices + build the forecast
npm run data:stations   # fetch actual pump prices (opens a headless browser)
npm run dev             # http://localhost:5173
```

`npm run build` produces a static site in `dist/`. `npm run gen-icons` regenerates the icons.

## Deploy to GitHub Pages (free, automatic)

1. Create a GitHub repo (e.g. **`gas-guru`**) and push this folder to it.
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. That's it. The workflow runs on every push and twice daily — it refreshes prices, rebuilds, and
   deploys. Your site appears at `https://<you>.github.io/gas-guru/`.

The base path is detected automatically (`/gas-guru/` for a project repo, `/` for a `you.github.io`
user repo or a custom domain).

### Keeping actual prices fresh

GasBuddy is behind Cloudflare, which sometimes blocks GitHub's datacenter IPs. The forecast and
regulated cap always update; if station prices can't be fetched in CI they just show as *cached*. To
refresh them reliably from your own (residential) connection at any time:

```bash
npm run data:stations
git add public/data/stations.json && git commit -m "fresh pump prices" && git push
```

## Put it on Dad's iPhone

1. Open the site in **Safari** on the iPhone.
2. Tap **Share** (the box-with-arrow), then **Add to Home Screen**, then **Add**.
3. Launch it from the new **Gas Guru** icon — it opens full-screen like a real app, works offline, and
   shows a splash screen.

*(Optional future upgrade: iOS supports Web Push for Home-Screen apps with free VAPID keys — no Apple
Developer account — so price-drop alerts can be added later with a tiny serverless cron. Not included
yet.)*

## Customize

- **Towns for station search:** set `GG_AREAS` (semicolon-separated), e.g.
  `GG_AREAS="Fredericton, NB;Oromocto, NB" npm run data:stations`.
- **Reset day / thresholds:** the predictor lives in [`scripts/lib/predict.mjs`](scripts/lib/predict.mjs).

## Caveats

- The regulated price is a legal **ceiling** — stations price at or below it. The forecast is an
  estimate, most exposed to NB's *interrupter clause* (out-of-cycle changes) and occasional regulatory
  margin/tax changes; both are surfaced in the app where possible.
- `nb_hist.xls` is committed as an offline fallback; the builder re-downloads the latest each run.

Made with ♥ for Dad. Happy Father's Day.
