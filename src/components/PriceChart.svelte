<script lang="ts">
  import type { HistPoint, Prediction } from "../lib/types";
  import { cents, fmtDate } from "../lib/format";

  let { series, prediction }: { series: HistPoint[]; prediction: Prediction | null } = $props();

  const RANGES = [
    { key: "3M", days: 92 },
    { key: "1Y", days: 366 },
    { key: "All", days: 1e9 },
  ];
  let rangeKey = $state("1Y");

  const W = 520,
    H = 210,
    PL = 10,
    PR = 12,
    PT = 14,
    PB = 22;

  const t = (iso: string) => new Date(iso + "T00:00:00").getTime();

  let view = $derived.by(() => {
    const days = RANGES.find((r) => r.key === rangeKey)!.days;
    const cutoff = Date.now() - days * 86400000;
    const pts = series.filter((p) => t(p.date) >= cutoff);
    return pts.length > 1 ? pts : series.slice(-2);
  });

  let fc = $derived(
    prediction ? { date: prediction.nextChangeDate, v: prediction.predictedRegular } : null
  );

  let dom = $derived.by(() => {
    const xs = view.map((p) => t(p.date));
    const ys = view.map((p) => p.regular);
    let tMin = Math.min(...xs),
      tMax = Math.max(...xs);
    let vMin = Math.min(...ys),
      vMax = Math.max(...ys);
    if (fc) {
      tMax = Math.max(tMax, t(fc.date));
      vMin = Math.min(vMin, prediction!.confidenceLow);
      vMax = Math.max(vMax, prediction!.confidenceHigh);
    }
    const pad = (vMax - vMin) * 0.12 || 4;
    return { tMin, tMax, vMin: vMin - pad, vMax: vMax + pad };
  });

  const x = (ts: number) =>
    PL + ((ts - dom.tMin) / (dom.tMax - dom.tMin || 1)) * (W - PL - PR);
  const y = (v: number) =>
    PT + (1 - (v - dom.vMin) / (dom.vMax - dom.vMin || 1)) * (H - PT - PB);

  let line = $derived(view.map((p, i) => `${i ? "L" : "M"}${x(t(p.date)).toFixed(1)} ${y(p.regular).toFixed(1)}`).join(" "));
  let area = $derived(`${line} L${x(t(view.at(-1)!.date)).toFixed(1)} ${H - PB} L${x(t(view[0].date)).toFixed(1)} ${H - PB} Z`);

  let last = $derived(view.at(-1)!);

  // pointer scrubber
  let hover = $state<number | null>(null);
  let svgEl: SVGSVGElement;
  function move(e: PointerEvent) {
    const r = svgEl.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = 0,
      bd = Infinity;
    for (let i = 0; i < view.length; i++) {
      const d = Math.abs(x(t(view[i].date)) - px);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    hover = best;
  }
  let hp = $derived(hover != null ? view[hover] : null);
</script>

<section class="glass card">
  <header>
    <div>
      <span class="eyebrow">Regulated max · history</span>
      <h3>The long view</h3>
    </div>
    <div class="seg">
      {#each RANGES as r}
        <button class:active={rangeKey === r.key} onclick={() => (rangeKey = r.key)}>{r.key}</button>
      {/each}
    </div>
  </header>

  <div class="plot">
    <svg
      bind:this={svgEl}
      viewBox="0 0 {W} {H}"
      preserveAspectRatio="none"
      onpointermove={move}
      onpointerleave={() => (hover = null)}
      role="img"
      aria-label="Price history chart"
    >
      <defs>
        <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(139,123,255,0.34)" />
          <stop offset="100%" stop-color="rgba(139,123,255,0)" />
        </linearGradient>
        <linearGradient id="stroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#8b7bff" />
          <stop offset="100%" stop-color="#2ee6c6" />
        </linearGradient>
      </defs>

      <path d={area} fill="url(#fill)" class="area" />
      <path d={line} fill="none" stroke="url(#stroke)" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" pathLength="1" class="line" />

      {#if fc && prediction}
        <!-- confidence band at forecast x -->
        <rect
          x={x(t(fc.date)) - 7}
          y={y(prediction.confidenceHigh)}
          width="14"
          height={Math.max(2, y(prediction.confidenceLow) - y(prediction.confidenceHigh))}
          rx="7"
          fill="rgba(46,230,198,0.18)"
        />
        <line
          x1={x(t(last.date))}
          y1={y(last.regular)}
          x2={x(t(fc.date))}
          y2={y(fc.v)}
          stroke="#2ee6c6"
          stroke-width="2"
          stroke-dasharray="4 4"
          opacity="0.9"
        />
        <circle cx={x(t(fc.date))} cy={y(fc.v)} r="4.5" fill="#2ee6c6" class="pulse" />
      {/if}

      <!-- current dot -->
      <circle cx={x(t(last.date))} cy={y(last.regular)} r="3.6" fill="#fff" />

      {#if hp}
        <line x1={x(t(hp.date))} y1={PT} x2={x(t(hp.date))} y2={H - PB} stroke="rgba(255,255,255,0.25)" stroke-width="1" />
        <circle cx={x(t(hp.date))} cy={y(hp.regular)} r="4" fill="#fff" />
      {/if}
    </svg>

    {#if hp}
      <div class="tip" style:left="{(x(t(hp.date)) / W) * 100}%">
        <b>{cents(hp.regular)}¢</b><span>{fmtDate(hp.date, true)}</span>
      </div>
    {/if}
  </div>

  <div class="axis">
    <span>{fmtDate(view[0].date, true)}</span>
    {#if fc}<span class="fc">forecast {fmtDate(fc.date)} · {cents(fc.v)}¢</span>{/if}
    <span>{fmtDate(last.date)}</span>
  </div>
</section>

<style>
  .card { padding: 18px 16px 14px; }
  header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
  .eyebrow { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-faint); }
  h3 { margin: 2px 0 0; font-size: 18px; font-weight: 600; }
  .seg { display: flex; gap: 2px; background: rgba(255,255,255,0.05); border: 1px solid var(--stroke); border-radius: 11px; padding: 3px; }
  .seg button { border: none; background: none; color: var(--ink-dim); font-size: 12px; font-weight: 600; padding: 5px 11px; border-radius: 8px; transition: all 0.2s; }
  .seg button.active { background: var(--glass-2); color: var(--ink); box-shadow: inset 0 1px 0 rgba(255,255,255,0.08); }

  .plot { position: relative; }
  svg { width: 100%; height: 210px; display: block; touch-action: pan-y; }
  .line { animation: draw 1.5s cubic-bezier(.4,0,.2,1) forwards; stroke-dasharray: 1; stroke-dashoffset: 1; }
  @keyframes draw { to { stroke-dashoffset: 0; } }
  .area { opacity: 0; animation: fade 1s ease 0.6s forwards; }
  @keyframes fade { to { opacity: 1; } }
  .pulse { animation: pulse 2s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

  .tip {
    position: absolute; top: -2px; transform: translateX(-50%);
    background: rgba(12,12,28,0.92); border: 1px solid var(--stroke-bright);
    border-radius: 9px; padding: 5px 9px; pointer-events: none; white-space: nowrap;
    display: flex; flex-direction: column; align-items: center; line-height: 1.2;
  }
  .tip b { font-size: 14px; }
  .tip span { font-size: 10px; color: var(--ink-faint); }

  .axis { display: flex; justify-content: space-between; gap: 8px; margin-top: 6px; font-size: 11px; color: var(--ink-faint); }
  .axis .fc { color: var(--teal); }
</style>
