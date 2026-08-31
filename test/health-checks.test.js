'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  checkPostgres,
  checkRedis,
  summarize,
} = require('../lib/health-checks.js');

test('postgres ok / down / error', async () => {
  assert.equal(await checkPostgres(null), 'down');
  assert.equal(await checkPostgres({ query: async () => ({}) }), 'ok');
  assert.equal(
    await checkPostgres({
      query: async () => {
        throw new Error('boom');
      },
    }),
    'error',
  );
});

test('redis uses ping and isRedisReady', async () => {
  assert.equal(await checkRedis(null), 'down');
  assert.equal(
    await checkRedis({
      isRedisReady: () => true,
      client: { ping: async () => 'PONG' },
    }),
    'ok',
  );
  assert.equal(
    await checkRedis({
      isRedisReady: () => false,
      client: { ping: async () => 'PONG' },
    }),
    'down',
  );
});

test('summarize degraded unless both ok', () => {
  const bad = summarize({ postgres: 'ok', redis: 'down' });
  assert.equal(bad.ok, false);
  assert.equal(bad.status, 'degraded');
  const good = summarize({ postgres: 'ok', redis: 'ok' });
  assert.equal(good.ok, true);
  assert.equal(good.status, 'ok');
});
