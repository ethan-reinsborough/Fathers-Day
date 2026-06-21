import type { Prediction, Stations, Regulated } from "./types";

export type Tone = "good" | "warn" | "neutral";

export interface Verdict {
  headline: string;
  tone: Tone;
  detail: string;
  emoji: string;
}

export function makeVerdict(
  prediction: Prediction | null,
  stations: Stations | null,
  regulated: Regulated
): Verdict {
  const cheapest =
    stations && stations.stations.length ? stations.stations[0] : null;
  const underCap =
    cheapest != null ? Math.round((regulated.regularSelfServe - cheapest.regular) * 10) / 10 : null;

  const stationLine =
    cheapest && underCap != null && underCap > 0
      ? ` Cheapest right now: ${cheapest.name} at ${cheapest.regular.toFixed(1)}¢ — ${underCap.toFixed(1)}¢ under the cap.`
      : "";

  if (!prediction) {
    return {
      headline: "Today's ceiling is set",
      tone: "neutral",
      emoji: "⛽",
      detail: `New Brunswick's legal maximum is ${regulated.regularSelfServe.toFixed(1)}¢/L.${stationLine}`,
    };
  }

  const d = prediction.deltaCents;

  if (prediction.interrupterRisk) {
    return {
      headline: "Volatile week — stay sharp",
      tone: "warn",
      emoji: "⚡",
      detail: `The benchmark is swinging fast, so NB's interrupter clause could change the price mid-week.${stationLine}`,
    };
  }
  if (d <= -1.5) {
    return {
      headline: "Prices should fall Friday",
      tone: "good",
      emoji: "📉",
      detail: `The Guru sees about ${Math.abs(d).toFixed(1)}¢ coming off the cap at the next reset — worth waiting if your tank allows.${stationLine}`,
    };
  }
  if (d >= 1.5) {
    return {
      headline: "Fill up before Friday",
      tone: "warn",
      emoji: "📈",
      detail: `The Guru sees about +${d.toFixed(1)}¢ at the next reset — topping up today likely saves you a little.${stationLine}`,
    };
  }
  return {
    headline: "Steady week ahead",
    tone: "neutral",
    emoji: "🧭",
    detail: `No big move expected at Friday's reset.${stationLine}`,
  };
}
