(() => {
  const raw = String(node.process.env.SESSION_ENABLED || '').trim().toLowerCase();
  const envEnabled =
    raw === '' ? null : !['0', 'false', 'off', 'no'].includes(raw);

  return {
    // Toggle session/auth in runtime. Env SESSION_ENABLED=false overrides.
    enabled: envEnabled === null ? true : envEnabled,
    secret: 'index-search-local-development-secret-change-before-production',
    accessTtl: 15 * 60,
    refreshTtl: 7 * 24 * 60 * 60,
  };
})();
