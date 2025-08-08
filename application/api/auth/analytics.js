({
  access: 'public',
  method: async () => {
    try {
      // Get session analytics from the server
      const analytics = await context.server.getSessionAnalytics();
      console.log({ analytics });
      return {
        status: 'fulfilled',
        response: analytics,
      };
    } catch (error) {
      console.error('Analytics error:', error);
      return {
        status: 'rejected',
        response: 'Failed to get session analytics',
      };
    }
  },
});
