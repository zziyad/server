'use strict';

const crypto = require('node:crypto');
const path = require('node:path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const SCRYPT_PARAMS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const SCRYPT_PREFIX = '$scrypt$N=32768,r=8,p=1,maxmem=67108864$';

const serializeHash = (hash, salt) => {
  const saltString = salt.toString('base64').split('=')[0];
  const hashString = hash.toString('base64').split('=')[0];
  return `${SCRYPT_PREFIX}${saltString}$${hashString}`;
};

const parsePath = (relPath) => {
  const name = path.basename(relPath, '.js');
  const names = relPath.split(path.sep);
  names[names.length - 1] = name;
  return names;
};

const parseOptions = (options) => {
  const values = [];
  const items = options.split(',');
  for (const item of items) {
    const [key, val] = item.split('=');
    values.push([key, Number(val)]);
  }
  return Object.fromEntries(values);
};

const extractPath = (inputPath) => {
  const parts = inputPath.split('/');
  if (parts[2] === 'api') {
    return '/' + parts.slice(2).join('/');
  }
  return "Second parameter is not 'api'";
};

const deserializeHash = (phcString) => {
  const [, name, options, salt64, hash64] = phcString.split('$');
  if (name !== 'scrypt') {
    throw new Error('Node.js crypto module only supports scrypt');
  }
  const params = parseOptions(options);
  const salt = Buffer.from(salt64, 'base64');
  const hash = Buffer.from(hash64, 'base64');
  return { params, salt, hash };
};

const SALT_LEN = 32;
const KEY_LEN = 64;

const hashPassword = (password) =>
  new Promise((resolve, reject) => {
    crypto.randomBytes(SALT_LEN, (err, salt) => {
      if (err) {
        reject(err);
        return;
      }
      crypto.scrypt(password, salt, KEY_LEN, SCRYPT_PARAMS, (err, hash) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(serializeHash(hash, salt));
      });
    });
  });

const validatePassword = (password, serHash) => {
  const { params, salt, hash } = deserializeHash(serHash);
  return new Promise((resolve, reject) => {
    const callback = (err, hashedPassword) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(crypto.timingSafeEqual(hashedPassword, hash));
    };
    crypto.scrypt(password, salt, hash.length, params, callback);
  });
};

const jsonParse = (buffer) => {
  if (!buffer || buffer.length === 0) return null;
  try {
    const source = Buffer.isBuffer(buffer) ? buffer.toString('utf8') : String(buffer);
    return source ? JSON.parse(source) : null;
  } catch {
    return null;
  }
};

const generateUniqueFileName = (fileName) => {
  const sanitizedFileName = fileName.replace(/\s+/g, '_');
  return `${crypto.randomUUID()}_${sanitizedFileName}`;
};

const receiveBody = async (req) => {
  const buffers = [];
  for await (const chunk of req) buffers.push(chunk);
  return Buffer.concat(buffers);
};

const execute = (method) => {
  if (typeof method !== 'function') return null;
  return method().catch((error) => {
    const msg = `Failed to execute method: ${error?.message}`;
    console.log(msg, error.stack);
    return Promise.reject(error);
  });
};

const removeCircularRefs = (value, seen = new WeakSet()) => {
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return undefined;
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => removeCircularRefs(item, seen));
  }
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    const clean = removeCircularRefs(item, seen);
    if (clean !== undefined) result[key] = clean;
  }
  return result;
};

const validateSchema = (value, schema) => {
  const data = removeCircularRefs(value || {});
  const ajv = new Ajv({
    allErrors: true,
    coerceTypes: true,
    removeAdditional: false,
    useDefaults: true,
  });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const valid = validate(data);
  return {
    valid,
    data,
    errors: valid
      ? []
      : (validate.errors || []).map(
          (error) => `${error.instancePath || '/'} ${error.message}`,
        ),
  };
};

module.exports = Object.freeze({
  hashPassword,
  validatePassword,
  generateUniqueFileName,
  jsonParse,
  receiveBody,
  parsePath,
  execute,
  extractPath,
  removeCircularRefs,
  validateSchema,
});
