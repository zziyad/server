'use strict';

const crypto = require('node:crypto');
// const hashTable = require('./hashTable.js');
const SCRYPT_PARAMS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const SCRYPT_PREFIX = '$scrypt$N=32768,r=8,p=1,maxmem=67108864$';
const readline = require('node:readline');
const CRC_LEN = 4;

const serializeHash = (hash, salt) => {
  const saltString = salt.toString('base64').split('=')[0];
  const hashString = hash.toString('base64').split('=')[0];
  return `${SCRYPT_PREFIX}${saltString}$${hashString}`;
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

const hash = (password) =>
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
  if (buffer.length === 0) return null;
  try {
    return JSON.parse(buffer);
  } catch {
    return null;
  }
};

const receiveBody = async (req) => {
  const buffers = [];
  for await (const chunk of req) buffers.push(chunk);
  console.log({ buffers });
  return Buffer.concat(buffers).toString();
};

const twoDigit = (n) => {
  const s = n.toString();
  if (n < 10) return '0' + s;
  return s;
};

const nowDate = (date) => {
  if (!date) date = new Date();
  const yyyy = date.getUTCFullYear().toString();
  const mm = twoDigit(date.getUTCMonth() + 1);
  const dd = twoDigit(date.getUTCDate());
  return `${yyyy}-${mm}-${dd}`;
};

const nowDateTimeUTC = (date, timeSep = ':') => {
  if (!date) date = new Date();
  const yyyy = date.getUTCFullYear().toString();
  const mm = twoDigit(date.getUTCMonth() + 1);
  const dd = twoDigit(date.getUTCDate());
  const hh = twoDigit(date.getUTCHours() + 4);
  const min = twoDigit(date.getUTCMinutes());
  const ss = twoDigit(date.getUTCSeconds());
  return `${yyyy}-${mm}-${dd}T${hh}${timeSep}${min}${timeSep}${ss}`;
};

const execute = (method) =>
  method().catch((error) => {
    const msg = `Failed to execute method: ${error?.message}`;
    console.error(msg, error.stack);
    return Promise.reject(error);
  });

const loging = (message) => {
  readline.cursorTo(process.stdout, 0);
  process.stdout.write(message);
};

const crcToken = (secret, key) => {
  const md5 = crypto.createHash('md5').update(key + secret);
  return md5.digest('hex').substring(0, CRC_LEN);
};

const validateToken = (secret, token) => {
  if (!token) return false;
  const len = token.length;
  console.log({ token });
  const crc = token.slice(len - CRC_LEN);
  const key = token.slice(0, -CRC_LEN);
  const secretSign = Buffer.from(crcToken(secret, key));
  const tokenSign = Buffer.from(crc);
  return crypto.timingSafeEqual(secretSign, tokenSign);
};

const makeRequest = async (data) => {
  const request = await fetch('http://localhost:8080/api', {
    body: data,
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
  return request.status;
};
module.exports = Object.freeze({
  hash,
  // hashTable,
  validatePassword,
  validateToken,
  jsonParse,
  receiveBody,
  nowDate,
  nowDateTimeUTC,
  execute,
  loging,
  makeRequest,
});
