({
  host: node.process.env.DB_HOST || '127.0.0.1',
  port: parseInt(node.process.env.DB_PORT || '5432', 10),
  database: node.process.env.DB_NAME || 'index_search',
  user: node.process.env.DB_USER || 'index_search',
  password: node.process.env.DB_PASSWORD || 'index_search_dev',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
