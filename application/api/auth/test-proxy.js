({
  access: 'public',
  method: async (token) => {
    try {
      console.log('=== TESTING CREATE PROXY FUNCTIONALITY ===');
      
      if (!context.client.session) {
        return {
          status: 'rejected',
          response: 'No active session found'
        };
      }

      const originalState = { ...context.client.session.state };
      console.log('Original session state:', originalState);

      // Test 1: Modify session state
      context.client.session.state.testTimestamp = new Date().toISOString();
      context.client.session.state.testCounter = (context.client.session.state.testCounter || 0) + 1;
      context.client.session.state.testArray = ['item1', 'item2', 'item3'];

      console.log('Modified session state:', context.client.session.state);

      // Test 2: Wait for auto-save (debounced)
      await new Promise(resolve => setTimeout(resolve, 200)); // Wait 200ms for debounce

      // Test 3: Verify data is saved by retrieving it from Redis
      const sessionManager = require('../../src/sessionManager.js');
      const { SessionManager } = sessionManager;
      const testSessionManager = new SessionManager();
      
      const savedData = await testSessionManager.getSession(token);
      console.log('Data retrieved from Redis:', savedData);

      // Test 4: Verify the new properties are there
      const hasNewProperties = savedData && 
        savedData.testTimestamp && 
        savedData.testCounter && 
        savedData.testArray;

      console.log('Auto-save test result:', hasNewProperties ? 'SUCCESS' : 'FAILED');
      console.log('=== END TEST ===');

      return {
        status: 'fulfilled',
        response: {
          originalState,
          modifiedState: context.client.session.state,
          savedData,
          autoSaveWorking: hasNewProperties
        }
      };

    } catch (error) {
      console.error('Test error:', error);
      return {
        status: 'rejected',
        response: 'Test failed: ' + error.message
      };
    }
  },
}); 