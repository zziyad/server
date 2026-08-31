'use strict';

class ConsList {
  #value = undefined;
  #next = null;
  #size = 0;
  static #EMPTY = new ConsList();
  constructor(value = undefined, next = null, size = 0) {
    this.#value = value;
    this.#next = next;
    this.#size = size;
  }
  static get empty() { return ConsList.#EMPTY; }
  static of(...values) { return ConsList.fromArray(values); }
  static fromArray(values) {
    let list = ConsList.empty;
    for (let i = values.length - 1; i >= 0; i--) list = list.prepend(values[i]);
    return list;
  }
  static fromIterable(iterable) { return ConsList.fromArray(Array.from(iterable)); }
  static merge(...lists) {
    const count = lists.length;
    if (count === 0) return ConsList.empty;
    let result = lists[count - 1];
    for (let i = count - 2; i >= 0; i--) {
      const list = lists[i];
      if (list.isEmpty()) continue;
      if (result.isEmpty()) { result = list; continue; }
      const size = list.#size;
      const values = new Array(size);
      let current = list;
      for (let j = 0; j < size; j++) { values[j] = current.#value; current = current.#next; }
      for (let j = size - 1; j >= 0; j--) result = result.prepend(values[j]);
    }
    return result;
  }
  get value() { return this.#value; }
  get tail() { return this.#next === null ? ConsList.empty : this.#next; }
  get size() { return this.#size; }
  isEmpty() { return this.#size === 0; }
  prepend(value = undefined) {
    const next = this.isEmpty() ? null : this;
    return new ConsList(value, next, this.#size + 1);
  }
  uncons() {
    return { value: this.#value, tail: this.#next === null ? ConsList.empty : this.#next };
  }
  [Symbol.iterator]() {
    let current = this;
    return {
      next: () => {
        if (current === null || current.isEmpty()) return { done: true, value: undefined };
        const value = current.#value;
        current = current.#next;
        return { done: false, value };
      },
      [Symbol.iterator]() { return this; },
    };
  }
}
const cons = (value, tail = ConsList.empty) => tail.prepend(value);
const uncons = (list) => list.uncons();
const runChain = async (list, ctx) => {
  for (const fn of list) {
    if (!ctx || ctx.halted) return;
    if (typeof fn !== 'function') continue;
    await fn(ctx);
  }
};
module.exports = { ConsList, cons, uncons, runChain };
