({
  access: 'public',
  method: async (email, password) => {
    const { characters, secret, length } = config.sessions;
    console.log({ email, password });
    
    if (!email || !password) {
      return {
        status: 'rejected',
        response: 'Email and password are required',
      };
    }

    try {
      console.log(`Logged user: ${email}`);
      const token = metarhia.metautil.generateToken(secret, characters, length);
      
      // Create session data
      const sessionData = {
        id: 333,
        email: email,
        username: 'Zizi',
        isAdmin: true,
        sessionId: context.uuid
      };
      
      // Start session using the new session manager
      await context.client.startSession(token, sessionData);
      
      return { 
        status: 'logged', 
        response: { 
          ...sessionData,
          token: token
        } 
      };
    } catch (error) {
      console.error('Signin error:', error);
      return {
        status: 'rejected',
        response: 'Server error occurred',
      };
    }
  },
});

