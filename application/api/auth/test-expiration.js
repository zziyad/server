({
  access: 'public',
  method: async () => {
    try {
      console.log('=== TESTING SESSION EXPIRATION ===');
      
      if (!context.client.session) {
        return {
          status: 'rejected',
          response: 'No active session found'
        };
      }

      const token = context.client.session.token;
      console.log(`Testing expiration for session: ${token}`);

      // Manually invalidate the session to simulate expiration
      await context.client.finalizeSession();
      
      console.log('Session manually expired for testing');
      console.log('=== END TEST ===');

      return {
        status: 'fulfilled',
        response: 'Session expired for testing'
      };

    } catch (error) {
      console.error('Expiration test error:', error);
      return {
        status: 'rejected',
        response: 'Test failed: ' + error.message
      };
    }
  },
}); 