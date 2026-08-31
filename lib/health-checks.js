'use strict';

const checkPostgres = async (pg) => {
  if (!pg || typeof pg.query !== 'function') return 'down';
  try {
    await pg.query('SELECT 1');
    return 'ok';
  } catch {
    return 'error';
  }
};

const checkRedis = async (sessionManager) => {
  if (!sessionManager) return 'down';
  try {
    if (typeof sessionManager.isRedisReady === 'function') {
      if (!sessionManager.isRedisReady()) return 'down';
    }
    const client = sessionManager.client;
    if (!client) return 'down';
    if (typeof client.ping === 'function') {
      await client.ping();
      return 'ok';
    }
    if (client.isReady || sessionManager.isConnected) return 'ok';
    return 'down';
  } catch {
    return 'error';
  }
};

const summarize = (checks) => {
  const ok = checks.postgres === 'ok' && checks.redis === 'ok';
  return {
    ok,
    status: ok ? 'ok' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  };
};

module.exports = { checkPostgres, checkRedis, summarize };
