/**
 * Forge Studio Control Room - Main Server
 * Central orchestration hub for AI-native streaming
 */

import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { logger } from './utils/logger.js';
import { config } from './config/config.js';
import { ObsController } from './controllers/ObsController.js';
import { SocketManager } from './controllers/SocketManager.js';
import { StateManager } from './state/StateManager.js';
import { SpindlesMonitor } from './monitors/SpindlesMonitor.js';

class ForgeStudioServer {
  private app: express.Application;
  private httpServer: ReturnType<typeof createServer>;
  private obsController: ObsController;
  private socketManager: SocketManager;
  private stateManager: StateManager;
  private spindlesMonitor: SpindlesMonitor;

  constructor() {
    this.app = express();
    this.httpServer = createServer(this.app);
    this.stateManager = new StateManager();
    this.obsController = new ObsController();
    this.socketManager = new SocketManager(this.httpServer);
    this.spindlesMonitor = new SpindlesMonitor();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupObsEvents();
    this.setupStateSync();
    this.setupSpindlesEvents();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static('public'));

    // Request logging
    this.app.use((req, _res, next) => {
      logger.debug(`${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/api/health', (_req, res) => {
      res.json({
        status: 'ok',
        obsConnected: this.obsController.connected(),
        socketClients: this.socketManager.getConnectedClientsCount(),
        timestamp: new Date().toISOString(),
      });
    });

    // Get OBS scenes
    this.app.get('/api/obs/scenes', async (_req, res) => {
      try {
        if (!this.obsController.connected()) {
          return res.status(503).json({ error: 'OBS not connected' });
        }
        const sceneList = await this.obsController.getSceneList();
        return res.json(sceneList);
      } catch (error) {
        logger.error(`Failed to get scenes: ${error}`);
        return res.status(500).json({ error: 'Failed to get scenes' });
      }
    });

    // Get current scene
    this.app.get('/api/obs/scene/current', async (_req, res) => {
      try {
        if (!this.obsController.connected()) {
          return res.status(503).json({ error: 'OBS not connected' });
        }
        const currentScene = await this.obsController.getCurrentScene();
        return res.json({ sceneName: currentScene });
      } catch (error) {
        logger.error(`Failed to get current scene: ${error}`);
        return res.status(500).json({ error: 'Failed to get current scene' });
      }
    });

    // Switch scene
    this.app.post('/api/obs/scene/switch', async (req, res) => {
      try {
        const { sceneName } = req.body;

        if (!sceneName) {
          return res.status(400).json({ error: 'sceneName is required' });
        }

        if (!this.obsController.connected()) {
          return res.status(503).json({ error: 'OBS not connected' });
        }

        await this.obsController.switchScene({ sceneName });
        return res.json({ success: true, sceneName });
      } catch (error) {
        logger.error(`Failed to switch scene: ${error}`);
        return res.status(500).json({ error: 'Failed to switch scene' });
      }
    });

    // Get OBS connection status
    this.app.get('/api/obs/status', (_req, res) => {
      res.json(this.obsController.getConnectionStatus());
    });

    // Get complete application state
    this.app.get('/api/state', (_req, res) => {
      res.json(this.stateManager.getState());
    });

    // Get OBS state only
    this.app.get('/api/state/obs', (_req, res) => {
      res.json(this.stateManager.getObsState());
    });

    // Get monitor state only
    this.app.get('/api/state/monitors', (_req, res) => {
      res.json(this.stateManager.getMonitorState());
    });

    // Spindles endpoint - receives thinking blocks from spindles-proxy
    this.app.post('/api/spindles', (req, res) => {
      try {
        const payload = req.body;

        logger.info(`🔴 POST /api/spindles received`);

        if (!payload || !payload.spindle) {
          logger.error(`🔴 Invalid payload: ${JSON.stringify(payload)}`);
          return res.status(400).json({ error: 'Invalid spindle payload' });
        }

        logger.info(`🔴 Valid spindle: ${payload.spindle.id}`);

        // Process the spindle
        this.spindlesMonitor.processSpindle(payload);

        logger.info(`🔴 Spindle sent to monitor`);

        return res.json({ success: true, received: payload.spindle.id });
      } catch (error) {
        logger.error(`Failed to process spindle: ${error}`);
        return res.status(500).json({ error: 'Failed to process spindle' });
      }
    });

    // Mock endpoint for testing
    this.app.post('/api/spindles/mock', (_req, res) => {
      logger.info(`🟡 MOCK spindle endpoint hit`);
      const mockPayload = {
        spindle: {
          id: 'mock-' + Date.now(),
          sessionId: 'mock-session',
          timestamp: new Date().toISOString(),
          type: 'thinking_block',
          content: '🧪 MOCK THINKING BLOCK: This is a test to verify the display pipeline is working correctly!',
          metadata: {}
        },
        capturedAt: new Date().toISOString()
      };

      this.spindlesMonitor.processSpindle(mockPayload);
      return res.json({ success: true, mock: true });
    });

    // Get spindles statistics
    this.app.get('/api/spindles/stats', (_req, res) => {
      res.json(this.spindlesMonitor.getStats());
    });

    // Test endpoint for git commit events
    this.app.post('/api/test/git-commit', (req, res) => {
      logger.info('🧪 TEST: Triggering git commit event');
      const testCommit = req.body || {
        message: 'Test commit: Added git status overlay',
        files: [
          { path: 'src/server.ts', additions: 12, deletions: 2 },
          { path: 'public/overlays/git-status/index.html', additions: 200, deletions: 0 },
        ],
        timestamp: new Date().toISOString(),
      };

      // Broadcast to all connected clients
      this.socketManager.broadcastGitCommit(testCommit);

      return res.json({ success: true, commit: testCommit });
    });

    // 404 handler
    this.app.use((_req, res) => {
      res.status(404).json({ error: 'Not found' });
    });
  }

  /**
   * Setup OBS event handlers
   */
  private setupObsEvents(): void {
    // OBS connected
    this.obsController.on('connected', async () => {
      logger.info('OBS connected event received');

      // Update state
      this.stateManager.setObsConnected(true);

      // Small delay to let OBS WebSocket fully authenticate
      await new Promise(resolve => setTimeout(resolve, 100));

      // Fetch and cache scenes
      try {
        const sceneList = await this.obsController.getSceneList();
        this.stateManager.setObsScenes(sceneList.scenes);
        this.stateManager.setCurrentScene(sceneList.currentProgramSceneName);
        logger.info(`Loaded ${sceneList.scenes.length} scenes from OBS`);
      } catch (error) {
        logger.error(`Failed to fetch scenes on connect: ${error}`);
      }

      // Broadcast to clients
      this.socketManager.broadcastObsConnection(true);
    });

    // OBS disconnected
    this.obsController.on('disconnected', () => {
      logger.warn('OBS disconnected event received');

      // Update state
      this.stateManager.setObsConnected(false);

      // Broadcast to clients
      this.socketManager.broadcastObsConnection(false);
    });

    // OBS scene changed
    this.obsController.on('scene-changed', (sceneName: string) => {
      logger.info(`Scene changed to: ${sceneName}`);

      // Update state
      this.stateManager.setCurrentScene(sceneName);

      // Broadcast to clients
      this.socketManager.broadcastSceneSwitch(sceneName);
    });

    // OBS error
    this.obsController.on('error', (error: Error) => {
      logger.error(`OBS error: ${error.message}`);
      this.socketManager.broadcastObsConnection(false, error.message);
    });
  }

  /**
   * Setup state synchronization with Socket.io
   */
  private setupStateSync(): void {
    // When state updates, broadcast to all clients
    this.stateManager.on('state:updated', (stateUpdate) => {
      this.socketManager.broadcast(stateUpdate);
    });

    logger.info('State synchronization configured');
  }

  /**
   * Setup spindles event handlers
   */
  private setupSpindlesEvents(): void {
    // When thinking block received, broadcast to overlays
    this.spindlesMonitor.on('thinking_block', (event) => {
      logger.debug(`Broadcasting thinking block: ${event.content.substring(0, 50)}...`);
      this.socketManager.broadcastThinkingBlock(event);
    });

    logger.info('Spindles monitor configured');
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    try {
      // Connect to OBS
      logger.info('Connecting to OBS...');
      try {
        await this.obsController.connect();
        logger.info('Successfully connected to OBS');
      } catch (error) {
        logger.warn(`Could not connect to OBS: ${error}`);
        logger.warn('Server will start without OBS connection. OBS will auto-reconnect when available.');
      }

      // Start HTTP server
      this.httpServer.listen(config.server.port, () => {
        logger.info(`Forge Studio Control Room running on port ${config.server.port}`);
        logger.info(`Dashboard: http://localhost:${config.server.port}/dashboard`);
        logger.info(`Environment: ${config.server.nodeEnv}`);
        logger.info(`State summary: ${this.stateManager.getStateSummary()}`);
      });

      // Periodic state summary logging (debugging)
      setInterval(() => {
        logger.debug(`State: ${this.stateManager.getStateSummary()}`);
      }, 30000);
    } catch (error) {
      logger.error(`Failed to start server: ${error}`);
      process.exit(1);
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down Forge Studio Control Room...');

    try {
      await this.obsController.disconnect();
      this.httpServer.close(() => {
        logger.info('Server shut down successfully');
        process.exit(0);
      });
    } catch (error) {
      logger.error(`Error during shutdown: ${error}`);
      process.exit(1);
    }
  }
}

// Create and start server
const server = new ForgeStudioServer();

// Handle shutdown signals
process.on('SIGTERM', () => server.shutdown());
process.on('SIGINT', () => server.shutdown());

// Start server
server.start();
// Test comment for git commit overlay demo
