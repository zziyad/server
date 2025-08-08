({
  access: 'public',
  method: async (token) => {
    try {
      console.log('Restore session for token:', token);

      // Try to restore session from Redis/memory
      const restored = await context.client.restoreSession(token);
      if (restored) {
        console.log('Session restored successfully');
        return {
          status: 'logged',
          response: context.client.session.state,
        };
      }

      console.log('No session data found');
      return { status: 'not logged' };
    } catch (error) {
      console.error('Session restore error:', error);
      return { status: 'not logged' };
    }
  },
});
