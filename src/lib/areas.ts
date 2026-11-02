import gropiusstadt from './addresses.json';
import blankenburg from './addresses-38889.json';
import zerbst from './addresses-39261.json';
import johannisthal from './addresses-12487.json';
import zerbstRegion from './addresses-39264.json';
import derenburg from './addresses-38895.json';
import thale from './addresses-06502.json';
import adlershof from './addresses-12489.json';

export const areas = [
  { city: 'Berlin-Gropiusstadt', label: 'Berlin-Gropiusstadt', center: [13.471, 52.422] as [number, number], zoom: 14, addresses: gropiusstadt, bounds: [13.455, 52.407, 13.488, 52.438] },
  { city: 'Blankenburg (Harz)', label: '38889 · Blankenburg und Umgebung', center: [10.955, 51.79] as [number, number], zoom: 11, addresses: blankenburg },
  { city: 'Zerbst/Anhalt', label: '39261 · Zerbst/Anhalt', center: [12.085, 51.966] as [number, number], zoom: 13, addresses: zerbst },
  { city: 'Berlin-Johannisthal', label: '12487 · Berlin-Johannisthal', center: [13.506, 52.442] as [number, number], zoom: 13, addresses: johannisthal },
];

export const expansions = [
  { id: '39264', label: '39264 · Zerbst und Umgebung', city: 'Zerbst/Anhalt', addresses: zerbstRegion },
  { id: '38895', label: '38895 · Derenburg und Umgebung', city: 'Blankenburg (Harz)', addresses: derenburg },
  { id: '06502', label: '06502 · Timmenrode und Thale', city: 'Blankenburg (Harz)', addresses: thale },
  { id: '12489', label: '12489 · Adlershof und Umgebung', city: 'Berlin-Johannisthal', addresses: adlershof },
];

export function getArea(city: string) {
  const area = areas.find((item) => item.city === city);
  if (!area) throw new Error('Spielgebiet nicht gefunden.');
  return area;
}

export function containsDepot(city: string, lon: number, lat: number) {
  const area = getArea(city);
  if (area.bounds) {
    const [west, south, east, north] = area.bounds;
    return lon >= west && lon <= east && lat >= south && lat <= north;
  }
  // The address dataset does not include postal boundaries; accept nearby streets only.
  return area.addresses.some((address) => Math.abs(address.lat - lat) < 0.003 && Math.abs(address.lon - lon) < 0.004);
}
