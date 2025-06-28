const winston = require('winston');
const { createLogger, format, transports } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const { register, Counter, Histogram, Gauge } = require('prometheus-client');
const os = require('os');
const process = require('process');

class MonitoringService {
  constructor(logger) {
    this.logger = logger;
    this.metrics = {};
    this.alerts = [];
    this.alertHandlers = new Map();
    this.initializeMetrics();
    this.initializeLogging();
    this.startMetricsCollection();
  }

  initializeMetrics() {
    try {
      // System metrics
      this.metrics.cpuUsage = new Gauge({
        name: 'system_cpu_usage_percent',
        help: 'CPU usage percentage',
        labelNames: ['core']
      });

      this.metrics.memoryUsage = new Gauge({
        name: 'system_memory_usage_bytes',
        help: 'Memory usage in bytes',
        labelNames: ['type']
      });

      this.metrics.diskUsage = new Gauge({
        name: 'system_disk_usage_bytes',
        help: 'Disk usage in bytes',
        labelNames: ['mount', 'type']
      });

      this.metrics.networkTraffic = new Counter({
        name: 'system_network_traffic_bytes',
        help: 'Network traffic in bytes',
        labelNames: ['interface', 'direction']
      });

      // Application metrics
      this.metrics.httpRequests = new Counter({
        name: 'http_requests_total',
        help: 'Total HTTP requests',
        labelNames: ['method', 'endpoint', 'status_code']
      });

      this.metrics.httpRequestDuration = new Histogram({
        name: 'http_request_duration_seconds',
        help: 'HTTP request duration in seconds',
        labelNames: ['method', 'endpoint'],
        buckets: [0.1, 0.5, 1, 2, 5, 10]
      });

      this.metrics.activeConnections = new Gauge({
        name: 'active_connections',
        help: 'Number of active connections',
        labelNames: ['type']
      });

      this.metrics.errorRate = new Counter({
        name: 'errors_total',
        help: 'Total number of errors',
        labelNames: ['service', 'type']
      });

      this.metrics.queueSize = new Gauge({
        name: 'queue_size',
        help: 'Current queue size',
        labelNames: ['queue_name']
      });

      this.metrics.storageUsage = new Gauge({
        name: 'storage_usage_bytes',
        help: 'Storage usage in bytes',
        labelNames: ['provider', 'bucket']
      });

      // Business metrics
      this.metrics.userActions = new Counter({
        name: 'user_actions_total',
        help: 'Total user actions',
        labelNames: ['action', 'user_type']
      });

      this.metrics.transactionVolume = new Counter({
        name: 'transaction_volume_total',
        help: 'Total transaction volume',
        labelNames: ['currency', 'type']
      });

      this.metrics.gameEvents = new Counter({
        name: 'game_events_total',
        help: 'Total game events',
        labelNames: ['event_type', 'player_type']
      });

      this.logger.info('Metrics initialized successfully');

    } catch (error) {
      this.logger.error('Metrics initialization failed:', error);
    }
  }

  initializeLogging() {
    try {
      // Create a custom logger for monitoring
      this.monitoringLogger = createLogger({
        level: 'info',
        format: format.combine(
          format.timestamp(),
          format.errors({ stack: true }),
          format.json()
        ),
        defaultMeta: { service: 'monitoring' },
        transports: [
          new DailyRotateFile({
            filename: 'logs/monitoring-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d'
          }),
          new transports.Console({
            format: format.simple()
          })
        ]
      });

      this.logger.info('Monitoring logging initialized');

    } catch (error) {
      this.logger.error('Monitoring logging initialization failed:', error);
    }
  }

  startMetricsCollection() {
    try {
      // Collect system metrics every 30 seconds
      setInterval(() => {
        this.collectSystemMetrics();
      }, 30000);

      // Collect application metrics every 10 seconds
      setInterval(() => {
        this.collectApplicationMetrics();
      }, 10000);

      // Collect business metrics every minute
      setInterval(() => {
        this.collectBusinessMetrics();
      }, 60000);

      // Check alerts every 15 seconds
      setInterval(() => {
        this.checkAlerts();
      }, 15000);

      this.logger.info('Metrics collection started');

    } catch (error) {
      this.logger.error('Metrics collection start failed:', error);
    }
  }

  async collectSystemMetrics() {
    try {
      // CPU usage
      const cpuUsage = os.loadavg();
      this.metrics.cpuUsage.set({ core: '1min' }, cpuUsage[0] * 100);
      this.metrics.cpuUsage.set({ core: '5min' }, cpuUsage[1] * 100);
      this.metrics.cpuUsage.set({ core: '15min' }, cpuUsage[2] * 100);

      // Memory usage
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;

      this.metrics.memoryUsage.set({ type: 'total' }, totalMem);
      this.metrics.memoryUsage.set({ type: 'used' }, usedMem);
      this.metrics.memoryUsage.set({ type: 'free' }, freeMem);

      // Process memory
      const processMem = process.memoryUsage();
      this.metrics.memoryUsage.set({ type: 'rss' }, processMem.rss);
      this.metrics.memoryUsage.set({ type: 'heap_used' }, processMem.heapUsed);
      this.metrics.memoryUsage.set({ type: 'heap_total' }, processMem.heapTotal);

      // Network interfaces
      const networkInterfaces = os.networkInterfaces();
      for (const [name, interfaces] of Object.entries(networkInterfaces)) {
        for (const iface of interfaces) {
          if (iface.family === 'IPv4') {
            // Note: This is a simplified version. In production, you'd track actual traffic
            this.metrics.networkTraffic.inc({ interface: name, direction: 'in' }, 0);
            this.metrics.networkTraffic.inc({ interface: name, direction: 'out' }, 0);
          }
        }
      }

    } catch (error) {
      this.logger.error('System metrics collection failed:', error);
    }
  }

  async collectApplicationMetrics() {
    try {
      // Active connections (simulated)
      const activeConnections = Math.floor(Math.random() * 100) + 10;
      this.metrics.activeConnections.set({ type: 'websocket' }, activeConnections);

      // Queue sizes (simulated)
      const queueSizes = {
        'celestial-events': Math.floor(Math.random() * 1000) + 100,
        'user-actions': Math.floor(Math.random() * 500) + 50,
        'system-tasks': Math.floor(Math.random() * 200) + 20
      };

      for (const [queue, size] of Object.entries(queueSizes)) {
        this.metrics.queueSize.set({ queue_name: queue }, size);
      }

      // Storage usage (simulated)
      const storageUsage = {
        'aws-s3': Math.floor(Math.random() * 1000000000) + 100000000,
        'gcs': Math.floor(Math.random() * 500000000) + 50000000,
        'azure': Math.floor(Math.random() * 300000000) + 30000000
      };

      for (const [provider, usage] of Object.entries(storageUsage)) {
        this.metrics.storageUsage.set({ provider, bucket: 'default' }, usage);
      }

    } catch (error) {
      this.logger.error('Application metrics collection failed:', error);
    }
  }

  async collectBusinessMetrics() {
    try {
      // User actions (simulated)
      const userActions = {
        'login': Math.floor(Math.random() * 100) + 10,
        'logout': Math.floor(Math.random() * 80) + 8,
        'purchase': Math.floor(Math.random() * 20) + 2,
        'game_start': Math.floor(Math.random() * 50) + 5
      };

      for (const [action, count] of Object.entries(userActions)) {
        this.metrics.userActions.inc({ action, user_type: 'premium' }, count);
        this.metrics.userActions.inc({ action, user_type: 'free' }, count * 2);
      }

      // Transaction volume (simulated)
      const transactionVolume = {
        'USD': Math.floor(Math.random() * 10000) + 1000,
        'EUR': Math.floor(Math.random() * 8000) + 800,
        'crypto': Math.floor(Math.random() * 5000) + 500
      };

      for (const [currency, volume] of Object.entries(transactionVolume)) {
        this.metrics.transactionVolume.inc({ currency, type: 'purchase' }, volume);
      }

      // Game events (simulated)
      const gameEvents = {
        'mission_complete': Math.floor(Math.random() * 200) + 20,
        'ship_upgrade': Math.floor(Math.random() * 50) + 5,
        'combat_win': Math.floor(Math.random() * 100) + 10,
        'exploration': Math.floor(Math.random() * 150) + 15
      };

      for (const [event, count] of Object.entries(gameEvents)) {
        this.metrics.gameEvents.inc({ event_type: event, player_type: 'active' }, count);
      }

    } catch (error) {
      this.logger.error('Business metrics collection failed:', error);
    }
  }

  recordHttpRequest(method, endpoint, statusCode, duration) {
    try {
      this.metrics.httpRequests.inc({ method, endpoint, status_code: statusCode });
      this.metrics.httpRequestDuration.observe({ method, endpoint }, duration);
    } catch (error) {
      this.logger.error('HTTP request recording failed:', error);
    }
  }

  recordError(service, type, error) {
    try {
      this.metrics.errorRate.inc({ service, type });
      
      // Log the error
      this.monitoringLogger.error('Application error', {
        service,
        type,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });

      // Check if this triggers any alerts
      this.checkErrorAlerts(service, type, error);

    } catch (err) {
      this.logger.error('Error recording failed:', err);
    }
  }

  async createAlert(alert) {
    try {
      const alertId = this.generateAlertId();
      const alertData = {
        id: alertId,
        name: alert.name,
        description: alert.description,
        severity: alert.severity || 'medium',
        condition: alert.condition,
        threshold: alert.threshold,
        status: 'active',
        createdAt: new Date().toISOString(),
        lastTriggered: null,
        triggerCount: 0
      };

      this.alerts.push(alertData);
      
      // Register alert handler
      if (alert.handler) {
        this.alertHandlers.set(alertId, alert.handler);
      }

      this.logger.info(`Alert created: ${alertId}`);
      
      return alertId;

    } catch (error) {
      this.logger.error('Alert creation failed:', error);
      throw error;
    }
  }

  async checkAlerts() {
    try {
      for (const alert of this.alerts) {
        if (alert.status !== 'active') continue;

        const isTriggered = await this.evaluateAlertCondition(alert);
        
        if (isTriggered) {
          await this.triggerAlert(alert);
        }
      }
    } catch (error) {
      this.logger.error('Alert checking failed:', error);
    }
  }

  async evaluateAlertCondition(alert) {
    try {
      const { condition, threshold } = alert;
      
      switch (condition.type) {
        case 'cpu_usage':
          const cpuUsage = os.loadavg()[0] * 100;
          return cpuUsage > threshold;
          
        case 'memory_usage':
          const totalMem = os.totalmem();
          const freeMem = os.freemem();
          const memoryUsage = ((totalMem - freeMem) / totalMem) * 100;
          return memoryUsage > threshold;
          
        case 'error_rate':
          // Get error rate from metrics
          const errorCount = this.metrics.errorRate.get();
          return errorCount > threshold;
          
        case 'queue_size':
          const queueSize = this.metrics.queueSize.get({ queue_name: condition.queue });
          return queueSize > threshold;
          
        case 'response_time':
          const responseTime = this.metrics.httpRequestDuration.get();
          return responseTime > threshold;
          
        case 'custom':
          // Custom condition evaluation
          if (condition.evaluator && typeof condition.evaluator === 'function') {
            return await condition.evaluator();
          }
          return false;
          
        default:
          return false;
      }
    } catch (error) {
      this.logger.error('Alert condition evaluation failed:', error);
      return false;
    }
  }

  async triggerAlert(alert) {
    try {
      alert.lastTriggered = new Date().toISOString();
      alert.triggerCount++;

      // Log the alert
      this.monitoringLogger.warn('Alert triggered', {
        alertId: alert.id,
        name: alert.name,
        severity: alert.severity,
        triggerCount: alert.triggerCount,
        timestamp: alert.lastTriggered
      });

      // Execute alert handler
      const handler = this.alertHandlers.get(alert.id);
      if (handler && typeof handler === 'function') {
        try {
          await handler(alert);
        } catch (error) {
          this.logger.error('Alert handler execution failed:', error);
        }
      }

      // Send notifications
      await this.sendAlertNotifications(alert);

    } catch (error) {
      this.logger.error('Alert triggering failed:', error);
    }
  }

  async sendAlertNotifications(alert) {
    try {
      const notification = {
        type: 'alert',
        severity: alert.severity,
        title: `Alert: ${alert.name}`,
        message: alert.description,
        timestamp: alert.lastTriggered,
        metadata: {
          alertId: alert.id,
          triggerCount: alert.triggerCount
        }
      };

      // Send to different notification channels based on severity
      switch (alert.severity) {
        case 'critical':
          await this.sendCriticalNotification(notification);
          break;
        case 'high':
          await this.sendHighPriorityNotification(notification);
          break;
        case 'medium':
          await this.sendMediumPriorityNotification(notification);
          break;
        case 'low':
          await this.sendLowPriorityNotification(notification);
          break;
      }

    } catch (error) {
      this.logger.error('Alert notification failed:', error);
    }
  }

  async sendCriticalNotification(notification) {
    // Send to all channels immediately
    await Promise.all([
      this.sendEmailNotification(notification),
      this.sendSlackNotification(notification),
      this.sendSMSNotification(notification),
      this.sendPagerDutyNotification(notification)
    ]);
  }

  async sendHighPriorityNotification(notification) {
    // Send to email and Slack
    await Promise.all([
      this.sendEmailNotification(notification),
      this.sendSlackNotification(notification)
    ]);
  }

  async sendMediumPriorityNotification(notification) {
    // Send to Slack only
    await this.sendSlackNotification(notification);
  }

  async sendLowPriorityNotification(notification) {
    // Log only
    this.monitoringLogger.info('Low priority alert', notification);
  }

  async sendEmailNotification(notification) {
    // Implementation would use nodemailer or similar
    this.logger.info('Email notification sent', notification);
  }

  async sendSlackNotification(notification) {
    // Implementation would use Slack webhook
    this.logger.info('Slack notification sent', notification);
  }

  async sendSMSNotification(notification) {
    // Implementation would use Twilio or similar
    this.logger.info('SMS notification sent', notification);
  }

  async sendPagerDutyNotification(notification) {
    // Implementation would use PagerDuty API
    this.logger.info('PagerDuty notification sent', notification);
  }

  async getMetrics() {
    try {
      const metrics = await register.metrics();
      return {
        metrics,
        timestamp: new Date().toISOString(),
        format: 'prometheus'
      };
    } catch (error) {
      this.logger.error('Metrics retrieval failed:', error);
      throw error;
    }
  }

  async getAlerts() {
    try {
      return {
        alerts: this.alerts,
        activeCount: this.alerts.filter(a => a.status === 'active').length,
        triggeredCount: this.alerts.filter(a => a.lastTriggered).length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Alerts retrieval failed:', error);
      throw error;
    }
  }

  async getLogs(level = 'info', limit = 100) {
    try {
      // In a real implementation, you'd query your log storage
      // For now, return recent logs from memory
      return {
        logs: [], // Would contain actual log entries
        level,
        limit,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Logs retrieval failed:', error);
      throw error;
    }
  }

  async healthCheck() {
    try {
      const health = {
        status: 'healthy',
        service: 'Monitoring Service',
        timestamp: new Date().toISOString(),
        metrics: {
          total: Object.keys(this.metrics).length,
          collectors: 3 // system, application, business
        },
        alerts: {
          total: this.alerts.length,
          active: this.alerts.filter(a => a.status === 'active').length
        },
        logging: {
          level: this.monitoringLogger.level,
          transports: this.monitoringLogger.transports.length
        }
      };

      return health;
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return { status: 'unhealthy', error: error.message };
    }
  }

  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  checkErrorAlerts(service, type, error) {
    // Check if this error triggers any specific alerts
    const errorAlerts = this.alerts.filter(a => 
      a.condition.type === 'error_rate' && 
      a.status === 'active'
    );

    for (const alert of errorAlerts) {
      if (alert.condition.service === service || alert.condition.service === '*') {
        this.triggerAlert(alert);
      }
    }
  }
}

module.exports = MonitoringService; 