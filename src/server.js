'use strict';

const http = require('node:http');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const ws = require('ws');
const { receiveBody, jsonParse } = require('../lib/common.js');
const transport = require('./transport.js');
const { HttpTransport, WsTransport } = transport;
const { SessionManager } = require('./sessionManager.js');

const createProxy = (data, save, logger) => {
  let saveTimeout = null;

  return new Proxy(data, {
    get: (data, key) => {
      const value = Reflect.get(data, key);
      return value;
    },
    set: (data, key, value) => {
      const success = Reflect.set(data, key, value);

      if (success && save) {
        // Debounce save operations to avoid excessive writes
        if (saveTimeout) {
          clearTimeout(saveTimeout);
        }

        saveTimeout = setTimeout(() => {
          // Create a clean copy of the data to avoid duplication
          const cleanData = { ...data };
          save(cleanData).catch((err) => {
            logger.error('Session auto-save error:', err);
          });
        }, 100); // 100ms debounce
      }

      return success;
    },
  });
};

class Session {
  constructor(token, data, server) {
    this.token = token;
    const { application, console } = server;

    // Create proxy with debounced save
    this.state = createProxy(
      data,
      async (sessionData) => {
        try {
          // Update session directly in Redis without adding metadata
          await sessionManager.redis.setEx(
            `session:${token}`,
            sessionManager.ttl,
            JSON.stringify(sessionData),
          );
          console.log(`Session auto-saved: ${token}`);
        } catch (error) {
          console.error('Session auto-save failed:', error);
        }
      },
      console,
    );
  }
}

// Initialize session manager
const sessionManager = new SessionManager();

class Context {
  constructor(client) {
    this.client = client;
    this.uuid = crypto.randomUUID();
    this.state = {};
    this.session = client?.session || null;
  }
}

class Client extends EventEmitter {
  #transport;

  constructor(transport) {
    super();
    this.#transport = transport;
    this.ip = transport.ip;
    this.session = null;
  }

  error(code, options) {
    this.#transport.error(code, options);
  }

  send(obj, code) {
    this.#transport.send(obj, code);
  }

  getCookies() {
    // Only HttpTransport has getCookies method
    if (this.#transport.getCookies) {
      return this.#transport.getCookies();
    }
    return {}; // WebSocket transports don't have cookies
  }

  removeSessionCookie(sessionId) {
    // Only HttpTransport has removeSessionCookie method
    if (this.#transport.removeSessionCookie) {
      this.#transport.removeSessionCookie(sessionId);
    }
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

  async initializeSession(token, data = {}) {
    try {
      // Only finalize if there's an existing session with a different token
      if (this.session && this.session.token !== token) {
        await this.finalizeSession();
      }
      await sessionManager.createSession(token, data);
      this.session = new Session(token, data, this.#transport.server);
      return true;
    } catch (error) {
      console.error('Session initialization error:', error);
      // Fallback to memory-only session
      this.session = new Session(token, data, this.#transport.server);
      return true;
    }
  }

  async startSession(token, data = {}) {
    try {
      console.log(`Starting session for token: ${token}`);
      await this.initializeSession(token, data);
      if (!this.#transport.connection)
        this.#transport.sendSessionCookie(token, data.sessionId);
      console.log(`Session started successfully for token: ${token}`);
      console.log('Session data stored:', this.session.state);
      return true;
    } catch (error) {
      console.error('Session start error:', error);
      // Fallback to memory-only session
      this.session = new Session(token, data, this.#transport.server);
      if (!this.#transport.connection)
        this.#transport.sendSessionCookie(token, data.sessionId);
      return true;
    }
  }

  async finalizeSession() {
    if (!this.session) return false;
    try {
      console.log(`Finalizing session: ${this.session.token}`);
      await sessionManager.invalidateSession(this.session.token);
    } catch (error) {
      console.error('Session finalization error:', error);
    }
    this.session = null;
    return true;
  }

  async restoreSession(token) {
    try {
      const sessionData = await sessionManager.getSession(token);
      if (!sessionData) return false;
      this.session = new Session(token, sessionData, this.#transport.server);
      return true;
    } catch (error) {
      console.error('Session restoration error:', error);
      return false;
    }
  }

  destroy() {
    console.log('Client destroy called');
    console.log('Transport type:', this.#transport.constructor.name);
    this.emit('close');

    // Don't automatically finalize sessions - let them persist in Redis
    if (this.session) {
      console.log(
        `Client destroyed, session preserved in Redis: ${this.session.token}`,
      );
    }
  }
}

class Server {
  constructor(application) {
    this.application = application;
    const { console, routing, config } = application;
    this.routing = routing;
    this.console = console;
    this.httpServer = http.createServer();
    const [port] = config.server.ports;
    this.listen(port);
    this.console.log(`API on port ${port}`);

    // Setup session cleanup interval
    this.setupSessionCleanup();
  }

  setupSessionCleanup() {
    // Clean up expired sessions every 5 minutes
    setInterval(
      async () => {
        try {
          const cleaned = await sessionManager.cleanupExpired();
          if (cleaned > 0) {
            this.console.log(`Cleaned up ${cleaned} expired sessions`);
          }
        } catch (error) {
          this.console.error('Session cleanup error:', error);
        }
      },
      5 * 60 * 1000,
    ); // 5 minutes
  }

  listen(port) {
    this.httpServer.on('request', async (req, res) => {
      const transport = new HttpTransport(this, req, res);
      if (!req.url.startsWith('/api')) {
        // Create a temporary transport for static file serving
        return void this.application.static.serve(req.url, transport);
      }
      // const transport = new HttpTransport(this, req, res);
      const client = new Client(transport);
      const data = await receiveBody(req);
      this.rpc(client, data);

      // For HTTP requests, destroy client after response is sent
      req.on('close', () => {
        // Only destroy if no active session or if session is already stored in Redis
        if (!client.session) {
          client.destroy();
        } else {
          console.log(
            `Preserving session for HTTP client: ${client.session.token}`,
          );
          // Don't destroy - let the session manager handle cleanup
        }
      });
    });

    const wsServer = new ws.Server({ server: this.httpServer });
    wsServer.on('connection', (connection, req) => {
      const transport = new WsTransport(this, req, connection);
      const client = new Client(transport);

      connection.on('message', (data) => {
        this.rpc(client, data);
      });

      // Don't destroy client on connection close for session persistence
      // connection.on('close', () => {
      //   client.destroy();
      // });
    });

    this.httpServer.listen(port);
  }

  async rpc(client, data) {
    const packet = jsonParse(data);
    if (!packet) {
      const error = new Error('JSON parsing error');
      client.error(500, { error, pass: true });
      return;
    }
    const { id, type, args } = packet;
    if (type !== 'call' || !id || !args) {
      const error = new Error('Packet structure error');
      client.error(400, { id, error, pass: true });
      return;
    }

    // Resume session from cookie if available
    await this.resumeCookieSession(client);

    const [unit, method] = packet.method.split('/');
    const proc = this.routing.get(unit + '.' + method);
    if (!proc) {
      client.error(404, { id });
      return;
    }
    const context = client.createContext();
    console.log({ context });
    /* TODO: check rights
        if (!client.session && proc.access !== 'public') {
          client.error(403, { id });
          return;
        }*/
    this.console.log(`${client.ip}\t${packet.method}`);
    console.log({ packet });
    proc(context)
      .method(...packet.args)
      .then((result) => {
        if (result?.constructor?.name === 'Error') {
          const { code, httpCode = 200 } = result;
          client.error(code, { id, error: result, httpCode });
          return;
        }
        client.send({ type: 'callback', id, result });
      })
      .catch((error) => {
        client.error(error.code, { id, error });
      });
  }

  async resumeCookieSession(client) {
    try {
      const cookies = client.getCookies();
      const sessionId = cookies['session-id'] || cookies['auth-token'];

      if (sessionId && !client.session) {
        console.log(`Attempting to resume session from cookie: ${sessionId}`);
        const restored = await client.restoreSession(sessionId);
        if (restored) {
          console.log('Session resumed from cookie successfully');
        }
      }
    } catch (error) {
      console.error('Session resume error:', error);
    }
  }

  /**
   * Gracefully closes the server
   *
   * @returns {Promise<void>}
   */
  async close() {
    return new Promise((resolve) => {
      if (this.httpServer && !this.httpServer._closed) {
        this.httpServer._closed = true;

        // Close session manager
        sessionManager.close().then(() => {
          this.httpServer.close(() => {
            this.console.log('HTTP server closed');
            resolve();
          });
        });
      } else {
        resolve();
      }
    });
  }

  // Add session analytics endpoint
  async getSessionAnalytics() {
    return await sessionManager.getSessionAnalytics();
  }

  // Add session management methods
  async invalidateUserSessions(userId) {
    return await sessionManager.invalidateUserSessions(userId);
  }

  async invalidateAllSessions() {
    return await sessionManager.invalidateAllSessions();
  }
}

module.exports = { Server };
