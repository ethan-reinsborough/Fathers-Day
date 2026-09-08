/** Bound the entire request, including a stalled body or an unresponsive service worker. */
export async function fetchJSON<T>(
  url: string,
  timeoutMs = 6500,
  fetcher: typeof fetch = fetch,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetcher(url, {
          signal: controller.signal,
          cache: "no-cache",
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return (await response.json()) as T;
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("Request timed out"));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}
