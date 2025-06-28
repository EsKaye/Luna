const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { createServer } = require('http');
const { Server } = require('socket.io');
const axios = require('axios');
const moment = require('moment');
const math = require('mathjs');
require('dotenv').config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));

// NASA API Integration
class NASAService {
  constructor() {
    this.baseURL = 'https://api.nasa.gov';
    this.apiKey = process.env.NASA_API_KEY;
  }

  async getAPOD(date = null) {
    try {
      const params = {
        api_key: this.apiKey,
        ...(date && { date })
      };
      
      const response = await axios.get(`${this.baseURL}/planetary/apod`, { params });
      return response.data;
    } catch (error) {
      console.error('NASA APOD Error:', error);
      throw error;
    }
  }

  async getNearEarthObjects(startDate, endDate) {
    try {
      const params = {
        api_key: this.apiKey,
        start_date: startDate,
        end_date: endDate
      };
      
      const response = await axios.get(`${this.baseURL}/neo/rest/v1/feed`, { params });
      return response.data;
    } catch (error) {
      console.error('NASA NEO Error:', error);
      throw error;
    }
  }

  async getMarsRoverPhotos(rover = 'curiosity', sol = 1000) {
    try {
      const params = {
        api_key: this.apiKey,
        sol
      };
      
      const response = await axios.get(`${this.baseURL}/mars-photos/api/v1/rovers/${rover}/photos`, { params });
      return response.data;
    } catch (error) {
      console.error('NASA Mars Rover Error:', error);
      throw error;
    }
  }

  async getSpaceWeather() {
    try {
      const response = await axios.get(`${this.baseURL}/DONKI/WSA`, {
        params: { api_key: this.apiKey }
      });
      return response.data;
    } catch (error) {
      console.error('NASA Space Weather Error:', error);
      throw error;
    }
  }
}

// ESA API Integration
class ESAService {
  constructor() {
    this.baseURL = 'https://www.esa.int/esa';
    this.apiKey = process.env.ESA_API_KEY;
  }

  async getMissionData(mission) {
    try {
      const response = await axios.get(`${this.baseURL}/mission/${mission}/data`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      return response.data;
    } catch (error) {
      console.error('ESA Mission Data Error:', error);
      throw error;
    }
  }

  async getSatellitePositions() {
    try {
      const response = await axios.get(`${this.baseURL}/satellites/positions`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      return response.data;
    } catch (error) {
      console.error('ESA Satellite Positions Error:', error);
      throw error;
    }
  }
}

// Wolfram Alpha Integration
class WolframAlphaService {
  constructor() {
    this.baseURL = 'http://api.wolframalpha.com/v2/query';
    this.apiKey = process.env.WOLFRAM_ALPHA_API_KEY;
  }

  async query(query) {
    try {
      const params = {
        input: query,
        appid: this.apiKey,
        output: 'json'
      };
      
      const response = await axios.get(this.baseURL, { params });
      return response.data;
    } catch (error) {
      console.error('Wolfram Alpha Error:', error);
      throw error;
    }
  }

  async calculateOrbitalMechanics(planet, parameters) {
    try {
      const query = `orbital mechanics ${planet} ${JSON.stringify(parameters)}`;
      return await this.query(query);
    } catch (error) {
      console.error('Orbital Mechanics Error:', error);
      throw error;
    }
  }

  async getAstronomicalData(celestialObject) {
    try {
      const query = `astronomical data ${celestialObject}`;
      return await this.query(query);
    } catch (error) {
      console.error('Astronomical Data Error:', error);
      throw error;
    }
  }
}

// Initialize services
const nasaService = new NASAService();
const esaService = new ESAService();
const wolframService = new WolframAlphaService();

// Scientific Data Routes
app.get('/api/scientific/apod', async (req, res) => {
  try {
    const { date } = req.query;
    const apod = await nasaService.getAPOD(date);
    
    res.json({
      success: true,
      data: apod,
      source: 'NASA',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch APOD' });
  }
});

app.get('/api/scientific/neo', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const neo = await nasaService.getNearEarthObjects(start_date, end_date);
    
    res.json({
      success: true,
      data: neo,
      source: 'NASA',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch NEO data' });
  }
});

app.get('/api/scientific/mars-photos', async (req, res) => {
  try {
    const { rover = 'curiosity', sol = 1000 } = req.query;
    const photos = await nasaService.getMarsRoverPhotos(rover, sol);
    
    res.json({
      success: true,
      data: photos,
      source: 'NASA',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch Mars photos' });
  }
});

app.get('/api/scientific/space-weather', async (req, res) => {
  try {
    const weather = await nasaService.getSpaceWeather();
    
    res.json({
      success: true,
      data: weather,
      source: 'NASA',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch space weather' });
  }
});

app.get('/api/scientific/esa-mission/:mission', async (req, res) => {
  try {
    const { mission } = req.params;
    const data = await esaService.getMissionData(mission);
    
    res.json({
      success: true,
      data,
      source: 'ESA',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch ESA mission data' });
  }
});

app.get('/api/scientific/satellite-positions', async (req, res) => {
  try {
    const positions = await esaService.getSatellitePositions();
    
    res.json({
      success: true,
      data: positions,
      source: 'ESA',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch satellite positions' });
  }
});

app.post('/api/scientific/wolfram-query', async (req, res) => {
  try {
    const { query } = req.body;
    const result = await wolframService.query(query);
    
    res.json({
      success: true,
      data: result,
      source: 'Wolfram Alpha',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to process Wolfram Alpha query' });
  }
});

app.post('/api/scientific/orbital-mechanics', async (req, res) => {
  try {
    const { planet, parameters } = req.body;
    const result = await wolframService.calculateOrbitalMechanics(planet, parameters);
    
    res.json({
      success: true,
      data: result,
      source: 'Wolfram Alpha',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to calculate orbital mechanics' });
  }
});

app.get('/api/scientific/astronomical-data/:object', async (req, res) => {
  try {
    const { object } = req.params;
    const data = await wolframService.getAstronomicalData(object);
    
    res.json({
      success: true,
      data,
      source: 'Wolfram Alpha',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch astronomical data' });
  }
});

// Real-time astronomical events
app.get('/api/scientific/live-events', async (req, res) => {
  try {
    const events = await getLiveAstronomicalEvents();
    
    res.json({
      success: true,
      data: events,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch live events' });
  }
});

// WebSocket for real-time scientific data
io.on('connection', (socket) => {
  console.log('Scientific data client connected:', socket.id);

  // Send real-time astronomical updates
  const updateInterval = setInterval(async () => {
    try {
      const updates = await getRealTimeUpdates();
      socket.emit('scientific-update', updates);
    } catch (error) {
      console.error('Real-time update error:', error);
    }
  }, 30000); // Update every 30 seconds

  socket.on('request-data', async (data) => {
    try {
      const { type, parameters } = data;
      let result;

      switch (type) {
        case 'apod':
          result = await nasaService.getAPOD();
          break;
        case 'neo':
          result = await nasaService.getNearEarthObjects(
            moment().format('YYYY-MM-DD'),
            moment().add(7, 'days').format('YYYY-MM-DD')
          );
          break;
        case 'space-weather':
          result = await nasaService.getSpaceWeather();
          break;
        default:
          result = { error: 'Unknown data type' };
      }

      socket.emit('data-response', { type, data: result });
    } catch (error) {
      socket.emit('data-error', { error: error.message });
    }
  });

  socket.on('disconnect', () => {
    console.log('Scientific data client disconnected:', socket.id);
    clearInterval(updateInterval);
  });
});

// Helper functions
async function getLiveAstronomicalEvents() {
  try {
    const [apod, neo, weather] = await Promise.all([
      nasaService.getAPOD(),
      nasaService.getNearEarthObjects(
        moment().format('YYYY-MM-DD'),
        moment().add(1, 'day').format('YYYY-MM-DD')
      ),
      nasaService.getSpaceWeather()
    ]);

    return {
      apod,
      nearEarthObjects: neo,
      spaceWeather: weather,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Live events error:', error);
    return { error: 'Failed to fetch live events' };
  }
}

async function getRealTimeUpdates() {
  try {
    const updates = {
      timestamp: new Date().toISOString(),
      solarActivity: await getSolarActivity(),
      spaceWeather: await nasaService.getSpaceWeather(),
      upcomingEvents: await getUpcomingEvents()
    };

    return updates;
  } catch (error) {
    console.error('Real-time updates error:', error);
    return { error: 'Failed to get real-time updates' };
  }
}

async function getSolarActivity() {
  // Simulated solar activity data
  return {
    sunspots: Math.floor(Math.random() * 50) + 10,
    solarFlare: Math.random() > 0.8,
    coronalMassEjection: Math.random() > 0.95
  };
}

async function getUpcomingEvents() {
  // Simulated upcoming astronomical events
  return [
    {
      type: 'meteor_shower',
      name: 'Perseids',
      date: moment().add(2, 'months').format('YYYY-MM-DD'),
      description: 'Annual meteor shower'
    },
    {
      type: 'eclipse',
      name: 'Solar Eclipse',
      date: moment().add(6, 'months').format('YYYY-MM-DD'),
      description: 'Partial solar eclipse'
    }
  ];
}

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'Scientific Data Service',
    timestamp: new Date().toISOString(),
    providers: {
      nasa: !!process.env.NASA_API_KEY,
      esa: !!process.env.ESA_API_KEY,
      wolfram: !!process.env.WOLFRAM_ALPHA_API_KEY
    }
  });
});

const PORT = process.env.PORT || 3003;
server.listen(PORT, () => {
  console.log(`🔬 Scientific Data Service running on port ${PORT}`);
  console.log(`📡 WebSocket server ready for real-time scientific data`);
  console.log(`🌌 Providers: NASA(${!!process.env.NASA_API_KEY}), ESA(${!!process.env.ESA_API_KEY}), Wolfram(${!!process.env.WOLFRAM_ALPHA_API_KEY})`);
});

module.exports = app; 