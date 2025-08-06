import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Wallet {
  id: string;
  address: string;
  chain: string;
  balance: number;
  currency: string;
}

interface NFT {
  id: string;
  name: string;
  description: string;
  image: string;
  chain: string;
  tokenId: string;
  contractAddress: string;
}

interface Asset {
  symbol: string;
  amount: number;
  value: number;
  change24h: number;
}

const WalletScreen: React.FC = () => {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);

  useEffect(() => {
    loadWalletData();
  }, []);

  const loadWalletData = async () => {
    try {
      setLoading(true);
      
      // Simulate API calls
      const mockWallets: Wallet[] = [
        {
          id: '1',
          address: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
          chain: 'ethereum',
          balance: 1.234,
          currency: 'ETH'
        },
        {
          id: '2',
          address: '0x8ba1f109551bD432803012645Hac136c772c3',
          chain: 'polygon',
          balance: 100.5,
          currency: 'MATIC'
        }
      ];

      const mockNFTs: NFT[] = [
        {
          id: '1',
          name: 'Celestial Spaceship #001',
          description: 'Rare spaceship NFT with quantum drive',
          image: 'https://via.placeholder.com/150',
          chain: 'ethereum',
          tokenId: '1',
          contractAddress: '0x1234567890abcdef'
        },
        {
          id: '2',
          name: 'Quantum Weapon #042',
          description: 'Advanced weapon system NFT',
          image: 'https://via.placeholder.com/150',
          chain: 'polygon',
          tokenId: '42',
          contractAddress: '0xabcdef1234567890'
        }
      ];

      const mockAssets: Asset[] = [
        { symbol: 'CELESTIAL', amount: 1000, value: 1000, change24h: 5.2 },
        { symbol: 'SPACESHIP', amount: 5, value: 500, change24h: -2.1 },
        { symbol: 'FUEL', amount: 50, value: 2500, change24h: 1.8 },
        { symbol: 'WEAPONS', amount: 3, value: 600, change24h: 3.4 }
      ];

      setWallets(mockWallets);
      setNfts(mockNFTs);
      setAssets(mockAssets);
      setSelectedWallet(mockWallets[0]?.id || null);
    } catch (error) {
      Alert.alert('Error', 'Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  };

  const createWallet = async (chain: string) => {
    try {
      // In a real app, this would call the blockchain service
      Alert.alert('Success', `New ${chain} wallet created!`);
      loadWalletData();
    } catch (error) {
      Alert.alert('Error', 'Failed to create wallet');
    }
  };

  const sendTransaction = async () => {
    if (!selectedWallet) {
      Alert.alert('Error', 'Please select a wallet first');
      return;
    }
    
    // In a real app, this would open a transaction modal
    Alert.alert('Transaction', 'Transaction feature coming soon!');
  };

  const mintNFT = async () => {
    if (!selectedWallet) {
      Alert.alert('Error', 'Please select a wallet first');
      return;
    }
    
    // In a real app, this would open an NFT minting modal
    Alert.alert('NFT Minting', 'NFT minting feature coming soon!');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading wallet data...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Wallet</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={loadWalletData}>
          <Ionicons name="refresh" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Wallets Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Wallets</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => createWallet('ethereum')}>
            <Ionicons name="add" size={20} color="#007AFF" />
          </TouchableOpacity>
        </View>
        
        {wallets.map((wallet) => (
          <TouchableOpacity
            key={wallet.id}
            style={[
              styles.walletCard,
              selectedWallet === wallet.id && styles.selectedWallet
            ]}
            onPress={() => setSelectedWallet(wallet.id)}
          >
            <View style={styles.walletInfo}>
              <Text style={styles.walletChain}>{wallet.chain.toUpperCase()}</Text>
              <Text style={styles.walletAddress} numberOfLines={1}>
                {wallet.address}
              </Text>
            </View>
            <View style={styles.walletBalance}>
              <Text style={styles.balanceAmount}>{wallet.balance}</Text>
              <Text style={styles.balanceCurrency}>{wallet.currency}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Assets Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Game Assets</Text>
          <TouchableOpacity style={styles.addButton} onPress={sendTransaction}>
            <Ionicons name="swap-horizontal" size={20} color="#007AFF" />
          </TouchableOpacity>
        </View>
        
        {assets.map((asset) => (
          <View key={asset.symbol} style={styles.assetCard}>
            <View style={styles.assetInfo}>
              <Text style={styles.assetSymbol}>{asset.symbol}</Text>
              <Text style={styles.assetAmount}>{asset.amount}</Text>
            </View>
            <View style={styles.assetValue}>
              <Text style={styles.valueAmount}>${asset.value}</Text>
              <Text style={[
                styles.change24h,
                asset.change24h >= 0 ? styles.positiveChange : styles.negativeChange
              ]}>
                {asset.change24h >= 0 ? '+' : ''}{asset.change24h}%
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* NFTs Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>NFTs</Text>
          <TouchableOpacity style={styles.addButton} onPress={mintNFT}>
            <Ionicons name="add-circle" size={20} color="#007AFF" />
          </TouchableOpacity>
        </View>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {nfts.map((nft) => (
            <View key={nft.id} style={styles.nftCard}>
              <View style={styles.nftImage}>
                <Ionicons name="image" size={40} color="#666" />
              </View>
              <Text style={styles.nftName} numberOfLines={1}>{nft.name}</Text>
              <Text style={styles.nftChain}>{nft.chain.toUpperCase()}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.actionButton} onPress={sendTransaction}>
          <Ionicons name="send" size={20} color="white" />
          <Text style={styles.actionButtonText}>Send</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton} onPress={mintNFT}>
          <Ionicons name="add-circle" size={20} color="white" />
          <Text style={styles.actionButtonText}>Mint NFT</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  refreshButton: {
    padding: 5,
  },
  section: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    padding: 5,
  },
  walletCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedWallet: {
    backgroundColor: '#e3f2fd',
    borderColor: '#007AFF',
    borderWidth: 1,
  },
  walletInfo: {
    flex: 1,
  },
  walletChain: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  walletAddress: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  walletBalance: {
    alignItems: 'flex-end',
  },
  balanceAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  balanceCurrency: {
    fontSize: 12,
    color: '#666',
  },
  assetCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
  },
  assetInfo: {
    flex: 1,
  },
  assetSymbol: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  assetAmount: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  assetValue: {
    alignItems: 'flex-end',
  },
  valueAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  change24h: {
    fontSize: 12,
    marginTop: 4,
  },
  positiveChange: {
    color: '#4caf50',
  },
  negativeChange: {
    color: '#f44336',
  },
  nftCard: {
    width: 120,
    marginRight: 12,
    alignItems: 'center',
  },
  nftImage: {
    width: 80,
    height: 80,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  nftName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  nftChain: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default WalletScreen; 