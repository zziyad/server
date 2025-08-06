# Refactored NodeJS Application Architecture

## 🚀 Overview

This project has been refactored from a monolithic `main.js` into a modular, maintainable, and production-ready application architecture. The new design provides better separation of concerns, comprehensive error handling, health monitoring, and graceful shutdown capabilities.

## 🏗️ Architecture

### Before vs After

**Before (Monolithic):**
```javascript
// 56 lines of mixed concerns in main.js
(async () => {
  const applications = await node.fsp.readFile('.applications', 'utf8');
  // ... all bootstrap logic mixed together
})();
```

**After (Modular):**
```javascript
// Clean, maintainable main.js
const app = new Application({
  enableHealthChecks: true,
  enableGracefulShutdown: true,
});

await app.start();
```

## 📁 New Structure

```
src/
├── application.js           # Main application orchestrator
├── applicationBootstrap.js  # Bootstrap process management
├── applicationState.js      # Centralized state management
├── errorHandler.js          # Error handling and recovery
├── dependencies.js          # Dependency management
├── loader.js               # Module loading system
├── server.js               # HTTP/WebSocket server
├── transport.js            # Transport layer
├── static.js               # Static file serving
├── code.js                 # Code module management
└── place.js                # Base place class

docs/
├── REFACTORING_GUIDE.md    # Comprehensive refactoring guide
└── QUICK_START.md          # Quick start guide
```

## 🎯 Key Components

### 1. Application Class
**Purpose**: Main orchestrator for application lifecycle
- Application lifecycle management (start, stop, restart)
- Health monitoring with configurable checks
- Error handling and recovery
- Graceful shutdown handling

### 2. ApplicationBootstrap Class
**Purpose**: Handles the complete bootstrap process
- VM sandbox creation and initialization
- Module loading (config, lib, domain)
- API routing setup
- Server and static file initialization
- Startup function execution

### 3. ApplicationState Class
**Purpose**: Centralized state management
- Application lifecycle state tracking
- Module registry management
- Error tracking and categorization
- Performance metrics collection
- Health status management

### 4. BootstrapErrorHandler Class
**Purpose**: Robust error handling and recovery
- Retry logic with exponential backoff
- Graceful shutdown handling
- Error categorization and logging
- Recovery strategy creation

## 🚀 Quick Start

### Basic Usage

```javascript
// main.js
const { Application } = require('./src/application.js');

const app = new Application({
  enableHealthChecks: true,
  enableGracefulShutdown: true,
});

app.start().catch(console.error);
```

### Check Application Status

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

## 🔧 Features

### Health Monitoring
- **Built-in Health Checks**: Application, memory, and module health
- **Custom Health Checks**: Easy to add application-specific checks
- **Health Status Tracking**: Real-time health status monitoring
- **Configurable Intervals**: Adjustable health check frequency

### Error Handling
- **Retry Logic**: Exponential backoff for failed operations
- **Error Categorization**: Automatic error classification
- **Recovery Strategies**: Intelligent recovery based on error type
- **Error Tracking**: Comprehensive error logging and statistics

### Graceful Shutdown
- **Signal Handling**: Responds to SIGTERM, SIGINT
- **Resource Cleanup**: Properly closes servers, watchers, and connections
- **Cleanup Functions**: Executes module cleanup functions
- **Database Connections**: Graceful database connection closure

### Performance Monitoring
- **Memory Usage**: Real-time memory monitoring
- **Request Tracking**: Request and error rate monitoring
- **Module Statistics**: Module loading and health statistics
- **Uptime Tracking**: Application uptime and performance metrics

## 📊 Monitoring

### Health Checks
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
```

### Metrics
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

### Status
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

## 🔄 Error Handling

### Retry with Backoff
```javascript
const { BootstrapErrorHandler } = require('./src/errorHandler.js');

const result = await BootstrapErrorHandler.withRetry(
  async () => {
    return await riskyOperation();
  },
  {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
  }
);
```

### Error Categorization
Errors are automatically categorized:
- **Bootstrap**: Critical startup errors
- **Network**: Connection issues
- **Database**: Database-related errors
- **Validation**: Input validation errors
- **Authentication**: Auth-related errors
- **Authorization**: Permission errors
- **Resource**: File/resource errors

## ⚙️ Configuration

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

## 🧪 Testing

### Unit Testing
Each component can be tested independently:
```javascript
const { ApplicationState } = require('./src/applicationState.js');

describe('ApplicationState', () => {
  let state;

  beforeEach(() => {
    state = new ApplicationState();
  });

  test('should track modules', () => {
    const module = { name: 'test' };
    state.addModule('test', module);
    expect(state.getModule('test')).toBe(module);
  });
});
```

### Integration Testing
```javascript
const { Application } = require('./src/application.js');

describe('Application', () => {
  let app;

  beforeEach(() => {
    app = new Application({
      enableHealthChecks: false,
      enableGracefulShutdown: false,
    });
  });

  test('should start successfully', async () => {
    await expect(app.start()).resolves.not.toThrow();
  });
});
```

## 📈 Performance Improvements

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

## 🔍 Troubleshooting

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
```javascript
const app = new Application({
  enableHealthChecks: true,
  enableGracefulShutdown: true,
  debug: true, // Enable debug logging
});
```

## 🚀 Benefits

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

## 📚 Documentation

- **[Refactoring Guide](docs/REFACTORING_GUIDE.md)**: Comprehensive guide to the refactored architecture
- **[Quick Start Guide](docs/QUICK_START.md)**: Quick start guide with examples
- **[API Documentation](docs/API.md)**: Detailed API documentation

## 🔮 Future Enhancements

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

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Metarhia Framework**: For the original application framework
- **Node.js Community**: For the excellent ecosystem and tools
- **Open Source Contributors**: For inspiration and best practices

---

**The refactored architecture transforms the application from a monolithic script into a robust, enterprise-ready system that can handle production workloads with confidence.** 