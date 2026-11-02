import { strict as assert } from 'node:assert';
import { simulate } from '../src/lib/simulation.ts';

const trip = { legs: [
  { coords: [[13, 52], [13.01, 52]], duration: 100, distance: 1000 },
  { coords: [[13.01, 52], [13, 52]], duration: 100, distance: 1000 },
] };

assert.equal(simulate(trip, 50).distance, 500);
assert.equal(simulate(trip, 100).delivered, 0);
assert.equal(simulate(trip, 160).delivered, 1);
assert.equal(simulate(trip, 260).finished, true);
assert.equal(simulate(trip, 260).distance, 2000);
