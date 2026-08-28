'use strict';

class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.sessionTtl = 24 * 60 * 60;
    this.absoluteTtl = this.sessionTtl;
    this.idleTtl = this.sessionTtl;
  }

  async createSession(sessionId, sessionData) {
    this.sessions.set(sessionId, sessionData);
    return true;
  }

  async rotateSessionCanonical(oldSessionId, newSessionId, options = {}) {
    if (oldSessionId) this.sessions.delete(oldSessionId);
    this.sessions.set(newSessionId, options.newSession);
    return true;
  }

  async getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  async updateLastSeen(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    if (session.meta) session.meta.last_seen_at = new Date().toISOString();
    return true;
  }

  isSessionValid(session) {
    return Boolean(session);
  }

  async destroySession(sessionId) {
    return this.sessions.delete(sessionId);
  }

  async destroyAllUserSessions(userId) {
    let count = 0;
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session?.auth?.user_id === userId) {
        this.sessions.delete(sessionId);
        count++;
      }
    }
    return count;
  }

  async checkSlidingLimit() {
    return { allowed: true, current: 0, limit: 0 };
  }

  async getActiveSessionsCount() {
    return this.sessions.size;
  }

  async keepAlive(sessionId) {
    const session = await this.getSession(sessionId);
    if (!session) return null;
    await this.updateLastSeen(sessionId);
    return session;
  }

  async close() {
    this.sessions.clear();
    return true;
  }

  get configManager() {
    return {
      logConfig() {},
    };
  }
}

module.exports = { SessionManager };
