# Development Setup Guide

## Prerequisites

### Required Software
- **Node.js**: Version 18.0.0 or higher
- **Git**: Latest version
- **Visual Studio Code**: Recommended IDE
- **Docker**: For containerized development
- **PostgreSQL**: Database (or use Docker)
- **Redis**: Caching layer (or use Docker)

### Game Development
- **Unreal Engine 5.3+**: Game engine
- **Visual Studio 2022**: C++ development
- **Windows 10/11**: For Unreal Engine development

### Mobile Development
- **Expo CLI**: `npm install -g expo-cli`
- **iOS Simulator**: For Mac users
- **Android Studio**: For Android development

## Environment Setup

### 1. Clone the Repository
```bash
git clone https://github.com/M-K-World-Wide/Celesstial.git
cd Celesstial
```

### 2. Environment Variables
Create `.env` files for each service:

#### Root `.env`
```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/celestial_syndicate
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# API Keys
OPENAI_API_KEY=your-openai-api-key
GOOGLE_AI_API_KEY=your-google-ai-api-key
HUGGINGFACE_API_KEY=your-huggingface-api-key
WOLFRAM_ALPHA_API_KEY=your-wolfram-alpha-api-key

# Blockchain
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/your-project-id
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
POLYGON_RPC_URL=https://polygon-rpc.com

# NASA/ESA APIs
NASA_API_KEY=your-nasa-api-key
ESA_API_KEY=your-esa-api-key

# Cloud Services
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=celestial-syndicate-assets

# Monitoring
SENTRY_DSN=your-sentry-dsn
NEW_RELIC_LICENSE_KEY=your-new-relic-key
```

### 3. Database Setup
```bash
# Using Docker
docker run --name celestial-postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=celestial_syndicate -p 5432:5432 -d postgres:15

docker run --name celestial-redis -p 6379:6379 -d redis:7-alpine
```

### 4. Service Installation

#### AI Service
```bash
cd services/ai
npm install
npm run dev
```

#### Blockchain Service
```bash
cd services/blockchain
npm install
npm run dev
```

#### Scientific Data Service
```bash
cd services/scientific
npm install
npm run dev
```

#### Mobile App
```bash
cd mobile-app
npm install
npm start
```

## Development Workflow

### 1. Code Quality
```bash
# Lint all services
npm run lint

# Run tests
npm test

# Type checking (TypeScript)
npm run type-check
```

### 2. Database Migrations
```bash
# Create migration
npm run migration:create -- --name add_user_table

# Run migrations
npm run migration:run

# Revert migration
npm run migration:revert
```

### 3. API Development
```bash
# Start all services
npm run dev:all

# Start specific service
npm run dev:ai
npm run dev:blockchain
npm run dev:scientific
```

### 4. Testing
```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Coverage report
npm run test:coverage
```

## Game Development Setup

### 1. Unreal Engine Project
1. Open Epic Games Launcher
2. Create new project from "Games" template
3. Enable C++ development
4. Copy `game/Source/` and `game/Content/` to your project
5. Configure project settings

### 2. Required Plugins
- Enhanced Input
- Physics Control
- Network Prediction
- Gameplay Abilities
- Enhanced Input
- Modular Gameplay

### 3. Build Configuration
```bash
# Generate Visual Studio project
# Right-click .uproject file → Generate Visual Studio project files

# Build from command line
"C:\Program Files\Epic Games\UE_5.3\Engine\Binaries\DotNET\UnrealBuildTool\UnrealBuildTool.exe" CelestialSyndicate Win64 Development -Project="path\to\your\project.uproject"
```

## Mobile Development

### 1. Expo Setup
```bash
cd mobile-app
npm install
npx expo start
```

### 2. Platform-Specific Development
```bash
# iOS
npx expo run:ios

# Android
npx expo run:android

# Web
npx expo start --web
```

### 3. Testing on Device
1. Install Expo Go app
2. Scan QR code from terminal
3. App will load on your device

## API Development

### 1. API Documentation
- Swagger UI: `http://localhost:3001/api-docs`
- Postman Collection: `docs/api/postman-collection.json`

### 2. Testing APIs
```bash
# Health checks
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health

# AI Service test
curl -X POST http://localhost:3001/api/ai/npc-dialogue \
  -H "Content-Type: application/json" \
  -d '{"character":{"name":"Athena","type":"AI"}, "context":"Space station", "playerInput":"Hello"}'
```

## Deployment

### 1. Docker Build
```bash
# Build all services
docker-compose build

# Run in production mode
docker-compose -f docker-compose.prod.yml up -d
```

### 2. Environment-Specific Configs
```bash
# Development
npm run dev

# Staging
npm run build:staging
npm run start:staging

# Production
npm run build:prod
npm run start:prod
```

## Troubleshooting

### Common Issues

#### Node.js Version
```bash
# Check version
node --version

# Use nvm to switch versions
nvm use 18
```

#### Port Conflicts
```bash
# Check what's using a port
netstat -ano | findstr :3001

# Kill process
taskkill /PID <process-id> /F
```

#### Database Connection
```bash
# Test connection
psql -h localhost -U username -d celestial_syndicate

# Reset database
npm run db:reset
```

#### Unreal Engine Issues
- Regenerate project files
- Clean and rebuild
- Check plugin compatibility
- Verify Visual Studio installation

## Performance Optimization

### 1. Development Mode
```bash
# Enable hot reload
npm run dev:watch

# Enable debugging
DEBUG=* npm run dev
```

### 2. Production Build
```bash
# Optimize builds
npm run build:optimized

# Bundle analysis
npm run analyze
```

## Contributing

### 1. Code Standards
- Follow ESLint configuration
- Use Prettier for formatting
- Write unit tests for new features
- Update documentation

### 2. Git Workflow
```bash
# Create feature branch
git checkout -b feature/amazing-feature

# Make changes and commit
git add .
git commit -m "feat: add amazing feature"

# Push and create PR
git push origin feature/amazing-feature
```

### 3. Pull Request Process
1. Fork the repository
2. Create feature branch
3. Make changes
4. Add tests
5. Update documentation
6. Submit pull request

## Support

- **Discord**: [Join our community](https://discord.gg/celestialsyndicate)
- **Issues**: [GitHub Issues](https://github.com/M-K-World-Wide/Celesstial/issues)
- **Wiki**: [Project Wiki](https://github.com/M-K-World-Wide/Celesstial/wiki)

---

*This guide is continuously updated. Check the latest version in the repository.* 