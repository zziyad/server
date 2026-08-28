'use strict';

const { loadEnvFile } = require('./lib/load-env.js');
loadEnvFile();

const { node, npm, metarhia } = require('./src/dependencies.js');
const console = require('./lib/logger.js');
const common = require('./lib/common.js');
const { Application } = require('./src/application.js');

const STARTUP_TIMEOUT = 15000;
const SHUTDOWN_TIMEOUT = 10000;
const CTRL_C = 3;

let application = null;
const sandbox = node.vm.createContext({
  console,
  common,
  npm,
  node,
  metarhia,
  db: {},
});

const gracefulShutdown = async (signal) => {
  console.info(`Graceful shutdown initiated by ${signal}`);

  if (!application) process.exit(0);

  try {
    const result = await application.shutdown(SHUTDOWN_TIMEOUT);
    if (!result.success) {
      console.error('Shutdown failed:', result.error?.message);
      process.exit(1);
    }
    console.info(`Graceful shutdown complete (${result.duration}ms total)`);
    process.exit(0);
  } catch (error) {
    console.error('Unexpected error during shutdown:', error);
    process.exit(1);
  }
};

const logError = (type) => async (error) => {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error(`${type}: ${err.stack || err.message}`);
  await gracefulShutdown(type);
};

process.removeAllListeners('warning');
process.removeAllListeners('uncaughtException');
process.removeAllListeners('unhandledRejection');
process.on('warning', (warning) => {
  if (warning.name !== 'ExperimentalWarning') console.error(warning.message);
});
process.on('uncaughtException', logError('uncaughtException'));
process.on('unhandledRejection', logError('unhandledRejection'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
  process.stdin.on('data', (data) => {
    if (data[0] === CTRL_C) gracefulShutdown('Ctrl+C');
  });
}

(async () => {
  const startupTimer = setTimeout(() => {
    console.error('Application startup timeout exceeded.');
    process.exit(1);
  }, STARTUP_TIMEOUT);

  try {
    const applications = await node.fsp.readFile('.applications', 'utf8');
    const appPath = node.path.join(process.cwd(), applications.trim());

    application = new Application({ path: appPath, sandbox, console });
    await application.start();
    clearTimeout(startupTimer);
  } catch (error) {
    clearTimeout(startupTimer);
    console.error('Application initialization failed:', error);
    await gracefulShutdown('initialization-error');
  }
})();
