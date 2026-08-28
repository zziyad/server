'use strict';

function loadEnvFile(envPath = '.env') {
  if (typeof process.loadEnvFile !== 'function') {
    return { loaded: false, reason: 'unsupported' };
  }

  try {
    process.loadEnvFile(envPath);
    return { loaded: true };
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return { loaded: false, reason: 'missing' };
    }
    throw error;
  }
}

module.exports = { loadEnvFile };
