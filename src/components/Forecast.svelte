<script lang="ts">
  import { Tween } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import type { Prediction } from "../lib/types";
  import { cents, signed, fmtDate, weekday } from "../lib/format";

  let { p }: { p: Prediction } = $props();

  const num = new Tween(p.currentRegular, { duration: 1400, easing: cubicOut });
  $effect(() => {
    num.set(p.predictedRegular);
  });

  // Confidence band position within a fixed visual window around current.
  let span = $derived(Math.max(8, p.confidenceHalfWidth * 2 + 4));
  let lo = $derived(p.currentRegular - span / 2);
  const pct = (v: number) => Math.max(0, Math.min(100, ((v - lo) / span) * 100));

  let arrow = $derived(p.direction === "up" ? "▲" : p.direction === "down" ? "▼" : "▪");
  let toneClass = $derived(p.direction === "up" ? "up" : p.direction === "down" ? "down" : "flat");
  let lockPct = $derived(Math.max(8, Math.round(p.observedFraction * 100)));
  let confLabel = $derived(
    p.observedFraction >= 0.8 ? "near-final" : p.observedFraction >= 0.34 ? "firming up" : "early read"
  );
</script>

<section class="glass card">
  <header>
    <span class="eyebrow">The Guru's call · {weekday(p.nextChangeDate)} {fmtDate(p.nextChangeDate)}</span>
    {#if p.interrupterRisk}
      <span class="badge warn">⚡ interrupter watch</span>
    {/if}
  </header>

  <div class="lead">
    <div class="pred {toneClass}">
      <span class="big">{num.current.toFixed(1)}</span><span class="cl">¢/L</span>
    </div>
    <div class="chip {toneClass}">
      <span class="arr">{arrow}</span>
      {signed(p.deltaCents)}¢
      <small>vs {cents(p.currentRegular)}¢ now</small>
    </div>
  </div>

  <!-- confidence band -->
  <div class="band" aria-hidden="true">
    <div class="band-fill" style:left="{pct(p.confidenceLow)}%" style:right="{100 - pct(p.confidenceHigh)}%"></div>
    <div class="band-now" style:left="{pct(p.currentRegular)}%"><span>now</span></div>
    <div class="band-pred {toneClass}" style:left="{pct(p.predictedRegular)}%"><span>pred</span></div>
  </div>
  <div class="band-label">
    likely <b>{cents(p.confidenceLow)}–{cents(p.confidenceHigh)}¢</b> · {confLabel}
    <span class="dots"><i style:width="{lockPct}%"></i></span>
  </div>

  <p class="why">
    Driven by New York-Harbour benchmark momentum of {signed(p.benchmark.momentumCents)}¢.
    NB resets the cap every Friday 12:01 AM as benchmark + fixed margins & taxes.
  </p>
</section>

<style>
  .card { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .eyebrow { font-size: 11.5px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-faint); }
  .badge { font-size: 11px; font-weight: 600; padding: 4px 9px; border-radius: 999px; }
  .badge.warn { color: #1a1408; background: var(--amber); }
  .lead { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; }
  .pred { line-height: 0.9; font-weight: 700; letter-spacing: -0.03em; }
  .big { font-size: clamp(40px, 12vw, 56px); }
  .cl { font-size: 18px; color: var(--ink-dim); margin-left: 4px; font-weight: 500; }
  .pred.up { color: var(--red); }
  .pred.down { color: var(--teal); }
  .pred.flat { color: var(--ink); }
  .chip {
    display: inline-flex; align-items: baseline; gap: 6px;
    font-weight: 700; font-size: 16px; padding: 8px 12px; border-radius: 14px;
    background: var(--glass-2); border: 1px solid var(--stroke); white-space: nowrap;
  }
  .chip small { display: block; font-weight: 500; font-size: 10.5px; color: var(--ink-faint); }
  .chip.up { color: var(--red); }
  .chip.down { color: var(--teal); }
  .chip.flat { color: var(--ink-dim); }
  .arr { font-size: 12px; }

  .band {
    position: relative; height: 30px; margin-top: 2px;
    border-radius: 999px; background: rgba(255,255,255,0.05);
    border: 1px solid var(--stroke);
  }
  .band-fill {
    position: absolute; top: 6px; bottom: 6px; border-radius: 999px;
    background: linear-gradient(90deg, rgba(139,123,255,0.5), rgba(46,230,198,0.5));
    animation: grow 0.9s cubic-bezier(.2,.8,.2,1) both;
  }
  @keyframes grow { from { transform: scaleX(0.2); opacity: 0; } to { transform: scaleX(1); opacity: 1; } }
  .band-now, .band-pred { position: absolute; top: -2px; bottom: -2px; width: 2px; transform: translateX(-1px); }
  .band-now { background: var(--ink-dim); }
  .band-pred { width: 3px; }
  .band-pred.up { background: var(--red); }
  .band-pred.down { background: var(--teal); }
  .band-pred.flat { background: var(--violet); }
  .band-now span, .band-pred span {
    position: absolute; top: -16px; left: 50%; transform: translateX(-50%);
    font-size: 9px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-faint);
  }
  .band-pred span { color: inherit; }

  .band-label { font-size: 12px; color: var(--ink-dim); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .band-label b { color: var(--ink); }
  .dots { flex: 1; min-width: 60px; height: 4px; border-radius: 999px; background: rgba(255,255,255,0.08); overflow: hidden; }
  .dots i { display: block; height: 100%; background: linear-gradient(90deg, var(--violet), var(--teal)); }

  .why { margin: 2px 0 0; font-size: 12.5px; line-height: 1.5; color: var(--ink-faint); }
</style>
