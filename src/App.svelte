<script lang="ts">
  import { onMount } from "svelte";
  import { loadAll, type AppData } from "./lib/data";
  import { makeVerdict } from "./lib/verdict";
  import { cents, relTime, signed } from "./lib/format";
  import Gauge from "./components/Gauge.svelte";
  import Forecast from "./components/Forecast.svelte";
  import Stations from "./components/Stations.svelte";
  import PriceChart from "./components/PriceChart.svelte";
  import Grades from "./components/Grades.svelte";
  import InstallHint from "./components/InstallHint.svelte";

  let data = $state<AppData | null>(null);
  let failed = $state(false);

  onMount(async () => {
    try {
      data = await loadAll();
      if (!data.latest) failed = true;
    } catch {
      failed = true;
    }
  });

  let latest = $derived(data?.latest ?? null);
  let cheapest = $derived(data?.stations?.stations?.[0] ?? null);

  let gauge = $derived.by(() => {
    const s = data?.history?.series ?? [];
    const cut = Date.now() - 365 * 86400000;
    const recent = s.filter((p) => new Date(p.date + "T00:00:00").getTime() >= cut).map((p) => p.regular);
    const v = latest?.regulated.regularSelfServe ?? 170;
    if (recent.length < 3) return { low: v - 18, high: v + 18 };
    const min = Math.min(...recent), max = Math.max(...recent);
    const pad = (max - min) * 0.08 || 4;
    return { low: min - pad, high: max + pad };
  });

  let verdict = $derived(latest ? makeVerdict(latest.prediction, data?.stations ?? null, latest.regulated) : null);
  let gaugeDelta = $derived(cheapest && latest ? cheapest.regular - latest.regulated.regularSelfServe : 0);
</script>

<main>
  <header class="top">
    <div class="brand">
      <svg viewBox="0 0 32 32" class="mark" aria-hidden="true">
        <circle cx="16" cy="16" r="14" fill="none" stroke="url(#g)" stroke-width="2.5" stroke-dasharray="66 22" stroke-linecap="round" transform="rotate(135 16 16)" />
        <circle cx="16" cy="16" r="3" fill="#2ee6c6" />
        <line x1="16" y1="16" x2="24" y2="9" stroke="#2ee6c6" stroke-width="2.4" stroke-linecap="round" />
        <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b7bff" /><stop offset="1" stop-color="#2ee6c6" /></linearGradient></defs>
      </svg>
      <div>
        <h1>Gas&nbsp;Guru</h1>
        <span class="sub">Fredericton · NB regulated fuel</span>
      </div>
    </div>
    {#if latest}<span class="upd">updated {relTime(latest.generatedAt)}</span>{/if}
  </header>

  {#if failed}
    <section class="glass state">
      <p>Couldn't load price data.</p>
      <small>Run <code>npm run data</code> to generate it, then refresh.</small>
    </section>
  {:else if !latest}
    <section class="glass state"><div class="spinner"></div><p>Consulting the Guru…</p></section>
  {:else}
    <!-- HERO -->
    <section class="glass hero">
      <Gauge value={latest.regulated.regularSelfServe} low={gauge.low} high={gauge.high} delta={gaugeDelta} />
      {#if verdict}
        <div class="verdict {verdict.tone}">
          <span class="emoji">{verdict.emoji}</span>
          <div>
            <b>{verdict.headline}</b>
            <p>{verdict.detail}</p>
          </div>
        </div>
      {/if}
    </section>

    {#if latest.prediction}
      <Forecast p={latest.prediction} />
    {/if}

    {#if data?.stations}
      <Stations data={data.stations} cap={latest.regulated.regularSelfServe} />
    {/if}

    {#if data?.history && data.history.series.length > 1}
      <PriceChart series={data.history.series} prediction={latest.prediction} />
    {/if}

    <Grades r={latest.regulated} />

    <InstallHint />

    {#if latest.prediction}
      <details class="glass how">
        <summary>How the Guru predicts ⌄</summary>
        <div class="how-body">
          <p>New Brunswick is one of the few places where gas prices are <b>government-regulated</b>. The Energy & Utilities Board sets one province-wide <b>maximum</b> every Friday at 12:01&nbsp;AM from a public formula:</p>
          <div class="formula">
            <span>NY-Harbour benchmark<br /><b>{cents(latest.prediction.benchmark.publishedCents)}¢</b></span>
            <i>+</i>
            <span>fixed margins, taxes<br />& delivery<br /><b>{cents(latest.prediction.benchmark.fixedComponentCents)}¢</b></span>
            <i>=</i>
            <span>today's cap<br /><b>{cents(latest.regulated.regularSelfServe)}¢</b></span>
          </div>
          <p>Only the benchmark moves. The Guru tracks the NY-Harbour gasoline price (its momentum is {signed(latest.prediction.benchmark.momentumCents)}¢) and carries it onto the cap to forecast the next reset — accurate to a couple of cents in a normal week.</p>
          <ul class="src">
            <li>Regulated price · <a href={latest.regulated.sourceUrl} target="_blank" rel="noopener">NBEUB</a></li>
            <li>Benchmark · <a href="https://fred.stlouisfed.org/series/DGASNYH" target="_blank" rel="noopener">FRED / EIA NY-Harbour</a></li>
            <li>Exchange rate · <a href="https://www.bankofcanada.ca/valet/" target="_blank" rel="noopener">Bank of Canada</a></li>
            <li>Pump prices · <a href={data?.stations?.sourceUrl ?? "https://www.gasbuddy.com"} target="_blank" rel="noopener">GasBuddy</a></li>
          </ul>
        </div>
      </details>
    {/if}

    <footer>
      <p>The regulated price is a legal <b>ceiling</b> — stations price at or below it. Forecasts are estimates, not guarantees.</p>
      <p class="made">Made with ♥ for Dad · Happy Father's Day</p>
    </footer>
  {/if}
</main>

<style>
  main {
    width: 100%;
    max-width: var(--maxw);
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .top { display: flex; align-items: center; justify-content: space-between; padding: 2px 4px 4px; }
  .brand { display: flex; align-items: center; gap: 11px; }
  .mark { width: 40px; height: 40px; filter: drop-shadow(0 0 12px rgba(46,230,198,0.4)); }
  h1 { margin: 0; font-size: 23px; font-weight: 700; letter-spacing: -0.02em; line-height: 1; }
  .sub { font-size: 11.5px; color: var(--ink-faint); letter-spacing: 0.02em; }
  .upd { font-size: 11px; color: var(--ink-faint); }

  .hero { padding: 10px 16px 18px; display: flex; flex-direction: column; }
  .verdict {
    display: flex; gap: 12px; align-items: flex-start;
    margin-top: 6px; padding: 14px; border-radius: 16px;
    background: rgba(255,255,255,0.035); border: 1px solid var(--stroke);
    animation: rise 0.6s ease 0.3s both;
  }
  @keyframes rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
  .verdict .emoji { font-size: 24px; line-height: 1.1; }
  .verdict b { font-size: 15.5px; }
  .verdict p { margin: 3px 0 0; font-size: 13px; line-height: 1.5; color: var(--ink-dim); }
  .verdict.good { border-color: rgba(46,230,198,0.3); box-shadow: inset 0 0 0 1px rgba(46,230,198,0.06); }
  .verdict.warn { border-color: rgba(255,209,102,0.3); }

  .state { padding: 40px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 14px; }
  .state code { background: var(--glass-2); padding: 1px 6px; border-radius: 6px; }
  .spinner { width: 30px; height: 30px; border: 3px solid var(--stroke); border-top-color: var(--teal); border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .how { padding: 4px 16px; }
  .how summary { padding: 14px 0; font-weight: 600; font-size: 14.5px; cursor: pointer; list-style: none; }
  .how summary::-webkit-details-marker { display: none; }
  .how-body { padding: 0 0 16px; font-size: 13px; line-height: 1.55; color: var(--ink-dim); }
  .how-body p { margin: 0 0 12px; }
  .formula {
    display: flex; align-items: center; justify-content: space-between; gap: 6px; text-align: center;
    background: rgba(255,255,255,0.035); border: 1px solid var(--stroke); border-radius: 14px;
    padding: 14px 10px; margin: 0 0 12px; font-size: 11px; color: var(--ink-faint);
  }
  .formula b { display: block; margin-top: 4px; font-size: 16px; color: var(--ink); }
  .formula i { font-style: normal; font-size: 16px; color: var(--ink-faint); }
  .src { margin: 8px 0 0; padding: 0; list-style: none; display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 12px; }

  footer { padding: 6px 8px 0; text-align: center; }
  footer p { margin: 0 0 6px; font-size: 11.5px; color: var(--ink-faint); line-height: 1.5; }
  .made { color: var(--ink-dim) !important; font-size: 12.5px !important; }
</style>
