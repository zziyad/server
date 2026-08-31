'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ConsList, runChain } = require('../lib/cons-list.js');

test('prepend does not mutate previous list', () => {
  const base = ConsList.of('a', 'b');
  const next = base.prepend('x');
  assert.equal(base.size, 2);
  assert.equal(next.size, 3);
  assert.equal(next.value, 'x');
  assert.deepEqual(base.toArray(), ['a', 'b']);
});

test('runChain walks the list and stops on halted', async () => {
  const seen = [];
  await runChain(ConsList.of(async () => { seen.push('one'); }, async () => { seen.push('two'); }), {});
  assert.deepEqual(seen, ['one', 'two']);
  const stopped = [];
  await runChain(ConsList.of(async (ctx) => { stopped.push('one'); ctx.halted = true; }, async () => { stopped.push('two'); }), { halted: false });
  assert.deepEqual(stopped, ['one']);
});
