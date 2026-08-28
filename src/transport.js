'use strict';

const http = require('node:http');
const { Readable } = require('node:stream');
const { EventEmitter } = require('node:events');
const metautil = require('metautil');
const {
  buildCookieHeader,
  buildCorsHeaders,
  buildSecurityHeaders,
} = require('../lib/common.js');

const MIME_TYPES = {
  html: 'text/html; charset=UTF-8',
  json: 'application/json; charset=UTF-8',
  js: 'application/javascript; charset=UTF-8',
  css: 'text/css',
  png: 'image/png',
  ico: 'image/x-icon',
  svg: 'image/svg+xml',
};

class Transport extends EventEmitter {
  constructor(server, req) {
    super();
    this.server = server;
    this.console = server.console;
    this.req = req;
    this.ip = req.socket.remoteAddress;
  }

  getHeader(name) {
    return this.req.headers[String(name || '').toLowerCase()];
  }

  error(code = 500, { id, error = null, httpCode = null } = {}) {
    const rawHttpCode = httpCode || error?.httpCode || code;
    httpCode = Number.isInteger(rawHttpCode) ? rawHttpCode : 500;
    const status = http.STATUS_CODES[httpCode];
    const message = httpCode < 500 ? error?.message || status : status;
    const packet = { type: 'callback', id, error: { message, code, status } };
    this.write(JSON.stringify(packet), httpCode, 'json');
  }

  send(obj, code = 200) {
    this.write(JSON.stringify(obj), code, 'json');
  }
}

class HttpTransport extends Transport {
  constructor(server, req, res) {
    super(server, req);
    this.res = res;
    if (req.method === 'OPTIONS') this.options();
    res.on('finish', () => this.emit('close'));
  }

  options() {
    if (this.res.headersSent) return;
    const origin = this.req.headers.origin;
    this.res.writeHead(204, {
      ...buildCorsHeaders(origin, this.server.application),
      ...buildSecurityHeaders(),
    });
    this.res.end();
  }

  write(data, httpCode = 200, ext = 'json') {
    if (this.res.writableEnded) return;
    const origin = this.req.headers.origin;
    const headers = {
      ...buildCorsHeaders(origin, this.server.application),
      ...buildSecurityHeaders(),
      'Content-Type': MIME_TYPES[ext] || MIME_TYPES.html,
    };
    if (!(data instanceof Readable)) {
      headers['Content-Length'] = Buffer.byteLength(data);
    }
    this.res.writeHead(httpCode, headers);
    if (data instanceof Readable) data.pipe(this.res);
    else this.res.end(data);
  }

  getCookies() {
    const { cookie } = this.req.headers;
    if (!cookie) return {};
    return metautil.parseCookies(cookie);
  }

  getUserAgent() {
    return this.req.headers['user-agent'] || '';
  }

  getOrigin() {
    return this.req.headers.origin;
  }

  sendSessionCookie(sessionId, ttl) {
    const cookie = buildCookieHeader({
      name: 'session_id',
      value: sessionId,
      maxAgeSeconds: ttl,
      path: '/',
      httpOnly: true,
      sameSite: this.server.isHttps ? 'None' : 'Lax',
      secure: this.server.isHttps === true,
    });
    this.res.appendHeader?.('Set-Cookie', cookie) ||
      this.res.setHeader('Set-Cookie', cookie);
  }

  clearSessionCookies() {
    const cookie = buildCookieHeader({
      name: 'session_id',
      value: 'deleted',
      maxAgeSeconds: 0,
      path: '/',
      httpOnly: true,
    });
    this.res.setHeader('Set-Cookie', cookie);
  }
}

class WsTransport extends Transport {
  constructor(server, req, connection) {
    super(server, req);
    this.connection = connection;
    connection.on('close', () => this.emit('close'));
  }

  getCookies() {
    const { cookie } = this.req.headers;
    if (!cookie) return {};
    return metautil.parseCookies(cookie);
  }

  getUserAgent() {
    return this.req.headers['user-agent'] || '';
  }

  write(data) {
    this.connection.send(data);
  }

  sendBinary(data) {
    this.connection.send(data);
  }

  sendStreamChunk(streamId, chunk) {
    const idBuffer = Buffer.from(streamId, 'utf8');
    const message = Buffer.concat([Buffer.from([idBuffer.length]), idBuffer, chunk]);
    this.sendBinary(message);
  }

  handleBinary(data, client) {
    const idLength = data[0];
    const streamId = data.slice(1, 1 + idLength).toString('utf8');
    const chunkData = data.slice(1 + idLength);
    const stream = client.streams.get(streamId);
    if (stream) {
      stream.bytesReceived += chunkData.length;
      stream.writable.write(chunkData);
    }
  }

  close() {
    this.connection.terminate();
    this.emit('close');
  }
}

module.exports = { Transport, HttpTransport, WsTransport, MIME_TYPES };
