<script lang="ts">
  let { name, size = 20 }: { name: string; size?: number } = $props();
  const paths: Record<string, string> = {
    pump: "M4 21V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v17M3 21h12M6 6h6v5H6zM14 13h2a2 2 0 0 1 2 2v3a2 2 0 0 0 4 0V9l-4-4M19 6v4h3",
    pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
    locate:
      "M12 2v3M12 19v3M2 12h3M19 12h3M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
    refresh:
      "M20 7V2l-3 3a8 8 0 0 0-13 7M20 2h-5M4 17v5l3-3a8 8 0 0 0 13-7M4 22h5",
    arrow: "M7 17 17 7M7 7h10v10",
    chevron: "m9 5 7 7-7 7",
    down: "m6 9 6 6 6-6",
    close: "m6 6 12 12M18 6 6 18",
    search: "M19 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0m-2 5 5 6",
    star: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z",
    trend: "M3 3v18h18M6 14l4-4 4 3 7-8M16 5h5v5",
    gauge:
      "M4 19a10 10 0 1 1 16 0M12 13l5-6M12 13a2 2 0 1 0 0 4 2 2 0 0 0 0-4M5 12h1M7 6l1 1M12 3v2M19 12h-1",
    wallet:
      "M20 7V4H5a2 2 0 0 0 0 4h16v13H5a2 2 0 0 1-2-2V6M21 12h-5v5h5M17 14.5h1",
    info: "M12 11v6M12 7h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    clock: "M12 6v6l4 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    check: "m5 12 4 4L19 6",
    bolt: "m13 2-9 12h7l-1 8 10-12h-7Z",
  };
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.7"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"><path d={paths[name] ?? paths.pump} /></svg
>
