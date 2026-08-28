({
  access: 'public',
  method: async () => ({
    status: 'fulfilled',
    response: {
      status: 'ok',
      sessionsEnabled: Boolean(context.sessionsEnabled),
      timestamp: new Date().toISOString(),
    },
  }),
});
