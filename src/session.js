'use strict';

const crypto = require('node:crypto');

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
      department_id:
        this.state.auth?.department_id ??
        this.state.auth?.department?.id ??
        null,
      department: this.state.auth?.department || null,
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
    this.eventBus = client?.eventBus ?? null;
    this.application = client?.application ?? null;
    this.notificationManager = client?.notificationManager ?? null;
  }
  get session() {
    return this.client.session;
  }
  get user() {
    return this.client?.session?.user ?? null;
  }
}

module.exports = { Session, Context };
