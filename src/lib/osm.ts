import { containsDepot, expansions, getArea } from './areas';
import { reachableIndices } from './reachability';
const OSRM = 'https://router.project-osrm.org';

export async function snapDepot(lon: number, lat: number, city: string): Promise<import('../types').Stop> {
  if (!containsDepot(city, lon, lat)) throw new Error('Bitte einen Standort nahe einer Adresse im Spielgebiet wählen.');
  const response = await fetch(`${OSRM}/nearest/v1/driving/${lon},${lat}?number=1`);
  if (!response.ok) throw new Error('Straße konnte nicht geprüft werden.');
  const result = await response.json();
  const point = result.waypoints?.[0];
  if (result.code !== 'Ok' || !point || point.distance > 100) throw new Error('Keine erreichbare Straße in 100 Metern Entfernung.');
  return { id: 'depot', name: 'Zentrale', address: point.name || 'Zentrale', lon: point.location[0], lat: point.location[1] };
}

export async function fetchStops(city: string, count = 5): Promise<import('../types').Stop[]> {
  return shuffle(getArea(city).addresses).slice(0, count);
}

function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export async function reachableStops(depot: import('../types').Stop, city: string, unlockedAreas: string[] = []): Promise<import('../types').Stop[]> {
  const available = expansions.filter((area) => area.city === city && unlockedAreas.includes(area.id));
  const base = await fetchStops(city, available.length ? 18 : 30);
  const extra = available.flatMap((area) => shuffle(area.addresses).slice(0, Math.floor(12 / available.length)));
  const candidates = [...base.flatMap((stop, index) => extra[index] ? [stop, extra[index]] : [stop]), ...extra.slice(base.length)].filter((stop) => stop.id !== depot.id);
  const points = [depot, ...candidates];
  const coordinates = points.map((point) => `${point.lon},${point.lat}`).join(';');
  const response = await fetch(`${OSRM}/table/v1/driving/${coordinates}?annotations=duration`);
  if (!response.ok) throw new Error('Erreichbarkeit konnte nicht geprüft werden. Bitte erneut versuchen.');
  const result = await response.json();
  if (result.code !== 'Ok' || !result.durations || !result.sources) throw new Error('Erreichbarkeit konnte nicht geprüft werden. Bitte erneut versuchen.');
  const indices = reachableIndices(result.sources.map((point: { distance: number }) => point.distance), result.durations);
  const reachable = indices.map((index) => candidates[index]).filter(Boolean);
  if (reachable.length < 5) throw new Error('Nicht genügend erreichbare Adressen gefunden. Bitte erneut versuchen.');
  return reachable.slice(0, 12).map((stop) => ({ ...stop, rewardCents: 800 + Math.round(Math.hypot((stop.lon - depot.lon) * 68, (stop.lat - depot.lat) * 111) * 50) }));
}

export type RouteResult = { distanceM: number; durationS: number; coords: [number, number][]; legs: import('./simulation').Leg[] };

export async function fetchRoute(stopsInOrder: import('../types').Stop[]): Promise<RouteResult> {
  if (stopsInOrder.length < 2) throw new Error('Need at least 2 stops');
  const coords = stopsInOrder.map((s) => `${s.lon},${s.lat}`).join(';');
  const url = `${OSRM}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM ${res.status}`);
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error(data.message || 'OSRM no route');
  const r = data.routes[0];
  const points = r.geometry.coordinates as [number, number][];
  if (data.waypoints.some((point: { distance: number }) => point.distance > 100)) throw new Error('Ein Ziel liegt zu weit von einer befahrbaren Straße entfernt.');
  const legs = r.legs.map((leg: { duration: number; distance: number; steps: { geometry: { coordinates: [number, number][] } }[] }) => ({
    duration: leg.duration, distance: leg.distance,
    coords: leg.steps.flatMap((step) => step.geometry.coordinates),
  }));
  if (legs.some((leg: { coords: [number, number][] }) => leg.coords.length < 2)) throw new Error('Die Route enthält keine vollständige Geometrie.');
  return {
    distanceM: r.distance,
    durationS: r.duration,
    coords: points,
    legs,
  };
}
