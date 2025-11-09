/**
 * OBS WebSocket Controller
 * Manages connection and communication with OBS Studio
 */

import OBSWebSocket from 'obs-websocket-js';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { config } from '../config/config.js';
import {
  ObsConnectionStatus,
  ObsSceneList,
  SceneSwitchOptions,
} from '../types/index.js';

export class ObsController extends EventEmitter {
  private obs: OBSWebSocket;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 2000;
  private isConnected: boolean = false;

  constructor() {
    super();
    this.obs = new OBSWebSocket();
    this.setupEventHandlers();
  }

  /**
   * Setup OBS event handlers
   */
  private setupEventHandlers(): void {
    this.obs.on('ConnectionOpened', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      logger.info('Connected to OBS WebSocket');
      this.emit('connected');
    });

    this.obs.on('ConnectionClosed', () => {
      this.isConnected = false;
      logger.warn('OBS WebSocket connection closed');
      this.emit('disconnected');
      this.attemptReconnect();
    });

    this.obs.on('ConnectionError', (err) => {
      logger.error(`OBS WebSocket connection error: ${err}`);
      this.emit('error', err);
    });

    this.obs.on('CurrentProgramSceneChanged', (data) => {
      logger.info(`Scene changed to: ${data.sceneName}`);
      this.emit('scene-changed', data.sceneName);
    });
  }

  /**
   * Connect to OBS WebSocket
   */
  async connect(): Promise<void> {
    try {
      const address = `ws://${config.obs.host}:${config.obs.port}`;
      logger.info(`Connecting to OBS at ${address}...`);

      await this.obs.connect(address, config.obs.password);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      logger.info('Successfully connected to OBS');
    } catch (error) {
      logger.error(`Failed to connect to OBS: ${error}`);
      throw error;
    }
  }

  /**
   * Attempt to reconnect to OBS
   */
  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached. Giving up.');
      return;
    }

    this.reconnectAttempts++;
    logger.info(
      `Attempting to reconnect to OBS (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
    );

    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        logger.error(`Reconnection attempt failed: ${error}`);
      }
    }, this.reconnectDelay);
  }

  /**
   * Disconnect from OBS
   */
  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.obs.disconnect();
      this.isConnected = false;
      logger.info('Disconnected from OBS');
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): ObsConnectionStatus {
    return {
      connected: this.isConnected,
    };
  }

  /**
   * Get list of scenes
   */
  async getSceneList(): Promise<ObsSceneList> {
    try {
      const response = await this.obs.call('GetSceneList');
      return {
        currentProgramSceneName: response.currentProgramSceneName,
        scenes: response.scenes.map((scene: any, index: number) => ({
          sceneName: scene.sceneName,
          sceneIndex: index,
        })),
      };
    } catch (error) {
      logger.error(`Failed to get scene list: ${error}`);
      throw error;
    }
  }

  /**
   * Get current scene name
   */
  async getCurrentScene(): Promise<string> {
    try {
      const response = await this.obs.call('GetCurrentProgramScene');
      return response.currentProgramSceneName;
    } catch (error) {
      logger.error(`Failed to get current scene: ${error}`);
      throw error;
    }
  }

  /**
   * Switch to a different scene
   */
  async switchScene(options: SceneSwitchOptions): Promise<void> {
    try {
      logger.info(`Switching to scene: ${options.sceneName}`);
      await this.obs.call('SetCurrentProgramScene', {
        sceneName: options.sceneName,
      });
      logger.info(`Successfully switched to scene: ${options.sceneName}`);
    } catch (error) {
      logger.error(`Failed to switch scene: ${error}`);
      throw error;
    }
  }

  /**
   * Check if connected
   */
  connected(): boolean {
    return this.isConnected;
  }
}
