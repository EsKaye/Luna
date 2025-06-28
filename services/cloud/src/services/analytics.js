const Redis = require('ioredis');
const winston = require('winston');
const EventEmitter = require('events');

class AnalyticsService {
  constructor(redis, logger) {
    this.redis = redis;
    this.logger = logger;
    this.eventEmitter = new EventEmitter();
    this.aggregators = new Map();
    this.realTimeStreams = new Map();
    this.initializeAnalytics();
  }

  async initializeAnalytics() {
    try {
      // Initialize analytics logging
      this.analyticsLogger = winston.createLogger({
        level: 'info',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
        defaultMeta: { service: 'analytics' },
        transports: [
          new winston.transports.File({ 
            filename: 'logs/analytics.log',
            level: 'info'
          }),
          new winston.transports.File({ 
            filename: 'logs/analytics-error.log',
            level: 'error'
          })
        ]
      });

      // Initialize aggregators
      this.initializeAggregators();
      
      // Start background processing
      this.startBackgroundProcessing();
      
      this.logger.info('Analytics service initialized');

    } catch (error) {
      this.logger.error('Analytics initialization failed:', error);
    }
  }

  initializeAggregators() {
    try {
      // User behavior aggregators
      this.aggregators.set('user_sessions', {
        type: 'counter',
        key: 'analytics:user_sessions',
        window: '1h',
        fields: ['userId', 'sessionId', 'duration', 'actions']
      });

      this.aggregators.set('user_actions', {
        type: 'counter',
        key: 'analytics:user_actions',
        window: '1h',
        fields: ['userId', 'action', 'timestamp', 'metadata']
      });

      this.aggregators.set('game_events', {
        type: 'counter',
        key: 'analytics:game_events',
        window: '1h',
        fields: ['eventType', 'playerId', 'timestamp', 'gameData']
      });

      this.aggregators.set('performance_metrics', {
        type: 'histogram',
        key: 'analytics:performance',
        window: '1h',
        fields: ['metric', 'value', 'timestamp', 'context']
      });

      this.aggregators.set('error_tracking', {
        type: 'counter',
        key: 'analytics:errors',
        window: '1h',
        fields: ['errorType', 'userId', 'timestamp', 'stack']
      });

      this.aggregators.set('revenue_tracking', {
        type: 'sum',
        key: 'analytics:revenue',
        window: '1h',
        fields: ['userId', 'amount', 'currency', 'transactionType', 'timestamp']
      });

      this.logger.info('Analytics aggregators initialized');

    } catch (error) {
      this.logger.error('Aggregators initialization failed:', error);
    }
  }

  async trackEvent(event, data, userId = null) {
    try {
      const eventId = this.generateEventId();
      const timestamp = new Date().toISOString();
      
      const eventData = {
        id: eventId,
        event,
        data,
        userId,
        timestamp,
        sessionId: data.sessionId || null,
        metadata: {
          source: 'celestial-syndicate',
          version: '1.0.0',
          environment: process.env.NODE_ENV || 'development'
        }
      };

      // Store raw event
      await this.redis.lpush('analytics:events', JSON.stringify(eventData));
      await this.redis.ltrim('analytics:events', 0, 999999); // Keep last 1M events

      // Store by event type
      await this.redis.lpush(`analytics:events:${event}`, JSON.stringify(eventData));
      await this.redis.ltrim(`analytics:events:${event}`, 0, 99999); // Keep last 100K per event type

      // Store by user if provided
      if (userId) {
        await this.redis.lpush(`analytics:user:${userId}:events`, JSON.stringify(eventData));
        await this.redis.ltrim(`analytics:user:${userId}:events`, 0, 9999); // Keep last 10K per user
      }

      // Aggregate event
      await this.aggregateEvent(eventData);

      // Emit real-time event
      this.eventEmitter.emit('event', eventData);

      // Log analytics event
      this.analyticsLogger.info('Event tracked', {
        eventId,
        event,
        userId,
        timestamp
      });

      return {
        eventId,
        success: true,
        timestamp
      };

    } catch (error) {
      this.logger.error('Event tracking failed:', error);
      throw error;
    }
  }

  async aggregateEvent(eventData) {
    try {
      const { event, data, userId, timestamp } = eventData;

      // Determine aggregator based on event type
      let aggregator = this.aggregators.get(event);
      
      if (!aggregator) {
        // Use default aggregator for unknown events
        aggregator = this.aggregators.get('user_actions');
      }

      const windowKey = this.getWindowKey(aggregator.window, timestamp);
      const aggregateKey = `${aggregator.key}:${windowKey}`;

      switch (aggregator.type) {
        case 'counter':
          await this.aggregateCounter(aggregateKey, eventData, aggregator);
          break;
        case 'histogram':
          await this.aggregateHistogram(aggregateKey, eventData, aggregator);
          break;
        case 'sum':
          await this.aggregateSum(aggregateKey, eventData, aggregator);
          break;
        default:
          await this.aggregateCounter(aggregateKey, eventData, aggregator);
      }

    } catch (error) {
      this.logger.error('Event aggregation failed:', error);
    }
  }

  async aggregateCounter(key, eventData, aggregator) {
    try {
      const { event, userId, timestamp } = eventData;
      
      // Increment total count
      await this.redis.hincrby(key, 'total', 1);
      
      // Increment by event type
      await this.redis.hincrby(key, `event:${event}`, 1);
      
      // Increment by user if provided
      if (userId) {
        await this.redis.hincrby(key, `user:${userId}`, 1);
      }
      
      // Store unique users
      if (userId) {
        await this.redis.sadd(`${key}:users`, userId);
      }
      
      // Set expiration
      await this.redis.expire(key, this.getWindowSeconds(aggregator.window));
      await this.redis.expire(`${key}:users`, this.getWindowSeconds(aggregator.window));

    } catch (error) {
      this.logger.error('Counter aggregation failed:', error);
    }
  }

  async aggregateHistogram(key, eventData, aggregator) {
    try {
      const { data, timestamp } = eventData;
      
      if (data.value !== undefined) {
        // Store value in sorted set for percentile calculations
        await this.redis.zadd(`${key}:values`, timestamp, data.value);
        
        // Update min/max
        const currentMin = await this.redis.hget(key, 'min');
        const currentMax = await this.redis.hget(key, 'max');
        
        if (!currentMin || data.value < parseFloat(currentMin)) {
          await this.redis.hset(key, 'min', data.value);
        }
        
        if (!currentMax || data.value > parseFloat(currentMax)) {
          await this.redis.hset(key, 'max', data.value);
        }
        
        // Update sum and count
        await this.redis.hincrbyfloat(key, 'sum', data.value);
        await this.redis.hincrby(key, 'count', 1);
        
        // Set expiration
        await this.redis.expire(key, this.getWindowSeconds(aggregator.window));
        await this.redis.expire(`${key}:values`, this.getWindowSeconds(aggregator.window));
      }

    } catch (error) {
      this.logger.error('Histogram aggregation failed:', error);
    }
  }

  async aggregateSum(key, eventData, aggregator) {
    try {
      const { data, userId, timestamp } = eventData;
      
      if (data.amount !== undefined) {
        // Add to total sum
        await this.redis.hincrbyfloat(key, 'total', data.amount);
        
        // Add to user sum if provided
        if (userId) {
          await this.redis.hincrbyfloat(key, `user:${userId}`, data.amount);
        }
        
        // Add to currency sum if provided
        if (data.currency) {
          await this.redis.hincrbyfloat(key, `currency:${data.currency}`, data.amount);
        }
        
        // Set expiration
        await this.redis.expire(key, this.getWindowSeconds(aggregator.window));
      }

    } catch (error) {
      this.logger.error('Sum aggregation failed:', error);
    }
  }

  async generateReports(type, timeframe = '24h', filters = {}) {
    try {
      const reports = [];

      switch (type) {
        case 'user_activity':
          reports.push(await this.generateUserActivityReport(timeframe, filters));
          break;
        case 'game_performance':
          reports.push(await this.generateGamePerformanceReport(timeframe, filters));
          break;
        case 'revenue_analysis':
          reports.push(await this.generateRevenueReport(timeframe, filters));
          break;
        case 'error_analysis':
          reports.push(await this.generateErrorReport(timeframe, filters));
          break;
        case 'system_performance':
          reports.push(await this.generateSystemPerformanceReport(timeframe, filters));
          break;
        case 'comprehensive':
          reports.push(
            await this.generateUserActivityReport(timeframe, filters),
            await this.generateGamePerformanceReport(timeframe, filters),
            await this.generateRevenueReport(timeframe, filters),
            await this.generateErrorReport(timeframe, filters),
            await this.generateSystemPerformanceReport(timeframe, filters)
          );
          break;
        default:
          throw new Error(`Unknown report type: ${type}`);
      }

      return {
        type,
        timeframe,
        filters,
        reports: reports.flat(),
        generatedAt: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Report generation failed:', error);
      throw error;
    }
  }

  async generateUserActivityReport(timeframe, filters) {
    try {
      const windowKey = this.getWindowKey(timeframe);
      const key = `analytics:user_actions:${windowKey}`;
      
      const totalActions = await this.redis.hget(key, 'total') || 0;
      const uniqueUsers = await this.redis.scard(`${key}:users`) || 0;
      
      // Get top actions
      const actionKeys = await this.redis.hkeys(key);
      const topActions = [];
      
      for (const actionKey of actionKeys) {
        if (actionKey.startsWith('event:')) {
          const action = actionKey.replace('event:', '');
          const count = await this.redis.hget(key, actionKey) || 0;
          topActions.push({ action, count: parseInt(count) });
        }
      }
      
      topActions.sort((a, b) => b.count - a.count);
      
      return {
        type: 'user_activity',
        data: {
          totalActions: parseInt(totalActions),
          uniqueUsers,
          topActions: topActions.slice(0, 10),
          averageActionsPerUser: uniqueUsers > 0 ? totalActions / uniqueUsers : 0
        }
      };

    } catch (error) {
      this.logger.error('User activity report generation failed:', error);
      throw error;
    }
  }

  async generateGamePerformanceReport(timeframe, filters) {
    try {
      const windowKey = this.getWindowKey(timeframe);
      const key = `analytics:game_events:${windowKey}`;
      
      const totalEvents = await this.redis.hget(key, 'total') || 0;
      
      // Get performance metrics
      const perfKey = `analytics:performance:${windowKey}`;
      const count = await this.redis.hget(perfKey, 'count') || 0;
      const sum = await this.redis.hget(perfKey, 'sum') || 0;
      const min = await this.redis.hget(perfKey, 'min') || 0;
      const max = await this.redis.hget(perfKey, 'max') || 0;
      
      const average = count > 0 ? sum / count : 0;
      
      // Get percentiles
      const values = await this.redis.zrange(`${perfKey}:values`, 0, -1, 'WITHSCORES');
      const percentiles = this.calculatePercentiles(values, [50, 90, 95, 99]);
      
      return {
        type: 'game_performance',
        data: {
          totalEvents: parseInt(totalEvents),
          performance: {
            count: parseInt(count),
            average,
            min: parseFloat(min),
            max: parseFloat(max),
            percentiles
          }
        }
      };

    } catch (error) {
      this.logger.error('Game performance report generation failed:', error);
      throw error;
    }
  }

  async generateRevenueReport(timeframe, filters) {
    try {
      const windowKey = this.getWindowKey(timeframe);
      const key = `analytics:revenue:${windowKey}`;
      
      const totalRevenue = await this.redis.hget(key, 'total') || 0;
      
      // Get revenue by currency
      const currencyKeys = await this.redis.hkeys(key);
      const revenueByCurrency = [];
      
      for (const currencyKey of currencyKeys) {
        if (currencyKey.startsWith('currency:')) {
          const currency = currencyKey.replace('currency:', '');
          const amount = await this.redis.hget(key, currencyKey) || 0;
          revenueByCurrency.push({ currency, amount: parseFloat(amount) });
        }
      }
      
      return {
        type: 'revenue_analysis',
        data: {
          totalRevenue: parseFloat(totalRevenue),
          revenueByCurrency,
          averageRevenue: revenueByCurrency.length > 0 ? 
            totalRevenue / revenueByCurrency.length : 0
        }
      };

    } catch (error) {
      this.logger.error('Revenue report generation failed:', error);
      throw error;
    }
  }

  async generateErrorReport(timeframe, filters) {
    try {
      const windowKey = this.getWindowKey(timeframe);
      const key = `analytics:errors:${windowKey}`;
      
      const totalErrors = await this.redis.hget(key, 'total') || 0;
      
      // Get errors by type
      const errorKeys = await this.redis.hkeys(key);
      const errorsByType = [];
      
      for (const errorKey of errorKeys) {
        if (errorKey.startsWith('event:')) {
          const errorType = errorKey.replace('event:', '');
          const count = await this.redis.hget(key, errorKey) || 0;
          errorsByType.push({ errorType, count: parseInt(count) });
        }
      }
      
      errorsByType.sort((a, b) => b.count - a.count);
      
      return {
        type: 'error_analysis',
        data: {
          totalErrors: parseInt(totalErrors),
          errorsByType: errorsByType.slice(0, 10),
          errorRate: totalErrors > 0 ? totalErrors / 1000 : 0 // per 1000 events
        }
      };

    } catch (error) {
      this.logger.error('Error report generation failed:', error);
      throw error;
    }
  }

  async generateSystemPerformanceReport(timeframe, filters) {
    try {
      const windowKey = this.getWindowKey(timeframe);
      const key = `analytics:performance:${windowKey}`;
      
      const count = await this.redis.hget(key, 'count') || 0;
      const sum = await this.redis.hget(key, 'sum') || 0;
      const min = await this.redis.hget(key, 'min') || 0;
      const max = await this.redis.hget(key, 'max') || 0;
      
      const average = count > 0 ? sum / count : 0;
      
      return {
        type: 'system_performance',
        data: {
          metrics: {
            count: parseInt(count),
            average,
            min: parseFloat(min),
            max: parseFloat(max)
          },
          throughput: count / this.getWindowSeconds(timeframe),
          utilization: average / max * 100
        }
      };

    } catch (error) {
      this.logger.error('System performance report generation failed:', error);
      throw error;
    }
  }

  async createStream(streamType, filters = {}) {
    try {
      const streamId = this.generateStreamId();
      
      const stream = {
        id: streamId,
        type: streamType,
        filters,
        createdAt: new Date().toISOString(),
        active: true
      };
      
      this.realTimeStreams.set(streamId, stream);
      
      // Set up event listener for this stream
      const listener = (eventData) => {
        if (this.matchesStreamFilters(eventData, filters)) {
          stream.emit('data', {
            streamId,
            event: eventData,
            timestamp: new Date().toISOString()
          });
        }
      };
      
      this.eventEmitter.on('event', listener);
      stream.listener = listener;
      
      this.logger.info(`Real-time stream created: ${streamId}`);
      
      return stream;

    } catch (error) {
      this.logger.error('Stream creation failed:', error);
      throw error;
    }
  }

  async closeStream(streamId) {
    try {
      const stream = this.realTimeStreams.get(streamId);
      if (!stream) {
        throw new Error(`Stream ${streamId} not found`);
      }
      
      // Remove event listener
      if (stream.listener) {
        this.eventEmitter.off('event', stream.listener);
      }
      
      // Mark stream as inactive
      stream.active = false;
      stream.closedAt = new Date().toISOString();
      
      this.realTimeStreams.delete(streamId);
      
      this.logger.info(`Real-time stream closed: ${streamId}`);
      
      return { success: true };

    } catch (error) {
      this.logger.error('Stream closure failed:', error);
      throw error;
    }
  }

  matchesStreamFilters(eventData, filters) {
    try {
      for (const [key, value] of Object.entries(filters)) {
        if (eventData[key] !== value) {
          return false;
        }
      }
      return true;
    } catch (error) {
      this.logger.error('Stream filter matching failed:', error);
      return false;
    }
  }

  startBackgroundProcessing() {
    try {
      // Clean up old data every hour
      setInterval(async () => {
        await this.cleanupOldData();
      }, 60 * 60 * 1000);

      // Generate periodic reports every 6 hours
      setInterval(async () => {
        await this.generatePeriodicReports();
      }, 6 * 60 * 60 * 1000);

      this.logger.info('Background processing started');

    } catch (error) {
      this.logger.error('Background processing start failed:', error);
    }
  }

  async cleanupOldData() {
    try {
      const cutoffTime = new Date();
      cutoffTime.setDate(cutoffTime.getDate() - 30); // Keep 30 days of data
      
      // Clean up old events
      const oldEvents = await this.redis.lrange('analytics:events', 0, -1);
      for (const event of oldEvents) {
        const eventData = JSON.parse(event);
        if (new Date(eventData.timestamp) < cutoffTime) {
          await this.redis.lrem('analytics:events', 1, event);
        }
      }
      
      this.logger.info('Old analytics data cleaned up');

    } catch (error) {
      this.logger.error('Data cleanup failed:', error);
    }
  }

  async generatePeriodicReports() {
    try {
      const reports = await this.generateReports('comprehensive', '24h');
      
      // Store reports for historical analysis
      await this.redis.lpush('analytics:reports', JSON.stringify(reports));
      await this.redis.ltrim('analytics:reports', 0, 999); // Keep last 1000 reports
      
      this.logger.info('Periodic reports generated');

    } catch (error) {
      this.logger.error('Periodic report generation failed:', error);
    }
  }

  getWindowKey(window, timestamp = new Date()) {
    const date = new Date(timestamp);
    
    switch (window) {
      case '1m':
        return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}`;
      case '1h':
        return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${date.getHours()}`;
      case '1d':
        return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
      case '1w':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return `${weekStart.getFullYear()}-${weekStart.getMonth() + 1}-${weekStart.getDate()}`;
      case '1M':
        return `${date.getFullYear()}-${date.getMonth() + 1}`;
      default:
        return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    }
  }

  getWindowSeconds(window) {
    switch (window) {
      case '1m': return 60;
      case '1h': return 60 * 60;
      case '1d': return 24 * 60 * 60;
      case '1w': return 7 * 24 * 60 * 60;
      case '1M': return 30 * 24 * 60 * 60;
      default: return 24 * 60 * 60;
    }
  }

  calculatePercentiles(values, percentiles) {
    try {
      const sortedValues = values
        .filter((_, index) => index % 2 === 0) // Get only values, not scores
        .map(v => parseFloat(v))
        .sort((a, b) => a - b);
      
      const result = {};
      
      for (const percentile of percentiles) {
        const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
        result[`p${percentile}`] = sortedValues[index] || 0;
      }
      
      return result;
    } catch (error) {
      this.logger.error('Percentile calculation failed:', error);
      return {};
    }
  }

  generateEventId() {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateStreamId() {
    return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async healthCheck() {
    try {
      const health = {
        status: 'healthy',
        service: 'Analytics Service',
        timestamp: new Date().toISOString(),
        features: {
          eventTracking: true,
          aggregation: true,
          reporting: true,
          realTimeStreams: true
        },
        aggregators: this.aggregators.size,
        activeStreams: this.realTimeStreams.size,
        eventQueue: await this.redis.llen('analytics:events')
      };
      
      return health;
    } catch (error) {
      this.logger.error('Analytics health check failed:', error);
      return { status: 'unhealthy', error: error.message };
    }
  }
}

module.exports = AnalyticsService; 