import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
} from 'react-native';

const mockShips = [
  {
    id: '1',
    name: 'Nova Star',
    type: 'Combat',
    status: 'Active',
    crew: 3,
    cargo: '75%',
    health: '92%',
  },
  {
    id: '2',
    name: 'Quantum Runner',
    type: 'Transport',
    status: 'Docked',
    crew: 2,
    cargo: '45%',
    health: '100%',
  },
  {
    id: '3',
    name: 'Celestial Explorer',
    type: 'Exploration',
    status: 'Maintenance',
    crew: 4,
    cargo: '30%',
    health: '78%',
  },
];

const ShipCard = ({ ship }) => (
  <TouchableOpacity style={styles.shipCard}>
    <View style={styles.shipHeader}>
      <Text style={styles.shipName}>{ship.name}</Text>
      <Text style={[
        styles.shipStatus,
        { color: ship.status === 'Active' ? '#4CAF50' : 
                ship.status === 'Docked' ? '#2196F3' : '#FFA000' }
      ]}>
        {ship.status}
      </Text>
    </View>
    
    <View style={styles.shipDetails}>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Type:</Text>
        <Text style={styles.detailValue}>{ship.type}</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Crew:</Text>
        <Text style={styles.detailValue}>{ship.crew} members</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Cargo:</Text>
        <Text style={styles.detailValue}>{ship.cargo}</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Health:</Text>
        <Text style={[
          styles.detailValue,
          { color: parseInt(ship.health) > 90 ? '#4CAF50' : 
                  parseInt(ship.health) > 70 ? '#FFA000' : '#F44336' }
        ]}>
          {ship.health}
        </Text>
      </View>
    </View>
  </TouchableOpacity>
);

const FleetScreen = () => {
  return (
    <View style={styles.container}>
      <FlatList
        data={mockShips}
        renderItem={({ item }) => <ShipCard ship={item} />}
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
  shipCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  shipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  shipName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  shipStatus: {
    fontSize: 14,
    fontWeight: '600',
  },
  shipDetails: {
    borderTopWidth: 1,
    borderTopColor: '#2a2a3e',
    paddingTop: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#8f8f8f',
  },
  detailValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
});

export default FleetScreen; 