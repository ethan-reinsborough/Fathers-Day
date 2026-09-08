<script lang="ts">
  import { onDestroy } from "svelte";
  import Icon from "./Icon.svelte";
  import {
    LOCATIONS,
    normalize,
    searchLocations,
    validLocation,
    type Location,
  } from "../lib/locations";
  let {
    location,
    onchange,
  }: { location: Location; onchange: (v: Location) => void } = $props();
  let dialog: HTMLDialogElement;
  let query = $state("");
  let remote = $state<Location[]>([]);
  let searchBusy = $state(false);
  let locating = $state(false);
  let message = $state("");
  let searchMessage = $state("");
  let request = 0;
  let gpsRequest = 0;
  let gpsTimer: ReturnType<typeof setTimeout>;
  let matches = $derived(
    LOCATIONS.filter((l) => normalize(l.name).includes(normalize(query))),
  );
  let results = $derived([
    ...matches,
    ...remote.filter(
      (l) => !matches.some((m) => normalize(m.name) === normalize(l.name)),
    ),
  ]);
  function choose(value: Location) {
    gpsRequest++;
    clearTimeout(gpsTimer);
    locating = false;
    message = "";
    onchange(value);
    dialog?.close();
  }
  function open() {
    request++;
    searchBusy = false;
    query = "";
    remote = [];
    searchMessage = "";
    dialog.showModal();
  }
  async function search(event: SubmitEvent) {
    event.preventDefault();
    if (query.trim().length < 2) return;
    const id = ++request;
    searchBusy = true;
    searchMessage = "";
    try {
      const found = await searchLocations(query);
      if (id !== request) return;
      remote = found;
      if (!found.length)
        searchMessage =
          "No additional places found. Try a nearby community or use your location.";
    } catch {
      if (id === request)
        searchMessage =
          "Online search is unavailable. The saved community list and GPS still work.";
    } finally {
      if (id === request) searchBusy = false;
    }
  }
  function locate() {
    if (!navigator.geolocation) {
      message =
        "Location is unavailable in this browser. Choose a community instead.";
      return;
    }
    const id = ++gpsRequest;
    locating = true;
    message = "";
    gpsTimer = setTimeout(() => {
      if (id === gpsRequest) {
        gpsRequest++;
        locating = false;
        message = "Location took too long. Try again or choose a community.";
      }
    }, 10000);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (id !== gpsRequest) return;
        clearTimeout(gpsTimer);
        locating = false;
        const value = {
          id: "gps",
          name: "Current location",
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          gps: true,
        };
        if (!validLocation(value)) {
          message =
            "You appear to be outside the New Brunswick region. Choose an NB destination to plan ahead.";
          return;
        }
        choose(value);
      },
      (error) => {
        if (id !== gpsRequest) return;
        clearTimeout(gpsTimer);
        locating = false;
        message =
          error.code === 1
            ? "Location permission is off. Choose a community, or enable location in your browser settings."
            : "Could not find your location. Try again or choose a community.";
      },
      { enableHighAccuracy: false, timeout: 9000, maximumAge: 60000 },
    );
  }
  onDestroy(() => {
    request++;
    gpsRequest++;
    clearTimeout(gpsTimer);
  });
</script>

<div class="location-bar">
  <button class="location-button" onclick={open} aria-label="Change location">
    <span class="location-icon"><Icon name="pin" /></span>
    <span class="location-label"
      ><small>YOUR PIT STOP</small><strong
        >{location.name}<span> · NB</span></strong
      ></span
    >
    <Icon name="down" size={16} />
  </button>
  <button
    class="gps-button"
    onclick={locate}
    disabled={locating}
    aria-label="Use my location"
    ><Icon name="locate" /><span>{locating ? "Locating…" : "Locate me"}</span
    ></button
  >
</div>
{#if message}<p class="location-message" role="status">{message}</p>{/if}
<div class="quick-places" aria-label="Quick locations">
  {#each LOCATIONS.slice(0, 3) as place}<button
      class:chosen={location.id === place.id}
      onclick={() => choose(place)}>{place.name}</button
    >{/each}
  <button onclick={open}>More places <Icon name="arrow" size={13} /></button>
</div>

<dialog bind:this={dialog} class="location-dialog">
  <div class="dialog-head">
    <div>
      <span class="eyebrow">HOME OR THE OPEN ROAD</span>
      <h2>Where are you headed?</h2>
    </div>
    <button
      class="icon-button"
      onclick={() => dialog.close()}
      aria-label="Close location picker"><Icon name="close" /></button
    >
  </div>
  <form onsubmit={search} class="place-search">
    <Icon name="search" /><input
      aria-label="Search New Brunswick communities"
      placeholder="Search a New Brunswick community"
      bind:value={query}
      oninput={() => {
        request++;
        remote = [];
        searchMessage = "";
        searchBusy = false;
      }}
    /><button class="button" disabled={searchBusy || query.trim().length < 2}
      >{searchBusy ? "Searching…" : "Search"}</button
    >
  </form>
  <p class="search-note">
    {LOCATIONS.length} communities available offline. Search online for more.
  </p>
  {#if searchMessage}<p class="search-note" role="status">
      {searchMessage}
    </p>{/if}
  <div class="place-results">
    {#each results as place (place.id)}<button onclick={() => choose(place)}
        ><Icon name="pin" size={17} /><span>{place.name}</span
        >{#if place.id === location.id}<Icon
            name="check"
            size={18}
          />{:else}<Icon name="chevron" size={16} />{/if}</button
      >{/each}
    {#if !results.length}<p>
        No saved matches. Tap Search to look across New Brunswick.
      </p>{/if}
  </div>
  <p class="search-note attribution">
    Place search: <a
      href="https://open-meteo.com/"
      target="_blank"
      rel="noopener">Open-Meteo</a
    >
    /
    <a href="https://www.geonames.org/" target="_blank" rel="noopener"
      >GeoNames</a
    >. GPS stays on this device until you open a map or station search.
  </p>
</dialog>

<style>
  .location-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--surface);
    border: 1px solid var(--stroke);
    border-radius: 16px;
    padding: 5px;
  }
  .location-button {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 11px;
    min-width: 0;
    text-align: left;
    background: none;
    border: 0;
    padding: 6px 9px;
  }
  .location-icon {
    color: var(--teal);
  }
  .location-label {
    display: grid;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }
  .location-label small {
    font-size: 10px;
    letter-spacing: 0.16em;
    color: var(--ink-faint);
  }
  strong {
    font-size: 15px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  strong span {
    color: var(--ink-faint);
    font-weight: 400;
  }
  .gps-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    border: 1px solid var(--stroke);
    background: var(--glass-2);
    border-radius: 11px;
    padding: 10px 12px;
    font-size: 12px;
    color: var(--teal);
  }
  .quick-places {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-top: 9px;
  }
  .quick-places button {
    display: flex;
    align-items: center;
    gap: 4px;
    background: none;
    border: 1px solid transparent;
    border-radius: 8px;
    min-height: 36px;
    padding: 4px 9px;
    font-size: 12px;
    color: var(--ink-dim);
  }
  .quick-places button.chosen {
    background: var(--teal-soft);
    color: var(--teal);
    border-color: var(--teal-border);
  }
  .quick-places button:last-child {
    margin-left: auto;
  }
  .location-message {
    font-size: 13px;
    color: var(--amber);
    line-height: 1.5;
    margin: 8px 4px 0;
  }
  .location-dialog {
    width: min(560px, calc(100% - 24px));
    max-height: 80dvh;
    color: var(--ink);
    background: #111d1b;
    border: 1px solid var(--stroke-bright);
    border-radius: 24px;
    padding: 24px;
    box-shadow: 0 30px 120px #000a;
  }
  .location-dialog::backdrop {
    background: #030b0ac7;
    backdrop-filter: blur(7px);
  }
  .dialog-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 20px;
  }
  h2 {
    font-size: 22px;
    margin: 5px 0 0;
    letter-spacing: -0.04em;
  }
  .place-search {
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid var(--stroke-bright);
    border-radius: 12px;
    padding: 5px 5px 5px 12px;
  }
  .place-search input {
    width: 100%;
    min-width: 0;
    background: none;
    border: 0;
    outline: 0;
    padding: 9px 0;
    font-size: 16px;
    color: var(--ink);
  }
  .place-search .button {
    padding: 10px;
    font-size: 12px;
  }
  .search-note {
    font-size: 12px;
    line-height: 1.5;
    color: var(--ink-faint);
  }
  .place-results {
    max-height: 43dvh;
    overflow-y: auto;
  }
  .place-results button {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 14px 8px;
    background: none;
    border: 0;
    border-bottom: 1px solid var(--stroke);
    text-align: left;
  }
  .place-results button span {
    flex: 1;
  }
  .place-results button:hover {
    background: var(--teal-soft);
  }
  .place-results p {
    font-size: 14px;
    color: var(--ink-dim);
  }
  .attribution {
    margin-bottom: 0;
  }
  @media (max-width: 380px) {
    .gps-button span {
      display: none;
    }
    .quick-places {
      gap: 0;
    }
    .quick-places button {
      font-size: 11px;
      padding: 4px 6px;
    }
    .location-dialog {
      padding: 18px;
    }
    .eyebrow {
      font-size: 10px;
    }
  }
</style>
