'use strict';

const { node, metarhia } = require('./dependencies.js');

class Place {
  constructor(name, application) {
    this.name = name;
    this.path = node.path.join(application.path, name);
    this.application = application;
  }

  async load(targetPath = this.path) {
    await metarhia.metautil.ensureDirectory(this.path);
    
    // Only use watcher if it's available
    if (this.application.watcher && typeof this.application.watcher.watch === 'function') {
      this.application.watcher.watch(targetPath);
    }
    
    try {
      const files = await node.fsp.readdir(targetPath, { withFileTypes: true });
      for (const file of files) {
        const { name } = file;
        if (name.startsWith('.eslint')) continue;
        const filePath = node.path.join(targetPath, name);
        if (file.isDirectory()) await this.load(filePath);
        else await this.change(filePath);
      }
    } catch (error) {
      const console = this.application.console || global.console;
      console.error(error.stack);
    }
  }
}

module.exports = { Place };
