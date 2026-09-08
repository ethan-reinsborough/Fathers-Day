# Gas Guru

A phone-first New Brunswick fuel-price companion, made for Dad. Svelte 5 + TypeScript + Vite, deployed as a static PWA on GitHub Pages.

## Features

- Midnight-green dashboard, animated price dial, mobile bottom navigation and refreshed home-screen icons.
- Province-wide regulated maximum prices, all fuel grades, and an estimate of the next regular-price change when recent benchmark data is available.
- Hanwell, Fredericton and Oromocto shortcuts; 69 offline communities; online search for other NB places; GPS location with a bounded wait and useful permission/timeout messages.
- Nearby station reports with fuel, radius, price/distance and favourites filters. Station names open driving directions. Map and GasBuddy searches use the chosen destination.
- Price history with 1-month, 3-month, 1-year and all-time views, period statistics, touch exploration and a keyboard-accessible slider.
- Fill-up estimates with a remembered volume, plus a distance/fuel-economy calculator for trips.
- Saved-data startup, background refresh, offline support and clearly labelled old reports.

## Run locally

Requires Node 22.18 or newer.

```sh
npm ci
npm run dev
npm run check
npm test
npm run build
npm run preview
```

The included snapshots make the app usable immediately. Refresh them separately:

```sh
npm run data
npm run data:stations
npm run gen-icons
```

The station collector needs Playwright Chromium (`npx playwright install chromium`). It is a best-effort public-data collector: if the source presents an access challenge, it stops and keeps prior reports.

## What fixed the loading stall

The old startup awaited `Promise.all` for price, history and station files, without a request deadline. A hung optional request kept the entire page on “Consulting the Guru”.

The app now renders the newest valid bundled or device-cached snapshot synchronously. Each data file refreshes independently, with a **6.5-second deadline covering both the response and its body**. Invalid responses keep the previous data. An explicit refresh button and reconnection/resume checks allow retrying. The service worker also has a 3-second network-first fallback, but the page does not depend on it to escape loading.

Device storage is optional: denied access, corrupt entries or a full quota cannot prevent startup. The app bundles its JSON snapshots, so a fresh installation does not need a separate data request to render.

## Data and coverage

| Data | Source | Limits |
| --- | --- | --- |
| Regulated maximum and history | [NBEUB](https://nbeub.ca/current-petroleum-prices-2) | The provincial maximum is not a quote from an individual station. |
| Forecast inputs | [FRED / EIA DGASNYH](https://fred.stlouisfed.org/series/DGASNYH), [Bank of Canada](https://www.bankofcanada.ca/valet/) | Feeds can lag. Forecasts are withheld when the inputs are old or the baseline does not match. |
| Reported pump prices | [GasBuddy](https://www.gasbuddy.com/gasprices/canada/new-brunswick) | Community reports can be missing, outdated, or inaccessible to the scheduled collector. |
| Online place search | [Open-Meteo](https://open-meteo.com/en/docs/geocoding-api) / [GeoNames](https://www.geonames.org/) | Requires a connection; results are filtered to New Brunswick, Canada. |

Location support covers NB; **fresh station-price coverage is not guaranteed in every community**. The collector now searches 23 areas across the province, preserves reports from areas missed by a partial refresh, and keeps original report times. `GG_AREAS` can override that list with semicolon-separated locations. Areas without saved reports provide destination-specific map and live-price searches instead of invented prices.

Reports older than 48 hours are labelled old and excluded from “best price” claims. Premium and diesel use their own report timestamps. Missing station coordinates are matched to known community centres and labelled approximate; distances are straight-line, not road distances. GPS is requested only after tapping **Locate me**, and remains on the device until the user opens an external map or price search. The provincial cap applies only inside NB, including when using GPS near a border.

The forecast is a benchmark-momentum heuristic, not a fully replicated regulatory formula or a statistically calibrated confidence interval. It is not backtested to any claimed accuracy. Market moves, interrupter decisions and changes to margins or taxes can invalidate it. Expired forecasts never appear as upcoming advice.

## Refresh and deployment

The existing GitHub Actions workflow refreshes data and deploys to GitHub Pages on `main` pushes, manual dispatch and twice daily. It keeps the repository's existing hosting setup and computes the Pages base path automatically. The browser's refresh button fetches the latest **published snapshots**; it does not run the data collector itself.

Source requests, the station collector and workflow jobs all have deadlines. Failed price-source requests preserve the last successful timestamp. History merges by date, allowing a shorter live workbook to add new prices without losing older years. An unavailable exchange-rate feed cannot silently manufacture a forecast with a guessed rate.

GitHub may pause scheduled workflows in an inactive repository. Re-enable **Update prices & deploy** in the Actions tab if updates stop. The optional existing keepalive job remains disabled. No hosting migration or paid service is required.

## Verification

`npm run check` checks Svelte and TypeScript. `npm test` uses Node's built-in test runner for request and body stalls, independent section loading, malformed responses, disabled storage, expired forecasts, per-grade report freshness and geographic filtering. CI runs both before building.

On iPhone, open the deployed app in Safari, choose **Share → Add to Home Screen**, then launch Gas Guru from its icon. The app respects safe areas, reduced-motion preferences and browser zoom.
