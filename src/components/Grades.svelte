<script lang="ts">
  import type { Regulated } from "../lib/types";
  import { cents } from "../lib/format";

  let { r }: { r: Regulated } = $props();

  let grades = $derived(
    [
      { label: "Regular", v: r.regularSelfServe, hint: "self-serve" },
      { label: "Mid-grade", v: r.midGrade, hint: "" },
      { label: "Premium", v: r.premium, hint: "" },
      { label: "Diesel", v: r.diesel, hint: "ULSD" },
      { label: "Furnace oil", v: r.furnace, hint: "" },
      { label: "Propane", v: r.propane, hint: "" },
    ].filter((g) => g.v != null) as { label: string; v: number; hint: string }[]
  );
</script>

<section class="glass card">
  <span class="eyebrow">Every grade · today's ceiling</span>
  <div class="grid">
    {#each grades as g, i}
      <div class="chip" style="--i:{i}">
        <span class="lab">{g.label}{#if g.hint}<small>{g.hint}</small>{/if}</span>
        <span class="val">{cents(g.v)}<i>¢</i></span>
      </div>
    {/each}
  </div>
</section>

<style>
  .card { padding: 16px; }
  .eyebrow { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-faint); }
  .grid { margin-top: 12px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  @media (max-width: 380px) { .grid { grid-template-columns: repeat(2, 1fr); } }
  .chip {
    background: rgba(255,255,255,0.04); border: 1px solid var(--stroke);
    border-radius: 14px; padding: 10px 12px; display: flex; flex-direction: column; gap: 4px;
    animation: pop 0.5s cubic-bezier(.2,.9,.3,1.2) both; animation-delay: calc(var(--i) * 45ms + 100ms);
  }
  @keyframes pop { from { opacity: 0; transform: translateY(8px) scale(0.96); } to { opacity: 1; transform: none; } }
  .lab { font-size: 12px; color: var(--ink-dim); display: flex; flex-direction: column; }
  .lab small { font-size: 9.5px; color: var(--ink-faint); text-transform: uppercase; letter-spacing: 0.06em; }
  .val { font-size: 21px; font-weight: 700; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
  .val i { font-size: 12px; font-style: normal; color: var(--ink-dim); margin-left: 2px; }
</style>
