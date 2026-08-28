const parseList = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const defaultAllowedOrigins = [
  'http://127.0.0.1:8091',
  'http://localhost:8091',
];
const envAllowedOrigins = parseList(node.process.env.CORS_ALLOWED_ORIGINS);
const publicOrigin = String(node.process.env.PUBLIC_ORIGIN || '').trim();

({
  host: node.process.env.HOST || '127.0.0.1',
  protocol: 'http',
  ports: [parseInt(node.process.env.PORT || '8091', 10)],
  nagle: false,
  timeouts: {
    bind: 2000,
    start: 15000,
    stop: 5000,
    request: 5000,
    watch: 1000,
  },
  queue: {
    concurrency: 1000,
    size: 2000,
    timeout: 3000,
  },
  tls: {
    enabled: false,
  },
  cors: {
    allowLocalhostLoopback: true,
    allowedOrigins: [
      ...defaultAllowedOrigins,
      ...(publicOrigin ? [publicOrigin] : []),
      ...envAllowedOrigins,
    ],
    allowCredentials: true,
    maxAge: 86400,
  },
});
