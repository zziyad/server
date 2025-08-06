'use strict';

const { metarhia } = require('./dependencies.js');
const { Place } = require('./place.js');
// const bus = require('./bus.js');

class Code extends Place {
  constructor(name, application) {
    super(name, application);
    this.tree = {};
  }

  async stop() {
    for (const moduleName of Object.keys(this.tree)) {
      const module = this.tree[moduleName];
      if (typeof module.stop === 'function') {
        await this.application.execute(module.stop);
      }
    }
  }

  stopModule(name, module) {
    const timeout = this.application.config.server.timeouts.watch;
    setTimeout(() => {
      if (this.tree[name] !== undefined) return;
      this.application.execute(module.stop);
    }, timeout);
  }

  set(relPath, unit) {
    const names = metarhia.metautil.parsePath(relPath);

    const last = names.length - 1;
    let level = this.tree;
    for (let depth = 0; depth <= last; depth++) {
      const name = names[depth];
      let next = level[name];
      if (depth === last) {
        if (unit === null) {
          if (name === 'stop') this.stopModule(names[0], level);
          delete level[name];
          return;
        }
        next = unit;
        unit.parent = level;
      }
      if (next === undefined) next = { parent: level };
      level[name] = next;
      if (depth === 2 && name === 'start') {
        if (unit.constructor.name === 'AsyncFunction') {
          this.application.starts.push(unit);
        } else {
          const msg = `${relPath} expected to be async function`;
          this.application.console.error(msg);
        }
      }
      level = next;
    }
  }

  delete(filePath) {
    const relPath = filePath.substring(this.path.length + 1);
    this.set(relPath, null);
  }

  async change(filePath) {
    if (!filePath.endsWith('.js')) return;
    if (filePath.startsWith('.eslint')) return;
    const { application, path } = this;
    const options = { context: application.sandbox, filename: filePath };
    try {
      const { exports } = await metarhia.metavm.readScript(filePath, options);
      const relPath = filePath.substring(path.length + 1);
      const exp = exports;
      this.set(relPath, exp);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        application.console.error(error.stack);
      }
    }
  }
}

module.exports = { Code };
