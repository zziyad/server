'use strict';

const { Application } = require('./src/application.js');

/**
 * Main application entry point
 * 
 * This file initializes and starts the application using the new modular architecture.
 * The Application class handles all the complexity of bootstrap, error handling,
 * health monitoring, and graceful shutdown.
 */

// Create application instance with default options
const app = new Application({
  enableHealthChecks: true,
  enableGracefulShutdown: true,
  healthCheckInterval: 30000, // 30 seconds
});

// Start the application
async function startApplication() {
  try {
    await app.start();
    
    // Log application status
    const status = app.getStatus();
    console.log('Application Status:', {
      running: status.running,
      bootstrapped: status.bootstrapped,
      health: status.health.status,
      uptime: status.health.uptime,
      modules: status.modules,
    });
    
  } catch (error) {
    console.error('Failed to start application:', error.message);
    process.exit(1);
  }
}

// Note: Error handling is now managed by the Application class
// through BootstrapErrorHandler.handleGracefulShutdown()

// Start the application
startApplication();
