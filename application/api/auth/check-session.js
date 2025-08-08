({
  access: 'public',
  method: async () => {
    try {
      console.log('=== CHECKING SESSION STATUS ===');

      if (!context.client.session) {
        return {
          status: 'rejected',
          response: 'No active session found',
        };
      }

      const sessionToken = context.client.session.token;
      const sessionData = context.client.session.state;

      console.log('Session token: ${sessionToken}');
      console.log('Session data:', sessionData);

      // Check if session is expired
      const now = new Date();
      const expiresAt = new Date(sessionData.expiresAt);
      const isExpired = expiresAt < now;
      const timeLeft = Math.max(0, expiresAt.getTime() - now.getTime());

      console.log(`Current time: ${now.toISOString()}`);
      console.log(`Expires at: ${expiresAt.toISOString()}`);
      console.log(`Is expired: ${isExpired}`);
      console.log(`Time left: ${Math.round(timeLeft / 1000)} seconds`);
      console.log('=== END CHECK ===');

      return {
        status: 'fulfilled',
        response: {
          token: sessionToken,
          sessionData,
          isExpired,
          timeLeftSeconds: Math.round(timeLeft / 1000),
          expiresAt: expiresAt.toISOString(),
          currentTime: now.toISOString(),
        },
      };
    } catch (error) {
      console.error('Session check error:', error);
      return {
        status: 'rejected',
        response: 'Check failed: ' + error.message,
      };
    }
  },
});
