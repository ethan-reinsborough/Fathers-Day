<script lang="ts">
  import type { Stations } from "../lib/types";
  import {
    nearbyStations,
    gasBuddyURL,
    mapsURL,
    directionsURL,
    type Location,
  } from "../lib/locations";
  import { readStored, writeStored } from "../lib/storage";
  import { cents, relTime } from "../lib/format";
  import { gradeTimestamp, stationIsOld } from "../lib/freshness";
  import Icon from "./Icon.svelte";
  let {
    data,
    cap,
    capOld,
    location,
    now,
  }: {
    data: Stations | null;
    cap: number;
    capOld: boolean;
    location: Location;
    now: number;
  } = $props();
  let radius = $state(25);
  let fuel = $state<"regular" | "premium" | "diesel">("regular");
  let sort = $state("price");
  let onlySaved = $state(false);
  const saved = readStored<unknown>("gg-favorites-v2", []);
  let favorites = $state<string[]>(
    Array.isArray(saved) ? saved.filter((v) => typeof v === "string") : [],
  );
  let expanded = $state(false);
  let nearby = $derived(
    nearbyStations(data, location, radius, now).map((s) => {
      const station = { ...s, postedAt: gradeTimestamp(s, fuel) };
      return { ...station, old: stationIsOld(station, data, now) };
    }),
  );
  let list = $derived(
    nearby
      .filter(
        (s) => (!onlySaved || favorites.includes(s.id)) && s[fuel] != null,
      )
      .sort((a, b) =>
        sort === "distance"
          ? a.distance - b.distance
          : Number(a.old) - Number(b.old) || a[fuel]! - b[fuel]!,
      ),
  );
  let visible = $derived(expanded ? list : list.slice(0, 5));
  let oldReports = $derived(list.some((s) => s.old));
  let freshBest = $derived(
    list
      .filter((s) => !s.old)
      .reduce((best, s) => Math.min(best, s[fuel]!), Infinity),
  );
  function toggle(id: string) {
    favorites = favorites.includes(id)
      ? favorites.filter((v) => v !== id)
      : [...favorites, id];
    writeStored("gg-favorites-v2", favorites);
  }
  $effect(() => {
    location.id;
    radius;
    fuel;
    onlySaved;
    expanded = false;
  });
</script>

<section class="station-section">
  <div class="section-head">
    <div>
      <span class="eyebrow">A GOOD PLACE TO PULL OVER</span>
      <h2>Find your next fill-up</h2>
    </div>
    <a class="text-link" href={mapsURL(location)} target="_blank" rel="noopener"
      >Open map <Icon name="arrow" size={17} /></a
    >
  </div>
  <div class="station-toolbar">
    <div class="fuel-tabs" aria-label="Station fuel type">
      {#each ["regular", "premium", "diesel"] as f}<button
          class:active={fuel === f}
          aria-pressed={fuel === f}
          onclick={() => (fuel = f as typeof fuel)}>{f}</button
        >{/each}
    </div>
    <div class="filters">
      <label class="filter-select"
        ><span class="sr-only">Search radius</span><select bind:value={radius}
          ><option value={10}>10 km</option><option value={25}>25 km</option
          ><option value={50}>50 km</option><option value={100}>100 km</option
          ></select
        ></label
      ><label class="filter-select"
        ><span class="sr-only">Sort stations</span><select bind:value={sort}
          ><option value="price">Lowest price</option><option value="distance"
            >Nearest</option
          ></select
        ></label
      ><button
        class="saved-filter"
        class:selected={onlySaved}
        aria-label="Show saved stations"
        aria-pressed={onlySaved}
        onclick={() => (onlySaved = !onlySaved)}
        ><Icon name="star" size={18} /></button
      >
    </div>
  </div>
  <div class="glass station-card">
    <div class="list-heading">
      <span
        >{list.length}
        {list.length === 1 ? "report" : "reports"} around
        <b>{location.name}</b></span
      ><span>¢ / L</span>
    </div>
    {#if visible.length}
      <ol>
        {#each visible as s (s.id)}<li>
            <div
              class="station-brand"
              class:best={!s.old && s[fuel] === freshBest}
            >
              {s.name.slice(0, 1).toUpperCase()}
            </div>
            <div class="station-info">
              <div class="name-row">
                <a
                  href={directionsURL(s)}
                  target="_blank"
                  rel="noopener"
                  aria-label={"Directions to " + s.name + ", " + s.address}
                  >{s.name}</a
                >{#if !s.old && s[fuel] === freshBest}<span class="best-badge"
                    >BEST PRICE</span
                  >{/if}
              </div>
              <p>{s.address}{s.address ? " · " : ""}{s.locality}</p>
              <div class="station-meta">
                <span
                  >{s.approximate
                    ? "Community match"
                    : `${s.distance.toFixed(1)} km away`}</span
                ><span class:old={s.old}
                  >{s.old ? "Old report · " : ""}{s.postedAt
                    ? relTime(s.postedAt)
                    : "Time unknown"}</span
                >
              </div>
            </div>
            <div class="station-price" class:old={s.old}>
              <strong>{cents(s[fuel])}</strong
              >{#if !s.old && !capOld && fuel === "regular" && cap - s.regular > 0}<small
                  >{cents(cap - s.regular)}¢ below cap</small
                >{:else}<small
                  >{s.old ? "last reported" : "reported price"}</small
                >{/if}
            </div>
            <button
              class="favorite"
              class:saved={favorites.includes(s.id)}
              aria-label={(favorites.includes(s.id) ? "Unsave " : "Save ") +
                s.name}
              aria-pressed={favorites.includes(s.id)}
              onclick={() => toggle(s.id)}
              ><Icon name="star" size={17} /></button
            >
          </li>{/each}
      </ol>
      {#if list.length > 5}<button
          class="show-more"
          onclick={() => (expanded = !expanded)}
          >{expanded
            ? "Show fewer stations"
            : `Show all ${list.length} stations`}<Icon
            name="down"
            size={16}
          /></button
        >{/if}
    {:else}<div class="empty-stations">
        <span class="empty-icon"><Icon name="pin" size={26} /></span>
        <h3>
          {onlySaved ? "No saved matches here." : "Let’s find a pump nearby."}
        </h3>
        <p>
          {onlySaved
            ? "Star a station to keep it handy, or turn off the saved filter."
            : `No ${fuel} price reports are saved within ${radius} km. Search current listings around ${location.name}, or try a wider radius.`}
        </p>
        <a
          class="button primary"
          href={gasBuddyURL(
            location,
            fuel === "diesel" ? 4 : fuel === "premium" ? 3 : 1,
          )}
          target="_blank"
          rel="noopener">Search local prices <Icon name="arrow" size={16} /></a
        >
      </div>{/if}
    <div class="station-footer">
      <p>
        {oldReports
          ? "Older reports are shown for reference. Check the price before driving."
          : "Community-reported prices can change."} Distances are straight-line;
        community matches are approximate.
      </p>
      <a
        href={gasBuddyURL(
          location,
          fuel === "diesel" ? 4 : fuel === "premium" ? 3 : 1,
        )}
        target="_blank"
        rel="noopener">Check on GasBuddy <Icon name="arrow" size={14} /></a
      >
    </div>
  </div>
</section>

<style>
  .station-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 13px;
  }
  .fuel-tabs {
    display: flex;
    gap: 5px;
  }
  .fuel-tabs button {
    background: none;
    border: 1px solid transparent;
    min-height: 42px;
    padding: 8px 15px;
    border-radius: 9px;
    color: var(--ink-faint);
    font-size: 13px;
    text-transform: capitalize;
  }
  .fuel-tabs button.active {
    background: var(--teal-soft);
    border-color: var(--teal-border);
    color: var(--teal);
  }
  .filters {
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .filter-select select {
    background: var(--surface);
    border: 1px solid var(--stroke);
    border-radius: 9px;
    min-height: 42px;
    padding: 7px 25px 7px 10px;
    font-size: 12px;
    color: var(--ink-dim);
  }
  .saved-filter {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    border: 1px solid var(--stroke);
    border-radius: 9px;
    background: var(--surface);
    color: var(--ink-faint);
  }
  .saved-filter.selected {
    color: var(--teal);
    border-color: var(--teal-border);
  }
  .station-card {
    overflow: hidden;
  }
  .list-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 17px 22px;
    border-bottom: 1px solid var(--stroke);
    font-size: 11px;
    color: var(--ink-faint);
  }
  .list-heading b {
    font-weight: 500;
    color: var(--ink-dim);
  }
  .list-heading > span:last-child {
    letter-spacing: 0.16em;
  }
  ol {
    list-style: none;
    margin: 0;
    padding: 0 22px;
  }
  li {
    display: grid;
    grid-template-columns: 43px minmax(0, 1fr) auto 34px;
    align-items: center;
    gap: 14px;
    padding: 19px 0;
    border-bottom: 1px solid var(--stroke);
  }
  li:last-child {
    border-bottom: 0;
  }
  .station-brand {
    display: grid;
    place-items: center;
    width: 43px;
    height: 43px;
    border: 1px solid var(--stroke);
    border-radius: 13px;
    font-size: 19px;
    font-weight: 700;
    color: var(--ink-dim);
    background: var(--glass-2);
  }
  .station-brand.best {
    background: var(--teal);
    color: #23300e;
  }
  .station-info {
    min-width: 0;
  }
  .name-row {
    display: flex;
    gap: 9px;
    align-items: center;
    flex-wrap: wrap;
  }
  .name-row > a {
    color: var(--ink);
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.02em;
  }
  .name-row > a:hover {
    text-decoration: underline;
    text-underline-offset: 4px;
  }
  .best-badge {
    font-size: 8px;
    letter-spacing: 0.08em;
    color: var(--teal);
    border: 1px solid var(--teal-border);
    padding: 2px 5px;
    border-radius: 4px;
  }
  .station-info p {
    font-size: 12px;
    color: var(--ink-faint);
    margin: 3px 0;
    line-height: 1.5;
  }
  .station-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 3px 12px;
    font-size: 10px;
    color: var(--ink-faint);
  }
  .station-meta .old {
    color: var(--amber);
  }
  .station-price {
    text-align: right;
    color: var(--teal);
  }
  .station-price.old {
    color: var(--ink-dim);
  }
  .station-price strong {
    font-size: 26px;
    letter-spacing: -1px;
    font-weight: 650;
    line-height: 1.2;
    font-variant-numeric: tabular-nums;
  }
  .station-price small {
    display: block;
    font-size: 9px;
    letter-spacing: 0.01em;
    margin-top: 5px;
    color: var(--ink-faint);
  }
  .favorite {
    display: grid;
    place-items: center;
    min-height: 44px;
    width: 34px;
    border: 0;
    background: none;
    color: var(--ink-faint);
  }
  .favorite.saved {
    color: var(--teal);
  }
  .favorite.saved :global(svg) {
    fill: #c2f97022;
  }
  .station-footer {
    padding: 14px 22px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    background: #ffffff02;
    border-top: 1px solid var(--stroke);
  }
  .station-footer p {
    margin: 0;
    max-width: 580px;
    font-size: 11px;
    line-height: 1.5;
    color: var(--ink-faint);
  }
  .station-footer a {
    display: flex;
    align-items: center;
    gap: 3px;
    white-space: nowrap;
    font-size: 11px;
    min-height: 36px;
  }
  .show-more {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    background: none;
    border: 0;
    border-top: 1px solid var(--stroke);
    width: 100%;
    padding: 13px;
    color: var(--ink-dim);
    font-size: 12px;
  }
  .empty-stations {
    text-align: center;
    padding: 30px 22px;
  }
  .empty-icon {
    display: inline-grid;
    place-items: center;
    background: var(--teal-soft);
    color: var(--teal);
    border: 1px solid var(--teal-border);
    border-radius: 50%;
    width: 52px;
    height: 52px;
  }
  .empty-stations h3 {
    font-size: 20px;
    letter-spacing: -0.5px;
    margin: 14px 0 8px;
  }
  .empty-stations p {
    font-size: 13px;
    color: var(--ink-dim);
    max-width: 390px;
    margin: 0 auto 20px;
    line-height: 1.7;
  }
  @media (max-width: 700px) {
    .section-head .eyebrow {
      font-size: 9px;
    }
    .section-head h2 {
      font-size: 22px;
    }
    .section-head .text-link {
      font-size: 11px;
      white-space: nowrap;
    }
    .station-toolbar {
      flex-wrap: wrap;
      gap: 10px;
    }
    .fuel-tabs button {
      padding: 8px 15px;
    }
    .filters {
      width: 100%;
    }
    .filter-select:nth-child(2) {
      margin-left: auto;
    }
    .list-heading {
      padding: 14px 16px;
      font-size: 10px;
    }
    ol {
      padding: 0 14px;
    }
    li {
      grid-template-columns: 33px minmax(0, 1fr) auto;
      gap: 10px;
      padding: 16px 0;
      position: relative;
    }
    .station-brand {
      width: 33px;
      height: 36px;
      border-radius: 10px;
      font-size: 16px;
    }
    .name-row > a {
      font-size: 13px;
    }
    .name-row {
      gap: 4px;
    }
    .station-info p {
      font-size: 10px;
    }
    .station-meta {
      font-size: 9px;
      gap: 2px 7px;
    }
    .station-price strong {
      font-size: 24px;
    }
    .station-price small {
      font-size: 8px;
    }
    .favorite {
      grid-column: 1;
      grid-row: auto;
      margin-top: -16px;
      margin-bottom: -9px;
      min-height: 34px;
    }
    .station-footer {
      padding: 13px 16px;
      display: block;
    }
    .station-footer p {
      font-size: 10px;
    }
    .station-footer a {
      margin-top: 5px;
    }
    .best-badge {
      font-size: 7px;
    }
    .station-info {
      align-self: start;
    }
    .station-price {
      align-self: start;
      padding-top: 1px;
    }
  }
</style>
