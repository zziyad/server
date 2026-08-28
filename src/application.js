'use strict';

const { node, metarhia } = require('./dependencies.js');
const { EventEmitter } = node.events;
const { DirectoryWatcher } = metarhia.metawatch;
const { Code } = require('./code.js');
const { Api } = require('./api.js');
const { Static } = require('./static.js');
const { Server } = require('./server.js');
const common = require('../lib/common.js');

class Application extends EventEmitter {
  constructor({ path, sandbox, console }) {
    super();
    this.path = path;
    this.sandbox = sandbox;
    this.console = console || global.console;

    this.starts = [];
    this.config = null;
    this.static = null;
    this.server = null;
    this.semaphore = null;
    this.routing = null;
    this.watcher = null;
    this.eventBus = null;
    this.notificationPipeline = null;
    this.notificationQueue = null;
    this.notificationDispatcher = null;
    this.notificationManager = null;
    this.scheduler = null;
    this.api = null;
    this.lib = null;
    this.domain = null;
    this.configCode = null;
  }

  absolute(relative) {
    return node.path.join(this.path, relative);
  }

  execute(method, ...args) {
    return method(...args).catch((error) => {
      const msg = `Failed to execute method: ${error?.message}`;
      this.console.error(msg, error.stack);
      return Promise.reject(error);
    });
  }

  _resolveWatcherPath(filePath) {
    const relPath = filePath.substring(this.path.length + 1);
    const sepIndex = relPath.indexOf(node.path.sep);
    if (sepIndex === -1) return null;

    const place = relPath.substring(0, sepIndex);
    const target = place === 'config' ? this.configCode : this[place];

    return { relPath, place, target };
  }

  startWatch(timeout = 1000) {
    if (this.watcher) return;
    this.watcher = new DirectoryWatcher({ timeout });

    this.watcher.on('change', async (filePath) => {
      const resolved = this._resolveWatcherPath(filePath);
      if (!resolved) return;

      const { relPath, target } = resolved;

      try {
        const stat = await node.fsp.stat(filePath);
        if (stat.isDirectory()) {
          if (target?.load) await target.load(filePath);
          return;
        }

        this.console.debug('Reload: /' + relPath);
        if (target?.change) await target.change(filePath);
      } catch (error) {
        if (error.code !== 'ENOENT' && this.console?.warn) {
          this.console.warn(`Watcher error for ${relPath}:`, error.message);
        }
      }
    });

    this.watcher.on('delete', (filePath) => {
      const resolved = this._resolveWatcherPath(filePath);
      if (!resolved) return;

      const { relPath, target } = resolved;
      if (target?.delete) target.delete(filePath);
    });
  }

  async stopWatch() {
    if (!this.watcher) return;

    if (this.watcher.timer) {
      clearTimeout(this.watcher.timer);
      this.watcher.timer = null;
    }

    for (const [, watcher] of this.watcher.watchers) {
      try {
        watcher.close();
      } catch (error) {}
    }

    this.watcher.watchers.clear();
    this.watcher.removeAllListeners();
    this.watcher = null;
  }

  async initializeModules() {
    const config = new Code('config', this);
    const lib = new Code('lib', this);
    const domain = new Code('domain', this);
    const api = new Api('api', this);

    this.api = api;
    this.lib = lib;
    this.domain = domain;
    this.configCode = config;
    this.static = new Static('static', this);

    const watchTimeout = 1000;
    this.startWatch(watchTimeout);

    const moduleNames = ['lib', 'domain', 'config', 'api'];
    const moduleLoaders = [lib.load(), domain.load(), config.load(), api.load()];
    const loadResults = await Promise.allSettled(moduleLoaders);

    const loadErrors = loadResults
      .map((result, index) =>
        result.status === 'rejected'
          ? `${moduleNames[index]}: ${result.reason?.message || result.reason}`
          : null,
      )
      .filter(Boolean);

    if (loadErrors.length > 0) {
      this.console.error('Module loading failed:');
      loadErrors.forEach((err) => this.console.error(`  - ${err}`));
      throw new Error('Failed to load modules: ' + loadErrors.join('; '));
    }

    Object.assign(this.sandbox, {
      api: api.container,
      lib: lib.tree,
      domain: domain.tree,
      config: config.tree,
      application: this,
      scheduler: this.scheduler,
    });

    this.config = config.tree;
    const { Semaphore } = metarhia.metautil;
    const queueConfig = this.config?.server?.queue || {
      concurrency: 1000,
      size: 2000,
      timeout: 3000,
    };
    this.semaphore = new Semaphore(
      queueConfig.concurrency,
      queueConfig.size,
      queueConfig.timeout,
    );

    const commonModule = require('../lib/common.js');
    const configForValidation = commonModule.removeCircularRefs(this.config);
    const { configSchema } = require('../lib/config-schema.js');
    const validation = commonModule.validateSchema(configForValidation, configSchema);

    if (!validation.valid) {
      this.console.error('Configuration validation failed:');
      validation.errors.forEach((err) => this.console.error(`  ✗ ${err}`));
      throw new Error('Invalid configuration');
    }

    const env = process.env.NODE_ENV || 'development';
    if (env === 'production' && this.config?.server?.cors?.allowedOrigins) {
      const hasWildcard = this.config.server.cors.allowedOrigins.some(
        (o) => o === '*' || /\*$/.test(o),
      );
      if (hasWildcard) {
        this.console.warn(
          'server.cors.allowedOrigins contains wildcards in production',
        );
      }
    }

    return { watchTimeout };
  }

  async start() {
    const { watchTimeout } = await this.initializeModules();

    const configuredTimeout = this.config?.server?.timeouts?.watch;
    if (configuredTimeout && configuredTimeout !== watchTimeout) {
      await this.stopWatch();
      this.startWatch(configuredTimeout);
    }

    this.server = new Server(this);
    await this.static.load();

    for (const start of this.starts) {
      await common.execute(start);
    }
    this.starts = [];

    return this;
  }

  async shutdown(timeout = 10000) {
    const shutdownStartTime = Date.now();
    const steps = [];
    let shutdownTimer = null;

    shutdownTimer = setTimeout(() => {
      const elapsed = Date.now() - shutdownStartTime;
      this.console.error(`Shutdown timeout exceeded after ${elapsed}ms`);
    }, timeout);

    try {
      if (this.scheduler?.stopAll) {
        try {
          this.scheduler.stopAll();
          steps.push('Scheduler');
        } catch (error) {
          steps.push(`Scheduler (error: ${error.message})`);
        }
      }

      if (this.server?.shutdown) {
        const start = Date.now();
        try {
          await this.server.shutdown();
          steps.push(`Server (${Date.now() - start}ms)`);
        } catch (error) {
          steps.push(`Server (error: ${error.message})`);
        }
      }

      if (this.watcher) {
        const start = Date.now();
        try {
          await this.stopWatch();
          steps.push(`Watcher (${Date.now() - start}ms)`);
        } catch (error) {
          steps.push(`Watcher (error: ${error.message})`);
        }
      }

      if (this.server?.sessionManager?.close) {
        const start = Date.now();
        try {
          await this.server.sessionManager.close();
          steps.push(`Sessions (${Date.now() - start}ms)`);
        } catch (error) {
          steps.push(`Sessions (error: ${error.message})`);
        }
      }

      if (this.sandbox?.db?.pg?.end) {
        const start = Date.now();
        try {
          await this.sandbox.db.pg.end();
          steps.push(`Database (${Date.now() - start}ms)`);
        } catch (error) {
          steps.push(`Database (error: ${error.message})`);
        }
      }

      if (this.console?.close) {
        try {
          await this.console.close();
          steps.push('Logger');
        } catch (error) {
          steps.push(`Logger (error: ${error.message})`);
        }
      }

      clearTimeout(shutdownTimer);
      const totalShutdownTime = Date.now() - shutdownStartTime;
      this.console.info(`Graceful shutdown complete (${totalShutdownTime}ms total)`);

      return { success: true, duration: totalShutdownTime, steps };
    } catch (error) {
      clearTimeout(shutdownTimer);
      return {
        success: false,
        duration: Date.now() - shutdownStartTime,
        steps,
        error,
      };
    }
  }
}

module.exports = { Application };
