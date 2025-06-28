import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen from './src/screens/HomeScreen';
import FleetScreen from './src/screens/FleetScreen';
import MissionsScreen from './src/screens/MissionsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import WalletScreen from './src/screens/WalletScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: keyof typeof Ionicons.glyphMap;

            if (route.name === 'Home') {
              iconName = focused ? 'home' : 'home-outline';
            } else if (route.name === 'Fleet') {
              iconName = focused ? 'rocket' : 'rocket-outline';
            } else if (route.name === 'Missions') {
              iconName = focused ? 'list' : 'list-outline';
            } else if (route.name === 'Wallet') {
              iconName = focused ? 'wallet' : 'wallet-outline';
            } else if (route.name === 'Profile') {
              iconName = focused ? 'person' : 'person-outline';
            } else {
              iconName = 'help-outline';
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#007AFF',
          tabBarInactiveTintColor: 'gray',
          headerStyle: {
            backgroundColor: '#007AFF',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        })}
      >
        <Tab.Screen 
          name="Home" 
          component={HomeScreen} 
          options={{ title: 'Celestial Syndicate' }}
        />
        <Tab.Screen 
          name="Fleet" 
          component={FleetScreen} 
          options={{ title: 'Fleet Management' }}
        />
        <Tab.Screen 
          name="Missions" 
          component={MissionsScreen} 
          options={{ title: 'Missions' }}
        />
        <Tab.Screen 
          name="Wallet" 
          component={WalletScreen} 
          options={{ title: 'Wallet & Assets' }}
        />
        <Tab.Screen 
          name="Profile" 
          component={ProfileScreen} 
          options={{ title: 'Profile' }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
} 