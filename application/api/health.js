({
  access: 'public',
  method: async () => {
    const { checkPostgres, checkRedis, summarize } = common;
    const checks = {
      postgres: await checkPostgres(typeof db !== 'undefined' ? db.pg : null),
      redis: await checkRedis(context.sessionManager),
    };
    const report = summarize(checks);
    return {
      status: report.ok ? 'fulfilled' : 'rejected',
      response: report,
    };
  },
});
