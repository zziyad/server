'use strict';

const http = require('node:http');
const { Readable } = require('node:stream');

const MIME_TYPES = {
  html: 'text/html; charset=UTF-8',
  json: 'application/json; charset=UTF-8',
  js: 'application/javascript; charset=UTF-8',
  css: 'text/css',
  png: 'image/png',
  ico: 'image/x-icon',
  svg: 'image/svg+xml',
  gzip: 'gzip',
  pdf: 'application/pdf',
  jpg: 'image/jpg',
  jpeg: 'image/jpg',
  csv: 'text/csv',
  bmp: 'image/x-ms-bmp',
  gif: 'image/gif',
};

const HEADERS = {
  'X-XSS-Protection': '1; mode=block',
  'X-Content-Type-Options': 'nosniff',
  'Strict-Transport-Security': 'max-age=31536000; includeSubdomains; preload',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

class Transport {
  constructor(server, req) {
    this.server = server;
    this.req = req;
    this.ip = req.socket.remoteAddress;
  }

  error(code = 500, { id = 0, error = null, httpCode = null } = {}) {
    const { console } = this.server;
    const { url, method } = this.req;
    if (!httpCode) httpCode = error?.httpCode || code;
    const status = http.STATUS_CODES[httpCode];
    const pass = httpCode < 500 || httpCode > 599;
    const message = pass ? error?.message : status || 'Unknown error';
    const reason = `${code}\t${error ? error.stack : status}`;
    console.error(`${this.ip}\t${method}\t${url}\t${reason}`);
    const packet = { type: 'callback', id, error: { message, code } };
    this.send(packet, httpCode);
  }

  send(obj, code = 200) {
    const data = JSON.stringify(obj);
    this.write(data, code, 'json');
  }
}

class HttpTransport extends Transport {
  constructor(server, req, res) {
    super(server, req);
    this.res = res;
  }

  async write(data, httpCode = 200, ext = 'json', options = {}) {
    const { res } = this;
    if (res.writableEnded) return;
    const streaming = data instanceof Readable;
    const mimeType = MIME_TYPES[ext] || MIME_TYPES.html;
    const headers = { ...HEADERS, 'Content-Type': mimeType };
    if (httpCode === 206) {
      const { start, end, size = '*' } = options;
      headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
      headers['Accept-Ranges'] = 'bytes';
      headers['Content-Length'] = end - start + 1;
    }
    if (!streaming) headers['Content-Length'] = data.length;
    res.writeHead(httpCode, headers);
    if (streaming) data.pipe(res);
    else res.end(data);
  }
}

class WsTransport extends Transport {
  constructor(server, req, connection) {
    super(server, req);
    this.connection = connection;
  }

  write(data) {
    this.connection.send(data);
  }
}

module.exports = { Transport, HttpTransport, WsTransport, MIME_TYPES, HEADERS };
