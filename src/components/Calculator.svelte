<script lang="ts">
  import type { Regulated, Prediction } from "../lib/types";
  import { readStored, writeStored } from "../lib/storage";
  import Icon from "./Icon.svelte";
  let {
    r,
    prediction,
    old,
  }: { r: Regulated; prediction: Prediction | null; old: boolean } = $props();
  const saved = readStored<any>("gg-fillup-v2", {});
  let litres = $state(
    typeof saved.litres === "number" &&
      saved.litres >= 10 &&
      saved.litres <= 120
      ? saved.litres
      : 50,
  );
  let grade = $state("regularSelfServe");
  let mode = $state<"fill" | "trip">("fill");
  let km = $state(200);
  let economy = $state(8);
  let grades = $derived(
    [
      { key: "regularSelfServe", name: "Regular", price: r.regularSelfServe },
      { key: "premium", name: "Premium", price: r.premium },
      { key: "diesel", name: "Diesel", price: r.diesel },
    ].filter((g) => g.price != null),
  );
  let price = $derived(
    grades.find((g) => g.key === grade)?.price ?? r.regularSelfServe,
  );
  let validTrip = $derived(
    Number.isFinite(km) &&
      km > 0 &&
      km <= 10000 &&
      Number.isFinite(economy) &&
      economy >= 1 &&
      economy <= 50,
  );
  let volume = $derived(
    mode === "fill" ? litres : validTrip ? (km * economy) / 100 : null,
  );
  let cost = $derived(volume != null ? (volume * price) / 100 : null);
  let difference = $derived(
    prediction && grade === "regularSelfServe" && volume != null
      ? (volume * prediction.deltaCents) / 100
      : null,
  );
  $effect(() => {
    writeStored("gg-fillup-v2", { litres });
  });
</script>

<section class="glass calculator">
  <div class="calculator-heading">
    <div>
      <span class="eyebrow">MAKE IT PERSONAL</span>
      <h2>What’s it cost you?</h2>
    </div>
    <span class="wallet-icon"><Icon name="wallet" size={23} /></span>
  </div>
  <div class="calc-tabs">
    <button
      class:active={mode === "fill"}
      aria-pressed={mode === "fill"}
      onclick={() => (mode = "fill")}>My fill-up</button
    ><button
      class:active={mode === "trip"}
      aria-pressed={mode === "trip"}
      onclick={() => (mode = "trip")}>Road trip</button
    ><label
      ><span class="sr-only">Calculator fuel grade</span><select
        bind:value={grade}
        >{#each grades as g}<option value={g.key}>{g.name}</option
          >{/each}</select
      ></label
    >
  </div>
  {#if mode === "fill"}<div class="volume-heading">
      <label for="litres">Amount to fill</label><span
        >{litres}<small> litres</small></span
      >
    </div>
    <input
      id="litres"
      class="litres-range"
      type="range"
      min="10"
      max="120"
      step="5"
      bind:value={litres}
    />
    <div class="range-labels">
      <span>10 L</span>
      <div>
        {#each [40, 50, 60] as amount}<button
            class:selected={litres === amount}
            onclick={() => (litres = amount)}>{amount} L</button
          >{/each}
      </div>
      <span>120 L</span>
    </div>
  {:else}<div class="trip-inputs">
      <label
        >Trip distance <div>
          <input
            type="number"
            min="1"
            max="10000"
            bind:value={km}
            aria-label="Trip distance in kilometres"
          /><span>km</span>
        </div></label
      ><label
        >Fuel economy <div>
          <input
            type="number"
            min="1"
            max="50"
            step="0.1"
            bind:value={economy}
            aria-label="Fuel economy in litres per 100 kilometres"
          /><span>L/100 km</span>
        </div></label
      >
    </div>
    {#if !validTrip}<p class="input-error">
        Enter a distance of 1–10,000 km and fuel use of 1–50 L/100 km.
      </p>{/if}{/if}
  <div class="cost-result">
    <div>
      <span class="eyebrow">{old ? "AT THE SAVED CAP" : "AT THE NB CAP"}</span>
      <div class="cost">
        <small>$</small>{cost != null ? cost.toFixed(2) : "—"}
      </div>
    </div>
    <div class="cost-detail">
      {volume != null ? volume.toFixed(mode === "fill" ? 0 : 1) : "—"} L × {(
        price / 100
      ).toFixed(3)}<br />CAD per litre
    </div>
  </div>
  {#if difference != null}<p class="savings">
      <Icon name="trend" size={16} /><span
        >{Math.abs(difference) < 0.01
          ? "Almost no change forecast."
          : `About $${Math.abs(difference).toFixed(2)} ${difference < 0 ? "less" : "more"} after the next reset.`}</span
      >
    </p>{:else}<p class="calc-note">
      An estimate at the {old ? "saved" : "regulated"} maximum. Your actual pump
      price may be lower.
    </p>{/if}
</section>

<style>
  .calculator {
    padding: 23px 24px;
    display: flex;
    flex-direction: column;
  }
  .calculator-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .calculator-heading h2 {
    font-size: 23px;
    letter-spacing: -0.7px;
    margin: 4px 0 0;
  }
  .wallet-icon {
    display: grid;
    place-items: center;
    width: 41px;
    height: 41px;
    border-radius: 13px;
    border: 1px solid var(--teal-border);
    background: var(--teal-soft);
    color: var(--teal);
  }
  .calc-tabs {
    display: flex;
    align-items: center;
    gap: 4px;
    margin: 22px 0 20px;
  }
  .calc-tabs button {
    font-size: 12px;
    color: var(--ink-faint);
    background: none;
    border: 0;
    min-height: 38px;
    padding: 7px 11px;
    border-radius: 8px;
  }
  .calc-tabs button.active {
    color: var(--ink);
    background: var(--glass-2);
  }
  .calc-tabs label {
    margin-left: auto;
  }
  .calc-tabs select {
    font-size: 12px;
    background: var(--surface);
    border: 1px solid var(--stroke);
    border-radius: 8px;
    padding: 7px 3px;
    min-height: 38px;
    max-width: 94px;
    color: var(--ink-dim);
  }
  .volume-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .volume-heading label {
    font-size: 13px;
    color: var(--ink-dim);
  }
  .volume-heading > span {
    font-size: 24px;
    font-weight: 600;
  }
  .volume-heading small {
    font-size: 12px;
    font-weight: 400;
    color: var(--ink-faint);
  }
  .litres-range {
    accent-color: var(--teal);
    width: 100%;
    margin: 13px 0 4px;
    height: 25px;
    cursor: pointer;
  }
  .range-labels {
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: var(--ink-faint);
    font-size: 10px;
  }
  .range-labels div {
    display: flex;
    gap: 5px;
  }
  .range-labels button {
    padding: 4px 10px;
    border: 1px solid var(--stroke);
    min-height: 33px;
    border-radius: 7px;
    background: none;
    font-size: 10px;
    color: var(--ink-faint);
  }
  .range-labels button.selected {
    color: var(--teal);
    border-color: var(--teal-border);
    background: var(--teal-soft);
  }
  .cost-result {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    border-top: 1px solid var(--stroke);
    padding-top: 20px;
    margin-top: 23px;
  }
  .cost-result .eyebrow {
    font-size: 9px;
  }
  .cost {
    font-size: 46px;
    line-height: 1.2;
    letter-spacing: -2px;
    margin-top: 5px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .cost small {
    font-size: 27px;
    font-weight: 400;
    vertical-align: top;
    margin: 4px 2px 0 0;
    display: inline-block;
    color: var(--ink-faint);
  }
  .cost-detail {
    text-align: right;
    font-size: 11px;
    color: var(--ink-faint);
    line-height: 1.7;
  }
  .calc-note,
  .savings {
    font-size: 11px;
    color: var(--ink-faint);
    line-height: 1.7;
    margin: 14px 0 0;
  }
  .savings {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--teal);
  }
  .savings :global(svg) {
    flex-shrink: 0;
  }
  .trip-inputs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .trip-inputs label {
    font-size: 12px;
    color: var(--ink-faint);
  }
  .trip-inputs label div {
    display: flex;
    align-items: center;
    border: 1px solid var(--stroke-bright);
    border-radius: 10px;
    padding: 10px;
    margin-top: 7px;
  }
  .trip-inputs input {
    width: 100%;
    min-width: 0;
    background: none;
    border: 0;
    font-size: 18px;
    color: var(--ink);
  }
  .trip-inputs span {
    font-size: 10px;
    white-space: nowrap;
  }
  .input-error {
    font-size: 12px;
    color: var(--amber);
  }
  @media (max-width: 700px) {
    .calculator {
      padding: 21px 20px;
    }
    .calc-tabs select {
      font-size: 13px;
    }
    .calculator-heading h2 {
      font-size: 23px;
    }
  }
</style>
