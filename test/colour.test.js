import { test } from 'node:test';
import assert from 'node:assert/strict';
import { colourMap } from '../src/colour.js';

test('colourMap gives distinct values distinct hex colours', () => {
  const map = colourMap(['Story', 'Bug', 'Task']);
  assert.equal(map.size, 3);
  assert.equal(new Set(map.values()).size, 3);
  for (const c of map.values()) assert.match(c, /^#[0-9a-f]{6}$/i);
});

test('colourMap is deterministic and order-stable', () => {
  const a = colourMap(['Story', 'Bug', 'Task']);
  const b = colourMap(['Story', 'Bug', 'Task']);
  assert.deepEqual([...a], [...b]);
});

test('colourMap skips blank and whitespace values', () => {
  const map = colourMap(['Story', '', '   ', 'Bug']);
  assert.equal(map.size, 2);
  assert.ok(!map.has(''));
});

test('colourMap dedupes repeated values to one colour', () => {
  const map = colourMap(['Bug', 'Story', 'Bug']);
  assert.equal(map.size, 2);
});

test('colourMap cycles the palette when values exceed it', () => {
  const values = Array.from({ length: 9 }, (_, i) => `T${i}`);
  const map = colourMap(values);
  assert.equal(map.size, 9);
  // 8-colour palette: the 9th distinct value reuses the first colour.
  assert.equal(map.get('T8'), map.get('T0'));
});
