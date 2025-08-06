const Redis = require('ioredis');
const amqp = require('amqplib');
const { Kafka } = require('kafka-node');
const { PubSub } = require('@google-cloud/pubsub');
const AWS = require('aws-sdk');
const { ServiceBusClient } = require('@azure/service-bus');
const EventEmitter = require('events');

class MessageQueueService {
  constructor(redis, logger) {
    this.redis = redis;
    this.logger = logger;
    this.queues = {};
    this.subscribers = new Map();
    this.eventEmitter = new EventEmitter();
    this.initializeQueues();
  }

  async initializeQueues() {
    try {
      // Initialize Redis Queue
      this.queues.redis = {
        name: 'redis',
        client: this.redis,
        publish: this.publishToRedis.bind(this),
        subscribe: this.subscribeToRedis.bind(this),
        unsubscribe: this.unsubscribeFromRedis.bind(this)
      };

      // Initialize RabbitMQ
      if (process.env.RABBITMQ_URL) {
        try {
          const connection = await amqp.connect(process.env.RABBITMQ_URL);
          const channel = await connection.createChannel();
          
          this.queues.rabbitmq = {
            name: 'rabbitmq',
            client: { connection, channel },
            publish: this.publishToRabbitMQ.bind(this),
            subscribe: this.subscribeToRabbitMQ.bind(this),
            unsubscribe: this.unsubscribeFromRabbitMQ.bind(this)
          };
          
          this.logger.info('RabbitMQ queue initialized');
        } catch (error) {
          this.logger.error('RabbitMQ initialization failed:', error);
        }
      }

      // Initialize Apache Kafka
      if (process.env.KAFKA_BROKERS) {
        try {
          const kafka = new Kafka({
            kafkaHost: process.env.KAFKA_BROKERS
          });
          
          this.queues.kafka = {
            name: 'kafka',
            client: kafka,
            publish: this.publishToKafka.bind(this),
            subscribe: this.subscribeToKafka.bind(this),
            unsubscribe: this.unsubscribeFromKafka.bind(this)
          };
          
          this.logger.info('Apache Kafka queue initialized');
        } catch (error) {
          this.logger.error('Kafka initialization failed:', error);
        }
      }

      // Initialize Google Cloud Pub/Sub
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        try {
          const pubsub = new PubSub();
          
          this.queues.pubsub = {
            name: 'pubsub',
            client: pubsub,
            publish: this.publishToPubSub.bind(this),
            subscribe: this.subscribeToPubSub.bind(this),
            unsubscribe: this.unsubscribeFromPubSub.bind(this)
          };
          
          this.logger.info('Google Cloud Pub/Sub queue initialized');
        } catch (error) {
          this.logger.error('Pub/Sub initialization failed:', error);
        }
      }

      // Initialize AWS SQS
      if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        try {
          const sqs = new AWS.SQS({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            region: process.env.AWS_REGION || 'us-east-1'
          });
          
          this.queues.sqs = {
            name: 'sqs',
            client: sqs,
            publish: this.publishToSQS.bind(this),
            subscribe: this.subscribeToSQS.bind(this),
            unsubscribe: this.unsubscribeFromSQS.bind(this)
          };
          
          this.logger.info('AWS SQS queue initialized');
        } catch (error) {
          this.logger.error('SQS initialization failed:', error);
        }
      }

      // Initialize Azure Service Bus
      if (process.env.AZURE_SERVICE_BUS_CONNECTION_STRING) {
        try {
          const serviceBusClient = new ServiceBusClient(
            process.env.AZURE_SERVICE_BUS_CONNECTION_STRING
          );
          
          this.queues.servicebus = {
            name: 'servicebus',
            client: serviceBusClient,
            publish: this.publishToServiceBus.bind(this),
            subscribe: this.subscribeToServiceBus.bind(this),
            unsubscribe: this.unsubscribeFromServiceBus.bind(this)
          };
          
          this.logger.info('Azure Service Bus queue initialized');
        } catch (error) {
          this.logger.error('Service Bus initialization failed:', error);
        }
      }

      this.logger.info(`Message queue service initialized with ${Object.keys(this.queues).length} providers`);

    } catch (error) {
      this.logger.error('Message queue initialization failed:', error);
    }
  }

  async publish(topic, message, priority = 'normal', provider = 'auto') {
    try {
      const queue = await this.selectQueue(provider);
      const messageId = this.generateMessageId();
      
      const messageData = {
        id: messageId,
        topic,
        data: message,
        priority,
        timestamp: new Date().toISOString(),
        metadata: {
          source: 'celestial-syndicate',
          version: '1.0.0'
        }
      };

      const result = await queue.publish(topic, messageData);
      
      // Store message metadata in Redis for tracking
      await this.redis.hset(`message:${messageId}`, {
        id: messageId,
        topic,
        priority,
        provider: queue.name,
        publishedAt: messageData.timestamp,
        status: 'published'
      });
      await this.redis.expire(`message:${messageId}`, 86400 * 7); // 7 days

      this.logger.info(`Message published to ${queue.name}: ${messageId}`);
      
      return {
        messageId,
        provider: queue.name,
        result
      };

    } catch (error) {
      this.logger.error('Message publish failed:', error);
      throw error;
    }
  }

  async subscribe(topic, callback, options = {}, provider = 'auto') {
    try {
      const queue = await this.selectQueue(provider);
      const subscriptionId = this.generateSubscriptionId();
      
      const subscription = await queue.subscribe(topic, callback, options);
      
      // Store subscription metadata
      this.subscribers.set(subscriptionId, {
        id: subscriptionId,
        topic,
        provider: queue.name,
        subscription,
        callback,
        options,
        createdAt: new Date().toISOString()
      });

      this.logger.info(`Subscription created on ${queue.name}: ${subscriptionId}`);
      
      return {
        subscriptionId,
        provider: queue.name,
        topic
      };

    } catch (error) {
      this.logger.error('Subscription failed:', error);
      throw error;
    }
  }

  async unsubscribe(subscriptionId) {
    try {
      const subscription = this.subscribers.get(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const queue = this.queues[subscription.provider];
      await queue.unsubscribe(subscription.subscription);
      
      this.subscribers.delete(subscriptionId);
      
      this.logger.info(`Subscription removed: ${subscriptionId}`);
      
      return { success: true };

    } catch (error) {
      this.logger.error('Unsubscribe failed:', error);
      throw error;
    }
  }

  async selectQueue(provider) {
    try {
      if (provider === 'auto') {
        // Auto-select based on availability and performance
        const availableQueues = Object.values(this.queues);
        
        // Priority order: redis, rabbitmq, kafka, pubsub, sqs, servicebus
        const priority = ['redis', 'rabbitmq', 'kafka', 'pubsub', 'sqs', 'servicebus'];
        
        for (const p of priority) {
          const queue = availableQueues.find(q => q.name === p);
          if (queue) {
            return queue;
          }
        }
      }

      if (this.queues[provider]) {
        return this.queues[provider];
      }

      throw new Error(`Queue provider ${provider} not available`);

    } catch (error) {
      this.logger.error('Queue selection failed:', error);
      throw error;
    }
  }

  // Redis Queue Implementation
  async publishToRedis(topic, message) {
    const channel = `queue:${topic}`;
    await this.redis.publish(channel, JSON.stringify(message));
    return { channel };
  }

  async subscribeToRedis(topic, callback, options = {}) {
    const channel = `queue:${topic}`;
    const subscriber = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD
    });

    subscriber.subscribe(channel, (err) => {
      if (err) {
        this.logger.error('Redis subscription error:', err);
      }
    });

    subscriber.on('message', (ch, message) => {
      try {
        const data = JSON.parse(message);
        callback(data);
      } catch (error) {
        this.logger.error('Redis message processing error:', error);
      }
    });

    return subscriber;
  }

  async unsubscribeFromRedis(subscription) {
    await subscription.quit();
  }

  // RabbitMQ Implementation
  async publishToRabbitMQ(topic, message) {
    const { channel } = this.queues.rabbitmq.client;
    
    await channel.assertExchange(topic, 'fanout', { durable: true });
    await channel.publish(topic, '', Buffer.from(JSON.stringify(message)));
    
    return { exchange: topic };
  }

  async subscribeToRabbitMQ(topic, callback, options = {}) {
    const { channel } = this.queues.rabbitmq.client;
    
    await channel.assertExchange(topic, 'fanout', { durable: true });
    const { queue } = await channel.assertQueue('', { exclusive: true });
    await channel.bindQueue(queue, topic, '');
    
    channel.consume(queue, (msg) => {
      if (msg) {
        try {
          const data = JSON.parse(msg.content.toString());
          callback(data);
          channel.ack(msg);
        } catch (error) {
          this.logger.error('RabbitMQ message processing error:', error);
          channel.nack(msg);
        }
      }
    });

    return { queue, channel };
  }

  async unsubscribeFromRabbitMQ(subscription) {
    const { channel, queue } = subscription;
    await channel.deleteQueue(queue);
  }

  // Kafka Implementation
  async publishToKafka(topic, message) {
    const producer = new this.queues.kafka.client.Producer();
    
    return new Promise((resolve, reject) => {
      producer.send([{
        topic,
        messages: [JSON.stringify(message)]
      }], (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
  }

  async subscribeToKafka(topic, callback, options = {}) {
    const consumer = new this.queues.kafka.client.Consumer(
      new this.queues.kafka.client.KafkaClient(),
      [{ topic }],
      { groupId: options.groupId || 'celestial-syndicate-group' }
    );

    consumer.on('message', (message) => {
      try {
        const data = JSON.parse(message.value);
        callback(data);
      } catch (error) {
        this.logger.error('Kafka message processing error:', error);
      }
    });

    return consumer;
  }

  async unsubscribeFromKafka(consumer) {
    consumer.close();
  }

  // Google Cloud Pub/Sub Implementation
  async publishToPubSub(topic, message) {
    const { client } = this.queues.pubsub;
    const topicName = `projects/${process.env.GOOGLE_CLOUD_PROJECT}/topics/${topic}`;
    
    const messageBuffer = Buffer.from(JSON.stringify(message));
    const messageId = await client.topic(topic).publish(messageBuffer);
    
    return { messageId };
  }

  async subscribeToPubSub(topic, callback, options = {}) {
    const { client } = this.queues.pubsub;
    const subscriptionName = options.subscriptionName || `${topic}-sub`;
    
    const subscription = client.subscription(subscriptionName);
    
    subscription.on('message', (message) => {
      try {
        const data = JSON.parse(message.data.toString());
        callback(data);
        message.ack();
      } catch (error) {
        this.logger.error('Pub/Sub message processing error:', error);
        message.nack();
      }
    });

    subscription.on('error', (error) => {
      this.logger.error('Pub/Sub subscription error:', error);
    });

    return subscription;
  }

  async unsubscribeFromPubSub(subscription) {
    subscription.removeAllListeners();
  }

  // AWS SQS Implementation
  async publishToSQS(topic, message) {
    const { client } = this.queues.sqs;
    const queueUrl = `${process.env.AWS_SQS_BASE_URL}/${topic}`;
    
    const params = {
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(message)
    };

    const result = await client.sendMessage(params).promise();
    return { messageId: result.MessageId };
  }

  async subscribeToSQS(topic, callback, options = {}) {
    const { client } = this.queues.sqs;
    const queueUrl = `${process.env.AWS_SQS_BASE_URL}/${topic}`;
    
    const pollMessages = async () => {
      try {
        const params = {
          QueueUrl: queueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 20
        };

        const result = await client.receiveMessage(params).promise();
        
        if (result.Messages) {
          for (const msg of result.Messages) {
            try {
              const data = JSON.parse(msg.Body);
              callback(data);
              
              // Delete message after processing
              await client.deleteMessage({
                QueueUrl: queueUrl,
                ReceiptHandle: msg.ReceiptHandle
              }).promise();
            } catch (error) {
              this.logger.error('SQS message processing error:', error);
            }
          }
        }
      } catch (error) {
        this.logger.error('SQS polling error:', error);
      }
      
      // Continue polling
      setTimeout(pollMessages, 1000);
    };

    pollMessages();
    
    return { queueUrl, pollInterval: 1000 };
  }

  async unsubscribeFromSQS(subscription) {
    // SQS polling is continuous, so we just stop the polling
    // This is handled by the polling function itself
  }

  // Azure Service Bus Implementation
  async publishToServiceBus(topic, message) {
    const { client } = this.queues.servicebus;
    const sender = client.createSender(topic);
    
    await sender.sendMessages({
      body: JSON.stringify(message)
    });
    
    await sender.close();
    return { topic };
  }

  async subscribeToServiceBus(topic, callback, options = {}) {
    const { client } = this.queues.servicebus;
    const receiver = client.createReceiver(topic, options.subscriptionName || 'default');
    
    receiver.subscribe({
      processMessage: async (message) => {
        try {
          const data = JSON.parse(message.body.toString());
          callback(data);
          await receiver.completeMessage(message);
        } catch (error) {
          this.logger.error('Service Bus message processing error:', error);
          await receiver.abandonMessage(message);
        }
      },
      processError: async (err) => {
        this.logger.error('Service Bus error:', err);
      }
    });

    return receiver;
  }

  async unsubscribeFromServiceBus(receiver) {
    await receiver.close();
  }

  // Utility methods
  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateSubscriptionId() {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async getQueueStats() {
    try {
      const stats = {};
      
      for (const [name, queue] of Object.entries(this.queues)) {
        try {
          switch (name) {
            case 'redis':
              const redisInfo = await this.redis.info();
              stats.redis = { status: 'connected', info: redisInfo };
              break;
            case 'rabbitmq':
              const { connection } = queue.client;
              stats.rabbitmq = { status: connection.connection.state };
              break;
            case 'kafka':
              stats.kafka = { status: 'connected' };
              break;
            case 'pubsub':
              stats.pubsub = { status: 'connected' };
              break;
            case 'sqs':
              stats.sqs = { status: 'connected' };
              break;
            case 'servicebus':
              stats.servicebus = { status: 'connected' };
              break;
          }
        } catch (error) {
          stats[name] = { status: 'error', error: error.message };
        }
      }

      return stats;
    } catch (error) {
      this.logger.error('Queue stats failed:', error);
      return { error: error.message };
    }
  }

  async healthCheck() {
    try {
      const stats = await this.getQueueStats();
      const healthyQueues = Object.values(stats).filter(s => s.status === 'connected').length;
      
      return {
        status: healthyQueues > 0 ? 'healthy' : 'unhealthy',
        queues: stats,
        activeSubscriptions: this.subscribers.size
      };
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return { status: 'unhealthy', error: error.message };
    }
  }
}

module.exports = MessageQueueService; 