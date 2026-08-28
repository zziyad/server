'use strict';

const http = require('node:http');
const https = require('node:https');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const ws = require('ws');
const {
  receiveBody,
  jsonParse,
  isOriginAllowed,
} = require('../lib/common.js');
const { HttpTransport, WsTransport } = require('./transport.js');
const { SessionManager } = require('./sessionManager.js');
const apiTiming = require('./api-timing.js');

class Session {
  constructor(sessionId, sessionData) {
    this.sessionId = sessionId;
    this.state = sessionData;
  }

  get user() {
    return {
      id: this.state.auth?.user_id,
      roles: this.state.auth?.roles || [],
      permissions: this.state.auth?.permissions || [],
    };
  }

  get csrfToken() {
    return this.state.security?.csrf_token;
  }

  get token() {
    return this.sessionId;
  }
}

class Context {
  constructor(client) {
    this.client = client;
    this.uuid = crypto.randomUUID();
    this.state = {};
    this.application = client?.application ?? null;
  }

  get session() {
    return this.client.session;
  }

  get user() {
    return this.client?.session?.user ?? null;
  }
}

class Client extends EventEmitter {
  #transport;

  constructor(transport) {
    super();
    this.#transport = transport;
    this.ip = transport.ip;
    this.session = null;
    this.streams = new Map();
    transport.server.clients.add(this);
    transport.once('close', () => {
      this.destroy();
      transport.server.clients.delete(this);
    });
  }

  get sessionManager() {
    return this.#transport?.server?.sessionManager;
  }

  isWebSocket() {
    return this.#transport instanceof WsTransport;
  }

  get application() {
    return this.#transport?.server?.application || null;
  }

  error(code, options) {
    this.#transport.error(code, options);
  }

  send(obj, code) {
    this.#transport.send(obj, code);
  }

  clearSessionCookies() {
    this.#transport.clearSessionCookies?.();
  }

  sendSessionCookie(sessionId, ttl) {
    if (!this.isWebSocket()) this.#transport.sendSessionCookie?.(sessionId, ttl);
  }

  createContext() {
    return new Context(this);
  }

  emit(name, data) {
    if (name === 'close') {
      super.emit(name, data);
      return;
    }
    this.send({ type: 'event', name, data });
  }

  getCookies() {
    return this.#transport.getCookies?.() || {};
  }

  getHeader(name) {
    return this.#transport.getHeader?.(name);
  }

  getUserAgent() {
    return this.#transport.getUserAgent?.() || '';
  }

  async validateSession(sessionId) {
    if (!sessionId) return null;
    const session = await this.sessionManager.getSession(sessionId);
    if (!session) return null;
    await this.sessionManager.updateLastSeen(sessionId);
    return session;
  }

  async startSession(userData) {
    const sm = this.sessionManager;
    const sessionId = crypto.randomUUID();
    const now = new Date();
    const session = {
      meta: {
        created_at: now.toISOString(),
        last_seen_at: now.toISOString(),
      },
      auth: {
        user_id: userData.id || null,
        roles: userData.roles || [],
        permissions: userData.permissions || [],
      },
      security: {
        csrf_token: crypto.randomBytes(32).toString('hex'),
      },
    };
    await sm.createSession(sessionId, session);
    this.session = new Session(sessionId, session);
    this.sendSessionCookie(sessionId, sm.sessionTtl);
    return true;
  }

  async destroySession() {
    if (!this.session) return false;
    await this.sessionManager.destroySession(this.session.sessionId);
    this.session = null;
    this.clearSessionCookies();
    return true;
  }

  destroy() {
    this.emit('close');
    for (const stream of this.streams.values()) {
      try {
        stream.writable?.end?.();
      } catch {}
    }
    this.streams.clear();
  }
}

class Server {
  constructor(application) {
    this.application = application;
    this.console = application.console;
    this.clients = new Set();
    this.semaphore = application.semaphore;
    this.sessionManager = new SessionManager({ config: application.config });
    const ssl = this.getSSLOptions();
    this.httpServer = ssl ? https.createServer(ssl) : http.createServer();
    this.isHttps = Boolean(ssl);
    const [port] = application.config.server.ports;
    this.listen(port);
    this.console.system?.(
      `API on port ${port} (${this.isHttps ? 'HTTPS' : 'HTTP'})`,
    );
    this.console.system?.(
      `Sessions ${this.isSessionsEnabled() ? 'enabled' : 'disabled'}`,
    );
  }

  isSessionsEnabled() {
    return this.application?.config?.sessions?.enabled !== false;
  }

  getSSLOptions() {
    const tls = this.application?.config?.server?.tls;
    if (!tls?.enabled || !tls.certPath || !tls.keyPath) return null;
    const fs = require('node:fs');
    return {
      cert: fs.readFileSync(tls.certPath),
      key: fs.readFileSync(tls.keyPath),
    };
  }

  listen(port) {
    this.httpServer.on('request', async (req, res) => {
      const transport = new HttpTransport(this, req, res);
      if (!req.url.startsWith('/api')) {
        return void this.application.static.serve(req.url, transport);
      }
      const client = new Client(transport);
      const data = await receiveBody(req);
      this.rpc(client, jsonParse(data));
    });

    const wsServer = new ws.Server({ server: this.httpServer });
    wsServer.on('connection', (connection, req) => {
      const origin = req.headers.origin;
      if (origin && !isOriginAllowed(origin, this.application)) {
        connection.close();
        return;
      }
      const transport = new WsTransport(this, req, connection);
      const client = new Client(transport);
      connection.on('message', (data, isBinary) => {
        if (isBinary) {
          transport.handleBinary?.(data, client);
          return;
        }
        this.rpc(client, jsonParse(data));
      });
    });

    this.httpServer.listen(port);
  }

  async rpc(client, packet) {
    if (!packet) {
      client.error(400, { error: { message: 'Packet is required' } });
      return;
    }
    const { id, type, args } = packet;
    if (type !== 'call' || !id || !args) {
      client.error(400, { id, error: { message: 'Packet structure error' } });
      return;
    }

    const key = String(packet.method || '')
      .split('/')
      .filter(Boolean)
      .join('.');
    const proc = this.application.routing.get(key);
    if (!proc) {
      client.error(404, {
        id,
        httpCode: 404,
        error: { message: `Method not found: ${packet.method}`, code: 404 },
      });
      return;
    }

    const context = client.createContext();
    context.sessionManager = this.sessionManager;
    context.config = this.application.config;
    context.application = this.application;
    const sessionsEnabled = this.isSessionsEnabled();
    context.sessionsEnabled = sessionsEnabled;

    if (sessionsEnabled) {
      const cookies = client.getCookies();
      const raw = cookies.session_id;
      const sessionIds = Array.isArray(raw) ? raw : [raw].filter(Boolean);
      for (const sessionId of [...sessionIds].reverse()) {
        const session = await client.validateSession(sessionId);
        if (session) {
          client.session = new Session(sessionId, session);
          break;
        }
      }
    }

    if (sessionsEnabled && proc().access !== 'public') {
      if (!client.session) {
        client.error(401, {
          id,
          error: { message: 'Authentication required', code: 'AUTH_REQUIRED' },
        });
        return;
      }
      const requiredAccess = proc().access;
      const rawPermissions =
        client.session.state?.auth?.permissions ||
        client.session.state?.permissions ||
        [];
      const permissions = Array.isArray(rawPermissions) ? rawPermissions : [];
      const rawRoles =
        client.session.state?.auth?.roles || client.session.state?.roles || [];
      const roles = Array.isArray(rawRoles) ? rawRoles : [];
      const isAdmin = roles.some(
        (role) => (typeof role === 'string' ? role : role?.name) === 'admin',
      );
      if (
        requiredAccess !== 'private' &&
        !isAdmin &&
        !permissions.includes(requiredAccess)
      ) {
        client.error(403, {
          id,
          error: {
            message: `Permission required: ${requiredAccess}`,
            code: 'PERMISSION_DENIED',
          },
        });
        return;
      }
    }

    const startedAtNs = apiTiming.nowNs();
    proc(context)
      .method(packet.args)
      .then((result) => {
        apiTiming.log({
          console: this.console,
          method: packet.method,
          status: apiTiming.getResultStatus(result),
          durationMs: apiTiming.elapsedMs(startedAtNs),
        });
        client.send({ type: 'callback', id, result });
      })
      .catch((error) => {
        apiTiming.log({
          console: this.console,
          method: packet.method,
          status: 'error',
          durationMs: apiTiming.elapsedMs(startedAtNs),
          errorCode: error?.code,
        });
        client.error(500, { id, error });
      });
  }

  async shutdown() {
    return new Promise((resolve) => {
      for (const client of this.clients) {
        try {
          client.destroy();
        } catch {}
      }
      this.httpServer.close(() => resolve());
      setTimeout(resolve, 3000);
    });
  }
}

module.exports = { Server, Client, Session, Context };
