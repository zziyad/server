({
  access: 'public',
  method: async () => {
    try {
      console.log('SIGN OUT');
      
      if (context.client.session) {
        console.log(`Signing out user: ${context.client.session.state.email}`);
        
        // Finalize the session (remove from Redis)
        await context.client.finalizeSession();
        
        // Remove session cookie if it's an HTTP transport
        context.client.removeSessionCookie(context.client.session?.state?.sessionId);
      }
      
      return { 
        status: 'fulfilled', 
        response: 'User has been signed out' 
      };
    } catch (error) {
      console.error('Signout error:', error);
      return { 
        status: 'rejected', 
        response: 'Error during signout' 
      };
    }
  },
});
