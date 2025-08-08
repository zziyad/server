'use strict';

/**
 * BootstrapErrorHandler - Handles errors during application bootstrap and runtime
 *
 * This class provides:
 * - Retry logic with exponential backoff
 * - Graceful shutdown handling
 * - Error categorization and logging
 * - Recovery mechanisms
 *
 * @class BootstrapErrorHandler
 */
class BootstrapErrorHandler {
  /**
   * Executes an operation with retry logic
   * - Operation to execute
   * @param {Function} operation
   * - Retry options
   * @param {Object} options
   *  - Maximum number of retries (default: 3)
   * @param {number} options.maxRetries
   *  - Base delay in milliseconds (default: 1000)
   * @param {number} options.baseDelay
   * - Maximum delay in milliseconds (default: 10000)
   * @param {number} options.maxDelay
   *  - Operation result
   * @returns {Promise<any>}
   *  - If all retries fail
   * @throws {Error}
   */
  static async withRetry(operation, options = {}) {
    const { maxRetries = 3, baseDelay = 1000, maxDelay = 10000 } = options;

    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        console.error(
          `Attempt ${attempt}/${maxRetries} failed:`,
          error.message,
        );

        if (attempt === maxRetries) {
          console.error('All retry attempts failed');
          throw error;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
        console.log(`Retrying in ${delay}ms...`);

        await this.delay(delay);
      }
    }

    throw lastError;
  }

  /**
   * Delays execution for specified milliseconds
   *
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  static delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Handles graceful shutdown of the application
   *
   * @param {Object} application - Application instance
   * @param {ApplicationState} state - Application state manager
   */
  static handleGracefulShutdown(application, state) {
    // Prevent multiple shutdown handlers from being registered
    if (this._shutdownHandlerRegistered) {
      return;
    }
    this._shutdownHandlerRegistered = true;

    // Global shutdown state to prevent multiple shutdowns
    let isShuttingDown = false;

    const shutdown = async (signal) => {
      if (isShuttingDown) {
        console.log('Shutdown already in progress, ignoring signal:', signal);
        return;
      }

      isShuttingDown = true;
      console.log(`\nReceived ${signal}, initiating graceful shutdown...`);

      // Remove all signal handlers to prevent further triggers
      process.removeAllListeners('SIGTERM');
      process.removeAllListeners('SIGINT');
      process.removeAllListeners('uncaughtException');
      process.removeAllListeners('unhandledRejection');

      try {
        // Mark application as shutting down
        if (state) {
          state.setShuttingDown();
        }

        // Close server if available
        if (
          application?.server &&
          typeof application.server.close === 'function'
        ) {
          console.log('Closing HTTP server...');
          await application.server.close();
        }

        // Close file watcher if available
        if (
          application?.watcher &&
          typeof application.watcher.close === 'function'
        ) {
          console.log('Closing file watcher...');
          application.watcher.close();
        }

        // Execute cleanup functions if available
        if (application?.starts && Array.isArray(application.starts)) {
          console.log('Executing cleanup functions...');
          const cleanupPromises = application.starts
            .filter((start) => typeof start.cleanup === 'function')
            .map(async (start) => {
              try {
                await start.cleanup();
              } catch (error) {
                console.error('Cleanup function failed:', error.message);
              }
            });

          await Promise.all(cleanupPromises);
        }

        // Additional cleanup for database connections
        if (application?.sandbox?.db) {
          console.log('Closing database connections...');
          await this.closeDatabaseConnections(application.sandbox.db);
        }

        console.log('Graceful shutdown completed');

        // Force exit after a short delay to ensure cleanup
        setTimeout(() => {
          console.log('Force exiting...');
          process.exit(0);
        }, 1000);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    // Register signal handlers
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      shutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection');
    });
  }

  /**
   * Closes database connections gracefully
   *
   * @param {Object} db - Database object
   * @returns {Promise<void>}
   */
  static async closeDatabaseConnections(db) {
    try {
      if (db.pg && typeof db.pg.end === 'function') {
        await db.pg.end();
      }

      if (db.redis && typeof db.redis.quit === 'function') {
        await db.redis.quit();
      }
    } catch (error) {
      console.error('Error closing database connections:', error.message);
    }
  }

  /**
   * Categorizes errors for better handling
   *
   * @param {Error} error - Error to categorize
   * @returns {Object} Error category and severity
   */
  static categorizeError(error) {
    const categories = {
      BOOTSTRAP: 'bootstrap',
      NETWORK: 'network',
      DATABASE: 'database',
      VALIDATION: 'validation',
      AUTHENTICATION: 'authentication',
      AUTHORIZATION: 'authorization',
      RESOURCE: 'resource',
      UNKNOWN: 'unknown',
    };

    const severities = {
      LOW: 'low',
      MEDIUM: 'medium',
      HIGH: 'high',
      CRITICAL: 'critical',
    };

    let category = categories.UNKNOWN;
    let severity = severities.MEDIUM;

    // Categorize based on error message and name
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    if (message.includes('bootstrap') || message.includes('startup')) {
      category = categories.BOOTSTRAP;
      severity = severities.CRITICAL;
    } else if (message.includes('connection') || message.includes('network')) {
      category = categories.NETWORK;
      severity = severities.HIGH;
    } else if (message.includes('database') || message.includes('sql')) {
      category = categories.DATABASE;
      severity = severities.HIGH;
    } else if (message.includes('validation') || message.includes('invalid')) {
      category = categories.VALIDATION;
      severity = severities.LOW;
    } else if (message.includes('auth') || message.includes('login')) {
      category = categories.AUTHENTICATION;
      severity = severities.MEDIUM;
    } else if (message.includes('permission') || message.includes('access')) {
      category = categories.AUTHORIZATION;
      severity = severities.MEDIUM;
    } else if (message.includes('file') || message.includes('resource')) {
      category = categories.RESOURCE;
      severity = severities.MEDIUM;
    }

    return { category, severity };
  }

  /**
   * Logs error with appropriate formatting
   *
   * @param {Error} error - Error to log
   * @param {string} context - Error context
   */
  static logError(error, context = '') {
    const { category, severity } = this.categorizeError(error);
    const timestamp = new Date().toISOString();

    console.error(
      `[${timestamp}] ${severity.toUpperCase()} ${category.toUpperCase()} ERROR${
        context ? ` in ${context}` : ''
      }:`,
    );
    console.error(`  Message: ${error.message}`);
    console.error(`  Stack: ${error.stack}`);

    // Log additional context if available
    if (error.code) {
      console.error(`  Code: ${error.code}`);
    }
    if (error.syscall) {
      console.error(`  Syscall: ${error.syscall}`);
    }
  }

  /**
   * Creates a custom error class for specific error types
   *
   * @param {string} name - Error class name
   * @param {string} defaultMessage - Default error message
   * @returns {Class} Custom error class
   */
  static createErrorClass(name, defaultMessage) {
    return class extends Error {
      constructor(message = defaultMessage, code = null) {
        super(message);
        this.name = name;
        this.code = code;
      }
    };
  }

  /**
   * Validates if an error is recoverable
   *
   * @param {Error} error - Error to check
   * @returns {boolean} True if error is recoverable
   */
  static isRecoverableError(error) {
    const nonRecoverableErrors = [
      'ENOENT', // File not found
      'EACCES', // Permission denied
      'EADDRINUSE', // Address already in use
      'ECONNREFUSED', // Connection refused
    ];

    return !nonRecoverableErrors.includes(error.code);
  }

  /**
   * Creates a recovery strategy for an error
   *
   * @param {Error} error - Error to create recovery for
   * @returns {Object|null} Recovery strategy or null if not recoverable
   */
  static createRecoveryStrategy(error) {
    if (!this.isRecoverableError(error)) {
      return null;
    }

    const { category } = this.categorizeError(error);

    switch (category) {
      case 'network':
        return {
          type: 'retry',
          maxAttempts: 3,
          delay: 1000,
          backoff: 'exponential',
        };

      case 'database':
        return {
          type: 'reconnect',
          maxAttempts: 5,
          delay: 2000,
          backoff: 'exponential',
        };

      case 'resource':
        return {
          type: 'wait',
          delay: 5000,
          maxAttempts: 2,
        };

      default:
        return {
          type: 'retry',
          maxAttempts: 2,
          delay: 1000,
          backoff: 'linear',
        };
    }
  }
}

module.exports = { BootstrapErrorHandler };
