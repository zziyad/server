/* eslint-disable quotes */
'use strict';

const { node } = require('./dependencies.js');
const { EventEmitter } = require('node:events');
const ws = require('ws');
const { receiveBody, jsonParse } = require('../lib/common.js');
const transport = require('./transport.js');
const { HttpTransport, WsTransport, HEADERS } = transport;
const sessions = new Map(); // token: Session
const storage = require('./storage.js');
const { MetaReadable, chunkDecode } = require('./streams.js');

class Session extends Map {
  constructor(token, data) {
    super();
    this.token = token;
    this.expire = null;
    this.state = { ...data };
  }

  static async start(token, data, client) {
    if (client.session) return client.session;
    client.token = token;
    const newSessionInstance = new Session(token, data.expires, data);
    const session = await storage.set(token, data);
    // Object.setPrototypeOf(session, Session.prototype);
    sessions.set(token, session);
    client.send({ type: 'heartbeat', session: token });
    return newSessionInstance;
  }

  static async restore(token) {
    const cache = sessions.get(token);
    if (cache) return cache;
    if (token) {
      const session = await storage.get(token /*, this.status */);
      if (!session || Array.isArray(session)) return null;
      delete session.userid;
      Object.setPrototypeOf(session, Session.prototype);
      sessions.set(token, session);
      return session;
    }
    return null;
  }
}

class Context {
  constructor(client) {
    this.client = client;
    this.uuid = node.crypto.randomUUID();
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
    this.token = null;
    this.streams = new Map();
    this.fileName = [];
  }

  static async getInstance(transport, token) {
    const client = new Client(transport);
    if (!token) token = this.token;
    client.session = await Session.restore(token, this);

    if (client.session && !client.isExpire(client.session?.expires)) {
      await storage.delete(token);
      sessions.delete(token);
      console.log('-------EXPIRED------');
      client.session = null;
      client.send({ type: 'heartbeat', session: null });
    }

    client.token = client.session ? token : null;
    return client;
  }

  error(code, options) {
    this.#transport.error(code, options);
  }

  exp(path) {
    const { res } = this.#transport;
    res.setHeader('Content-Disposition', `attachment; filename="${path}"`);
    res.writeHead(200, { ...HEADERS, 'Content-Type': 'text/csv' });
    node.fs.createReadStream(path).pipe(res);
  }

  send(obj, code) {
    this.#transport.send(obj, code);
  }

  getStream(id) {
    if (!this.#transport.connection) {
      throw new Error("Can't receive stream from http transport");
    }
    const stream = this.streams.get(id);
    if (stream) return stream;
    throw new Error(`Stream ${id} is not initialized`);
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

  isExpire(expires) {
    const expireTimestamp = new Date(expires);
    const currentTime = new Date();
    if (isNaN(expireTimestamp) || isNaN(currentTime)) return false;
    const diffMillisec = expireTimestamp.getTime() - currentTime.getTime();
    if (diffMillisec <= 0) return false;
    return true;
  }

  async startSession(token, data) {
    if (this.token === null)
      this.session = await Session.start(token, data, this);
    else this.session = await Session.restore(this.token);
    return this.session;
  }

  finalizeSession() {
    if (!this.session) return false;
    this.session = null;
    return true;
  }

  destroy() {
    this.emit('close');
    if (!this.session) return;
    this.finalizeSession();
  }
}

class Server {
  constructor(application) {
    this.application = application;
    const { console, routing, config } = application;
    this.routing = routing;
    this.console = console;
    this.httpServer = node.http.createServer();
    this.staticPath = node.path.join(application.path, 'static');
    const [port] = config.server.ports;
    this.fileName = [];
    this.listen(port);
    console.log(`API on port ${port}`);
  }

  listen(port) {
    this.httpServer.on('request', async (req, res) => {
      console.log({ URL: req.url });
      const transport = new HttpTransport(this, req, res);
      if (!req.url.startsWith('/api')) {
        if (this.application.static.constructor.name !== 'Static') return;
        return void this.application.static.serve(req.url, transport);
      }
      const client = new Client(transport);
      const body = await receiveBody(req);
      const httpPacket = JSON.stringify({
        type: 'http',
        path: req.url,
        args: body,
      });
      const data = body === '' ? httpPacket : body;
      this.rpc(client, data);

      req.on('close', () => {
        client.destroy();
      });
    });

    const wsServer = new ws.Server({ server: this.httpServer });
    wsServer.on('connection', async (connection, req) => {
      const tKn = req.headers.cookie ? req.headers.cookie.split('; ') : [];
      const [token] = tKn.map((item) => item.split('=')[1]);
      const transport = new WsTransport(this, req, connection);
      const client = await Client.getInstance(transport, token);

      connection.on('message', (data, isBinary) => {
        if (isBinary) this.binary(client, new Uint8Array(data));
        else this.rpc(client, data);
      });

      connection.on('close', () => {
        console.log('DESTROY');
        client.destroy();
      });
    });

    this.httpServer.listen(port);
  }

  rpc(client, data) {
    const packet = jsonParse(data);

    if (!packet) {
      const error = new Error('JSON parsing error');
      return void client.error(500, { error, pass: true });
    }

    const { id, type, args } = packet;
    if (type === 'stream') return void this.stream(client, packet);
    if (type === 'http') return void this.request(client, packet);
    if (type !== 'call' || !id || !args) {
      const error = new Error('Packet structure error');
      return void client.error(400, { id, error, pass: true });
    }
    /* TODO: resumeCookieSession(); */
    const [unit, method] = packet.method.split('/');
    const proc = this.routing.get(unit + '.' + method);

    if (!proc) return void client.error(404, { id });
    const context = client.createContext();
    /* TODO: check rights
    if (!client.session && proc.access !== 'public') {
      client.error(403, { id });
      return;
    }*/
    this.console.log(`${client.ip}\t${packet.method}`);
    proc(context)
      .method(...packet.args)
      .then((result) => {
        if (result?.constructor?.name === 'Error') {
          const { code, httpCode = 200 } = result;
          return void client.error(code, { id, error: result, httpCode });
        }
        client.send({ type: 'callback', id, result });
      })
      .catch((error) => {
        client.error(error.code, { id, error });
      });
  }

  async request(client, packet) {
    const [unit, method] = packet.path;
    const proc = this.routing.get(unit + '.' + method);
    if (!proc) return void client.error(404);
    const context = client.createContext();

    this.console.log(`${client.ip}\t${packet.path}`);
    proc(context)
      .method(...packet.args)
      .then((result) => {
        if (result?.constructor?.name === 'Error') {
          const { code, httpCode = 200 } = result;
          return void client.error(code, { error: result, httpCode });
        }
        // client.send({ result });
      })
      .catch((error) => {
        client.error(error.code, { error });
      });
  }

  async stream(client, packet) {
    const { id, name, size, status } = packet;
    const tag = id + '/' + name;
    try {
      const stream = client.streams.get(id);
      if (status) {
        if (!stream) throw new Error(`Stream ${tag} is not initialized`);
        if (status === 'end') await stream.close();
        if (status === 'terminate') await stream.terminate();
        console.log({ status, packet });
        return void client.streams.delete(id);
      }
      const valid = typeof name === 'string' && Number.isSafeInteger(size);
      if (!valid) throw new Error('Stream packet structure error');
      if (stream) throw new Error(`Stream ${tag} is already initialized`);
      {
        const options = { highWaterMark: 21345 };
        const stream = new MetaReadable({ id, name, size, options });
        client.streams.set(id, stream);
        console.log({ FILES: client.streams });
        this.console.log(`${client.ip}\tstream ${tag} init`);
      }
    } catch (error) {
      this.console.error(`${client.ip}\tstream ${tag} error`);
      client.error(400, { id, error, pass: true });
    }
  }

  binary(client, data) {
    const { id, payload } = chunkDecode(data);
    try {
      const upstream = client.streams.get(id);
      if (upstream) {
        upstream.push(payload);
      } else {
        const error = new Error(`Stream ${id} is not initialized`);
        client.error(400, { id, error, pass: true });
      }
    } catch (error) {
      this.console.error(`${client.ip}\tstream ${id} error`);
      client.error(400, { id: 0, error });
    }
  }
}

module.exports = { Server };
