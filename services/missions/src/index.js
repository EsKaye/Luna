const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { createServer } = require('http');
const { Server } = require('socket.io');
const Redis = require('ioredis');
const mongoose = require('mongoose');
const OpenAI = require('openai');
const moment = require('moment');
const cron = require('node-cron');
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
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
  defaultMeta: { service: 'mission-service' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/celestial-missions', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Mission Schema
const missionSchema = new mongoose.Schema({
  id: { type: String, default: uuidv4, unique: true },
  title: String,
  description: String,
  type: String, // combat, exploration, trading, rescue, escort, etc.
  difficulty: Number, // 1-10
  reward: {
    credits: Number,
    experience: Number,
    items: [String]
  },
  requirements: {
    level: Number,
    reputation: Number,
    equipment: [String]
  },
  objectives: [{
    id: String,
    description: String,
    type: String, // kill, collect, deliver, reach, etc.
    target: String,
    quantity: Number,
    completed: { type: Boolean, default: false }
  }],
  location: {
    system: String,
    planet: String,
    coordinates: {
      x: Number,
      y: Number,
      z: Number
    }
  },
  timeLimit: Number, // in minutes
  faction: String,
  status: { type: String, default: 'available' }, // available, active, completed, failed
  assignedTo: String, // player ID
  createdAt: { type: Date, default: Date.now },
  expiresAt: Date,
  completedAt: Date,
  aiGenerated: { type: Boolean, default: true }
});

const Mission = mongoose.model('Mission', missionSchema);

// Player Mission Progress Schema
const playerMissionSchema = new mongoose.Schema({
  playerId: String,
  missionId: String,
  progress: [{
    objectiveId: String,
    completed: Boolean,
    progress: Number,
    completedAt: Date
  }],
  startedAt: { type: Date, default: Date.now },
  completedAt: Date,
  status: { type: String, default: 'active' } // active, completed, failed, abandoned
});

const PlayerMission = mongoose.model('PlayerMission', playerMissionSchema);

// Mission System Service
class MissionSystemService {
  constructor() {
    this.missionTemplates = this.initializeMissionTemplates();
    this.factionData = this.initializeFactionData();
  }

  initializeMissionTemplates() {
    return {
      combat: {
        types: ['bounty_hunt', 'defense', 'assault', 'interception'],
        objectives: ['eliminate_targets', 'defend_location', 'escort_vessel', 'intercept_enemy'],
        locations: ['asteroid_belt', 'space_station', 'planet_surface', 'deep_space']
      },
      exploration: {
        types: ['survey', 'discovery', 'mapping', 'research'],
        objectives: ['scan_location', 'collect_samples', 'map_territory', 'analyze_anomaly'],
        locations: ['unknown_system', 'nebula', 'black_hole', 'ancient_ruins']
      },
      trading: {
        types: ['delivery', 'smuggling', 'escort', 'procurement'],
        objectives: ['deliver_cargo', 'acquire_resources', 'transport_passengers', 'smuggle_contraband'],
        locations: ['trading_post', 'spaceport', 'colony', 'outpost']
      },
      rescue: {
        types: ['search_rescue', 'medical_emergency', 'evacuation', 'recovery'],
        objectives: ['locate_survivors', 'provide_medical_aid', 'evacuate_civilians', 'recover_equipment'],
        locations: ['wreckage', 'medical_facility', 'colony', 'space_station']
      }
    };
  }

  initializeFactionData() {
    return {
      'celestial_empire': {
        name: 'Celestial Empire',
        reputation: 0,
        missions: ['combat', 'exploration'],
        rewards: { credits: 1.2, experience: 1.1 }
      },
      'quantum_alliance': {
        name: 'Quantum Alliance',
        reputation: 0,
        missions: ['trading', 'research'],
        rewards: { credits: 1.0, experience: 1.3 }
      },
      'void_pirates': {
        name: 'Void Pirates',
        reputation: 0,
        missions: ['smuggling', 'combat'],
        rewards: { credits: 1.5, experience: 0.8 }
      },
      'stellar_corporation': {
        name: 'Stellar Corporation',
        reputation: 0,
        missions: ['trading', 'escort'],
        rewards: { credits: 1.1, experience: 1.0 }
      }
    };
  }

  async generateMission(playerId, playerLevel, playerReputation) {
    try {
      // Determine mission type based on player stats and random selection
      const missionTypes = Object.keys(this.missionTemplates);
      const selectedType = missionTypes[Math.floor(Math.random() * missionTypes.length)];
      const template = this.missionTemplates[selectedType];
      
      // Select specific mission subtype
      const subtype = template.types[Math.floor(Math.random() * template.types.length)];
      
      // Generate mission using AI
      const missionData = await this.generateMissionWithAI(selectedType, subtype, playerLevel);
      
      // Calculate difficulty and rewards
      const difficulty = this.calculateDifficulty(playerLevel, missionData);
      const rewards = this.calculateRewards(difficulty, selectedType, playerReputation);
      
      // Create mission object
      const mission = new Mission({
        title: missionData.title,
        description: missionData.description,
        type: selectedType,
        difficulty,
        reward: rewards,
        requirements: {
          level: Math.max(1, playerLevel - 2),
          reputation: Math.max(0, playerReputation - 100),
          equipment: missionData.requiredEquipment || []
        },
        objectives: missionData.objectives,
        location: missionData.location,
        timeLimit: missionData.timeLimit || 60,
        faction: missionData.faction,
        expiresAt: moment().add(24, 'hours').toDate()
      });
      
      await mission.save();
      
      logger.info(`Generated mission: ${mission.title} for player ${playerId}`);
      return mission;
    } catch (error) {
      logger.error('Mission generation failed:', error);
      throw error;
    }
  }

  async generateMissionWithAI(missionType, subtype, playerLevel) {
    try {
      const prompt = `Generate a space mission for a level ${playerLevel} player in a sci-fi game called Celestial Syndicate.

Mission Type: ${missionType}
Subtype: ${subtype}

Requirements:
- Create an engaging title
- Write a detailed description (2-3 sentences)
- Generate 2-4 specific objectives
- Specify a location (star system, planet, coordinates)
- Suggest required equipment
- Assign a faction
- Set appropriate time limit

Format the response as JSON with these fields:
{
  "title": "Mission Title",
  "description": "Mission description",
  "objectives": [
    {
      "id": "obj_1",
      "description": "Objective description",
      "type": "objective_type",
      "target": "target_name",
      "quantity": 1
    }
  ],
  "location": {
    "system": "Star System Name",
    "planet": "Planet Name",
    "coordinates": {"x": 100, "y": 200, "z": 300}
  },
  "requiredEquipment": ["equipment1", "equipment2"],
  "faction": "faction_name",
  "timeLimit": 60
}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: "You are a mission generation AI for Celestial Syndicate. Create engaging, varied missions that fit the sci-fi space theme." },
          { role: "user", content: prompt }
        ],
        max_tokens: 800,
        temperature: 0.8
      });

      const response = completion.choices[0].message.content;
      return JSON.parse(response);
    } catch (error) {
      logger.error('AI mission generation failed:', error);
      // Fallback to template-based generation
      return this.generateFallbackMission(missionType, subtype);
    }
  }

  generateFallbackMission(missionType, subtype) {
    const fallbackMissions = {
      combat: {
        title: "Eliminate Void Pirates",
        description: "A group of Void Pirates has been terrorizing the trade routes in the Alpha Centauri system. Eliminate the threat to restore safe passage.",
        objectives: [
          {
            id: "obj_1",
            description: "Destroy 5 pirate vessels",
            type: "eliminate",
            target: "pirate_vessel",
            quantity: 5
          },
          {
            id: "obj_2",
            description: "Capture the pirate leader",
            type: "capture",
            target: "pirate_leader",
            quantity: 1
          }
        ],
        location: {
          system: "Alpha Centauri",
          planet: "None",
          coordinates: { x: 150, y: 75, z: 200 }
        },
        requiredEquipment: ["combat_shield", "pulse_rifle"],
        faction: "celestial_empire",
        timeLimit: 90
      },
      exploration: {
        title: "Survey Unknown Nebula",
        description: "A mysterious nebula has been detected in the outer reaches. Survey the area and collect data for scientific analysis.",
        objectives: [
          {
            id: "obj_1",
            description: "Scan 3 nebula sectors",
            type: "scan",
            target: "nebula_sector",
            quantity: 3
          },
          {
            id: "obj_2",
            description: "Collect gas samples",
            type: "collect",
            target: "gas_sample",
            quantity: 10
          }
        ],
        location: {
          system: "Outer Reaches",
          planet: "None",
          coordinates: { x: 500, y: 300, z: 800 }
        },
        requiredEquipment: ["scanner", "sample_collector"],
        faction: "quantum_alliance",
        timeLimit: 120
      }
    };

    return fallbackMissions[missionType] || fallbackMissions.combat;
  }

  calculateDifficulty(playerLevel, missionData) {
    // Base difficulty on player level and mission complexity
    let difficulty = Math.max(1, Math.min(10, playerLevel));
    
    // Adjust based on objectives
    difficulty += missionData.objectives.length * 0.5;
    
    // Adjust based on time limit
    if (missionData.timeLimit < 30) difficulty += 1;
    if (missionData.timeLimit > 120) difficulty -= 1;
    
    return Math.max(1, Math.min(10, Math.round(difficulty)));
  }

  calculateRewards(difficulty, missionType, playerReputation) {
    const baseCredits = difficulty * 100;
    const baseExperience = difficulty * 50;
    
    // Apply faction bonuses
    const faction = this.factionData[missionType] || this.factionData.celestial_empire;
    const creditMultiplier = faction.rewards.credits;
    const experienceMultiplier = faction.rewards.experience;
    
    // Apply reputation bonus
    const reputationBonus = Math.min(0.5, playerReputation / 1000);
    
    return {
      credits: Math.round(baseCredits * creditMultiplier * (1 + reputationBonus)),
      experience: Math.round(baseExperience * experienceMultiplier * (1 + reputationBonus)),
      items: this.generateRewardItems(difficulty, missionType)
    };
  }

  generateRewardItems(difficulty, missionType) {
    const items = [];
    
    // Common items
    if (difficulty >= 3) items.push('advanced_medkit');
    if (difficulty >= 5) items.push('shield_booster');
    if (difficulty >= 7) items.push('quantum_core');
    
    // Mission-specific items
    if (missionType === 'combat') {
      if (difficulty >= 4) items.push('pulse_rifle');
      if (difficulty >= 6) items.push('plasma_cannon');
    } else if (missionType === 'exploration') {
      if (difficulty >= 4) items.push('advanced_scanner');
      if (difficulty >= 6) items.push('quantum_sensor');
    }
    
    return items;
  }

  async assignMission(playerId, missionId) {
    try {
      const mission = await Mission.findOne({ id: missionId, status: 'available' });
      if (!mission) {
        throw new Error('Mission not available');
      }
      
      // Check requirements
      // In a real implementation, you'd check player stats here
      
      // Assign mission
      mission.status = 'active';
      mission.assignedTo = playerId;
      await mission.save();
      
      // Create player mission progress
      const playerMission = new PlayerMission({
        playerId,
        missionId,
        progress: mission.objectives.map(obj => ({
          objectiveId: obj.id,
          completed: false,
          progress: 0
        }))
      });
      
      await playerMission.save();
      
      // Cache mission data
      await redis.hset(`mission:${missionId}`, {
        status: 'active',
        assignedTo: playerId,
        startedAt: new Date().toISOString()
      });
      
      logger.info(`Mission ${missionId} assigned to player ${playerId}`);
      return { mission, playerMission };
    } catch (error) {
      logger.error('Mission assignment failed:', error);
      throw error;
    }
  }

  async updateMissionProgress(playerId, missionId, objectiveId, progress) {
    try {
      const playerMission = await PlayerMission.findOne({ playerId, missionId });
      if (!playerMission) {
        throw new Error('Player mission not found');
      }
      
      // Update objective progress
      const objective = playerMission.progress.find(p => p.objectiveId === objectiveId);
      if (objective) {
        objective.progress = progress;
        if (progress >= 100) {
          objective.completed = true;
          objective.completedAt = new Date();
        }
      }
      
      // Check if all objectives are complete
      const allCompleted = playerMission.progress.every(p => p.completed);
      if (allCompleted) {
        await this.completeMission(playerId, missionId);
      }
      
      await playerMission.save();
      
      // Emit progress update
      io.to(`player:${playerId}`).emit('mission-progress-update', {
        missionId,
        objectiveId,
        progress,
        completed: objective?.completed || false
      });
      
      return playerMission;
    } catch (error) {
      logger.error('Mission progress update failed:', error);
      throw error;
    }
  }

  async completeMission(playerId, missionId) {
    try {
      const mission = await Mission.findOne({ id: missionId });
      const playerMission = await PlayerMission.findOne({ playerId, missionId });
      
      if (!mission || !playerMission) {
        throw new Error('Mission not found');
      }
      
      // Update mission status
      mission.status = 'completed';
      mission.completedAt = new Date();
      await mission.save();
      
      // Update player mission
      playerMission.status = 'completed';
      playerMission.completedAt = new Date();
      await playerMission.save();
      
      // Award rewards
      // In a real implementation, you'd update player stats here
      
      // Emit completion event
      io.to(`player:${playerId}`).emit('mission-completed', {
        missionId,
        rewards: mission.reward,
        completedAt: new Date()
      });
      
      logger.info(`Mission ${missionId} completed by player ${playerId}`);
      return { mission, rewards: mission.reward };
    } catch (error) {
      logger.error('Mission completion failed:', error);
      throw error;
    }
  }

  async getAvailableMissions(playerId, playerLevel, playerReputation) {
    try {
      const missions = await Mission.find({ 
        status: 'available',
        'requirements.level': { $lte: playerLevel },
        'requirements.reputation': { $lte: playerReputation }
      }).limit(20);
      
      return missions;
    } catch (error) {
      logger.error('Get available missions failed:', error);
      throw error;
    }
  }

  async getPlayerMissions(playerId) {
    try {
      const playerMissions = await PlayerMission.find({ 
        playerId, 
        status: { $in: ['active', 'completed'] } 
      }).populate('missionId');
      
      return playerMissions;
    } catch (error) {
      logger.error('Get player missions failed:', error);
      throw error;
    }
  }

  async generateDailyMissions() {
    try {
      // Generate new missions for all players
      // In a real implementation, you'd get all active players
      const mockPlayers = [
        { id: 'player1', level: 5, reputation: 100 },
        { id: 'player2', level: 8, reputation: 250 },
        { id: 'player3', level: 3, reputation: 50 }
      ];
      
      for (const player of mockPlayers) {
        await this.generateMission(player.id, player.level, player.reputation);
      }
      
      logger.info('Daily missions generated');
    } catch (error) {
      logger.error('Daily mission generation failed:', error);
    }
  }
}

// Initialize mission system
const missionSystem = new MissionSystemService();

// Mission Routes
app.get('/api/missions/available', async (req, res) => {
  try {
    const { playerId, level, reputation } = req.query;
    const missions = await missionSystem.getAvailableMissions(playerId, parseInt(level), parseInt(reputation));
    
    res.json({
      success: true,
      data: missions,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Get available missions failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/missions/generate', async (req, res) => {
  try {
    const { playerId, playerLevel, playerReputation } = req.body;
    const mission = await missionSystem.generateMission(playerId, playerLevel, playerReputation);
    
    res.json({
      success: true,
      data: mission,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Mission generation failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/missions/assign', async (req, res) => {
  try {
    const { playerId, missionId } = req.body;
    const result = await missionSystem.assignMission(playerId, missionId);
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Mission assignment failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/missions/progress', async (req, res) => {
  try {
    const { playerId, missionId, objectiveId, progress } = req.body;
    const result = await missionSystem.updateMissionProgress(playerId, missionId, objectiveId, progress);
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Mission progress update failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/missions/player/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;
    const missions = await missionSystem.getPlayerMissions(playerId);
    
    res.json({
      success: true,
      data: missions,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Get player missions failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// WebSocket for real-time mission updates
io.on('connection', (socket) => {
  logger.info('Mission client connected:', socket.id);

  socket.on('join-player', (data) => {
    const { playerId } = data;
    socket.join(`player:${playerId}`);
    logger.info(`Player ${playerId} joined mission room`);
  });

  socket.on('leave-player', (data) => {
    const { playerId } = data;
    socket.leave(`player:${playerId}`);
    logger.info(`Player ${playerId} left mission room`);
  });

  socket.on('disconnect', () => {
    logger.info('Mission client disconnected:', socket.id);
  });
});

// Schedule daily mission generation
cron.schedule('0 0 * * *', async () => {
  try {
    await missionSystem.generateDailyMissions();
  } catch (error) {
    logger.error('Scheduled mission generation failed:', error);
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'Mission Service',
    timestamp: new Date().toISOString(),
    activeConnections: io.engine.clientsCount
  });
});

const PORT = process.env.PORT || 3007;
server.listen(PORT, () => {
  logger.info(`🎯 Mission Service running on port ${PORT}`);
  logger.info(`🤖 AI-powered mission generation enabled`);
  logger.info(`📡 Real-time mission updates active`);
});

module.exports = app; 