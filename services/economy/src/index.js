const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { createServer } = require('http');
const { Server } = require('socket.io');
const Redis = require('ioredis');
const mongoose = require('mongoose');
const Web3 = require('web3');
const ethers = require('ethers');
const moment = require('moment');
const cron = require('node-cron');
const winston = require('winston');
require('dotenv').config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));

// Initialize Redis
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD
});

// Configure logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'economy-service' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/celestial-economy', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Market Data Schema
const marketDataSchema = new mongoose.Schema({
  symbol: String,
  price: Number,
  volume: Number,
  change: Number,
  changePercent: Number,
  high: Number,
  low: Number,
  open: Number,
  timestamp: { type: Date, default: Date.now }
});

const MarketData = mongoose.model('MarketData', marketDataSchema);

// Trade Schema
const tradeSchema = new mongoose.Schema({
  userId: String,
  symbol: String,
  type: String, // buy, sell
  amount: Number,
  price: Number,
  total: Number,
  timestamp: { type: Date, default: Date.now },
  status: { type: String, default: 'pending' }
});

const Trade = mongoose.model('Trade', tradeSchema);

// Portfolio Schema
const portfolioSchema = new mongoose.Schema({
  userId: String,
  assets: [{
    symbol: String,
    amount: Number,
    averagePrice: Number,
    currentValue: Number
  }],
  totalValue: Number,
  lastUpdated: { type: Date, default: Date.now }
});

const Portfolio = mongoose.model('Portfolio', portfolioSchema);

// Game Economy Service
class GameEconomyService {
  constructor() {
    this.markets = new Map();
    this.initializeMarkets();
  }

  async initializeMarkets() {
    // Initialize game-specific markets
    const gameMarkets = [
      { symbol: 'CELESTIAL', name: 'Celestial Credits', basePrice: 1.0 },
      { symbol: 'SPACESHIP', name: 'Spaceship Parts', basePrice: 100.0 },
      { symbol: 'FUEL', name: 'Quantum Fuel', basePrice: 50.0 },
      { symbol: 'WEAPONS', name: 'Advanced Weapons', basePrice: 200.0 },
      { symbol: 'SHIELDS', name: 'Energy Shields', basePrice: 150.0 },
      { symbol: 'CARGO', name: 'Cargo Space', basePrice: 75.0 },
      { symbol: 'TECH', name: 'Technology', basePrice: 300.0 },
      { symbol: 'MINERALS', name: 'Rare Minerals', basePrice: 25.0 }
    ];

    for (const market of gameMarkets) {
      this.markets.set(market.symbol, {
        ...market,
        price: market.basePrice,
        volume: 0,
        change: 0,
        changePercent: 0,
        high: market.basePrice,
        low: market.basePrice,
        open: market.basePrice,
        lastUpdate: new Date()
      });
    }

    logger.info('Game markets initialized');
  }

  async updateMarketPrices() {
    for (const [symbol, market] of this.markets) {
      // Simulate price movements based on supply/demand
      const volatility = 0.05; // 5% volatility
      const change = (Math.random() - 0.5) * 2 * volatility * market.price;
      
      market.open = market.price;
      market.price += change;
      market.change = change;
      market.changePercent = (change / market.open) * 100;
      market.volume = Math.random() * 1000 + 100;
      market.high = Math.max(market.high, market.price);
      market.low = Math.min(market.low, market.price);
      market.lastUpdate = new Date();

      // Store in MongoDB
      await MarketData.create({
        symbol,
        price: market.price,
        volume: market.volume,
        change: market.change,
        changePercent: market.changePercent,
        high: market.high,
        low: market.low,
        open: market.open,
        timestamp: market.lastUpdate
      });

      // Cache in Redis
      await redis.hset(`market:${symbol}`, market);
    }

    // Emit real-time updates
    io.emit('market-update', Array.from(this.markets.values()));
  }

  async executeTrade(userId, symbol, type, amount, price) {
    try {
      const market = this.markets.get(symbol);
      if (!market) {
        throw new Error(`Market ${symbol} not found`);
      }

      const total = amount * price;
      const trade = await Trade.create({
        userId,
        symbol,
        type,
        amount,
        price,
        total,
        status: 'completed'
      });

      // Update portfolio
      await this.updatePortfolio(userId, symbol, type, amount, price);

      // Update market volume
      market.volume += amount;
      await redis.hset(`market:${symbol}`, market);

      logger.info(`Trade executed: ${userId} ${type} ${amount} ${symbol} at ${price}`);

      return trade;
    } catch (error) {
      logger.error('Trade execution failed:', error);
      throw error;
    }
  }

  async updatePortfolio(userId, symbol, type, amount, price) {
    try {
      let portfolio = await Portfolio.findOne({ userId });
      
      if (!portfolio) {
        portfolio = new Portfolio({ userId, assets: [], totalValue: 0 });
      }

      const assetIndex = portfolio.assets.findIndex(asset => asset.symbol === symbol);
      
      if (type === 'buy') {
        if (assetIndex >= 0) {
          // Update existing asset
          const asset = portfolio.assets[assetIndex];
          const totalCost = asset.amount * asset.averagePrice + amount * price;
          const totalAmount = asset.amount + amount;
          asset.amount = totalAmount;
          asset.averagePrice = totalCost / totalAmount;
          asset.currentValue = totalAmount * price;
        } else {
          // Add new asset
          portfolio.assets.push({
            symbol,
            amount,
            averagePrice: price,
            currentValue: amount * price
          });
        }
      } else if (type === 'sell') {
        if (assetIndex >= 0) {
          const asset = portfolio.assets[assetIndex];
          if (asset.amount >= amount) {
            asset.amount -= amount;
            asset.currentValue = asset.amount * price;
            
            if (asset.amount === 0) {
              portfolio.assets.splice(assetIndex, 1);
            }
          } else {
            throw new Error('Insufficient assets to sell');
          }
        } else {
          throw new Error('Asset not found in portfolio');
        }
      }

      // Update total portfolio value
      portfolio.totalValue = portfolio.assets.reduce((sum, asset) => sum + asset.currentValue, 0);
      portfolio.lastUpdated = new Date();

      await portfolio.save();
      return portfolio;
    } catch (error) {
      logger.error('Portfolio update failed:', error);
      throw error;
    }
  }

  async getPortfolio(userId) {
    try {
      let portfolio = await Portfolio.findOne({ userId });
      
      if (!portfolio) {
        portfolio = new Portfolio({ userId, assets: [], totalValue: 0 });
        await portfolio.save();
      }

      // Update current values
      for (const asset of portfolio.assets) {
        const market = this.markets.get(asset.symbol);
        if (market) {
          asset.currentValue = asset.amount * market.price;
        }
      }

      portfolio.totalValue = portfolio.assets.reduce((sum, asset) => sum + asset.currentValue, 0);
      await portfolio.save();

      return portfolio;
    } catch (error) {
      logger.error('Get portfolio failed:', error);
      throw error;
    }
  }

  async getMarketData(symbol) {
    try {
      const market = this.markets.get(symbol);
      if (!market) {
        throw new Error(`Market ${symbol} not found`);
      }

      // Get historical data from MongoDB
      const historicalData = await MarketData.find({ symbol })
        .sort({ timestamp: -1 })
        .limit(100);

      return {
        current: market,
        historical: historicalData.reverse()
      };
    } catch (error) {
      logger.error('Get market data failed:', error);
      throw error;
    }
  }

  async getAllMarkets() {
    return Array.from(this.markets.values());
  }
}

// Initialize economy service
const economyService = new GameEconomyService();

// Economy Routes
app.get('/api/economy/markets', async (req, res) => {
  try {
    const markets = await economyService.getAllMarkets();
    
    res.json({
      success: true,
      data: markets,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Get markets failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/economy/market/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const marketData = await economyService.getMarketData(symbol);
    
    res.json({
      success: true,
      data: marketData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Get market data failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/economy/trade', async (req, res) => {
  try {
    const { userId, symbol, type, amount, price } = req.body;
    const trade = await economyService.executeTrade(userId, symbol, type, amount, price);
    
    res.json({
      success: true,
      data: trade,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Trade failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/economy/portfolio/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const portfolio = await economyService.getPortfolio(userId);
    
    res.json({
      success: true,
      data: portfolio,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Get portfolio failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// WebSocket for real-time market updates
io.on('connection', (socket) => {
  logger.info('Economy client connected:', socket.id);

  socket.on('subscribe-market', async (data) => {
    try {
      const { symbol } = data;
      socket.join(`market:${symbol}`);
      
      const marketData = await economyService.getMarketData(symbol);
      socket.emit('market-data', marketData);
    } catch (error) {
      socket.emit('error', { error: error.message });
    }
  });

  socket.on('unsubscribe-market', (data) => {
    const { symbol } = data;
    socket.leave(`market:${symbol}`);
  });

  socket.on('request-portfolio', async (data) => {
    try {
      const { userId } = data;
      const portfolio = await economyService.getPortfolio(userId);
      
      socket.emit('portfolio-update', portfolio);
    } catch (error) {
      socket.emit('error', { error: error.message });
    }
  });

  socket.on('disconnect', () => {
    logger.info('Economy client disconnected:', socket.id);
  });
});

// Schedule market updates every 30 seconds
cron.schedule('*/30 * * * * *', async () => {
  try {
    await economyService.updateMarketPrices();
  } catch (error) {
    logger.error('Scheduled market update failed:', error);
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'Economy Service',
    timestamp: new Date().toISOString(),
    markets: economyService.markets.size,
    activeConnections: io.engine.clientsCount
  });
});

const PORT = process.env.PORT || 3006;
server.listen(PORT, () => {
  logger.info(`💰 Economy Service running on port ${PORT}`);
  logger.info(`📈 Real-time market updates enabled`);
  logger.info(`🎮 Game markets: ${economyService.markets.size} active`);
});

module.exports = app; 