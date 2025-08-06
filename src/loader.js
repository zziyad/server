'use strict';

const { node } = require('./dependencies.js');

const STARTS_LEVEL_DEPTH = 3;
const starts = [];
const OPTIONS = { timeout: 5000, displayErrors: false };

const load = async (filePath, sandbox, contextualize = false) => {
  const src = await node.fsp.readFile(filePath, 'utf8');
  const opening = contextualize ? '(context) => ' : '';
  const code = `'use strict';\n${opening}${src}`;
  const script = new node.vm.Script(code, { ...OPTIONS, lineOffset: -1 });
  const exports = script.runInContext(sandbox, OPTIONS);
  const pathComponents = filePath.split('/');
  const index = pathComponents.findIndex((p) => p === 'lib' || p === 'domain');
  if (index !== -1) {
    const names = pathComponents.slice(index + 1);
    for (const [depth, name] of names.entries()) {
      if (depth <= STARTS_LEVEL_DEPTH && name === 'start.js')
        if (exports.constructor.name === 'AsyncFunction') starts.push(exports);
        else console.error(`${name} expected to be an async function`);
    }
  }
  return exports;
};

const loadDir = async (dir, sandbox, contextualize = false) => {
  const files = await node.fsp.readdir(dir, { withFileTypes: true });
  const container = {};
  for (const file of files) {
    const { name } = file;
    if (file.isFile() && !name.endsWith('.js')) continue;
    const location = node.path.join(dir, name);
    const key = node.path.basename(name, '.js');
    const loader = file.isFile() ? load : loadDir;
    container[key] = await loader(location, sandbox, contextualize);
  }
  return container;
};

const createRouting = (container, path = '', routing = new Map()) => {
  for (const [key, value] of Object.entries(container)) {
    const location = path ? `${path}.${key}` : key;
    if (typeof value === 'function') routing.set(location, value);
    else createRouting(value, location, routing);
  }
  return routing;
};

module.exports = { loadDir, createRouting, starts };
