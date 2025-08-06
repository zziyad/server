({
  access: 'public',
  method: async (action, userId = null) => {
    try {
      let result;
      
      switch (action) {
        case 'invalidateUser':
          if (!userId) {
            return {
              status: 'rejected',
              response: 'User ID is required for user session invalidation'
            };
          }
          result = await context.server.invalidateUserSessions(userId);
          return {
            status: 'fulfilled',
            response: `Invalidated ${result} sessions for user ${userId}`
          };
          
        case 'invalidateAll':
          result = await context.server.invalidateAllSessions();
          return {
            status: 'fulfilled',
            response: `Invalidated ${result} total sessions`
          };
          
        case 'cleanup':
          result = await context.server.sessionManager.cleanupExpired();
          return {
            status: 'fulfilled',
            response: `Cleaned up ${result} expired sessions`
          };
          
        default:
          return {
            status: 'rejected',
            response: 'Invalid action. Use: invalidateUser, invalidateAll, or cleanup'
          };
      }
    } catch (error) {
      console.error('Session management error:', error);
      return {
        status: 'rejected',
        response: 'Failed to perform session management operation'
      };
    }
  },
}); 