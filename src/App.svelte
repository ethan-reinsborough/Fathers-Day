<script lang="ts">
  import { onMount } from "svelte";
  import { initialData, refreshData, type AppData } from "./lib/data";
  import { currentPrediction, pricesAreOld } from "./lib/freshness";
  import { cents, fmtDate, relTime, signed } from "./lib/format";
  import { makeVerdict } from "./lib/verdict";
  import {
    DEFAULT_LOCATION,
    validLocation,
    type Location,
  } from "./lib/locations";
  import { readStored, writeStored } from "./lib/storage";
  import Icon from "./components/Icon.svelte";
  import LocationPicker from "./components/LocationPicker.svelte";
  import Gauge from "./components/Gauge.svelte";
  import Forecast from "./components/Forecast.svelte";
  import Stations from "./components/Stations.svelte";
  import PriceChart from "./components/PriceChart.svelte";
  import Grades from "./components/Grades.svelte";
  import Calculator from "./components/Calculator.svelte";
  import InstallHint from "./components/InstallHint.svelte";

  let data = $state<AppData>(initialData());
  const savedLocation = readStored<Location>(
    "gg-location-v2",
    DEFAULT_LOCATION,
  );
  let location = $state<Location>(
    validLocation(savedLocation) ? savedLocation : DEFAULT_LOCATION,
  );
  let refreshing = $state(false);
  let offline = $state(!navigator.onLine);
  let refreshNote = $state("");
  let now = $state(Date.now());
  let activeSection = $state("overview");
  let lastAttempt = 0;
  let latest = $derived(data.latest);
  let old = $derived(latest ? pricesAreOld(latest, now) : true);
  let prediction = $derived(currentPrediction(latest, now));
  let verdict = $derived(
    latest ? makeVerdict(prediction, null, latest.regulated) : null,
  );
  let recent = $derived(
    (data.history?.series ?? []).filter(
      (p) =>
        p.date >= new Date(now - 365 * 86400000).toISOString().slice(0, 10),
    ),
  );
  let low = $derived(
    Math.min(
      latest?.regulated.regularSelfServe ?? 150,
      ...recent.map((p) => p.regular),
    ) - 4,
  );
  let high = $derived(
    Math.max(
      latest?.regulated.regularSelfServe ?? 190,
      ...recent.map((p) => p.regular),
    ) + 4,
  );
  let previous = $derived(
    latest?.regulated.effectiveDateVerified === false
      ? null
      : data.history?.series
          .filter((p) => p.date < (latest?.regulated.effectiveDate ?? ""))
          .at(-1),
  );
  let change = $derived(
    previous && latest
      ? Math.round(
          (latest.regulated.regularSelfServe - previous.regular) * 10,
        ) / 10
      : null,
  );
  function setLocation(value: Location) {
    location = value;
    writeStored("gg-location-v2", value);
  }
  async function refresh(showNotice = false) {
    if (refreshing) return;
    refreshing = true;
    refreshNote = "";
    lastAttempt = Date.now();
    try {
      const failures = await refreshData((key, value) => {
        if (
          !data[key] ||
          Date.parse(value.generatedAt) >= Date.parse(data[key]!.generatedAt)
        )
          data = { ...data, [key]: value };
      });
      refreshNote = failures.length
        ? "Some updates could not be reached. Saved data is still available."
        : showNotice
          ? "Checked for updates. Showing the latest published data."
          : "";
    } finally {
      refreshing = false;
      now = Date.now();
    }
  }
  onMount(() => {
    void refresh();
    const reconnect = () => {
      offline = !navigator.onLine;
      if (!offline) void refresh();
    };
    const resume = () => {
      now = Date.now();
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastAttempt > 5 * 60000
      )
        void refresh();
    };
    window.addEventListener("online", reconnect);
    window.addEventListener("offline", reconnect);
    document.addEventListener("visibilitychange", resume);
    const timer = setInterval(() => {
      now = Date.now();
    }, 60000);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) activeSection = entry.target.id;
      },
      { rootMargin: "-10% 0px -55% 0px" },
    );
    document
      .querySelectorAll("[data-section]")
      .forEach((section) => observer.observe(section));
    return () => {
      clearInterval(timer);
      observer.disconnect();
      window.removeEventListener("online", reconnect);
      window.removeEventListener("offline", reconnect);
      document.removeEventListener("visibilitychange", resume);
    };
  });
</script>

<main>
  <h1 class="sr-only">Gas Guru — New Brunswick fuel prices</h1>
  <header class="topbar">
    <a class="brand" href="#overview" aria-label="Gas Guru overview"
      ><span class="brand-mark"><Icon name="pump" size={25} /></span><span
        >gas<span class="brand-light">guru</span><small>NEW BRUNSWICK</small
        ></span
      ></a
    >
    <div class="top-actions">
      <span class="edition">A little wisdom. A better fill-up.</span><button
        class="icon-button"
        onclick={() => refresh(true)}
        disabled={refreshing}
        aria-label={refreshing ? "Refreshing prices" : "Refresh prices"}
        ><span class:spinning={refreshing}
          ><Icon name="refresh" size={18} /></span
        ></button
      >
    </div>
  </header>

  <div class="location-wrap">
    <LocationPicker {location} onchange={setLocation} />
  </div>

  <div class="status-line" role="status">
    <span class="status-dot" class:warning={old || offline}></span><span
      >{offline
        ? "Offline · saved prices"
        : refreshing
          ? "Checking for fresh prices…"
          : old
            ? "Saved prices · update needed"
            : "Prices up to date"}{#if latest}<span class="status-date">
          · checked {relTime(latest.generatedAt)}</span
        >{/if}</span
    >
  </div>
  {#if refreshNote}<p class="refresh-note" role="status">{refreshNote}</p>{/if}
  {#if latest}
    {#if old}<div class="notice">
        <Icon name="info" size={18} />
        <p>
          These prices were saved on <b>{fmtDate(latest.generatedAt, true)}</b>.
          Check the latest NB cap before filling up.
        </p>
        <a
          href={latest.regulated.sourceUrl}
          target="_blank"
          rel="noopener"
          aria-label="Check current prices at NBEUB"
          ><Icon name="arrow" size={20} /></a
        >
      </div>{/if}

    <div class="overview-grid" id="overview" data-section>
      <section class="glass price-card">
        <div class="price-heading">
          <span class="eyebrow"
            >{old ? "LAST KNOWN" : "AT THE PUMP"} · REGULAR</span
          ><span class="cap-badge">NB maximum</span>
        </div>
        <Gauge
          value={latest.regulated.regularSelfServe}
          {low}
          {high}
          caption="cents per litre"
        />
        <div class="price-context">
          <span
            >{latest.regulated.effectiveDateVerified === false
              ? "Retrieved " + fmtDate(latest.generatedAt)
              : "Effective " + fmtDate(latest.regulated.effectiveDate)}</span
          >{#if change !== null}<span class:cheaper={change < 0}
              >{signed(change)}¢ <small>vs previous</small></span
            >{/if}
        </div>
        <div class="hero-rule"></div>
        <div class="guru-call">
          <span class="guru-symbol"
            ><Icon
              name={old
                ? "clock"
                : prediction?.interrupterRisk
                  ? "bolt"
                  : "trend"}
              size={22}
            /></span
          >
          <div>
            <span class="eyebrow">A WORD FROM THE GURU</span>
            <h2>{old ? "Time for a fresh price check." : verdict?.headline}</h2>
            <p>
              {old
                ? "Your saved prices and history are ready. Check the current cap before making a trip."
                : prediction
                  ? verdict?.detail
                  : "The regulated maximum applies across New Brunswick. Local pump prices can be lower."}
            </p>
          </div>
        </div>
      </section>
      <div class="outlook-stack">
        {#if prediction}<Forecast p={prediction} />{:else}<section
            class="glass waiting-forecast"
          >
            <div class="forecast-icon"><Icon name="trend" size={24} /></div>
            <span class="eyebrow">LOOKING DOWN THE ROAD</span>
            <h2>The next move,<br />with a little more clarity.</h2>
            <p>
              {old
                ? "This saved forecast has expired. We’ll show a new estimate when the price and benchmark data are fresh."
                : "There isn’t enough recent benchmark data for a useful forecast yet."}
            </p>
            <div class="reset-note">
              <Icon name="clock" size={17} /><span
                >Usual reset · Friday, 12:01 AM Atlantic</span
              >
            </div>
          </section>{/if}
        <a class="trip-link" href="#stations"
          ><span class="trip-icon"><Icon name="pin" size={23} /></span>
          <div>
            <b>Your next pit stop</b><span
              >Find stations around {location.name}.</span
            >
          </div>
          <Icon name="arrow" size={22} /></a
        >
      </div>
    </div>

    <div id="stations" data-section class="section-wrap">
      <Stations
        data={data.stations}
        cap={latest.regulated.regularSelfServe}
        capOld={old}
        {location}
        {now}
      />
    </div>
    <div class="details-grid">
      <div id="trends" data-section class="section-wrap">
        {#if data.history && data.history.series.length > 1}<PriceChart
            series={data.history.series}
            {prediction}
          />{:else}<section class="glass no-history">
            <h2>The long view</h2>
            <p>
              History is temporarily unavailable. Your price data is still
              ready.
            </p>
            <button class="button" onclick={() => refresh(true)}
              >Try again</button
            >
          </section>{/if}
      </div>
      <div id="garage" data-section class="section-wrap">
        <Calculator r={latest.regulated} {prediction} {old} />
      </div>
    </div>
    <Grades r={latest.regulated} {old} />
    <InstallHint />

    <details class="glass how">
      <summary
        ><span><Icon name="info" size={18} />Behind the numbers</span><Icon
          name="down"
          size={18}
        /></summary
      >
      <div class="how-body">
        <p>
          NB publishes maximum fuel prices. Your local station may charge less.
          The regular price dial and history show the provincial self-serve
          maximum, including taxes.
        </p>
        <p>
          The forecast estimates the next change using New York Harbour gasoline
          prices and the Canadian dollar. It is an estimate, and unexpected
          market moves or regulatory changes can affect the result.
        </p>
        <p>
          Station prices are community reports, and may have changed. Reports
          older than 48 hours are marked as old. Distances are straight-line
          distances; reports without coordinates are matched to their community.
        </p>
        <div class="source-links">
          <a href={latest.regulated.sourceUrl} target="_blank" rel="noopener"
            >NBEUB prices ↗</a
          ><a
            href="https://fred.stlouisfed.org/series/DGASNYH"
            target="_blank"
            rel="noopener">FRED / EIA benchmark ↗</a
          ><a
            href="https://www.bankofcanada.ca/valet/"
            target="_blank"
            rel="noopener">Bank of Canada ↗</a
          ><a href="https://www.gasbuddy.com" target="_blank" rel="noopener"
            >GasBuddy reports ↗</a
          >
        </div>
      </div>
    </details>
  {:else}<section class="glass error-state">
      <Icon name="pump" size={36} />
      <h2>Let’s get your prices back.</h2>
      <p>
        Price data isn’t available yet. Check your connection and try again.
      </p>
      <button
        class="button primary"
        onclick={() => refresh(true)}
        disabled={refreshing}>{refreshing ? "Checking…" : "Try again"}</button
      >
    </section>{/if}
  <footer class="page-footer">
    <span class="footer-mark">g<span>g</span></span>
    <p>
      Made with <span class="heart">♥</span> for Dad.<br /><small
        >Good roads. Full tanks. Happy Father’s Day.</small
      >
    </p>
    <span class="footer-province">NB / CANADA</span>
  </footer>
</main>
<nav class="bottom-nav" aria-label="Main navigation">
  {#each [{ id: "overview", icon: "gauge", label: "Overview" }, { id: "stations", icon: "pin", label: "Stations" }, { id: "trends", icon: "trend", label: "Trends" }, { id: "garage", icon: "wallet", label: "My fill-up" }] as item}<a
      href={"#" + item.id}
      class:active={activeSection === item.id}
      aria-current={activeSection === item.id ? "location" : undefined}
      onclick={() => (activeSection = item.id)}
      ><Icon name={item.icon} size={21} /><span>{item.label}</span></a
    >{/each}
</nav>

<style>
  main {
    max-width: var(--maxw);
    margin: 0 auto;
  }
  .topbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 28px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 11px;
    color: var(--ink);
    font-size: 27px;
    font-weight: 750;
    letter-spacing: -1.3px;
    line-height: 1;
  }
  .brand-light {
    font-weight: 400;
    color: var(--teal);
  }
  .brand small {
    display: block;
    font-size: 8px;
    font-weight: 600;
    letter-spacing: 2.2px;
    color: var(--ink-faint);
    margin-top: 7px;
  }
  .brand-mark {
    display: grid;
    place-items: center;
    width: 46px;
    height: 46px;
    border-radius: 14px;
    background: var(--teal);
    color: #243410;
    transform: rotate(-6deg);
  }
  .brand-mark :global(svg) {
    transform: rotate(6deg);
  }
  .top-actions {
    display: flex;
    align-items: center;
    gap: 23px;
  }
  .edition {
    font-size: 12px;
    color: var(--ink-faint);
  }
  .icon-button span {
    display: flex;
  }
  .spinning {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .location-wrap {
    max-width: 550px;
  }
  .status-line {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 11px;
    color: var(--ink-faint);
    margin: 18px 2px 14px;
  }
  .status-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--teal);
  }
  .status-dot.warning {
    background: var(--amber);
  }
  .refresh-note {
    font-size: 12px;
    color: var(--ink-dim);
    margin: -3px 0 12px;
  }
  .notice {
    display: flex;
    gap: 10px;
    align-items: center;
    border: 1px solid #f1c37b24;
    background: #f1c37b08;
    border-radius: 12px;
    padding: 10px 13px;
    margin-bottom: 16px;
    color: var(--amber);
  }
  .notice p {
    flex: 1;
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
  }
  .notice > :global(svg) {
    flex-shrink: 0;
  }
  .notice a {
    display: grid;
    place-items: center;
    width: 35px;
    min-height: 40px;
    color: var(--amber);
  }
  .overview-grid {
    display: grid;
    grid-template-columns: 1.1fr 1fr;
    gap: 18px;
  }
  .price-card {
    padding: 23px 26px 24px;
    background:
      radial-gradient(ellipse at 50% 38%, #c2f97008, transparent 65%),
      var(--surface);
    overflow: hidden;
  }
  .price-heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  .cap-badge {
    font-size: 10px;
    color: var(--ink-dim);
    border: 1px solid var(--stroke-bright);
    padding: 4px 8px;
    border-radius: 5px;
  }
  .price-context {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;
    color: var(--ink-dim);
    margin-top: -9px;
  }
  .price-context > span:last-child {
    color: var(--amber);
  }
  .price-context > span.cheaper {
    color: var(--teal);
  }
  .price-context small {
    color: var(--ink-faint);
    margin-left: 3px;
    font-size: 10px;
  }
  .hero-rule {
    height: 1px;
    background: var(--stroke);
    margin: 21px 0;
  }
  .guru-call {
    display: flex;
    align-items: flex-start;
    gap: 13px;
  }
  .guru-symbol {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    border-radius: 12px;
    background: var(--teal-soft);
    color: var(--teal);
  }
  .guru-call .eyebrow {
    font-size: 9px;
    letter-spacing: 0.12em;
    color: var(--teal);
  }
  .guru-call h2 {
    font-size: 21px;
    line-height: 1.25;
    letter-spacing: -0.65px;
    margin: 5px 0 6px;
  }
  .guru-call p {
    font-size: 13px;
    line-height: 1.65;
    color: var(--ink-dim);
    margin: 0;
  }
  .outlook-stack {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .waiting-forecast {
    padding: 27px;
    flex: 1;
    background:
      radial-gradient(ellipse at 100% 0%, #a397ff10, transparent 60%),
      var(--surface);
  }
  .forecast-icon {
    width: 42px;
    height: 42px;
    display: grid;
    place-items: center;
    border: 1px solid #a397ff26;
    background: #a397ff0d;
    color: #bcb3ff;
    border-radius: 13px;
    margin-bottom: 22px;
  }
  .waiting-forecast h2 {
    font-size: 29px;
    letter-spacing: -1px;
    line-height: 1.22;
    margin: 10px 0 12px;
  }
  .waiting-forecast p {
    font-size: 14px;
    color: var(--ink-dim);
    line-height: 1.7;
    max-width: 360px;
  }
  .reset-note {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-top: 17px;
    margin-top: 20px;
    border-top: 1px solid var(--stroke);
    color: var(--ink-faint);
    font-size: 12px;
  }
  .trip-link {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 21px 24px;
    border: 1px solid var(--teal-border);
    background: var(--teal-soft);
    border-radius: 20px;
  }
  .trip-icon {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    flex-shrink: 0;
    border: 1px solid var(--teal-border);
    border-radius: 50%;
  }
  .trip-link div {
    flex: 1;
  }
  .trip-link b {
    font-size: 15px;
    font-weight: 600;
    color: var(--ink);
  }
  .trip-link div span {
    display: block;
    color: var(--ink-dim);
    font-size: 12px;
    margin-top: 3px;
  }
  .section-wrap {
    margin-top: 30px;
    min-width: 0;
  }
  .details-grid {
    display: grid;
    grid-template-columns: 1.15fr 1fr;
    gap: 18px;
    margin-bottom: 20px;
  }
  .details-grid > div {
    display: flex;
    flex-direction: column;
  }
  .details-grid > div :global(section) {
    height: 100%;
  }
  .how {
    margin-top: 20px;
    padding: 0 22px;
  }
  .how summary {
    list-style: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    min-height: 65px;
    font-size: 14px;
  }
  .how summary::-webkit-details-marker {
    display: none;
  }
  .how summary span {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .how-body {
    font-size: 13px;
    line-height: 1.7;
    color: var(--ink-dim);
    padding: 0 0 20px;
  }
  .how-body p:first-child {
    margin-top: 0;
  }
  .source-links {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 5px;
  }
  .source-links a {
    padding: 6px 0;
    font-size: 12px;
  }
  .page-footer {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 30px 3px 5px;
  }
  .footer-mark {
    font-size: 30px;
    font-weight: 750;
    letter-spacing: -4px;
    color: var(--ink-faint);
    margin-right: 5px;
  }
  .footer-mark span {
    color: var(--teal);
  }
  .page-footer p {
    font-size: 12px;
    color: var(--ink-dim);
    margin: 0;
  }
  .page-footer small {
    font-size: 11px;
    color: var(--ink-faint);
  }
  .heart {
    color: var(--teal);
  }
  .footer-province {
    margin-left: auto;
    font-size: 9px;
    letter-spacing: 0.15em;
    color: var(--ink-faint);
  }
  .bottom-nav {
    display: none;
  }
  .error-state {
    padding: 35px;
    text-align: center;
  }
  .error-state p {
    color: var(--ink-dim);
  }
  .no-history {
    padding: 25px;
  }
  @media (max-width: 700px) {
    .topbar {
      margin-bottom: 22px;
    }
    .edition {
      display: none;
    }
    .brand {
      font-size: 25px;
    }
    .brand-mark {
      width: 41px;
      height: 41px;
      border-radius: 12px;
    }
    .location-wrap {
      max-width: none;
    }
    .status-line {
      margin-top: 14px;
      font-size: 10px;
    }
    .status-date {
      display: none;
    }
    .overview-grid {
      grid-template-columns: 1fr;
      gap: 16px;
    }
    .price-card {
      padding: 18px 19px 20px;
    }
    .price-context {
      margin-top: -8px;
    }
    .hero-rule {
      margin: 17px 0;
    }
    .guru-call h2 {
      font-size: 21px;
    }
    .outlook-stack {
      gap: 13px;
    }
    .waiting-forecast {
      padding: 22px;
    }
    .forecast-icon {
      display: none;
    }
    .waiting-forecast h2 {
      font-size: 25px;
    }
    .waiting-forecast h2 br {
      display: none;
    }
    .waiting-forecast p {
      font-size: 13px;
    }
    .reset-note {
      margin-top: 15px;
      padding-top: 15px;
      font-size: 11px;
    }
    .trip-link {
      padding: 16px 19px;
      border-radius: 16px;
    }
    .details-grid {
      grid-template-columns: 1fr;
      gap: 0;
    }
    .section-wrap {
      margin-top: 27px;
    }
    .how {
      padding: 0 17px;
    }
    .page-footer {
      padding-top: 25px;
    }
    .footer-province {
      display: none;
    }
    .bottom-nav {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      display: flex;
      justify-content: space-around;
      padding: 9px 12px calc(env(safe-area-inset-bottom) + 11px);
      background: #0d1815f2;
      border-top: 1px solid var(--stroke-bright);
      backdrop-filter: blur(18px);
      z-index: 20;
    }
    .bottom-nav a {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 5px;
      min-height: 46px;
      min-width: 66px;
      color: var(--ink-faint);
      font-size: 10px;
    }
    .bottom-nav a.active {
      color: var(--teal);
    }
    .notice {
      padding: 9px 11px;
    }
    .notice p {
      font-size: 11px;
    }
  }
</style>
