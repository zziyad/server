'use strict';

const fs = require('node:fs');

const DEFAULT_SLOW_MS = 250;
const ENV_FILE = '.env';
let envFileCache = null;

const readEnvFile = () => {
  if (envFileCache) return envFileCache;
  envFileCache = Object.create(null);

  try {
    const lines = fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const index = trimmed.indexOf('=');
      if (index === -1) continue;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed
        .slice(index + 1)
        .trim()
        .replace(/^[\'"]|[\'"]$/g, '');
      envFileCache[key] = value;
    }
  } catch {}

  return envFileCache;
};

const readEnv = (name) => {
  if (name in process.env) return process.env[name];
  return readEnvFile()[name];
};

const readBoolValue = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
};

const readBool = (name) => readBoolValue(readEnv(name));

const readBoolSetting = (name) => {
  const value = readEnv(name);
  return value === undefined ? null : readBoolValue(value);
};

const readPositiveInt = (name, fallback) => {
  const value = Number(readEnv(name));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
};

const nowNs = () => process.hrtime.bigint();

const elapsedMs = (startedAtNs) => {
  const nsPerMs = 1000000n;
  return Number((nowNs() - startedAtNs) / nsPerMs);
};

const getErrorCode = (error) => {
  const code = error?.code || error?.error?.code;
  return code == null ? null : String(code);
};

const getResultStatus = (result) => {
  if (result?.status === 'rejected') return 'rejected';
  if (result?.constructor?.name === 'Error') return 'error';
  return 'fulfilled';
};

const isDevelopment = () => process.env.NODE_ENV !== 'production';

const shouldLog = (durationMs, status) => {
  const explicitTimingLog = readBoolSetting('API_TIMING_LOG');
  if (explicitTimingLog === true) return true;
  if (explicitTimingLog === null && isDevelopment()) return true;
  if (status !== 'fulfilled') return true;
  return durationMs >= readPositiveInt('API_SLOW_LOG_MS', DEFAULT_SLOW_MS);
};

const format = ({ method, status, durationMs, errorCode = null }) => {
  const event = status === 'fulfilled' ? 'api_timing' : 'api_error_timing';
  const parts = [
    event,
    `method=${method}`,
    `status=${status}`,
    `duration_ms=${durationMs}`,
  ];
  if (errorCode) parts.push(`error_code=${errorCode}`);
  return parts.join(' ');
};

const shouldWriteStdout = () =>
  readBool('API_TIMING_STDOUT') ||
  (readBool('API_TIMING_LOG') && !isDevelopment());

const writeStdout = (line) => {
  if (!shouldWriteStdout()) return;
  process.stdout.write(`${line}\n`);
};

const log = ({ console, method, status, durationMs, errorCode = null }) => {
  if (!shouldLog(durationMs, status)) return;
  const line = format({ method, status, durationMs, errorCode });
  if (status === 'fulfilled') console.log(line);
  else console.warn ? console.warn(line) : console.log(line);
  writeStdout(line);
};

module.exports = { elapsedMs, getErrorCode, getResultStatus, log, nowNs };
