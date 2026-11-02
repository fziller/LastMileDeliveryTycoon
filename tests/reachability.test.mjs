import { strict as assert } from 'node:assert';
import { reachableIndices } from '../src/lib/reachability.ts';

assert.deepEqual(reachableIndices([0, 20, 101, 5, 5], [
  [0, 10, 10, null, 10], [10], [10], [10], [null],
]), [0]);
