import { test } from 'node:test';
import assert from 'node:assert/strict';
import { balance, buy, capacity, completeDay, costPerKm } from '../src/lib/economy.ts';

const stop = (id, rewardCents) => ({ id, name: id, address: id, lat: 0, lon: 0, rewardCents });
const game = { city: 'Zerbst/Anhalt', createdAt: 1, stops: [stop('a', 1000), stop('b', 1500), stop('c', 900)], order: ['a', 'b'] };
const route = { distanceM: 2500, durationS: 300, coords: [], legs: [] };

test('settles selected deliveries once, in integer cents', () => {
  const completed = completeDay(game, route);
  assert.deepEqual(completed.dayResult, { revenueCents: 2500, costCents: 100, profitCents: 2400 });
  assert.equal(balance(completed), 12400);
  assert.strictEqual(completeDay(completed, route), completed);
});

test('legacy saves keep their prior completed day without crediting it', () => {
  const legacy = { ...game, completedRoute: route };
  assert.equal(balance(completeDay(legacy, route)), 10000);
});

test('purchases require funds and cannot be repeated', () => {
  assert.strictEqual(buy(game, 'capacity'), game);
  const rich = { ...game, balanceCents: 50000 };
  const upgraded = buy(rich, 'capacity');
  assert.equal(capacity(upgraded), 8);
  assert.equal(balance(upgraded), 38000);
  assert.strictEqual(buy(upgraded, 'capacity'), upgraded);
  const efficient = buy(upgraded, 'efficiency');
  assert.equal(costPerKm(efficient), 30);
  const expanded = buy(efficient, 'area', '39264');
  assert.deepEqual(expanded.unlockedAreas, ['39264']);
  assert.strictEqual(buy(expanded, 'area', '39264'), expanded);
});
