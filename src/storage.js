'use strict';

const { Database } = require('metasql');

const options = {
  host: '127.0.0.1',
  port: 5432,
  database: 'upsell',
  user: 'marcus',
  password: 'marcus',
  console: null,
  model: null,
};

const db = new Database(options);

class Storage extends Map {
  async set(token, data) {
    const { expires, userid } = data;

    try {
      const record = {
        userid,
        token,
        expires,
        data: JSON.stringify(data),
      };

      await db.insert('session', { token, expires, data });
      const sessionToken = await this.get(token);
      delete sessionToken.userid;
      super.set(token, record);
      return await sessionToken;
    } catch (error) {
      console.log({ error });
      throw new Error(error);
    }
  }

  async get(token) {
    const session = super.get(token);
    if (session) return session;
    try {
      const sessionDb = await db.select('session', ['*'], { token });
      super.set(token, sessionDb);
      return sessionDb[0];
    } catch (error) {
      console.log({ error });
      throw new Error(error);
    }
  }
  async delete(token) {
    try {
      await db.delete('session', { token });
      return true;
    } catch (error) {
      console.log({ error });
      throw new Error(error);
    }
  }
}

module.exports = new Storage();
