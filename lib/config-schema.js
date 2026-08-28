'use strict';

const configSchema = {
  type: 'object',
  required: ['server', 'sessions'],
  properties: {
    server: {
      type: 'object',
      required: ['ports'],
      properties: {
        ports: {
          type: 'array',
          minItems: 1,
          items: { type: 'integer', minimum: 1, maximum: 65535 },
        },
        cors: { type: 'object' },
        tls: { type: 'object' },
        queue: { type: 'object' },
        timeouts: { type: 'object' },
      },
    },
    sessions: {
      type: 'object',
      required: ['secret'],
      properties: {
        enabled: { type: 'boolean' },
        secret: { type: 'string', minLength: 32 },
        accessTtl: { type: 'integer' },
        refreshTtl: { type: 'integer' },
      },
    },
    database: { type: 'object' },
    log: { type: 'object' },
  },
};

module.exports = { configSchema };
