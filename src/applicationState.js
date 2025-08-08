'use strict';

/**
 * ApplicationState - Centralized state management for the application
 *
 * This class manages:
 * - Application lifecycle state
 * - Loaded modules registry
 * - Error tracking
 * - Performance metrics
 * - Health status
 *
 * @class ApplicationState
 */
class ApplicationState {
  /**
   * Creates a new ApplicationState instance
   */
  constructor() {
    this.state = {
      // Application lifecycle
      isBootstrapped: false,
      isShuttingDown: false,
      startTime: Date.now(),

      // Module registry
      modules: new Map(),

      // Error tracking
      errors: [],
      maxErrors: 100, // Keep last 100 errors

      // Performance metrics
      metrics: {
        requests: 0,
        errors: 0,
        startupTime: 0,
        memoryUsage: 0,
      },

      // Health status
      health: {
        status: 'unknown',
        lastCheck: null,
        checks: new Map(),
      },
    };
  }

  /**
   * Marks the application as successfully bootstrapped
   */
  setBootstrapped() {
    this.state.isBootstrapped = true;
    this.state.metrics.startupTime = Date.now() - this.state.startTime;
    this.updateHealthStatus('healthy');
  }

  /**
   * Marks the application as shutting down
   */
  setShuttingDown() {
    this.state.isShuttingDown = true;
    this.updateHealthStatus('shutting_down');
  }

  /**
   * Checks if the application is bootstrapped
   *
   * @returns {boolean} True if application is bootstrapped
   */
  isBootstrapped() {
    return this.state.isBootstrapped;
  }

  /**
   * Checks if the application is shutting down
   *
   * @returns {boolean} True if application is shutting down
   */
  isShuttingDown() {
    return this.state.isShuttingDown;
  }

  /**
   * Adds a module to the registry
   *
   * @param {string} name - Module name
   * @param {Object} module - Module instance
   */
  addModule(name, module) {
    this.state.modules.set(name, {
      instance: module,
      loadedAt: Date.now(),
      status: 'loaded',
    });
  }

  /**
   * Gets a module from the registry
   *
   * @param {string} name - Module name
   * @returns {Object|null} Module instance or null if not found
   */
  getModule(name) {
    const moduleInfo = this.state.modules.get(name);
    return moduleInfo ? moduleInfo.instance : null;
  }

  /**
   * Gets all loaded modules
   *
   * @returns {Map} Map of all loaded modules
   */
  getAllModules() {
    return this.state.modules;
  }

  /**
   * Checks if a module is loaded
   *
   * @param {string} name - Module name
   * @returns {boolean} True if module is loaded
   */
  hasModule(name) {
    return this.state.modules.has(name);
  }

  /**
   * Adds an error to the error tracking
   *
   * @param {Error} error - Error object
   */
  addError(error) {
    const errorEntry = {
      timestamp: Date.now(),
      message: error.message,
      stack: error.stack,
      name: error.name,
    };

    this.state.errors.push(errorEntry);
    this.state.metrics.errors++;

    // Keep only the last maxErrors
    if (this.state.errors.length > this.state.maxErrors) {
      this.state.errors = this.state.errors.slice(-this.state.maxErrors);
    }

    this.updateHealthStatus('degraded');
  }

  /**
   * Gets all tracked errors
   *
   * @returns {Array} Array of error entries
   */
  getErrors() {
    return this.state.errors;
  }

  /**
   * Gets recent errors (last N errors)
   *
   * @param {number} count - Number of recent errors to return
   * @returns {Array} Array of recent error entries
   */
  getRecentErrors(count = 10) {
    return this.state.errors.slice(-count);
  }

  /**
   * Clears all tracked errors
   */
  clearErrors() {
    this.state.errors = [];
    this.state.metrics.errors = 0;
  }

  /**
   * Increments the request counter
   */
  incrementRequests() {
    this.state.metrics.requests++;
  }

  /**
   * Gets current performance metrics
   *
   * @returns {Object} Current metrics
   */
  getMetrics() {
    const uptime = Date.now() - this.state.startTime;
    const memoryUsage = process.memoryUsage();

    return {
      ...this.state.metrics,
      uptime,
      memoryUsage: {
        rss: memoryUsage.rss,
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
      },
      moduleCount: this.state.modules.size,
      errorCount: this.state.errors.length,
    };
  }

  /**
   * Updates the health status
   *
   * @param {string} status - Health status ('healthy', 'degraded', 'unhealthy', 'shutting_down')
   */
  updateHealthStatus(status) {
    this.state.health.status = status;
    this.state.health.lastCheck = Date.now();
  }

  /**
   * Adds a health check
   *
   * @param {string} name - Health check name
   * @param {Function} checkFn - Health check function
   */
  addHealthCheck(name, checkFn) {
    this.state.health.checks.set(name, {
      fn: checkFn,
      lastRun: null,
      status: 'unknown',
    });
  }

  /**
   * Runs all health checks
   *
   * @returns {Promise<Object>} Health check results
   */
  async runHealthChecks() {
    const results = {};
    const checks = Array.from(this.state.health.checks.entries());

    for (const [name, check] of checks) {
      try {
        check.lastRun = Date.now();
        const result = await check.fn();
        check.status = result.healthy ? 'healthy' : 'unhealthy';
        results[name] = result;
      } catch (error) {
        check.status = 'error';
        results[name] = {
          healthy: false,
          error: error.message,
        };
      }
    }

    // Update overall health status
    const allHealthy = Object.values(results).every((result) => result.healthy);
    this.updateHealthStatus(allHealthy ? 'healthy' : 'degraded');

    return results;
  }

  /**
   * Gets current health status
   *
   * @returns {Object} Health status information
   */
  getHealthStatus() {
    return {
      status: this.state.health.status,
      lastCheck: this.state.health.lastCheck,
      uptime: Date.now() - this.state.startTime,
      modules: Array.from(this.state.modules.keys()),
    };
  }

  /**
   * Gets application status summary
   *
   * @returns {Object} Complete application status
   */
  getStatus() {
    return {
      bootstrapped: this.state.isBootstrapped,
      shuttingDown: this.state.isShuttingDown,
      health: this.getHealthStatus(),
      metrics: this.getMetrics(),
      modules: Array.from(this.state.modules.keys()),
      recentErrors: this.getRecentErrors(5),
    };
  }

  /**
   * Resets the application state (useful for testing)
   */
  reset() {
    this.state = {
      isBootstrapped: false,
      isShuttingDown: false,
      startTime: Date.now(),
      modules: new Map(),
      errors: [],
      maxErrors: 100,
      metrics: {
        requests: 0,
        errors: 0,
        startupTime: 0,
        memoryUsage: 0,
      },
      health: {
        status: 'unknown',
        lastCheck: null,
        checks: new Map(),
      },
    };
  }
}

module.exports = { ApplicationState };
