'use strict';

const crypto = require('node:crypto');

const base64url = (buf) =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function genRandomBuf(bytes = 32) {
  return crypto.randomBytes(bytes);
}
function signRandomBuf(secret, randomBuf) {
  const hmac = crypto.createHmac('sha256', secret).update(randomBuf).digest();
  return `${base64url(randomBuf)}.${base64url(hmac)}`;
}
function verifySignedToken(secret, token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const rnd = Buffer.from(parts[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    const sig = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    const expected = crypto.createHmac('sha256', secret).update(rnd).digest();
    if (expected.length !== sig.length) return null;
    if (!crypto.timingSafeEqual(expected, sig)) return null;
    return rnd;
  } catch (e) {
    return null;
  }
}
function hashTokenHex(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
function buildCookieHeader({
  name, value, maxAgeSeconds, domain, httpOnly = true, secure = true, sameSite = 'None', path = '/',
}) {
  const expires = new Date(Date.now() + maxAgeSeconds * 1000).toUTCString();
  let cookie = `${name}=${value}; Max-Age=${Math.floor(maxAgeSeconds)}; Expires=${expires}; Path=${path};`;
  if (domain) cookie += ` Domain=${domain};`;
  if (httpOnly) cookie += ' HttpOnly;';
  if (secure) cookie += ' Secure;';
  if (sameSite) cookie += ` SameSite=${sameSite};`;
  return cookie;
}
function makeTokens(secret) {
  const rndAccess = genRandomBuf(32);
  const accessToken = signRandomBuf(secret, rndAccess);
  const refreshRaw = genRandomBuf(64).toString('base64');
  const refreshHash = hashTokenHex(refreshRaw);
  return { accessToken, refreshRaw, refreshHash };
}
module.exports = {
  genRandomBuf, signRandomBuf, verifySignedToken, hashTokenHex, buildCookieHeader, makeTokens,
};
