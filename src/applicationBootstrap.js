'use strict';

const { node, npm, metarhia } = require('./dependencies.js');
const { loadDir, createRouting } = require('./loader.js');
const { Static } = require('./static.js');
const { Server } = require('./server.js');
const { Code } = require('./code.js');
// DirectoryWatcher is optional and might not be available
const DirectoryWatcher = metarhia.metawatch?.DirectoryWatcher;
const console = require('../lib/logger.js');
const common = require('../lib/common.js');

/**
 * ApplicationBootstrap - Handles the complete application initialization process
 * 
 * This class manages the bootstrap process including:
 * - Sandbox creation and initialization
 * - Module loading (config, lib, domain)
 * - API routing setup
 * - Server and static file initialization
 * - Startup function execution
 * 
 * @class ApplicationBootstrap
 */
class ApplicationBootstrap {
  /**
   * Creates a new ApplicationBootstrap instance
   * 
   * @param {ApplicationState} state - Application state manager
   */
  constructor(state) {
    this.state = state;
    this.starts = [];
    this.sandbox = this.createSandbox();
    this.application = null;
  }

  /**
   * Creates the VM sandbox context with all required modules
   * 
   * @returns {Object} VM context with injected dependencies
   */
  createSandbox() {
    return node.vm.createContext({
      console,
      common,
      npm,
      node,
      metarhia,
      db: {},
    });
  }

  /**
   * Loads the application path from .applications file
   * 
   * @returns {Promise<string>} Absolute path to the application directory
   * @throws {Error} If .applications file cannot be read
   */
  async loadApplicationPath() {
    try {
      const applications = await node.fsp.readFile('.applications', 'utf8');
      const appPath = node.path.join(process.cwd(), applications.trim());
      
      // Validate that the application path exists
      await node.fsp.access(appPath);
      
      return appPath;
    } catch (error) {
      throw new Error(`Failed to load application path: ${error.message}`);
    }
  }

  /**
   * Initializes the application modules and creates routing
   * 
   * @param {string} appPath - Path to the application directory
   * @returns {Promise<Object>} Application object with basic configuration
   */
  async initializeModules(appPath) {
    try {
      const apiPath = node.path.join(appPath, './api');
      
      // Validate API directory exists
      await node.fsp.access(apiPath);
      
      const api = await loadDir(apiPath, this.sandbox, true);
      const routing = createRouting(api);
      
      const application = {
        path: appPath,
        sandbox: this.sandbox,
        console,
        routing,
        starts: this.starts,
      };

      this.state.addModule('application', application);
      return application;
    } catch (error) {
      throw new Error(`Failed to initialize modules: ${error.message}`);
    }
  }

  /**
   * Loads all code modules (config, lib, domain) in parallel
   * 
   * @param {Object} application - Application context object
   * @returns {Promise<Object>} Object containing loaded modules
   */
  async loadCodeModules(application) {
    try {
      const config = new Code('config', application);
      const lib = new Code('lib', application);
      const domain = new Code('domain', application);
      
      // Load all modules in parallel for better performance
      await Promise.all([
        lib.load(),
        domain.load(),
        config.load(),
      ]);

      this.state.addModule('config', config);
      this.state.addModule('lib', lib);
      this.state.addModule('domain', domain);

      return { config, lib, domain };
    } catch (error) {
      throw new Error(`Failed to load code modules: ${error.message}`);
    }
  }

  /**
   * Sets up the application context with all loaded modules
   * 
   * @param {Object} config - Config module
   * @param {Object} lib - Lib module
   * @param {Object} domain - Domain module
   */
  setupApplicationContext(config, lib, domain) {
    try {
      Object.assign(this.sandbox, {
        api: this.application.api,
        lib: lib.tree,
        domain: domain.tree,
        config: config.tree,
        application: this.application,
      });
      
      this.application.config = config.tree;
      this.application.api = this.application.api || {};
      
      console.log('Application context setup completed');
    } catch (error) {
      throw new Error(`Failed to setup application context: ${error.message}`);
    }
  }

  /**
   * Initializes server and static file services
   * 
   * @returns {Promise<void>}
   */
  async initializeServices() {
    try {
      // Initialize static file serving
      this.application.static = new Static('static', this.application);
      
      // Initialize file watcher for hot reloading (if available)
      if (metarhia.metawatch && metarhia.metawatch.DirectoryWatcher) {
        this.application.watcher = new metarhia.metawatch.DirectoryWatcher({ timeout: 1000 });
        console.log('File watcher initialized');
      } else {
        console.log('File watcher not available, skipping hot reload');
        this.application.watcher = null;
      }
      
      // Initialize HTTP/WebSocket server
      this.application.server = new Server(this.application);
      
      // Load static files
      await this.application.static.load();
      
      console.log('Services initialized successfully');
    } catch (error) {
      throw new Error(`Failed to initialize services: ${error.message}`);
    }
  }

  /**
   * Executes all startup functions in parallel
   * 
   * @returns {Promise<void>}
   */
  async executeStarts() {
    try {
      if (this.application.starts.length === 0) {
        console.log('No startup functions to execute');
        return;
      }

      console.log(`Executing ${this.application.starts.length} startup functions...`);
      
      const startPromises = this.application.starts.map((startFn, index) => {
        return common.execute(startFn)
          .then(() => {
            console.log(`Startup function ${index + 1} executed successfully`);
          })
          .catch((error) => {
            console.error(`Startup function ${index + 1} failed:`, error.message);
            this.state.addError(error);
            throw error;
          });
      });

      await Promise.all(startPromises);
      this.application.starts = [];
      
      console.log('All startup functions executed successfully');
    } catch (error) {
      throw new Error(`Failed to execute startup functions: ${error.message}`);
    }
  }

  /**
   * Main bootstrap method that orchestrates the entire application startup
   * 
   * @returns {Promise<void>}
   * @throws {Error} If any step of the bootstrap process fails
   */
  async bootstrap() {
    try {
      console.log('Starting application bootstrap...');
      
      // Step 1: Load application path
      const appPath = await this.loadApplicationPath();
      console.log(`Application path loaded: ${appPath}`);
      
      // Step 2: Initialize modules and routing
      this.application = await this.initializeModules(appPath);
      console.log('Modules initialized');
      
      // Step 3: Load code modules
      const { config, lib, domain } = await this.loadCodeModules(this.application);
      console.log('Code modules loaded');
      
      // Step 4: Setup application context
      this.setupApplicationContext(config, lib, domain);
      
      // Step 5: Initialize services
      await this.initializeServices();
      
      // Step 6: Execute startup functions
      await this.executeStarts();
      
      console.log('Application bootstrap completed successfully');
    } catch (error) {
      this.state.addError(error);
      console.error('Bootstrap failed:', error.message);
      throw error;
    }
  }

  /**
   * Gracefully shuts down the application
   * 
   * @returns {Promise<void>}
   */
  async shutdown() {
    try {
      console.log('Shutting down application...');
      
      if (this.application?.server) {
        await this.application.server.close();
      }
      
      if (this.application?.watcher && typeof this.application.watcher.close === 'function') {
        this.application.watcher.close();
      }
      
      console.log('Application shutdown completed');
    } catch (error) {
      console.error('Error during shutdown:', error);
      throw error;
    }
  }
}

module.exports = { ApplicationBootstrap }; 