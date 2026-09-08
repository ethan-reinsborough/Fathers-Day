<script lang="ts">
  import type { HistPoint, Prediction } from "../lib/types";
  import { cents, fmtDate } from "../lib/format";

  let {
    series,
    prediction,
  }: { series: HistPoint[]; prediction: Prediction | null } = $props();

  const RANGES = [
    { key: "1M", days: 31 },
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
    // Anchor to the last actual observation so old/offline data remains useful.
    const cutoff = t(series.at(-1)!.date) - days * 86400000;
    const pts = series.filter((p) => t(p.date) >= cutoff);
    return pts.length > 1 ? pts : series.slice(-2);
  });

  let fc = $derived(
    prediction
      ? { date: prediction.nextChangeDate, v: prediction.predictedRegular }
      : null,
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

  let line = $derived(
    view
      .map(
        (p, i) =>
          `${i ? "L" : "M"}${x(t(p.date)).toFixed(1)} ${y(p.regular).toFixed(1)}`,
      )
      .join(" "),
  );
  let area = $derived(
    `${line} L${x(t(view.at(-1)!.date)).toFixed(1)} ${H - PB} L${x(t(view[0].date)).toFixed(1)} ${H - PB} Z`,
  );

  let last = $derived(view.at(-1)!);
  let stats = $derived({
    low: Math.min(...view.map((p) => p.regular)),
    high: Math.max(...view.map((p) => p.regular)),
    change: last.regular - view[0].regular,
  });
  let grid = $derived(
    [0.2, 0.5, 0.8].map((f) => dom.vMin + (dom.vMax - dom.vMin) * f),
  );

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
  let hp = $derived(
    hover != null ? view[Math.min(hover, view.length - 1)] : null,
  );
</script>

<section class="glass card">
  <header>
    <div>
      <span class="eyebrow">Regulated max · history</span>
      <h3>The long view</h3>
    </div>
    <div class="seg">
      {#each RANGES as r}
        <button
          class:active={rangeKey === r.key}
          aria-pressed={rangeKey === r.key}
          onclick={() => {
            rangeKey = r.key;
            hover = null;
          }}>{r.key}</button
        >
      {/each}
    </div>
  </header>

  <div class="chart-stats">
    <div><span>PERIOD LOW</span><b>{cents(stats.low)}<small>¢</small></b></div>
    <div>
      <span>PERIOD HIGH</span><b>{cents(stats.high)}<small>¢</small></b>
    </div>
    <div>
      <span>CHANGE</span><b class:falling={stats.change < 0}
        >{stats.change > 0 ? "+" : ""}{cents(stats.change)}<small>¢</small></b
      >
    </div>
  </div>

  <div class="plot">
    <svg
      bind:this={svgEl}
      viewBox="0 0 {W} {H}"
      preserveAspectRatio="none"
      onpointermove={move}
      onpointerdown={move}
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

      {#each grid as value}<line
          x1={PL}
          y1={y(value)}
          x2={W - PR}
          y2={y(value)}
          stroke="rgba(255,255,255,0.075)"
          stroke-dasharray="3 5"
        /><text x={PL + 2} y={y(value) - 5} fill="#8b9d92" font-size="10"
          >{value.toFixed(0)}¢</text
        >{/each}

      <path d={area} fill="url(#fill)" class="area" />
      <path
        d={line}
        fill="none"
        stroke="url(#stroke)"
        stroke-width="2.4"
        stroke-linejoin="round"
        stroke-linecap="round"
        pathLength="1"
        class="line"
      />

      {#if fc && prediction}
        <!-- confidence band at forecast x -->
        <rect
          x={x(t(fc.date)) - 7}
          y={y(prediction.confidenceHigh)}
          width="14"
          height={Math.max(
            2,
            y(prediction.confidenceLow) - y(prediction.confidenceHigh),
          )}
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
        <circle
          cx={x(t(fc.date))}
          cy={y(fc.v)}
          r="4.5"
          fill="#2ee6c6"
          class="pulse"
        />
      {/if}

      <!-- current dot -->
      <circle cx={x(t(last.date))} cy={y(last.regular)} r="3.6" fill="#fff" />

      {#if hp}
        <line
          x1={x(t(hp.date))}
          y1={PT}
          x2={x(t(hp.date))}
          y2={H - PB}
          stroke="rgba(255,255,255,0.25)"
          stroke-width="1"
        />
        <circle cx={x(t(hp.date))} cy={y(hp.regular)} r="4" fill="#fff" />
      {/if}
    </svg>

    {#if hp}
      <div
        class="tip"
        style:left="clamp(65px, {(x(t(hp.date)) / W) * 100}%, calc(100% - 65px))"
      >
        <b>{cents(hp.regular)}¢</b><span>{fmtDate(hp.date, true)}</span>
      </div>
    {/if}
  </div>

  <div class="axis">
    <span>{fmtDate(view[0].date, true)}</span>
    {#if fc}<span class="fc">forecast {fmtDate(fc.date)} · {cents(fc.v)}¢</span
      >{/if}
    <span>{fmtDate(last.date)}</span>
  </div>
  <label class="scrubber"
    ><span
      >{hp
        ? `${fmtDate(hp.date, true)} · ${cents(hp.regular)}¢/L`
        : "Drag the graph to explore. Or use the slider."}</span
    ><input
      type="range"
      min="0"
      max={view.length - 1}
      value={hover ?? view.length - 1}
      oninput={(e) => (hover = Number(e.currentTarget.value))}
      aria-label="Explore historical prices"
      aria-valuetext={hp
        ? `${fmtDate(hp.date, true)}, ${cents(hp.regular)} cents per litre`
        : `${fmtDate(last.date, true)}, ${cents(last.regular)} cents per litre`}
    /></label
  >
</section>

<style>
  .card {
    padding: 23px 22px 18px;
  }
  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }
  .eyebrow {
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }
  h3 {
    margin: 3px 0 0;
    font-size: 23px;
    font-weight: 600;
    letter-spacing: -0.04em;
  }
  .seg {
    display: flex;
    gap: 2px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--stroke);
    border-radius: 11px;
    padding: 3px;
  }
  .seg button {
    border: none;
    background: none;
    color: var(--ink-dim);
    font-size: 11px;
    font-weight: 600;
    padding: 7px 9px;
    min-height: 36px;
    border-radius: 8px;
    transition: all 0.2s;
  }
  .seg button.active {
    background: var(--glass-2);
    color: var(--ink);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }

  .plot {
    position: relative;
  }
  svg {
    width: 100%;
    height: 210px;
    display: block;
    touch-action: pan-y;
  }
  .line {
    animation: draw 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
  }
  @keyframes draw {
    to {
      stroke-dashoffset: 0;
    }
  }
  .area {
    opacity: 0;
    animation: fade 1s ease 0.6s forwards;
  }
  @keyframes fade {
    to {
      opacity: 1;
    }
  }
  .pulse {
    animation: pulse 2s ease-in-out infinite;
    transform-origin: center;
    transform-box: fill-box;
  }
  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }

  .tip {
    position: absolute;
    top: -2px;
    transform: translateX(-50%);
    background: rgba(12, 12, 28, 0.92);
    border: 1px solid var(--stroke-bright);
    border-radius: 9px;
    padding: 5px 9px;
    pointer-events: none;
    white-space: nowrap;
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1.2;
  }
  .tip b {
    font-size: 14px;
  }
  .tip span {
    font-size: 10px;
    color: var(--ink-faint);
  }

  .axis {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-top: 6px;
    font-size: 11px;
    color: var(--ink-faint);
  }
  .axis .fc {
    color: var(--teal);
  }
  .chart-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin: 21px 0 15px;
  }
  .chart-stats div {
    border-right: 1px solid var(--stroke);
  }
  .chart-stats div:last-child {
    border: 0;
  }
  .chart-stats span {
    display: block;
    font-size: 8px;
    letter-spacing: 0.12em;
    color: var(--ink-faint);
  }
  .chart-stats b {
    display: block;
    font-size: 22px;
    letter-spacing: -0.6px;
    font-weight: 550;
    margin-top: 4px;
  }
  .chart-stats small {
    font-size: 11px;
    color: var(--ink-faint);
    margin-left: 3px;
  }
  .chart-stats .falling {
    color: var(--teal);
  }
  .scrubber {
    display: block;
    color: var(--ink-faint);
    font-size: 10px;
    margin-top: 16px;
  }
  .scrubber input {
    width: 100%;
    height: 25px;
    accent-color: var(--teal);
    margin-top: 7px;
  }
  .axis {
    font-size: 9px;
    flex-wrap: wrap;
  }
  .tip span {
    font-size: 11px;
  }
  @media (max-width: 700px) {
    .card {
      padding: 22px 19px 16px;
    }
    header {
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .eyebrow {
      font-size: 9px;
    }
    .seg button {
      padding: 7px 9px;
    }
    svg {
      height: 190px;
    }
    .chart-stats {
      margin: 18px 0 14px;
    }
  }
</style>
