const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { createServer } = require('http');
const { Server } = require('socket.io');
const Web3 = require('web3');
const ethers = require('ethers');
const { Connection, PublicKey, clusterApiUrl } = require('@solana/web3.js');
const { Keypair } = require('@solana/web3.js');
const { Token, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const { TezosToolkit } = require('@taquito/taquito');
const { InMemorySigner } = require('@taquito/signer');
const { Contract } = require('@taquito/contract');
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

// Blockchain Service Manager
class BlockchainServiceManager {
  constructor() {
    this.providers = new Map();
    this.contracts = new Map();
    this.wallets = new Map();
    this.initializeProviders();
  }

  async initializeProviders() {
    try {
      // Ethereum/EVM chains
      if (process.env.ETHEREUM_RPC_URL) {
        this.providers.set('ethereum', new Web3(process.env.ETHEREUM_RPC_URL));
        this.providers.set('polygon', new Web3(process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com'));
        this.providers.set('bsc', new Web3(process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org'));
        this.providers.set('arbitrum', new Web3(process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc'));
      }

      // Solana
      if (process.env.SOLANA_RPC_URL) {
        this.providers.set('solana', new Connection(process.env.SOLANA_RPC_URL, 'confirmed'));
      } else {
        this.providers.set('solana', new Connection(clusterApiUrl('devnet'), 'confirmed'));
      }

      // Tezos
      if (process.env.TEZOS_RPC_URL) {
        this.providers.set('tezos', new TezosToolkit(process.env.TEZOS_RPC_URL));
      }

      // Polkadot (simulated)
      this.providers.set('polkadot', { type: 'polkadot', status: 'simulated' });

      console.log(`Blockchain providers initialized: ${Array.from(this.providers.keys()).join(', ')}`);

    } catch (error) {
      console.error('Blockchain provider initialization failed:', error);
    }
  }

  async getProvider(chain) {
    const provider = this.providers.get(chain);
    if (!provider) {
      throw new Error(`Provider for chain ${chain} not available`);
    }
    return provider;
  }

  async createWallet(chain, mnemonic = null) {
    try {
      let wallet;

      switch (chain) {
        case 'ethereum':
        case 'polygon':
        case 'bsc':
        case 'arbitrum':
          const provider = await this.getProvider(chain);
          if (mnemonic) {
            wallet = ethers.Wallet.fromMnemonic(mnemonic).connect(provider);
          } else {
            wallet = ethers.Wallet.createRandom().connect(provider);
          }
          break;

        case 'solana':
          const solanaProvider = await this.getProvider(chain);
          if (mnemonic) {
            // In a real implementation, you'd derive from mnemonic
            wallet = Keypair.generate();
          } else {
            wallet = Keypair.generate();
          }
          break;

        case 'tezos':
          const tezosProvider = await this.getProvider(chain);
          if (mnemonic) {
            wallet = await InMemorySigner.fromMnemonic({ mnemonic });
          } else {
            // Generate new mnemonic for Tezos
            wallet = await InMemorySigner.fromMnemonic({ 
              mnemonic: ethers.Wallet.createRandom().mnemonic.phrase 
            });
          }
          break;

        default:
          throw new Error(`Unsupported chain: ${chain}`);
      }

      const walletId = this.generateWalletId();
      this.wallets.set(walletId, { chain, wallet, createdAt: new Date().toISOString() });

      return {
        walletId,
        chain,
        address: await this.getWalletAddress(wallet, chain),
        publicKey: await this.getWalletPublicKey(wallet, chain)
      };

    } catch (error) {
      console.error('Wallet creation failed:', error);
      throw error;
    }
  }

  async getWalletAddress(wallet, chain) {
    try {
      switch (chain) {
        case 'ethereum':
        case 'polygon':
        case 'bsc':
        case 'arbitrum':
          return wallet.address;
        case 'solana':
          return wallet.publicKey.toString();
        case 'tezos':
          return await wallet.publicKeyHash();
        default:
          throw new Error(`Unsupported chain: ${chain}`);
      }
    } catch (error) {
      console.error('Get wallet address failed:', error);
      throw error;
    }
  }

  async getWalletPublicKey(wallet, chain) {
    try {
      switch (chain) {
        case 'ethereum':
        case 'polygon':
        case 'bsc':
        case 'arbitrum':
          return wallet.publicKey;
        case 'solana':
          return wallet.publicKey.toString();
        case 'tezos':
          return await wallet.publicKey();
        default:
          throw new Error(`Unsupported chain: ${chain}`);
      }
    } catch (error) {
      console.error('Get wallet public key failed:', error);
      throw error;
    }
  }

  async getBalance(walletId, chain) {
    try {
      const walletInfo = this.wallets.get(walletId);
      if (!walletInfo || walletInfo.chain !== chain) {
        throw new Error('Wallet not found or chain mismatch');
      }

      const provider = await this.getProvider(chain);
      const address = await this.getWalletAddress(walletInfo.wallet, chain);

      switch (chain) {
        case 'ethereum':
        case 'polygon':
        case 'bsc':
        case 'arbitrum':
          const balance = await provider.eth.getBalance(address);
          return {
            balance: ethers.utils.formatEther(balance),
            symbol: 'ETH',
            decimals: 18
          };

        case 'solana':
          const solBalance = await provider.getBalance(new PublicKey(address));
          return {
            balance: solBalance / 1e9, // Convert lamports to SOL
            symbol: 'SOL',
            decimals: 9
          };

        case 'tezos':
          const tezosBalance = await provider.tz.getBalance(address);
          return {
            balance: tezosBalance.toNumber() / 1e6, // Convert mutez to XTZ
            symbol: 'XTZ',
            decimals: 6
          };

        default:
          throw new Error(`Unsupported chain: ${chain}`);
      }

    } catch (error) {
      console.error('Get balance failed:', error);
      throw error;
    }
  }

  async sendTransaction(walletId, chain, to, amount, data = null) {
    try {
      const walletInfo = this.wallets.get(walletId);
      if (!walletInfo || walletInfo.chain !== chain) {
        throw new Error('Wallet not found or chain mismatch');
      }

      const provider = await this.getProvider(chain);
      const txHash = await this.createTransaction(walletInfo.wallet, chain, to, amount, data);

      return {
        txHash,
        chain,
        from: await this.getWalletAddress(walletInfo.wallet, chain),
        to,
        amount,
        status: 'pending'
      };

    } catch (error) {
      console.error('Send transaction failed:', error);
      throw error;
    }
  }

  async createTransaction(wallet, chain, to, amount, data = null) {
    try {
      switch (chain) {
        case 'ethereum':
        case 'polygon':
        case 'bsc':
        case 'arbitrum':
          const tx = {
            to,
            value: ethers.utils.parseEther(amount.toString()),
            ...(data && { data })
          };
          const signedTx = await wallet.signTransaction(tx);
          const provider = await this.getProvider(chain);
          const result = await provider.eth.sendSignedTransaction(signedTx);
          return result.transactionHash;

        case 'solana':
          const solanaProvider = await this.getProvider(chain);
          const transaction = new solanaProvider.Transaction().add(
            solanaProvider.SystemProgram.transfer({
              fromPubkey: wallet.publicKey,
              toPubkey: new PublicKey(to),
              lamports: amount * 1e9 // Convert SOL to lamports
            })
          );
          const signature = await solanaProvider.sendTransaction(transaction, [wallet]);
          return signature;

        case 'tezos':
          const tezosProvider = await this.getProvider(chain);
          const op = await tezosProvider.contract.transfer({
            to,
            amount: amount * 1e6 // Convert XTZ to mutez
          });
          await op.confirmation();
          return op.hash;

        default:
          throw new Error(`Unsupported chain: ${chain}`);
      }

    } catch (error) {
      console.error('Create transaction failed:', error);
      throw error;
    }
  }

  async deploySmartContract(walletId, chain, contractCode, constructorArgs = []) {
    try {
      const walletInfo = this.wallets.get(walletId);
      if (!walletInfo || walletInfo.chain !== chain) {
        throw new Error('Wallet not found or chain mismatch');
      }

      switch (chain) {
        case 'ethereum':
        case 'polygon':
        case 'bsc':
        case 'arbitrum':
          const provider = await this.getProvider(chain);
          const factory = new ethers.ContractFactory(
            contractCode.abi,
            contractCode.bytecode,
            walletInfo.wallet
          );
          const contract = await factory.deploy(...constructorArgs);
          await contract.deployed();

          const contractId = this.generateContractId();
          this.contracts.set(contractId, {
            id: contractId,
            chain,
            address: contract.address,
            abi: contractCode.abi,
            deployedAt: new Date().toISOString()
          });

          return {
            contractId,
            address: contract.address,
            chain,
            txHash: contract.deployTransaction.hash
          };

        default:
          throw new Error(`Smart contract deployment not supported for chain: ${chain}`);
      }

    } catch (error) {
      console.error('Smart contract deployment failed:', error);
      throw error;
    }
  }

  async callSmartContract(contractId, method, args = []) {
    try {
      const contractInfo = this.contracts.get(contractId);
      if (!contractInfo) {
        throw new Error('Contract not found');
      }

      const provider = await this.getProvider(contractInfo.chain);
      const contract = new ethers.Contract(
        contractInfo.address,
        contractInfo.abi,
        provider
      );

      const result = await contract[method](...args);
      return result;

    } catch (error) {
      console.error('Smart contract call failed:', error);
      throw error;
    }
  }

  async createNFT(walletId, chain, metadata) {
    try {
      const walletInfo = this.wallets.get(walletId);
      if (!walletInfo || walletInfo.chain !== chain) {
        throw new Error('Wallet not found or chain mismatch');
      }

      const nftId = this.generateNFTId();
      const nftData = {
        id: nftId,
        chain,
        metadata,
        owner: await this.getWalletAddress(walletInfo.wallet, chain),
        createdAt: new Date().toISOString()
      };

      // Store NFT metadata
      await this.storeNFTMetadata(nftId, nftData);

      return nftData;

    } catch (error) {
      console.error('NFT creation failed:', error);
      throw error;
    }
  }

  async storeNFTMetadata(nftId, metadata) {
    try {
      // In a real implementation, you'd store this on IPFS or similar
      // For now, we'll store it in memory
      const nftStorage = new Map();
      nftStorage.set(nftId, metadata);
      
      return true;
    } catch (error) {
      console.error('NFT metadata storage failed:', error);
      throw error;
    }
  }

  async getNFT(nftId) {
    try {
      // In a real implementation, you'd fetch from IPFS or blockchain
      const nftStorage = new Map();
      return nftStorage.get(nftId);
    } catch (error) {
      console.error('Get NFT failed:', error);
      throw error;
    }
  }

  generateWalletId() {
    return `wallet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateContractId() {
    return `contract_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateNFTId() {
    return `nft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Initialize blockchain service manager
const blockchainManager = new BlockchainServiceManager();

// Blockchain Routes
app.post('/api/blockchain/wallet/create', async (req, res) => {
  try {
    const { chain, mnemonic } = req.body;
    const wallet = await blockchainManager.createWallet(chain, mnemonic);
    
    res.json({
      success: true,
      data: wallet,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/blockchain/wallet/:walletId/balance', async (req, res) => {
  try {
    const { walletId } = req.params;
    const { chain } = req.query;
    const balance = await blockchainManager.getBalance(walletId, chain);
    
    res.json({
      success: true,
      data: balance,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/blockchain/transaction/send', async (req, res) => {
  try {
    const { walletId, chain, to, amount, data } = req.body;
    const transaction = await blockchainManager.sendTransaction(walletId, chain, to, amount, data);
    
    res.json({
      success: true,
      data: transaction,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/blockchain/contract/deploy', async (req, res) => {
  try {
    const { walletId, chain, contractCode, constructorArgs } = req.body;
    const contract = await blockchainManager.deploySmartContract(walletId, chain, contractCode, constructorArgs);
    
    res.json({
      success: true,
      data: contract,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/blockchain/contract/:contractId/call', async (req, res) => {
  try {
    const { contractId } = req.params;
    const { method, args } = req.body;
    const result = await blockchainManager.callSmartContract(contractId, method, args);
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/blockchain/nft/create', async (req, res) => {
  try {
    const { walletId, chain, metadata } = req.body;
    const nft = await blockchainManager.createNFT(walletId, chain, metadata);
    
    res.json({
      success: true,
      data: nft,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/blockchain/nft/:nftId', async (req, res) => {
  try {
    const { nftId } = req.params;
    const nft = await blockchainManager.getNFT(nftId);
    
    if (!nft) {
      return res.status(404).json({ success: false, error: 'NFT not found' });
    }
    
    res.json({
      success: true,
      data: nft,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Game-specific blockchain routes
app.post('/api/blockchain/game/ship/mint', async (req, res) => {
  try {
    const { walletId, chain, shipData } = req.body;
    
    const metadata = {
      name: shipData.name,
      type: 'spaceship',
      rarity: shipData.rarity,
      attributes: {
        speed: shipData.speed,
        defense: shipData.defense,
        attack: shipData.attack,
        cargo: shipData.cargo
      },
      image: shipData.image,
      description: shipData.description
    };
    
    const nft = await blockchainManager.createNFT(walletId, chain, metadata);
    
    res.json({
      success: true,
      data: {
        nft,
        shipData,
        message: 'Spaceship NFT minted successfully'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/blockchain/game/currency/transfer', async (req, res) => {
  try {
    const { fromWalletId, toAddress, amount, currency, chain } = req.body;
    
    // Transfer game currency (could be ERC-20 token)
    const transaction = await blockchainManager.sendTransaction(
      fromWalletId, 
      chain, 
      toAddress, 
      amount
    );
    
    res.json({
      success: true,
      data: {
        transaction,
        currency,
        message: `${amount} ${currency} transferred successfully`
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// WebSocket for real-time blockchain events
io.on('connection', (socket) => {
  console.log('Blockchain client connected:', socket.id);

  socket.on('subscribe-transactions', async (data) => {
    try {
      const { walletId, chain } = data;
      
      // In a real implementation, you'd subscribe to blockchain events
      socket.emit('transaction-update', {
        walletId,
        chain,
        message: 'Transaction monitoring started'
      });
    } catch (error) {
      socket.emit('error', { error: error.message });
    }
  });

  socket.on('request-balance', async (data) => {
    try {
      const { walletId, chain } = data;
      const balance = await blockchainManager.getBalance(walletId, chain);
      
      socket.emit('balance-update', {
        walletId,
        chain,
        balance
      });
    } catch (error) {
      socket.emit('error', { error: error.message });
    }
  });

  socket.on('disconnect', () => {
    console.log('Blockchain client disconnected:', socket.id);
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'Blockchain Service',
    timestamp: new Date().toISOString(),
    providers: Array.from(blockchainManager.providers.keys()),
    activeWallets: blockchainManager.wallets.size,
    deployedContracts: blockchainManager.contracts.size
  });
});

const PORT = process.env.PORT || 3005;
server.listen(PORT, () => {
  console.log(`⛓️ Blockchain Service running on port ${PORT}`);
  console.log(`🔗 Supported chains: ${Array.from(blockchainManager.providers.keys()).join(', ')}`);
  console.log(`💼 WebSocket server ready for real-time blockchain events`);
});

module.exports = app; 