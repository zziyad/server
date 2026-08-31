'use strict';

class AbortScope {
  #controller = new AbortController();

  get signal() {
    return this.#controller.signal;
  }

  [Symbol.dispose]() {
    if (this.#controller.signal.aborted) return;
    this.#controller.abort(new Error('Scope disposed'));
  }
}

module.exports = { AbortScope };
