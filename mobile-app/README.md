# Celestial Syndicate Mobile Companion

A React Native mobile companion app for the Celestial Syndicate space simulation game. This app allows players to manage their fleet, track missions, and monitor their progress while away from the main game.

## Features

- 🚀 **Fleet Management**: View and manage your ships, crew, and cargo
- 🎯 **Mission Tracking**: Monitor active missions and their progress
- 👤 **Commander Profile**: View your stats, achievements, and progression
- 💫 **Real-time Updates**: Stay connected with your game progress

## Prerequisites

- Node.js (v14 or later)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (for Mac) or Android Studio (for Android development)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/celestial-syndicate.git
cd celestial-syndicate/mobile-app
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Start the development server:
```bash
npm start
# or
yarn start
```

4. Run on your preferred platform:
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Scan the QR code with Expo Go app on your physical device

## Development

### Project Structure

```
mobile-app/
├── src/
│   ├── screens/         # Screen components
│   ├── components/      # Reusable components
│   ├── navigation/      # Navigation configuration
│   ├── services/        # API and business logic
│   └── utils/          # Helper functions
├── assets/             # Images, fonts, etc.
└── App.tsx            # Root component
```

### Available Scripts

- `npm start` - Start the Expo development server
- `npm run ios` - Run on iOS simulator
- `npm run android` - Run on Android emulator
- `npm run web` - Run in web browser

## Building for Production

### iOS

1. Configure app.json with your iOS bundle identifier
2. Run `expo build:ios`
3. Follow the prompts to build through Expo's servers

### Android

1. Configure app.json with your Android package name
2. Run `expo build:android`
3. Follow the prompts to build through Expo's servers

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with React Native and Expo
- Inspired by Star Citizen's companion app
- Special thanks to the Celestial Syndicate development team 