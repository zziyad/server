'use strict';

const apiTiming = require('./api-timing.js');
const { Session } = require('./session.js');
const { ConsList, runChain } = require('../lib/cons-list.js');
const { AbortScope } = require('../lib/abort-scope.js');

const restoreSession = async (ctx) => {
  const { client, packet } = ctx;
  const cookies = client.getCookies();
  const sessionId = cookies['session_id'];
  if (!sessionId) return;

  try {
    const transportType = client.isWebSocket() ? 'ws' : 'http';
    const session = await client.validateSession(
      sessionId,
      packet.method,
      transportType,
    );
    if (session) {
      client.session = new Session(sessionId, session);
    } else if (transportType === 'http') {
      client.clearSessionCookies?.();
    }
  } catch {}
};

const authorize = async (ctx) => {
  const { client, packet, proc, server } = ctx;
  if (proc().access === 'public') return;

  if (!client.session) {
    ctx.halted = true;
    server.semaphore.leave();
    client.clearSessionCookies?.();
    client.error(401, {
      id: packet.id,
      error: { message: 'Authentication required', code: 'AUTH_REQUIRED' },
    });
    return;
  }

  const requiredAccess = proc().access;
  const rawRoles =
    client.session.state?.auth?.roles || client.session.state?.roles || [];
  const roles = Array.isArray(rawRoles) ? rawRoles : [];
  const rawPermissions =
    client.session.state?.auth?.permissions ||
    client.session.state?.permissions ||
    [];
  const permissions = Array.isArray(rawPermissions) ? rawPermissions : [];
  const isSuperAdmin = roles.some(
    (role) => (typeof role === 'string' ? role : role?.name) === 'super_admin',
  );

  if (
    requiredAccess !== 'private' &&
    !isSuperAdmin &&
    !permissions.includes(requiredAccess)
  ) {
    ctx.halted = true;
    server.semaphore.leave();
    client.error(403, {
      id: packet.id,
      error: {
        message: `Permission required: ${requiredAccess}`,
        code: 'PERMISSION_DENIED',
      },
    });
    return;
  }

  const csrf = client.validateCsrfToken(packet.method);
  if (!csrf.valid && !csrf.skipped) {
    ctx.halted = true;
    server.semaphore.leave();
    client.error(403, {
      id: packet.id,
      error: {
        message: csrf.error || 'CSRF validation failed',
        code: csrf.code || 'CSRF_FAILED',
      },
    });
    return;
  }
};

const sessionUserId = (client) =>
  client.session?.state?.auth?.user_id || client.session?.state?.id || null;

const writeAccessLog = (ctx, started) => {
  const { client, packet, server, proc } = ctx;
  const ms = Date.now() - started;
  const access = typeof proc === 'function' ? proc()?.access : undefined;
  const line = `${client.ip}\t${packet.method}\t${ms}ms\tuser=${
    sessionUserId(client) || '-'
  }\taccess=${access || '-'}\thalted=${ctx.halted ? '1' : '0'}`;
  try {
    server.console.access(line);
  } catch {
    server.console.log(line);
  }
  if (ctx.halted) {
    try {
      server.console.security('rpc-halted', {
        method: packet.method,
        userId: sessionUserId(client),
        ip: client.ip,
        ms,
      });
    } catch {}
  }
};

const invoke = async (ctx) => {
  const { client, packet, proc, server, context } = ctx;
  if (context && ctx.signal) context.signal = ctx.signal;
  if (context && client?.ip) context.ip = client.ip;
  const startedAtNs = apiTiming.nowNs();
  try {
    const result = await proc(context).method(packet.args);
    const status = apiTiming.getResultStatus(result);
    apiTiming.log({
      console: server.console,
      method: packet.method,
      status,
      durationMs: apiTiming.elapsedMs(startedAtNs),
      errorCode: result?.error?.code || apiTiming.getErrorCode(result),
    });
    if (result?.constructor?.name === 'Error') {
      const { code, httpCode = 200, retryAfterSec } = result;
      const headers = retryAfterSec
        ? { 'Retry-After': String(retryAfterSec) }
        : undefined;
      client.error(code, { id: packet.id, error: result, httpCode, headers });
      return;
    }
    client.send({ type: 'callback', id: packet.id, result });
  } catch (error) {
    apiTiming.log({
      console: server.console,
      method: packet.method,
      status: 'error',
      durationMs: apiTiming.elapsedMs(startedAtNs),
      errorCode: apiTiming.getErrorCode(error),
    });
    client.error(error.code, { id: packet.id, error });
  } finally {
    server.semaphore.leave();
  }
};

const createRpcChain = (extra = ConsList.empty) =>
  ConsList.merge(extra, ConsList.of(restoreSession, authorize, invoke));

const runRpc = async (list, ctx) => {
  const scope = new AbortScope();
  ctx.signal = scope.signal;
  if (ctx.context) {
    ctx.context.signal = scope.signal;
    if (ctx.client?.ip) ctx.context.ip = ctx.client.ip;
  }
  const onClose = () => scope[Symbol.dispose]();
  ctx.client.once('close', onClose);
  const started = Date.now();
  try {
    await runChain(list, ctx);
  } finally {
    ctx.client.off('close', onClose);
    scope[Symbol.dispose]();
    writeAccessLog(ctx, started);
  }
};

module.exports = {
  restoreSession,
  authorize,
  invoke,
  createRpcChain,
  runChain,
  runRpc,
};
