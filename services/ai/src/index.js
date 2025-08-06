const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { HfInference } = require('@huggingface/inference');
const QuantumService = require('./quantum');

// Initialize AI clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);
const quantumService = new QuantumService();

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

// AI Service Routes
app.post('/api/ai/npc-dialogue', async (req, res) => {
  try {
    const { character, context, playerInput } = req.body;
    
    const prompt = `You are ${character.name}, a ${character.type} in the Celestial Syndicate universe. 
    Context: ${context}
    Player says: "${playerInput}"
    
    Respond as ${character.name} would, staying in character and considering the context.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: `You are ${character.name} in the Celestial Syndicate universe.` },
        { role: "user", content: prompt }
      ],
      max_tokens: 150,
      temperature: 0.8
    });

    res.json({
      success: true,
      response: completion.choices[0].message.content,
      character: character.name
    });
  } catch (error) {
    console.error('NPC Dialogue Error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate NPC response' });
  }
});

app.post('/api/ai/mission-generation', async (req, res) => {
  try {
    const { playerLevel, location, missionType } = req.body;
    
    const prompt = `Generate a ${missionType} mission for a level ${playerLevel} player in ${location}.
    Include: mission title, description, objectives, rewards, and difficulty rating.
    Make it engaging and appropriate for the player's level.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are a mission generator for Celestial Syndicate." },
        { role: "user", content: prompt }
      ],
      max_tokens: 300,
      temperature: 0.7
    });

    res.json({
      success: true,
      mission: JSON.parse(completion.choices[0].message.content)
    });
  } catch (error) {
    console.error('Mission Generation Error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate mission' });
  }
});

app.post('/api/ai/procedural-content', async (req, res) => {
  try {
    const { contentType, parameters } = req.body;
    
    let prompt = '';
    switch (contentType) {
      case 'planet':
        prompt = `Generate a detailed description of a planet with these characteristics: ${JSON.stringify(parameters)}`;
        break;
      case 'spacecraft':
        prompt = `Design a spacecraft with specifications: ${JSON.stringify(parameters)}`;
        break;
      case 'faction':
        prompt = `Create a faction description with traits: ${JSON.stringify(parameters)}`;
        break;
      default:
        prompt = `Generate ${contentType} content with parameters: ${JSON.stringify(parameters)}`;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are a content generator for Celestial Syndicate." },
        { role: "user", content: prompt }
      ],
      max_tokens: 400,
      temperature: 0.8
    });

    res.json({
      success: true,
      content: JSON.parse(completion.choices[0].message.content)
    });
  } catch (error) {
    console.error('Procedural Content Error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate content' });
  }
});

// Google AI Integration
app.post('/api/ai/visual-description', async (req, res) => {
  try {
    const { description } = req.body;
    
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent(description);
    const response = await result.response;
    const text = response.text();

    res.json({
      success: true,
      enhancedDescription: text
    });
  } catch (error) {
    console.error('Visual Description Error:', error);
    res.status(500).json({ success: false, error: 'Failed to enhance description' });
  }
});

// HuggingFace Integration for specialized tasks
app.post('/api/ai/sentiment-analysis', async (req, res) => {
  try {
    const { text } = req.body;
    
    const result = await hf.textClassification({
      model: 'cardiffnlp/twitter-roberta-base-sentiment-latest',
      inputs: text
    });

    res.json({
      success: true,
      sentiment: result[0]
    });
  } catch (error) {
    console.error('Sentiment Analysis Error:', error);
    res.status(500).json({ success: false, error: 'Failed to analyze sentiment' });
  }
});

// Quantum computation endpoint
app.post('/api/ai/quantum-solve', async (req, res) => {
  try {
    const { type, payload } = req.body;
    let result;
    switch (type) {
      case 'braket-circuit':
        result = await quantumService.runBraketCircuit(payload.circuit, payload.device, payload.shots);
        break;
      case 'qiskit-circuit':
        result = await quantumService.runQiskitCircuit(payload.qasm, payload.backend, payload.shots);
        break;
      case 'quantum-optimization':
        result = await quantumService.quantumInspiredOptimization(payload.problem);
        break;
      case 'quantum-random':
        result = await quantumService.quantumRandom(payload.count);
        break;
      default:
        result = { error: 'Unknown quantum computation type' };
    }
    res.json({ success: true, result });
  } catch (error) {
    console.error('Quantum Solve Error:', error);
    res.status(500).json({ success: false, error: 'Quantum computation failed' });
  }
});

// Advanced quantum computation endpoints
app.post('/api/ai/quantum-grovers', async (req, res) => {
  try {
    const { database, oracle, shots } = req.body;
    const result = await quantumService.groversAlgorithm(database, oracle, shots);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Grover\'s Algorithm Error:', error);
    res.status(500).json({ success: false, error: 'Grover\'s algorithm failed' });
  }
});

app.post('/api/ai/quantum-shors', async (req, res) => {
  try {
    const { N, shots } = req.body;
    const result = await quantumService.shorsAlgorithm(N, shots);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Shor\'s Algorithm Error:', error);
    res.status(500).json({ success: false, error: 'Shor\'s algorithm failed' });
  }
});

app.post('/api/ai/quantum-vqe', async (req, res) => {
  try {
    const { hamiltonian, ansatz, shots } = req.body;
    const result = await quantumService.variationalQuantumEigensolver(hamiltonian, ansatz, shots);
    res.json({ success: true, result });
  } catch (error) {
    console.error('VQE Error:', error);
    res.status(500).json({ success: false, error: 'VQE failed' });
  }
});

app.post('/api/ai/quantum-neural-network', async (req, res) => {
  try {
    const { trainingData, labels, modelParams } = req.body;
    const result = await quantumService.quantumNeuralNetwork(trainingData, labels, modelParams);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Quantum Neural Network Error:', error);
    res.status(500).json({ success: false, error: 'Quantum neural network failed' });
  }
});

// Advanced AI endpoints for game features
app.post('/api/ai/combat-tactics', async (req, res) => {
  try {
    const { playerStats, enemyStats, environment, missionType } = req.body;
    
    const prompt = `Generate advanced combat tactics for a ${missionType} mission.
    Player: ${JSON.stringify(playerStats)}
    Enemy: ${JSON.stringify(enemyStats)}
    Environment: ${environment}
    
    Provide: tactical recommendations, weapon loadout, movement patterns, and risk assessment.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are a tactical AI for Celestial Syndicate combat missions." },
        { role: "user", content: prompt }
      ],
      max_tokens: 500,
      temperature: 0.7
    });

    res.json({
      success: true,
      tactics: JSON.parse(completion.choices[0].message.content)
    });
  } catch (error) {
    console.error('Combat Tactics Error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate combat tactics' });
  }
});

app.post('/api/ai/economy-simulation', async (req, res) => {
  try {
    const { marketData, playerActions, timeFrame } = req.body;
    
    // Use quantum-inspired optimization for market simulation
    const marketSimulation = await quantumService.quantumInspiredOptimization({
      type: 'market_simulation',
      data: marketData,
      actions: playerActions,
      timeframe: timeFrame
    });

    res.json({
      success: true,
      simulation: marketSimulation,
      predictions: {
        priceMovements: await generatePricePredictions(marketData),
        marketTrends: await analyzeMarketTrends(marketData),
        riskAssessment: await assessMarketRisk(marketData)
      }
    });
  } catch (error) {
    console.error('Economy Simulation Error:', error);
    res.status(500).json({ success: false, error: 'Economy simulation failed' });
  }
});

app.post('/api/ai/flight-navigation', async (req, res) => {
  try {
    const { currentPosition, destination, obstacles, fuel, missionType } = req.body;
    
    // Use quantum algorithms for optimal pathfinding
    const navigationData = {
      currentPosition,
      destination,
      obstacles,
      fuel,
      missionType
    };

    const optimalPath = await quantumService.quantumInspiredOptimization({
      type: 'pathfinding',
      data: navigationData
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are a navigation AI for space flight in Celestial Syndicate." },
        { role: "user", content: `Generate flight plan: ${JSON.stringify(navigationData)}` }
      ],
      max_tokens: 300,
      temperature: 0.6
    });

    res.json({
      success: true,
      optimalPath,
      flightPlan: JSON.parse(completion.choices[0].message.content),
      fuelEfficiency: calculateFuelEfficiency(optimalPath, fuel),
      riskLevel: assessFlightRisk(obstacles, missionType)
    });
  } catch (error) {
    console.error('Flight Navigation Error:', error);
    res.status(500).json({ success: false, error: 'Flight navigation failed' });
  }
});

// WebSocket for real-time AI interactions
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('ai-request', async (data) => {
    try {
      const { type, payload } = data;
      let response;

      switch (type) {
        case 'npc-dialogue':
          // Handle real-time NPC dialogue
          response = await handleRealTimeDialogue(payload);
          break;
        case 'mission-update':
          // Handle dynamic mission updates
          response = await handleMissionUpdate(payload);
          break;
        default:
          response = { error: 'Unknown request type' };
      }

      socket.emit('ai-response', response);
    } catch (error) {
      socket.emit('ai-error', { error: error.message });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Helper functions
async function handleRealTimeDialogue(payload) {
  const { character, context, playerInput } = payload;
  
  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: `You are ${character.name} in real-time conversation.` },
      { role: "user", content: `Context: ${context}\nPlayer: "${playerInput}"` }
    ],
    max_tokens: 100,
    temperature: 0.9
  });

  return {
    type: 'npc-dialogue',
    response: completion.choices[0].message.content,
    character: character.name
  };
}

async function handleMissionUpdate(payload) {
  const { missionId, playerAction, currentState } = payload;
  
  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: "You are a dynamic mission system." },
      { role: "user", content: `Mission ${missionId}: Player action "${playerAction}" in state ${currentState}. Update mission accordingly.` }
    ],
    max_tokens: 200,
    temperature: 0.7
  });

  return {
    type: 'mission-update',
    missionId,
    update: JSON.parse(completion.choices[0].message.content)
  };
}

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'AI Service',
    timestamp: new Date().toISOString(),
    aiProviders: {
      openai: !!process.env.OPENAI_API_KEY,
      google: !!process.env.GOOGLE_AI_API_KEY,
      huggingface: !!process.env.HUGGINGFACE_API_KEY
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 AI Service running on port ${PORT}`);
  console.log(`📡 WebSocket server ready for real-time AI interactions`);
  console.log(`🤖 AI Providers: OpenAI(${!!process.env.OPENAI_API_KEY}), Google(${!!process.env.GOOGLE_AI_API_KEY}), HuggingFace(${!!process.env.HUGGINGFACE_API_KEY})`);
});

module.exports = app; 