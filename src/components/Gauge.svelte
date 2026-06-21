<script lang="ts">
  import { Tween, Spring } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import { priceColor } from "../lib/format";

  let {
    value,
    low,
    high,
    caption = "regulated maximum",
    delta = 0,
  }: { value: number; low: number; high: number; caption?: string; delta?: number } = $props();

  const CX = 140,
    CY = 146,
    R = 108,
    START = 135,
    SWEEP = 270,
    N = 56;

  const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const pt = (deg: number, r: number) => [CX + r * Math.cos(rad(deg)), CY + r * Math.sin(rad(deg))];

  // Animated value (count-up) and needle (spring).
  const display = new Tween(low, { duration: 1500, easing: cubicOut });
  const needle = new Spring(0, { stiffness: 0.045, damping: 0.5 });

  $effect(() => {
    const f = clamp((value - low) / (high - low || 1));
    display.set(value);
    needle.set(f);
  });

  let angle = $derived(START + needle.current * SWEEP);
  let np = $derived(pt(angle, R - 16));
  let nx = $derived(np[0]);
  let ny = $derived(np[1]);
  let valueColor = $derived(priceColor(clamp((value - low) / (high - low || 1))));

  const ticks = Array.from({ length: N + 1 }, (_, i) => {
    const f = i / N;
    const a = START + f * SWEEP;
    const major = i % 7 === 0;
    const [x1, y1] = pt(a, R);
    const [x2, y2] = pt(a, R - (major ? 18 : 11));
    return { x1, y1, x2, y2, color: priceColor(f), major, f };
  });

  const [ax, ay] = pt(START, R);
  const [bx, by] = pt(START + SWEEP, R);
  const largeArc = SWEEP > 180 ? 1 : 0;
</script>

<div class="gauge">
  <svg viewBox="0 0 280 280" role="img" aria-label="Current price gauge">
    <defs>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3.4" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>

    <!-- track -->
    <path
      d="M {ax} {ay} A {R} {R} 0 {largeArc} 1 {bx} {by}"
      fill="none"
      stroke="rgba(255,255,255,0.06)"
      stroke-width="20"
      stroke-linecap="round"
    />

    <!-- coloured ticks -->
    {#each ticks as t}
      <line
        x1={t.x1}
        y1={t.y1}
        x2={t.x2}
        y2={t.y2}
        stroke={t.color}
        stroke-width={t.major ? 3 : 1.6}
        stroke-linecap="round"
        opacity={t.f <= needle.current + 0.012 ? 1 : 0.28}
      />
    {/each}

    <!-- needle -->
    <g filter="url(#glow)">
      <line x1={CX} y1={CY} x2={nx} y2={ny} stroke={valueColor} stroke-width="3.4" stroke-linecap="round" />
      <circle cx={CX} cy={CY} r="9" fill={valueColor} />
      <circle cx={CX} cy={CY} r="4.2" fill="#0b0b1a" />
    </g>
  </svg>

  <div class="readout">
    <div class="num" style:color={valueColor}>
      {display.current.toFixed(1)}<span class="unit">¢/L</span>
    </div>
    <div class="cap">{caption}</div>
    {#if delta}
      <div class="delta" class:up={delta > 0} class:down={delta < 0}>
        {delta > 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}¢ vs cheapest
      </div>
    {/if}
  </div>
</div>

<style>
  .gauge {
    position: relative;
    width: min(360px, 86vw);
    aspect-ratio: 1;
    margin: 4px auto 0;
  }
  svg {
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .readout {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    transform: translateY(6%);
  }
  .num {
    font-size: clamp(48px, 15vw, 70px);
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1;
    text-shadow: 0 0 38px currentColor;
    font-variant-numeric: tabular-nums;
  }
  .unit {
    font-size: 0.32em;
    font-weight: 500;
    color: var(--ink-dim);
    margin-left: 4px;
    letter-spacing: 0;
  }
  .cap {
    margin-top: 8px;
    font-size: 12px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }
  .delta {
    margin-top: 8px;
    font-size: 12.5px;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 999px;
    background: var(--glass-2);
    border: 1px solid var(--stroke);
  }
  .delta.up { color: var(--red); }
  .delta.down { color: var(--teal); }
</style>
