import { fetchJSON } from "./network.ts";
import type { Station, Stations } from "./types";
import { stationIsOld } from "./freshness.ts";

export interface Location {
  id: string;
  name: string;
  lat: number;
  lng: number;
  gps?: boolean;
}
// Community centres. Never presented as exact station coordinates.
const towns: [string, number, number][] = [
  ["Hanwell", 45.893, -66.786],
  ["Fredericton", 45.9636, -66.6431],
  ["Oromocto", 45.847, -66.479],
  ["New Maryland", 45.895, -66.685],
  ["Nackawic", 45.997, -67.241],
  ["Keswick Ridge", 46.006, -66.886],
  ["Douglas", 45.993, -66.714],
  ["Lincoln", 45.899, -66.58],
  ["Mactaquac", 45.988, -66.877],
  ["Moncton", 46.0878, -64.7782],
  ["Dieppe", 46.078, -64.687],
  ["Riverview", 46.061, -64.805],
  ["Saint John", 45.2733, -66.0633],
  ["Quispamsis", 45.432, -65.946],
  ["Rothesay", 45.388, -65.995],
  ["Sussex", 45.722, -65.506],
  ["Hampton", 45.529, -65.834],
  ["Grand Bay-Westfield", 45.36, -66.242],
  ["Woodstock", 46.15, -67.603],
  ["Hartland", 46.299, -67.526],
  ["Florenceville-Bristol", 46.444, -67.616],
  ["Perth-Andover", 46.735, -67.704],
  ["Grand Falls", 47.047, -67.739],
  ["Edmundston", 47.373, -68.325],
  ["Saint-Léonard", 47.164, -67.924],
  ["Saint-Quentin", 47.514, -67.392],
  ["Kedgwick", 47.646, -67.344],
  ["Campbellton", 48.007, -66.673],
  ["Dalhousie", 48.063, -66.373],
  ["Bathurst", 47.618, -65.652],
  ["Beresford", 47.693, -65.702],
  ["Belledune", 47.905, -65.825],
  ["Petit-Rocher", 47.783, -65.716],
  ["Miramichi", 47.029, -65.501],
  ["Tracadie", 47.514, -64.919],
  ["Caraquet", 47.789, -64.938],
  ["Shippagan", 47.744, -64.707],
  ["Lamèque", 47.793, -64.651],
  ["Neguac", 47.254, -65.07],
  ["Bouctouche", 46.468, -64.739],
  ["Richibucto", 46.681, -64.883],
  ["Shediac", 46.22, -64.541],
  ["Sackville", 45.897, -64.369],
  ["Port Elgin", 46.05, -64.087],
  ["Memramcook", 45.971, -64.551],
  ["Salisbury", 46.025, -65.043],
  ["Petitcodiac", 45.931, -65.177],
  ["Hillsborough", 45.905, -64.65],
  ["Alma", 45.602, -64.946],
  ["St. Stephen", 45.194, -67.275],
  ["Saint Andrews", 45.074, -67.053],
  ["St. George", 45.129, -66.827],
  ["Blacks Harbour", 45.054, -66.786],
  ["Grand Manan", 44.697, -66.818],
  ["Campobello Island", 44.886, -66.943],
  ["McAdam", 45.595, -67.325],
  ["Harvey", 45.731, -67.008],
  ["Fredericton Junction", 45.658, -66.612],
  ["Tracy", 45.682, -66.677],
  ["Gagetown", 45.779, -66.147],
  ["Minto", 46.078, -66.076],
  ["Chipman", 46.169, -65.879],
  ["Doaktown", 46.557, -66.128],
  ["Boiestown", 46.456, -66.419],
  ["Stanley", 46.28, -66.739],
  ["Plaster Rock", 46.908, -67.396],
  ["Saint-Louis de Kent", 46.738, -64.968],
  ["Saint-Antoine", 46.363, -64.751],
  ["Rogersville", 46.734, -65.427],
];
export const LOCATIONS: Location[] = towns.map(([name, lat, lng]) => ({
  id: name.toLowerCase().replace(/\W+/g, "-"),
  name,
  lat,
  lng,
}));
export const normalize = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
export const DEFAULT_LOCATION = LOCATIONS[0];
export function validLocation(v: any): v is Location {
  return (
    v &&
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    Number.isFinite(v.lat) &&
    Number.isFinite(v.lng) &&
    v.lat >= 44.4 &&
    v.lat <= 48.2 &&
    v.lng >= -69.1 &&
    v.lng <= -63.7
  );
}
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const rad = Math.PI / 180;
  const dlat = (b.lat - a.lat) * rad,
    dlng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dlng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export async function searchLocations(query: string): Promise<Location[]> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.search = new URLSearchParams({
    name: `${query.trim()}, New Brunswick`,
    count: "30",
    language: "en",
    countryCode: "CA",
  }).toString();
  const data = await fetchJSON<{ results?: any[] }>(url.href, 6000);
  return (data.results ?? [])
    .filter((p) => p.country_code === "CA" && p.admin1 === "New Brunswick")
    .map((p) => ({
      id: `geo-${p.id}`,
      name: p.name,
      lat: p.latitude,
      lng: p.longitude,
    }))
    .filter(validLocation);
}
export interface NearbyStation extends Station {
  distance: number;
  approximate: boolean;
  old: boolean;
}
export function nearbyStations(
  data: Stations | null,
  location: Location,
  radius: number,
  now = Date.now(),
): NearbyStation[] {
  return (data?.stations ?? []).flatMap((station) => {
    const exact = Number.isFinite(station.lat) && Number.isFinite(station.lng);
    const point = exact
      ? { lat: station.lat!, lng: station.lng! }
      : LOCATIONS.find(
          (t) => normalize(t.name) === normalize(station.locality),
        );
    if (!point) return [];
    const distance = distanceKm(location, point);
    return distance <= radius
      ? [
          {
            ...station,
            distance,
            approximate: !exact,
            old: stationIsOld(station, data, now),
          },
        ]
      : [];
  });
}
export function gasBuddyURL(location: Location, fuel = 1): string {
  const search = location.gps
    ? `${location.lat.toFixed(5)},${location.lng.toFixed(5)}`
    : `${location.name}, NB`;
  return `https://www.gasbuddy.com/home?${new URLSearchParams({ search, fuel: String(fuel), method: "all" })}`;
}
export function mapsURL(location: Location): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`gas stations near ${location.lat},${location.lng}`)}`;
}
export function directionsURL(station: Station): string {
  const destination =
    station.lat != null && station.lng != null
      ? `${station.lat},${station.lng}`
      : `${station.name}, ${station.address}, ${station.locality}, NB, Canada`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
}
