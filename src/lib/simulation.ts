export type Point = [number, number];
export type Leg = { coords: Point[]; duration: number; distance: number };
export type Journey = { legs: Leg[] };
const STOP_SECONDS = 60;

function segmentLength(a: Point, b: Point): number {
  const lat = (a[1] + b[1]) * Math.PI / 360;
  return Math.hypot((b[0] - a[0]) * Math.cos(lat), b[1] - a[1]);
}

export function simulate(journey: Journey, seconds: number) {
  let remaining = Math.max(0, seconds);
  let distance = 0;
  let delivered = 0;
  let position = journey.legs[0]?.coords[0] ?? [0, 0] as Point;
  let bearing = 0;
  for (let i = 0; i < journey.legs.length; i++) {
    const leg = journey.legs[i];
    const fraction = leg.duration > 0 ? Math.min(1, remaining / leg.duration) : 1;
    const lengths = leg.coords.slice(1).map((point, index) => segmentLength(leg.coords[index], point));
    const total = lengths.reduce((a, b) => a + b, 0);
    let target = total * fraction;
    for (let j = 0; j < lengths.length; j++) {
      const a = leg.coords[j], b = leg.coords[j + 1], length = lengths[j];
      if (target <= length || j === lengths.length - 1) {
        const t = length ? Math.min(1, target / length) : 0;
        position = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        bearing = Math.atan2((b[0] - a[0]) * Math.cos(a[1] * Math.PI / 180), b[1] - a[1]) * 180 / Math.PI;
        break;
      }
      target -= length;
    }
    distance += leg.distance * fraction;
    if (fraction < 1) return { position, bearing, distance, delivered, finished: false };
    remaining -= leg.duration;
    if (i < journey.legs.length - 1) {
      if (remaining < STOP_SECONDS) return { position, bearing, distance, delivered, finished: false };
      remaining -= STOP_SECONDS;
      delivered++;
    }
  }
  return { position, bearing, distance, delivered, finished: true };
}
