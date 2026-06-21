<script lang="ts">
  // Show only on iOS Safari when NOT already installed to the home screen.
  let show = $state(false);
  let dismissed = $state(false);

  $effect(() => {
    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/.test(ua);
    const standalone =
      (window.navigator as any).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;
    const hid = localStorage.getItem("gg-install-hid") === "1";
    show = isIOS && !standalone && !hid;
  });

  function close() {
    dismissed = true;
    localStorage.setItem("gg-install-hid", "1");
  }
</script>

{#if show && !dismissed}
  <div class="glass hint">
    <button class="x" onclick={close} aria-label="Dismiss">×</button>
    <div class="ico">⛽</div>
    <div class="body">
      <b>Add Gas Guru to your Home Screen</b>
      <p>Tap <span class="key">Share</span> <span class="sf">􀈂</span> below, then <b>Add to Home Screen</b> — it opens like a real app.</p>
    </div>
  </div>
{/if}

<style>
  .hint {
    position: relative; display: flex; align-items: center; gap: 12px;
    padding: 14px 16px; border-color: var(--stroke-bright);
  }
  .ico { font-size: 26px; }
  .body b { font-size: 14px; }
  .body p { margin: 4px 0 0; font-size: 12.5px; color: var(--ink-dim); line-height: 1.5; }
  .key { background: var(--glass-2); border: 1px solid var(--stroke); border-radius: 6px; padding: 1px 6px; font-weight: 600; font-size: 11px; }
  .sf { color: var(--teal); }
  .x {
    position: absolute; top: 8px; right: 10px; border: none; background: none;
    color: var(--ink-faint); font-size: 20px; line-height: 1; padding: 4px;
  }
</style>
