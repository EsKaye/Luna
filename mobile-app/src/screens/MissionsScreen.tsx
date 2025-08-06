import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
} from 'react-native';

const mockMissions = [
  {
    id: '1',
    title: 'Deep Space Exploration',
    type: 'Exploration',
    status: 'In Progress',
    progress: 65,
    reward: '50,000 Credits',
    deadline: '2 days left',
    description: 'Chart unknown sectors in the Andromeda quadrant.',
  },
  {
    id: '2',
    title: 'Cargo Delivery',
    type: 'Transport',
    status: 'Active',
    progress: 30,
    reward: '25,000 Credits',
    deadline: '1 day left',
    description: 'Deliver medical supplies to the Orion Colony.',
  },
  {
    id: '3',
    title: 'Pirate Interception',
    type: 'Combat',
    status: 'Active',
    progress: 15,
    reward: '75,000 Credits',
    deadline: '3 days left',
    description: 'Intercept and neutralize pirate activity in sector 7G.',
  },
];

const ProgressBar = ({ progress }) => (
  <View style={styles.progressBarContainer}>
    <View style={[styles.progressBar, { width: `${progress}%` }]} />
  </View>
);

const MissionCard = ({ mission }) => (
  <TouchableOpacity style={styles.missionCard}>
    <View style={styles.missionHeader}>
      <View>
        <Text style={styles.missionTitle}>{mission.title}</Text>
        <Text style={styles.missionType}>{mission.type}</Text>
      </View>
      <Text style={[
        styles.missionStatus,
        { color: mission.status === 'In Progress' ? '#FFA000' : '#4CAF50' }
      ]}>
        {mission.status}
      </Text>
    </View>

    <Text style={styles.missionDescription}>{mission.description}</Text>

    <View style={styles.progressContainer}>
      <Text style={styles.progressText}>Progress: {mission.progress}%</Text>
      <ProgressBar progress={mission.progress} />
    </View>

    <View style={styles.missionFooter}>
      <View style={styles.footerItem}>
        <Text style={styles.footerLabel}>Reward</Text>
        <Text style={styles.footerValue}>{mission.reward}</Text>
      </View>
      <View style={styles.footerItem}>
        <Text style={styles.footerLabel}>Deadline</Text>
        <Text style={styles.footerValue}>{mission.deadline}</Text>
      </View>
    </View>
  </TouchableOpacity>
);

const MissionsScreen = () => {
  return (
    <View style={styles.container}>
      <FlatList
        data={mockMissions}
        renderItem={({ item }) => <MissionCard mission={item} />}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  listContainer: {
    padding: 16,
  },
  missionCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  missionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  missionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  missionType: {
    fontSize: 14,
    color: '#8f8f8f',
  },
  missionStatus: {
    fontSize: 14,
    fontWeight: '600',
  },
  missionDescription: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 16,
    lineHeight: 20,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressText: {
    fontSize: 14,
    color: '#8f8f8f',
    marginBottom: 8,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#2a2a3e',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 3,
  },
  missionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#2a2a3e',
    paddingTop: 12,
  },
  footerItem: {
    flex: 1,
  },
  footerLabel: {
    fontSize: 12,
    color: '#8f8f8f',
    marginBottom: 4,
  },
  footerValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
});

export default MissionsScreen; 