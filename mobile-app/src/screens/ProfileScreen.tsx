import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const mockCommander = {
  name: 'Commander Nova',
  rank: 'Elite',
  credits: '1,250,000',
  reputation: 85,
  missionsCompleted: 127,
  shipsOwned: 5,
  achievements: [
    {
      id: '1',
      title: 'Deep Space Pioneer',
      description: 'Explored 50 unknown sectors',
      progress: 100,
      icon: '🌌',
    },
    {
      id: '2',
      title: 'Combat Master',
      description: 'Defeated 100 enemy ships',
      progress: 75,
      icon: '⚔️',
    },
    {
      id: '3',
      title: 'Trading Tycoon',
      description: 'Earned 1,000,000 credits from trading',
      progress: 60,
      icon: '💰',
    },
  ],
};

const StatCard = ({ title, value }) => (
  <View style={styles.statCard}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statTitle}>{title}</Text>
  </View>
);

const AchievementCard = ({ achievement }) => (
  <View style={styles.achievementCard}>
    <Text style={styles.achievementIcon}>{achievement.icon}</Text>
    <View style={styles.achievementContent}>
      <Text style={styles.achievementTitle}>{achievement.title}</Text>
      <Text style={styles.achievementDescription}>
        {achievement.description}
      </Text>
      <View style={styles.achievementProgress}>
        <View style={styles.progressBarContainer}>
          <View 
            style={[
              styles.progressBar,
              { width: `${achievement.progress}%` }
            ]} 
          />
        </View>
        <Text style={styles.progressText}>{achievement.progress}%</Text>
      </View>
    </View>
  </View>
);

const ProfileScreen = () => {
  return (
    <ScrollView style={styles.container}>
      <LinearGradient
        colors={['#1a1a2e', '#16213e']}
        style={styles.header}
      >
        <Text style={styles.commanderName}>{mockCommander.name}</Text>
        <Text style={styles.commanderRank}>{mockCommander.rank}</Text>
        <Text style={styles.commanderCredits}>
          {mockCommander.credits} Credits
        </Text>
      </LinearGradient>

      <View style={styles.statsContainer}>
        <StatCard
          title="Reputation"
          value={`${mockCommander.reputation}%`}
        />
        <StatCard
          title="Missions"
          value={mockCommander.missionsCompleted}
        />
        <StatCard
          title="Ships"
          value={mockCommander.shipsOwned}
        />
      </View>

      <View style={styles.achievementsContainer}>
        <Text style={styles.sectionTitle}>Achievements</Text>
        {mockCommander.achievements.map(achievement => (
          <AchievementCard
            key={achievement.id}
            achievement={achievement}
          />
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  header: {
    padding: 20,
    paddingTop: 40,
    paddingBottom: 40,
    alignItems: 'center',
  },
  commanderName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  commanderRank: {
    fontSize: 18,
    color: '#FFD700',
    marginBottom: 8,
  },
  commanderCredits: {
    fontSize: 16,
    color: '#8f8f8f',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    marginTop: -20,
  },
  statCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 12,
    color: '#8f8f8f',
  },
  achievementsContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  achievementCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  achievementIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  achievementContent: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  achievementDescription: {
    fontSize: 14,
    color: '#8f8f8f',
    marginBottom: 8,
  },
  achievementProgress: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBarContainer: {
    flex: 1,
    height: 6,
    backgroundColor: '#2a2a3e',
    borderRadius: 3,
    marginRight: 8,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#8f8f8f',
    width: 40,
    textAlign: 'right',
  },
});

export default ProfileScreen; 