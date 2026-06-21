<script lang="ts">
  import type { Stations } from "../lib/types";
  import { cents, relTime, priceColor } from "../lib/format";

  let { data, cap, limit = 7 }: { data: Stations; cap: number; limit?: number } = $props();

  let list = $derived(data.stations.slice(0, limit));
  let lo = $derived(data.lowestRegular ?? (list.length ? list[0].regular : cap));
  let hi = $derived(data.highestRegular ?? cap);
  const frac = (v: number) => (hi === lo ? 0 : (v - lo) / (hi - lo));
  const save = (v: number) => Math.round((cap - v) * 10) / 10;
  const stamp = $derived(data.lastLiveAt ?? data.generatedAt);
</script>

<section class="glass card">
  <header>
    <div>
      <span class="eyebrow">Actual pump prices</span>
      <h3>Cheapest near you</h3>
    </div>
    <a class="src" href={data.sourceUrl} target="_blank" rel="noopener">
      {data.source} ↗
    </a>
  </header>

  {#if list.length}
    <ol>
      {#each list as s, i (s.id)}
        <li style="--i:{i}">
          <span class="rank">{i + 1}</span>
          <span class="meta">
            <b>{s.name}</b>
            <small>{s.locality || s.address}{s.postedAt ? ` · ${relTime(s.postedAt)}` : ""}</small>
          </span>
          {#if save(s.regular) > 0}
            <span class="save">−{save(s.regular).toFixed(1)}¢</span>
          {/if}
          <span class="price" style:color={priceColor(frac(s.regular))}>{cents(s.regular)}</span>
        </li>
      {/each}
    </ol>
    <footer>
      {data.count ?? data.stations.length} stations · updated {relTime(stamp)}
      {#if data.stale}<span class="stale">· cached</span>{/if}
    </footer>
  {:else}
    <div class="empty">
      <p>Live station prices aren't loaded right now.</p>
      <a class="cta" href={data.sourceUrl} target="_blank" rel="noopener">View live on GasBuddy ↗</a>
    </div>
  {/if}
</section>

<style>
  .card { padding: 18px 18px 14px; }
  header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
  .eyebrow { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-faint); }
  h3 { margin: 2px 0 0; font-size: 18px; font-weight: 600; }
  .src { font-size: 12px; color: var(--ink-dim); white-space: nowrap; padding-top: 4px; }

  ol { list-style: none; margin: 6px 0 0; padding: 0; display: flex; flex-direction: column; }
  li {
    display: grid;
    grid-template-columns: 22px 1fr auto auto;
    align-items: center;
    gap: 10px;
    padding: 9px 0;
    border-top: 1px solid var(--stroke);
    animation: row 0.5s ease both;
    animation-delay: calc(var(--i) * 55ms + 120ms);
  }
  li:first-child { border-top: none; }
  @keyframes row { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: none; } }
  .rank { font-size: 12px; color: var(--ink-faint); font-weight: 600; text-align: center; }
  .meta { display: flex; flex-direction: column; min-width: 0; }
  .meta b { font-weight: 600; font-size: 14.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .meta small { color: var(--ink-faint); font-size: 11.5px; }
  .save {
    font-size: 11px; font-weight: 700; color: var(--teal);
    background: rgba(46,230,198,0.1); border: 1px solid rgba(46,230,198,0.25);
    padding: 2px 7px; border-radius: 999px;
  }
  .price { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; min-width: 58px; text-align: right; }

  footer { margin-top: 10px; font-size: 11.5px; color: var(--ink-faint); }
  .stale { color: var(--amber); }
  .empty { padding: 10px 0 6px; }
  .empty p { margin: 0 0 10px; color: var(--ink-dim); font-size: 14px; }
  .cta {
    display: inline-block; font-weight: 600; padding: 9px 14px; border-radius: 12px;
    background: var(--glass-2); border: 1px solid var(--stroke);
  }
</style>
