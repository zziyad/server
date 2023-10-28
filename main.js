'use strict';

const { node, npm, metarhia } = require('./src/dependencies.js');
const console = require('./lib/logger.js');
const common = require('./lib/common.js');
const { loadDir, createRouting, starts } = require('./src/loader.js');
const { Static } = require('./src/static.js');
const { Server } = require('./src/server.js');

const sandbox = node.vm.createContext({
  static: null,
  console,
  common,
  npm,
  node,
  metarhia,
  db: {},
});

(async () => {
  const applications = await node.fsp.readFile('.applications', 'utf8');
  const appPath = node.path.join(process.cwd(), applications.trim());

  const configPath = node.path.join(appPath, './config');
  const config = await loadDir(configPath, sandbox);

  const libPath = node.path.join(appPath, './lib');
  const lib = await loadDir(libPath, sandbox);

  const domainPath = node.path.join(appPath, './domain');
  const domain = await loadDir(domainPath, sandbox);

  const apiPath = node.path.join(appPath, './api');
  const api = await loadDir(apiPath, sandbox, true);
  const routing = createRouting(api);
  const application = {
    path: appPath,
    sandbox,
    console,
    routing,
    config,
    starts,
  };

  application.static = new Static('static', application);
  await application.static.load();
  Object.assign(sandbox, { api, lib, domain, config, application });
  application.server = new Server(application);
  // starts functions execut on starts of application
  application.starts.map((fn) => common.execute(fn));
  application.starts = [];
})();
