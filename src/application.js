'use strict';

const { ApplicationBootstrap } = require('./applicationBootstrap.js');
const { ApplicationState } = require('./applicationState.js');
const { BootstrapErrorHandler } = require('./errorHandler.js');

/**
 * Application - Main application class that orchestrates the entire application lifecycle
 * 
 * This class provides:
 * - Application lifecycle management
 * - Bootstrap orchestration
 * - Error handling and recovery
 * - Health monitoring
 * - Graceful shutdown
 * 
 * @class Application
 */
class Application {
  /**
   * Creates a new Application instance
   * 
   * @param {Object} options - Application options
   * @param {boolean} options.enableHealthChecks - Enable health checks (default: true)
   * @param {boolean} options.enableGracefulShutdown - Enable graceful shutdown (default: true)
   * @param {number} options.healthCheckInterval - Health check interval in ms (default: 30000)
   */
  constructor(options = {}) {
    this.options = {
      enableHealthChecks: true,
      enableGracefulShutdown: true,
      healthCheckInterval: 30000,
      ...options,
    };

    this.state = new ApplicationState();
    this.bootstrap = new ApplicationBootstrap(this.state);
    this.healthCheckInterval = null;
    this.isRunning = false;
  }

  /**
   * Starts the application
   * 
   * @returns {Promise<void>}
   * @throws {Error} If application fails to start
   */
  async start() {
    if (this.isRunning) {
      throw new Error('Application is already running');
    }

    try {
      console.log('Starting application...');
      
      // Bootstrap the application with retry logic
      await BootstrapErrorHandler.withRetry(
        () => this.bootstrap.bootstrap(),
        {
          maxRetries: 3,
          baseDelay: 2000,
          maxDelay: 10000,
        }
      );

      // Mark application as bootstrapped
      this.state.setBootstrapped();
      this.isRunning = true;

      // Setup graceful shutdown handlers
      if (this.options.enableGracefulShutdown) {
        BootstrapErrorHandler.handleGracefulShutdown(
          this.bootstrap.application,
          this.state
        );
      }

      // Setup health checks
      if (this.options.enableHealthChecks) {
        this.setupHealthChecks();
      }

      console.log('Application started successfully');
      console.log(`Health status: ${this.state.getHealthStatus().status}`);
      
    } catch (error) {
      BootstrapErrorHandler.logError(error, 'Application.start');
      this.state.addError(error);
      throw error;
    }
  }

  /**
   * Stops the application gracefully
   * 
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this.isRunning) {
      console.log('Application is not running');
      return;
    }

    try {
      console.log('Stopping application...');
      
      // Stop health checks
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      // Shutdown bootstrap
      await this.bootstrap.shutdown();
      
      this.isRunning = false;
      console.log('Application stopped successfully');
      
    } catch (error) {
      BootstrapErrorHandler.logError(error, 'Application.stop');
      this.state.addError(error);
      throw error;
    }
  }

  /**
   * Restarts the application
   * 
   * @returns {Promise<void>}
   */
  async restart() {
    console.log('Restarting application...');
    await this.stop();
    await this.start();
    console.log('Application restarted successfully');
  }

  /**
   * Sets up health checks for the application
   */
  setupHealthChecks() {
    // Add basic health checks
    this.state.addHealthCheck('application', () => this.checkApplicationHealth());
    this.state.addHealthCheck('memory', () => this.checkMemoryHealth());
    this.state.addHealthCheck('modules', () => this.checkModulesHealth());

    // Run health checks periodically
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.state.runHealthChecks();
      } catch (error) {
        console.error('Health check failed:', error.message);
      }
    }, this.options.healthCheckInterval);

    console.log(`Health checks enabled (interval: ${this.options.healthCheckInterval}ms)`);
  }

  /**
   * Checks application health
   * 
   * @returns {Promise<Object>} Health check result
   */
  async checkApplicationHealth() {
    try {
      const isBootstrapped = this.state.isBootstrapped();
      const isShuttingDown = this.state.isShuttingDown();
      
      return {
        healthy: isBootstrapped && !isShuttingDown,
        details: {
          bootstrapped: isBootstrapped,
          shuttingDown: isShuttingDown,
          uptime: this.state.getMetrics().uptime,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
      };
    }
  }

  /**
   * Checks memory health
   * 
   * @returns {Promise<Object>} Health check result
   */
  async checkMemoryHealth() {
    try {
      const memoryUsage = process.memoryUsage();
      const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
      const heapTotalMB = memoryUsage.heapTotal / 1024 / 1024;
      const memoryUsagePercent = (heapUsedMB / heapTotalMB) * 100;

      // Consider unhealthy if memory usage is above 90%
      const isHealthy = memoryUsagePercent < 90;

      return {
        healthy: isHealthy,
        details: {
          heapUsed: `${heapUsedMB.toFixed(2)} MB`,
          heapTotal: `${heapTotalMB.toFixed(2)} MB`,
          usagePercent: `${memoryUsagePercent.toFixed(2)}%`,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
      };
    }
  }

  /**
   * Checks modules health
   * 
   * @returns {Promise<Object>} Health check result
   */
  async checkModulesHealth() {
    try {
      const modules = this.state.getAllModules();
      const moduleCount = modules.size;
      const loadedModules = Array.from(modules.keys());

      return {
        healthy: moduleCount > 0,
        details: {
          moduleCount,
          loadedModules,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
      };
    }
  }

  /**
   * Gets application status
   * 
   * @returns {Object} Application status
   */
  getStatus() {
    return {
      running: this.isRunning,
      ...this.state.getStatus(),
    };
  }

  /**
   * Gets application metrics
   * 
   * @returns {Object} Application metrics
   */
  getMetrics() {
    return this.state.getMetrics();
  }

  /**
   * Gets application health status
   * 
   * @returns {Object} Health status
   */
  getHealthStatus() {
    return this.state.getHealthStatus();
  }

  /**
   * Gets recent errors
   * 
   * @param {number} count - Number of recent errors to return
   * @returns {Array} Recent errors
   */
  getRecentErrors(count = 10) {
    return this.state.getRecentErrors(count);
  }

  /**
   * Gets a module from the application
   * 
   * @param {string} name - Module name
   * @returns {Object|null} Module instance or null if not found
   */
  getModule(name) {
    return this.state.getModule(name);
  }

  /**
   * Checks if a module is loaded
   * 
   * @param {string} name - Module name
   * @returns {boolean} True if module is loaded
   */
  hasModule(name) {
    return this.state.hasModule(name);
  }

  /**
   * Gets the application instance from bootstrap
   * 
   * @returns {Object|null} Application instance or null if not bootstrapped
   */
  getApplicationInstance() {
    return this.bootstrap.application;
  }
}

module.exports = { Application }; 