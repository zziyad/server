# Quick Start Guide

## Getting Started with the Refactored Application

This guide will help you quickly understand and use the new modular application architecture.

## Basic Usage

### 1. Start the Application

```javascript
// main.js
const { Application } = require('./src/application.js');

const app = new Application({
  enableHealthChecks: true,
  enableGracefulShutdown: true,
});

app.start().catch(console.error);
```

### 2. Check Application Status

```javascript
// Get overall status
const status = app.getStatus();
console.log('Status:', status);

// Get health status
const health = app.getHealthStatus();
console.log('Health:', health);

// Get metrics
const metrics = app.getMetrics();
console.log('Metrics:', metrics);
```

### 3. Handle Errors

```javascript
// Get recent errors
const errors = app.getRecentErrors(5);
console.log('Recent errors:', errors);

// Check if application is healthy
const isHealthy = health.status === 'healthy';
```

## Advanced Usage

### Custom Health Checks

```javascript
// Add custom health check
app.state.addHealthCheck('database', async () => {
  try {
    await db.ping();
    return { healthy: true };
  } catch (error) {
    return { healthy: false, error: error.message };
  }
});

// Add custom health check with details
app.state.addHealthCheck('external-api', async () => {
  try {
    const response = await fetch('https://api.example.com/health');
    const isHealthy = response.ok;
    
    return {
      healthy: isHealthy,
      details: {
        statusCode: response.status,
        responseTime: Date.now() - startTime,
      },
    };
  } catch (error) {
    return { healthy: false, error: error.message };
  }
});
```

### Error Handling with Retry

```javascript
const { BootstrapErrorHandler } = require('./src/errorHandler.js');

// Retry risky operations
const result = await BootstrapErrorHandler.withRetry(
  async () => {
    return await riskyDatabaseOperation();
  },
  {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
  }
);
```

### Graceful Shutdown

```javascript
// The application automatically handles graceful shutdown
// But you can also trigger it manually
await app.stop();

// Or restart
await app.restart();
```

## Monitoring Examples

### Basic Monitoring

```javascript
// Monitor application health
setInterval(() => {
  const health = app.getHealthStatus();
  if (health.status !== 'healthy') {
    console.warn('Application health degraded:', health);
  }
}, 60000); // Check every minute
```

### Advanced Monitoring

```javascript
// Comprehensive monitoring
class ApplicationMonitor {
  constructor(app) {
    this.app = app;
    this.lastMetrics = null;
  }

  start() {
    setInterval(() => this.checkHealth(), 30000);
    setInterval(() => this.checkMetrics(), 60000);
  }

  async checkHealth() {
    const health = await this.app.state.runHealthChecks();
    const unhealthy = Object.entries(health)
      .filter(([name, result]) => !result.healthy);
    
    if (unhealthy.length > 0) {
      console.error('Unhealthy checks:', unhealthy);
    }
  }

  checkMetrics() {
    const metrics = this.app.getMetrics();
    
    if (this.lastMetrics) {
      const requestRate = (metrics.requests - this.lastMetrics.requests) / 60;
      const errorRate = (metrics.errors - this.lastMetrics.errors) / 60;
      
      console.log(`Request rate: ${requestRate}/s, Error rate: ${errorRate}/s`);
    }
    
    this.lastMetrics = metrics;
  }
}

// Usage
const monitor = new ApplicationMonitor(app);
monitor.start();
```

## Configuration Examples

### Development Configuration

```javascript
const app = new Application({
  enableHealthChecks: true,
  enableGracefulShutdown: true,
  healthCheckInterval: 30000,
  debug: true, // Enable debug logging
});
```

### Production Configuration

```javascript
const app = new Application({
  enableHealthChecks: true,
  enableGracefulShutdown: true,
  healthCheckInterval: 60000, // Less frequent checks
  debug: false, // Disable debug logging
});
```

### Testing Configuration

```javascript
const app = new Application({
  enableHealthChecks: false, // Disable for testing
  enableGracefulShutdown: false, // Disable for testing
});
```

## Common Patterns

### Module Access

```javascript
// Get a specific module
const config = app.getModule('config');
const lib = app.getModule('lib');
const domain = app.getModule('domain');

// Check if module is loaded
if (app.hasModule('database')) {
  const db = app.getModule('database');
  // Use database module
}
```

### Error Tracking

```javascript
// Track custom errors
try {
  await riskyOperation();
} catch (error) {
  app.state.addError(error);
  console.error('Operation failed:', error.message);
}

// Get error statistics
const errors = app.state.getErrors();
const recentErrors = app.state.getRecentErrors(10);
```

### Performance Monitoring

```javascript
// Monitor memory usage
setInterval(() => {
  const metrics = app.getMetrics();
  const memoryUsage = metrics.memoryUsage;
  
  if (memoryUsage.heapUsed > 100 * 1024 * 1024) { // 100MB
    console.warn('High memory usage:', memoryUsage);
  }
}, 30000);
```

## Troubleshooting

### Application Won't Start

```javascript
// Check if all required files exist
const fs = require('fs');
const path = require('path');

const requiredFiles = [
  '.applications',
  'application/api',
  'application/config',
  'application/lib',
  'application/domain',
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    console.error(`Missing required file: ${file}`);
  }
}
```

### Health Checks Failing

```javascript
// Debug health checks
const health = await app.state.runHealthChecks();
console.log('Health check results:', JSON.stringify(health, null, 2));

// Check specific health check
const appHealth = await app.checkApplicationHealth();
console.log('Application health:', appHealth);
```

### Memory Issues

```javascript
// Monitor memory usage
const metrics = app.getMetrics();
const memory = metrics.memoryUsage;

console.log('Memory usage:');
console.log(`  RSS: ${(memory.rss / 1024 / 1024).toFixed(2)} MB`);
console.log(`  Heap Used: ${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
console.log(`  Heap Total: ${(memory.heapTotal / 1024 / 1024).toFixed(2)} MB`);
```

## Best Practices

### 1. Always Handle Errors

```javascript
app.start().catch(error => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
```

### 2. Monitor Application Health

```javascript
// Regular health monitoring
setInterval(async () => {
  const health = app.getHealthStatus();
  if (health.status !== 'healthy') {
    // Alert or log the issue
    console.warn('Application health issue:', health);
  }
}, 60000);
```

### 3. Use Graceful Shutdown

```javascript
// The application handles this automatically
// But you can also add custom cleanup
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down...');
  await app.stop();
  process.exit(0);
});
```

### 4. Track Important Metrics

```javascript
// Track application metrics
setInterval(() => {
  const metrics = app.getMetrics();
  console.log('Application metrics:', {
    uptime: metrics.uptime,
    requests: metrics.requests,
    errors: metrics.errors,
    memoryUsage: metrics.memoryUsage.heapUsed,
  });
}, 300000); // Every 5 minutes
```

This quick start guide covers the essential usage patterns for the refactored application architecture. The modular design makes it easy to extend and customize based on your specific needs. 