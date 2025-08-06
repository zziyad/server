'use strict';

const node = {};
const metarhia = {};

const internals = [
  'util',
  'child_process',
  'worker_threads',
  'os',
  'v8',
  'vm',
  'path',
  'url',
  'assert',
  'querystring',
  'string_decoder',
  'perf_hooks',
  'async_hooks',
  'timers',
  'events',
  'stream',
  'fs',
  'crypto',
  'zlib',
  'readline',
  'dns',
  'net',
  'tls',
  'http',
  'https',
  'http2',
  'dgram',
  'stream/promises',
];
const optional = ['metawatch', 'metavm'];
const metapkg = ['metautil', 'metasql', 'metaschema', ...optional];

for (const name of metapkg) metarhia[name] = require(`${name}`);

for (const name of internals) node[name] = require(`node:${name}`);

node.process = process;
node.buffer = Buffer;
node.childProcess = node['child_process'];
node.StringDecoder = node['string_decoder'];
node.perfHooks = node['perf_hooks'];
node.asyncHooks = node['async_hooks'];
node.worker = node['worker_threads'];
node.fsp = node.fs.promises;
// node.streamProm = node['stream/promises'];

const npm = {};

const pkg = require(process.cwd() + '/package.json');

if (pkg.dependencies) {
  for (const dependency of Object.keys(pkg.dependencies)) {
    npm[dependency] = require(dependency);
  }
}

Object.freeze(npm);
Object.freeze(node);
Object.freeze(metarhia);

module.exports = { node, npm, metarhia };
