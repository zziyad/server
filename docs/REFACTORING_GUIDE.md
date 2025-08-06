# Application Refactoring Guide

## Overview

This document describes the refactored application architecture that transforms the monolithic `main.js` into a modular, maintainable, and robust system.

## Architecture Changes

### Before (Monolithic)
```javascript
// main.js - Before
(async () => {
  // 56 lines of mixed concerns
  const applications = await node.fsp.readFile('.applications', 'utf8');
  // ... all bootstrap logic in one place
})();
```

### After (Modular)
```javascript
// main.js - After
const app = new Application({
  enableHealthChecks: true,
  enableGracefulShutdown: true,
});

await app.start();
```

## New Architecture Components

### 1. Application Class (`src/application.js`)

**Purpose**: Main orchestrator for application lifecycle

**Key Features**:
- Application lifecycle management (start, stop, restart)
- Health monitoring with configurable checks
- Error handling and recovery
- Graceful shutdown handling

**Usage**:
```javascript
const { Application } = require('./src/application.js');

const app = new Application({
  enableHealthChecks: true,
  enableGracefulShutdown: true,
  healthCheckInterval: 30000,
});

await app.start();
```

### 2. ApplicationBootstrap Class (`src/applicationBootstrap.js`)

**Purpose**: Handles the complete bootstrap process

**Key Features**:
- VM sandbox creation and initialization
- Module loading (config, lib, domain)
- API routing setup
- Server and static file initialization
- Startup function execution

**Responsibilities**:
- `createSandbox()` - Creates VM context
- `loadApplicationPath()` - Loads app path from `.applications`
- `initializeModules()` - Sets up modules and routing
- `loadCodeModules()` - Loads config, lib, domain in parallel
- `setupApplicationContext()` - Configures application context
- `initializeServices()` - Sets up server and static files
- `executeStarts()` - Runs startup functions

### 3. ApplicationState Class (`src/applicationState.js`)

**Purpose**: Centralized state management

**Key Features**:
- Application lifecycle state tracking
- Module registry management
- Error tracking and categorization
- Performance metrics collection
- Health status management

**Usage**:
```javascript
const state = new ApplicationState();

// Track modules
state.addModule('config', configModule);
state.getModule('config');

// Track errors
state.addError(error);
state.getRecentErrors(10);

// Get metrics
const metrics = state.getMetrics();
const health = state.getHealthStatus();
```

### 4. BootstrapErrorHandler Class (`src/errorHandler.js`)

**Purpose**: Robust error handling and recovery

**Key Features**:
- Retry logic with exponential backoff
- Graceful shutdown handling
- Error categorization and logging
- Recovery strategy creation

**Usage**:
```javascript
// Retry with backoff
await BootstrapErrorHandler.withRetry(
  () => riskyOperation(),
  { maxRetries: 3, baseDelay: 1000 }
);

// Graceful shutdown
BootstrapErrorHandler.handleGracefulShutdown(app, state);

// Error categorization
const { category, severity } = BootstrapErrorHandler.categorizeError(error);
```

## Benefits of the New Architecture

### 1. Separation of Concerns
- **Before**: All logic mixed in one file
- **After**: Each class has a single responsibility

### 2. Testability
- **Before**: Hard to test individual components
- **After**: Each class can be unit tested independently

### 3. Error Handling
- **Before**: Basic try-catch with no recovery
- **After**: Comprehensive error handling with retry logic

### 4. Monitoring
- **Before**: No health monitoring
- **After**: Built-in health checks and metrics

### 5. Maintainability
- **Before**: Hard to modify without affecting everything
- **After**: Modular design allows isolated changes

## Health Monitoring

The new architecture includes comprehensive health monitoring:

### Built-in Health Checks
1. **Application Health**: Checks if app is bootstrapped and running
2. **Memory Health**: Monitors memory usage (unhealthy if >90%)
3. **Module Health**: Verifies all modules are loaded

### Custom Health Checks
```javascript
// Add custom health check
state.addHealthCheck('database', async () => {
  try {
    await db.ping();
    return { healthy: true };
  } catch (error) {
    return { healthy: false, error: error.message };
  }
});
```

### Health Check Results
```javascript
const health = await state.runHealthChecks();
// Returns:
// {
//   application: { healthy: true, details: {...} },
//   memory: { healthy: true, details: {...} },
//   modules: { healthy: true, details: {...} }
// }
```

## Error Handling Improvements

### Error Categorization
Errors are automatically categorized:
- **Bootstrap**: Critical startup errors
- **Network**: Connection issues
- **Database**: Database-related errors
- **Validation**: Input validation errors
- **Authentication**: Auth-related errors
- **Authorization**: Permission errors
- **Resource**: File/resource errors

### Recovery Strategies
```javascript
const strategy = BootstrapErrorHandler.createRecoveryStrategy(error);
// Returns appropriate retry/recovery strategy based on error type
```

### Retry Logic
```javascript
await BootstrapErrorHandler.withRetry(
  () => databaseOperation(),
  {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
  }
);
```

## Graceful Shutdown

The new architecture ensures graceful shutdown:

1. **Signal Handling**: Responds to SIGTERM, SIGINT
2. **Server Closure**: Properly closes HTTP server
3. **File Watcher**: Closes file watcher
4. **Database Connections**: Closes DB connections
5. **Cleanup Functions**: Executes module cleanup functions

## Configuration Options

### Application Options
```javascript
const app = new Application({
  enableHealthChecks: true,        // Enable health monitoring
  enableGracefulShutdown: true,    // Enable graceful shutdown
  healthCheckInterval: 30000,      // Health check interval (ms)
});
```

### Bootstrap Options
```javascript
await BootstrapErrorHandler.withRetry(
  () => bootstrap(),
  {
    maxRetries: 3,        // Maximum retry attempts
    baseDelay: 2000,      // Base delay between retries
    maxDelay: 10000,      // Maximum delay between retries
  }
);
```

## Migration Guide

### Step 1: Update Dependencies
Ensure all new modules are available:
```javascript
const { Application } = require('./src/application.js');
const { ApplicationState } = require('./src/applicationState.js');
const { BootstrapErrorHandler } = require('./src/errorHandler.js');
```

### Step 2: Replace main.js
Replace the entire content of `main.js` with the new modular version.

### Step 3: Test Application
Run the application and verify:
- Application starts successfully
- Health checks are working
- Graceful shutdown works
- Error handling functions properly

### Step 4: Add Custom Health Checks (Optional)
Add application-specific health checks:
```javascript
// In your application code
app.state.addHealthCheck('custom', async () => {
  // Your custom health check logic
  return { healthy: true };
});
```

## Performance Improvements

### Parallel Module Loading
Modules are now loaded in parallel instead of sequentially:
```javascript
// Before: Sequential loading
await lib.load();
await domain.load();
await config.load();

// After: Parallel loading
await Promise.all([
  lib.load(),
  domain.load(),
  config.load(),
]);
```

### Memory Management
- Automatic cleanup of old errors (keeps last 100)
- Memory usage monitoring
- Graceful resource cleanup

## Monitoring and Observability

### Metrics Available
```javascript
const metrics = app.getMetrics();
// {
//   requests: 0,
//   errors: 0,
//   startupTime: 1234,
//   uptime: 56789,
//   memoryUsage: { rss: ..., heapUsed: ..., heapTotal: ... },
//   moduleCount: 5,
//   errorCount: 2
// }
```

### Status Information
```javascript
const status = app.getStatus();
// {
//   running: true,
//   bootstrapped: true,
//   health: { status: 'healthy', uptime: 56789, modules: [...] },
//   metrics: {...},
//   recentErrors: [...]
// }
```

## Best Practices

### 1. Error Handling
- Always use `BootstrapErrorHandler.withRetry()` for risky operations
- Log errors with context using `BootstrapErrorHandler.logError()`
- Categorize errors appropriately

### 2. Health Checks
- Add health checks for critical dependencies
- Monitor memory usage
- Set appropriate thresholds

### 3. Graceful Shutdown
- Always implement cleanup functions in modules
- Close database connections properly
- Handle uncaught exceptions

### 4. Monitoring
- Regularly check application status
- Monitor error rates
- Track performance metrics

## Troubleshooting

### Common Issues

1. **Application won't start**
   - Check `.applications` file exists
   - Verify application path is correct
   - Check for missing dependencies

2. **Health checks failing**
   - Review health check implementations
   - Check system resources
   - Verify module loading

3. **Graceful shutdown not working**
   - Ensure cleanup functions are implemented
   - Check signal handlers
   - Verify resource cleanup

### Debug Mode
Enable debug logging:
```javascript
const app = new Application({
  enableHealthChecks: true,
  enableGracefulShutdown: true,
  debug: true, // Enable debug logging
});
```

## Future Enhancements

### Planned Improvements
1. **TypeScript Migration**: Add full TypeScript support
2. **Configuration Management**: Centralized configuration system
3. **Plugin System**: Modular plugin architecture
4. **Advanced Monitoring**: Integration with external monitoring tools
5. **Performance Profiling**: Built-in performance profiling

### Extension Points
The modular architecture makes it easy to extend:
- Add new health check types
- Implement custom error handlers
- Create specialized bootstrap strategies
- Add monitoring integrations

## Conclusion

The refactored architecture provides:
- **Better Maintainability**: Clear separation of concerns
- **Improved Reliability**: Comprehensive error handling
- **Enhanced Monitoring**: Built-in health checks and metrics
- **Easier Testing**: Modular, testable components
- **Production Ready**: Graceful shutdown and recovery

This new architecture transforms the application from a monolithic script into a robust, enterprise-ready system that can handle production workloads with confidence. 