require('dotenv').config();
const express = require('express');
const { ApiPromise, WsProvider } = require('@polkadot/api');
const { Keyring } = require('@polkadot/keyring');
const logger = require('./utils/logger');

/**
 * BlockchainService - Handles connection and extrinsic submission to Substrate blockchain
 */
class BlockchainService {
  constructor() {
    this.api = null;
    this.account = null;
    this.isInitialized = false;
  }

  /**
   * Initialize blockchain connection and account setup
   */
  async initialize() {
    try {
      logger.info('Initializing BlockchainService...');
      
      // Connect to Substrate WebSocket node
      const wsProvider = new WsProvider('ws://127.0.0.1:9944');
      this.api = await ApiPromise.create({ provider: wsProvider });
      
      // Wait for API to be ready
      await this.api.isReady;
      logger.info('API connected and ready');

      // Setup account using test account //Alice
      const keyring = new Keyring({ type: 'sr25519' });
      this.account = keyring.addFromUri('//Alice');
      
      this.isInitialized = true;
      logger.info(`BlockchainService initialized with account: ${this.account.address}`);
      
      return true;
    } catch (error) {
      logger.error('Failed to initialize BlockchainService:', error.message);
      throw error;
    }
  }

  /**
   * Check if blockchain connection is active
   */
  isConnected() {
    return this.isInitialized && this.api && this.api.isConnected;
  }

  /**
   * Submit solar data (voltage, current) as a system remark extrinsic
   * @param {number} voltage - Solar panel voltage reading
   * @param {number} current - Solar panel current reading
   * @returns {Promise<string>} - Transaction hash of the submitted extrinsic
   */
  async submitSolarData(voltage, current) {
    try {
      if (!this.isConnected()) {
        throw new Error('Blockchain not connected');
      }

      // Create remark payload with solar data
      const remarkData = `SOLAR_DATA:V=${voltage},I=${current}`;
      
      logger.info(`Submitting solar data - Voltage: ${voltage}V, Current: ${current}A`);

      // Create the system.remark extrinsic with solar data
      const extrinsic = this.api.tx.system.remark(remarkData);

      return new Promise((resolve, reject) => {
        let txHash;
        let unsub;

        // Sign and send the extrinsic
        extrinsic.signAndSend(this.account, { nonce: -1 }, (result) => {
          try {
            if (result.status.isBroadcast) {
              txHash = result.txHash.toString();
              logger.info(`Extrinsic broadcasted: ${txHash}`);
            } else if (result.status.isInBlock) {
              txHash = result.txHash.toString();
              logger.info(`Extrinsic included in block: ${result.status.asInBlock.toString()}`);
            } else if (result.status.isFinalized) {
              txHash = result.txHash.toString();
              logger.info(`Extrinsic finalized: ${txHash}`);
              
              // Check for extrinsic success
              if (result.isCompleted) {
                if (result.isError) {
                  logger.error('Extrinsic execution failed');
                  reject(new Error('Extrinsic execution failed'));
                } else {
                  logger.info('Extrinsic executed successfully');
                  resolve(txHash);
                }
              }
              
              if (unsub) unsub();
            }
          } catch (error) {
            logger.error('Error processing extrinsic result:', error.message);
            reject(error);
            if (unsub) unsub();
          }
        })
          .then((unsubscribe) => {
            unsub = unsubscribe;
          })
          .catch((error) => {
            logger.error('Error submitting extrinsic:', error.message);
            reject(error);
          });

        // Timeout after 60 seconds
        setTimeout(() => {
          if (unsub) unsub();
          reject(new Error('Extrinsic submission timeout'));
        }, 60000);
      });
    } catch (error) {
      logger.error('Error submitting solar data:', error.message);
      throw error;
    }
  }

  /**
   * Disconnect from blockchain
   */
  async disconnect() {
    try {
      if (this.api && this.api.isConnected) {
        await this.api.disconnect();
        this.isInitialized = false;
        logger.info('Disconnected from blockchain');
      }
    } catch (error) {
      logger.error('Error disconnecting from blockchain:', error.message);
    }
  }

  /**
   * Get chain information
   */
  async getChainInfo() {
    try {
      if (!this.isConnected()) {
        throw new Error('Blockchain not connected');
      }
      
      const chain = await this.api.rpc.system.chain();
      const name = await this.api.rpc.system.name();
      const version = await this.api.runtimeVersion.specVersion;

      return {
        chain: chain.toString(),
        name: name.toString(),
        specVersion: version.toString(),
      };
    } catch (error) {
      logger.error('Error getting chain info:', error.message);
      throw error;
    }
  }
}

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Global blockchain service instance
let blockchainService = null;

/**
 * POST /solar-data
 * Receives solar panel data from ESP32 and submits to blockchain
 * Expected payload: { current: number, voltage: number }
 */
app.post('/solar-data', async (req, res) => {
  try {
    const { current, voltage } = req.body;

    // Validate input
    if (typeof current !== 'number' || typeof voltage !== 'number') {
      logger.warn('Invalid solar data received:', req.body);
      return res.status(400).json({
        success: false,
        error: 'Invalid payload. Expected { current: number, voltage: number }',
      });
    }

    if (current < 0 || voltage < 0) {
      logger.warn('Negative solar data values:', { current, voltage });
      return res.status(400).json({
        success: false,
        error: 'Current and voltage must be non-negative values',
      });
    }

    logger.info(`Received solar data from ESP32 - Voltage: ${voltage}V, Current: ${current}A`);

    // Submit to blockchain
    const txHash = await blockchainService.submitSolarData(voltage, current);

    logger.info(`Solar data submitted successfully: ${txHash}`);

    res.status(202).json({
      success: true,
      message: 'Solar data submitted to blockchain',
      data: {
        voltage,
        current,
        transactionHash: txHash,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error processing solar data:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to submit solar data to blockchain',
      message: error.message,
    });
  }
});

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', async (req, res) => {
  try {
    const isConnected = blockchainService.isConnected();
    
    if (!isConnected) {
      return res.status(503).json({
        success: false,
        status: 'unhealthy',
        message: 'Blockchain connection lost',
      });
    }

    const chainInfo = await blockchainService.getChainInfo();

    res.status(200).json({
      success: true,
      status: 'healthy',
      blockchain: chainInfo,
      account: blockchainService.account.address,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (error) {
    logger.error('Health check error:', error.message);
    res.status(503).json({
      success: false,
      status: 'error',
      error: error.message,
    });
  }
});

/**
 * 404 handler
 */
app.use((req, res) => {
  logger.warn(`404 - Not Found: ${req.method} ${req.path}`);
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
  });
});

/**
 * Error handler
 */
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
  });

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

/**
 * Start server and initialize blockchain connection
 */
(async () => {
  try {
    logger.info('Starting Solar Data Blockchain Server...');

    // Initialize blockchain service
    blockchainService = new BlockchainService();
    await blockchainService.initialize();

    // Start Express server
    app.listen(PORT, () => {
      logger.info(`Solar Data Server listening on port ${PORT}`);
      logger.info(`POST /solar-data - Submit solar data from ESP32`);
      logger.info(`GET /health - Health check endpoint`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error.message);
    process.exit(1);
  }
})();

/**
 * Graceful shutdown
 */
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received: shutting down gracefully');
  if (blockchainService) {
    await blockchainService.disconnect();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received: shutting down gracefully');
  if (blockchainService) {
    await blockchainService.disconnect();
  }
  process.exit(0);
});

module.exports = { app, BlockchainService };
