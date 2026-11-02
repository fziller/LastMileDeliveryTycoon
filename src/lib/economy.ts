import type { GameState, Stop } from '../types';
import type { RouteResult } from './osm';

export const START_BALANCE = 10000;
export const CAPACITY_PRICE = 12000;
export const EFFICIENCY_PRICE = 10000;
export const AREA_PRICE = 20000;

export const capacity = (game: GameState) => game.capacityUpgraded ? 8 : 5;
export const costPerKm = (game: GameState) => game.efficiencyUpgraded ? 30 : 40;
export const balance = (game: GameState) => game.balanceCents ?? START_BALANCE;
export const reward = (stop: Stop) => stop.rewardCents ?? 800;

export function completeDay(game: GameState, route: RouteResult): GameState {
  if (game.completedRoute) return game;
  const selected = new Set(game.order);
  const revenueCents = game.stops.filter((stop) => selected.has(stop.id)).reduce((sum, stop) => sum + reward(stop), 0);
  const costCents = Math.round(route.distanceM / 1000 * costPerKm(game));
  const profitCents = revenueCents - costCents;
  return { ...game, balanceCents: balance(game) + profitCents, dayResult: { revenueCents, costCents, profitCents }, completedRoute: route, activeRoute: undefined, elapsed: undefined };
}

export function buy(game: GameState, item: 'capacity' | 'efficiency' | 'area', area?: string): GameState {
  const price = item === 'capacity' ? CAPACITY_PRICE : item === 'efficiency' ? EFFICIENCY_PRICE : AREA_PRICE;
  if (balance(game) < price || (item === 'capacity' && game.capacityUpgraded) || (item === 'efficiency' && game.efficiencyUpgraded) || (item === 'area' && (!area || (game.unlockedAreas ?? []).includes(area)))) return game;
  return { ...game, balanceCents: balance(game) - price, ...(item === 'capacity' ? { capacityUpgraded: true } : item === 'efficiency' ? { efficiencyUpgraded: true } : { unlockedAreas: [...(game.unlockedAreas ?? []), area!] }) };
}
