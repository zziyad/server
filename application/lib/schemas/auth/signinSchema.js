// =============================================================================
// AUTH SIGNIN SCHEMA - JSON Schema
// =============================================================================

async () => ({
  type: 'object',
  additionalProperties: false,
  properties: {
    email: { type: 'string', minLength: 1, maxLength: 255, description: 'Email or username' },
    password: { type: 'string', minLength: 1, maxLength: 128 },
  },
  required: ['email', 'password'],
});
