const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { createServer } = require('http');
const { Server } = require('socket.io');
const Redis = require('ioredis');
const winston = require('winston');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const cluster = require('cluster');
const os = require('os');
require('dotenv').config();

// Import service modules
const StorageService = require('./services/storage');
const MessageQueueService = require('./services/messageQueue');
const MonitoringService = require('./services/monitoring');
const OrchestrationService = require('./services/orchestration');
const SecurityService = require('./services/security');
const AnalyticsService = require('./services/analytics');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  },
  adapter: require('socket.io-redis')({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
  })
});

// Initialize Redis
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3
});

// Configure logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'cloud-service' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // allow 50 requests per 15 minutes, then...
  delayMs: 500 // begin adding 500ms of delay per request above 50
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(limiter);
app.use(speedLimiter);

// Initialize services
const storageService = new StorageService(redis, logger);
const messageQueueService = new MessageQueueService(redis, logger);
const monitoringService = new MonitoringService(logger);
const orchestrationService = new OrchestrationService(redis, logger);
const securityService = new SecurityService(logger);
const analyticsService = new AnalyticsService(redis, logger);

// Health check
app.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      service: 'Cloud Infrastructure Service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      services: {
        redis: await redis.ping() === 'PONG',
        storage: await storageService.healthCheck(),
        messageQueue: await messageQueueService.healthCheck(),
        monitoring: await monitoringService.healthCheck(),
        orchestration: await orchestrationService.healthCheck()
      }
    };
    
    res.json(health);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});

// Storage Routes
app.post('/api/storage/upload', async (req, res) => {
  try {
    const { file, metadata, bucket } = req.body;
    const result = await storageService.uploadFile(file, metadata, bucket);
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Upload failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/storage/download/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { bucket } = req.query;
    const file = await storageService.downloadFile(fileId, bucket);
    
    res.json({
      success: true,
      data: file,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Download failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/storage/delete/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { bucket } = req.query;
    await storageService.deleteFile(fileId, bucket);
    
    res.json({
      success: true,
      message: 'File deleted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Delete failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Message Queue Routes
app.post('/api/queue/publish', async (req, res) => {
  try {
    const { topic, message, priority = 'normal' } = req.body;
    const result = await messageQueueService.publish(topic, message, priority);
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Publish failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/queue/subscribe', async (req, res) => {
  try {
    const { topic, callback } = req.body;
    const subscription = await messageQueueService.subscribe(topic, callback);
    
    res.json({
      success: true,
      data: subscription,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Subscribe failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Monitoring Routes
app.get('/api/monitoring/metrics', async (req, res) => {
  try {
    const metrics = await monitoringService.getMetrics();
    
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Metrics failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/monitoring/alert', async (req, res) => {
  try {
    const { alert } = req.body;
    await monitoringService.createAlert(alert);
    
    res.json({
      success: true,
      message: 'Alert created successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Alert creation failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Orchestration Routes
app.post('/api/orchestration/deploy', async (req, res) => {
  try {
    const { service, config } = req.body;
    const deployment = await orchestrationService.deployService(service, config);
    
    res.json({
      success: true,
      data: deployment,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Deployment failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/orchestration/services', async (req, res) => {
  try {
    const services = await orchestrationService.getServices();
    
    res.json({
      success: true,
      data: services,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Services fetch failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Security Routes
app.post('/api/security/encrypt', async (req, res) => {
  try {
    const { data, algorithm = 'aes-256-gcm' } = req.body;
    const encrypted = await securityService.encrypt(data, algorithm);
    
    res.json({
      success: true,
      data: encrypted,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Encryption failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/security/decrypt', async (req, res) => {
  try {
    const { data, key, algorithm = 'aes-256-gcm' } = req.body;
    const decrypted = await securityService.decrypt(data, key, algorithm);
    
    res.json({
      success: true,
      data: decrypted,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Decryption failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Analytics Routes
app.post('/api/analytics/track', async (req, res) => {
  try {
    const { event, data, userId } = req.body;
    await analyticsService.trackEvent(event, data, userId);
    
    res.json({
      success: true,
      message: 'Event tracked successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Event tracking failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/analytics/reports', async (req, res) => {
  try {
    const { type, timeframe, filters } = req.query;
    const reports = await analyticsService.generateReports(type, timeframe, filters);
    
    res.json({
      success: true,
      data: reports,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Reports generation failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// WebSocket for real-time cloud operations
io.on('connection', (socket) => {
  logger.info('Cloud client connected:', socket.id);

  // Handle real-time storage operations
  socket.on('storage-operation', async (data) => {
    try {
      const { operation, params } = data;
      let result;

      switch (operation) {
        case 'upload':
          result = await storageService.uploadFile(params.file, params.metadata, params.bucket);
          break;
        case 'download':
          result = await storageService.downloadFile(params.fileId, params.bucket);
          break;
        case 'delete':
          result = await storageService.deleteFile(params.fileId, params.bucket);
          break;
        default:
          result = { error: 'Unknown operation' };
      }

      socket.emit('storage-response', { operation, data: result });
    } catch (error) {
      socket.emit('storage-error', { error: error.message });
    }
  });

  // Handle real-time monitoring
  socket.on('monitoring-request', async (data) => {
    try {
      const { type } = data;
      let result;

      switch (type) {
        case 'metrics':
          result = await monitoringService.getMetrics();
          break;
        case 'alerts':
          result = await monitoringService.getAlerts();
          break;
        case 'logs':
          result = await monitoringService.getLogs();
          break;
        default:
          result = { error: 'Unknown monitoring type' };
      }

      socket.emit('monitoring-response', { type, data: result });
    } catch (error) {
      socket.emit('monitoring-error', { error: error.message });
    }
  });

  // Handle real-time orchestration
  socket.on('orchestration-command', async (data) => {
    try {
      const { command, params } = data;
      let result;

      switch (command) {
        case 'deploy':
          result = await orchestrationService.deployService(params.service, params.config);
          break;
        case 'scale':
          result = await orchestrationService.scaleService(params.service, params.replicas);
          break;
        case 'restart':
          result = await orchestrationService.restartService(params.service);
          break;
        default:
          result = { error: 'Unknown command' };
      }

      socket.emit('orchestration-response', { command, data: result });
    } catch (error) {
      socket.emit('orchestration-error', { error: error.message });
    }
  });

  // Real-time analytics streaming
  socket.on('analytics-stream', async (data) => {
    try {
      const { streamType, filters } = data;
      const stream = await analyticsService.createStream(streamType, filters);
      
      socket.emit('analytics-stream-started', { streamId: stream.id });
      
      stream.on('data', (data) => {
        socket.emit('analytics-data', data);
      });
    } catch (error) {
      socket.emit('analytics-error', { error: error.message });
    }
  });

  socket.on('disconnect', () => {
    logger.info('Cloud client disconnected:', socket.id);
  });
});

// Background tasks
const backgroundTasks = {
  // Cleanup old files
  async cleanupOldFiles() {
    try {
      await storageService.cleanupOldFiles();
      logger.info('Old files cleanup completed');
    } catch (error) {
      logger.error('Cleanup failed:', error);
    }
  },

  // Update metrics
  async updateMetrics() {
    try {
      await monitoringService.updateMetrics();
      logger.info('Metrics updated');
    } catch (error) {
      logger.error('Metrics update failed:', error);
    }
  },

  // Health check services
  async healthCheckServices() {
    try {
      await orchestrationService.healthCheckAll();
      logger.info('Service health check completed');
    } catch (error) {
      logger.error('Health check failed:', error);
    }
  }
};

// Schedule background tasks
const cron = require('node-cron');

// Cleanup every 6 hours
cron.schedule('0 */6 * * *', backgroundTasks.cleanupOldFiles);

// Update metrics every 5 minutes
cron.schedule('*/5 * * * *', backgroundTasks.updateMetrics);

// Health check every 10 minutes
cron.schedule('*/10 * * * *', backgroundTasks.healthCheckServices);

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  // Close Redis connection
  await redis.quit();
  
  // Close server
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  // Close Redis connection
  await redis.quit();
  
  // Close server
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Error handling
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

const PORT = process.env.PORT || 3004;

// Cluster mode for production
if (cluster.isMaster && process.env.NODE_ENV === 'production') {
  const numCPUs = os.cpus().length;
  
  logger.info(`Master ${process.pid} is running`);
  logger.info(`Starting ${numCPUs} workers`);

  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    logger.info(`Worker ${worker.process.pid} died`);
    // Replace the dead worker
    cluster.fork();
  });
} else {
  server.listen(PORT, () => {
    logger.info(`☁️ Cloud Infrastructure Service running on port ${PORT}`);
    logger.info(`🔧 Worker ${process.pid} started`);
    logger.info(`📊 Monitoring: ${process.env.MONITORING_ENABLED || 'enabled'}`);
    logger.info(`🔐 Security: ${process.env.SECURITY_ENABLED || 'enabled'}`);
    logger.info(`📈 Analytics: ${process.env.ANALYTICS_ENABLED || 'enabled'}`);
  });
}

module.exports = app; 