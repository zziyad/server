'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { AbortScope } = require('../lib/abort-scope.js');

test('dispose aborts signal once', () => {
  const scope = new AbortScope();
  assert.equal(scope.signal.aborted, false);
  scope[Symbol.dispose]();
  assert.equal(scope.signal.aborted, true);
  scope[Symbol.dispose]();
  assert.equal(scope.signal.aborted, true);
});
