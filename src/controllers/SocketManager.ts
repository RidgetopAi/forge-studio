/**
 * Socket.io Manager
 * Handles real-time communication with browser-based overlays and dashboard
 */

import { Server as SocketServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { logger } from '../utils/logger.js';
import {
  SocketEvent,
  StatusUpdateEvent,
  SceneSwitchEvent,
  ObsConnectionEvent,
} from '../types/index.js';

export class SocketManager {
  private io: SocketServer;
  private connectedClients: Map<string, Socket> = new Map();

  constructor(httpServer: HttpServer) {
    this.io = new SocketServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    this.setupEventHandlers();
    logger.info('Socket.io manager initialized');
  }

  /**
   * Setup Socket.io event handlers
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      const clientId = socket.id;
      this.connectedClients.set(clientId, socket);
      logger.info(`Client connected: ${clientId} (Total: ${this.connectedClients.size})`);

      // Handle client identification
      socket.on('identify', (data: { type: string; name?: string }) => {
        logger.info(`Client ${clientId} identified as: ${data.type}`);
        socket.data.clientType = data.type;
        socket.data.clientName = data.name || data.type;
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.connectedClients.delete(clientId);
        logger.info(`Client disconnected: ${clientId} (Remaining: ${this.connectedClients.size})`);
      });

      // Handle ping/pong for connection monitoring
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: new Date().toISOString() });
      });
    });
  }

  /**
   * Broadcast event to all connected clients
   */
  broadcast(event: SocketEvent): void {
    logger.debug(`Broadcasting event: ${event.type}`);
    this.io.emit(event.type, event);
  }

  /**
   * Broadcast to specific client type (e.g., 'dashboard', 'overlay')
   */
  broadcastToType(clientType: string, event: SocketEvent): void {
    logger.debug(`Broadcasting to ${clientType}: ${event.type}`);
    const clients = Array.from(this.connectedClients.values());
    clients
      .filter((socket) => socket.data.clientType === clientType)
      .forEach((socket) => socket.emit(event.type, event));
  }

  /**
   * Send scene switch event
   */
  broadcastSceneSwitch(sceneName: string, previousScene?: string): void {
    const event: SceneSwitchEvent = {
      type: 'scene_switch',
      timestamp: new Date().toISOString(),
      sceneName,
      previousScene,
    };
    this.broadcast(event);
  }

  /**
   * Send OBS connection status update
   */
  broadcastObsConnection(connected: boolean, error?: string): void {
    const event: ObsConnectionEvent = {
      type: 'obs_connection',
      timestamp: new Date().toISOString(),
      connected,
      error,
    };
    this.broadcast(event);
  }

  /**
   * Send status update to dashboard
   */
  broadcastStatusUpdate(
    obsConnected: boolean,
    activeScene?: string,
    clientsConnected?: number
  ): void {
    const event: StatusUpdateEvent = {
      type: 'status_update',
      timestamp: new Date().toISOString(),
      obsConnected,
      activeScene,
      clientsConnected: clientsConnected ?? this.connectedClients.size,
    };
    this.broadcastToType('dashboard', event);
  }

  /**
   * Get number of connected clients
   */
  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  /**
   * Get connected clients by type
   */
  getClientsByType(clientType: string): Socket[] {
    return Array.from(this.connectedClients.values()).filter(
      (socket) => socket.data.clientType === clientType
    );
  }

  /**
   * Broadcast thinking block to all clients
   */
  broadcastThinkingBlock(event: any): void {
    logger.info(`🟢 BROADCASTING thinking_block to ${this.connectedClients.size} clients`);
    logger.info(`🟢 Event content: ${event.content?.substring(0, 100)}...`);
    this.io.emit('thinking_block', event);
    logger.info(`🟢 Broadcast complete`);
  }

  /**
   * Broadcast git commit event to all clients
   */
  broadcastGitCommit(event: any): void {
    logger.info(`🔀 BROADCASTING git_commit to ${this.connectedClients.size} clients`);
    logger.info(`🔀 Commit message: ${event.message}`);
    this.io.emit('git_commit', event);
    logger.info(`🔀 Broadcast complete`);
  }
}
