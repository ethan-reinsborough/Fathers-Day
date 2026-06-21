export const cents = (n: number | null | undefined, d = 1): string =>
  n == null || !isFinite(n) ? "—" : n.toFixed(d);

export const signed = (n: number, d = 1): string =>
  `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(d)}`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const parse = (iso: string): Date => new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);

export function fmtDate(iso: string, withYear = false): string {
  const d = parse(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}${withYear ? ", " + d.getFullYear() : ""}`;
}

export function weekday(iso: string): string {
  return WEEKDAYS[parse(iso).getDay()];
}

export function relTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const then = parse(iso).getTime();
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return fmtDate(iso, true);
}

/** Linear blend between hex colours a,b at t in [0,1]. */
export function mix(a: string, b: string, t: number): string {
  const pa = hex(a), pb = hex(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}
function hex(h: string): [number, number, number] {
  const n = h.replace("#", "");
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}

/** Green (cheap) -> amber -> red (dear), t in [0,1]. */
export function priceColor(t: number): string {
  t = Math.max(0, Math.min(1, t));
  return t < 0.5 ? mix("#2ee6c6", "#ffd166", t * 2) : mix("#ffd166", "#ff5d5d", (t - 0.5) * 2);
}
