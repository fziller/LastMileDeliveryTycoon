import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('example areas contain distinct, usable OSM addresses', () => {
  const files = ['addresses.json', 'addresses-38889.json', 'addresses-39261.json', 'addresses-12487.json', 'addresses-12489.json', 'addresses-39264.json', 'addresses-38895.json', 'addresses-06502.json'];
  const ids = new Set();
  for (const file of files) {
    const addresses = JSON.parse(readFileSync(new URL(`../src/lib/${file}`, import.meta.url)));
    assert.ok(addresses.length >= 30);
    for (const address of addresses) {
      assert.ok(address.id && address.name && address.address);
      assert.ok(Number.isFinite(address.lon) && Number.isFinite(address.lat));
      assert.ok(!ids.has(address.id), `Duplicate OSM object: ${address.id}`);
      ids.add(address.id);
    }
  }
});
