/**
 * Scene Director
 * Central decision-maker for automated cinematography
 * Receives events from monitors and orchestrates scene switching
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { ObsController } from '../controllers/ObsController.js';
import { SocketManager } from '../controllers/SocketManager.js';
import { TransitionManager } from './TransitionManager.js';
import { ZoomController } from './ZoomController.js';

export interface SceneDirectorConfig {
  sceneSwitchCooldown: number;  // Minimum time between scene switches (ms)
  idleThreshold: number;         // Time before switching to THINKING scene (ms)
  automationEnabled: boolean;    // Master automation toggle
}

export interface SceneDecision {
  sceneName: string;
  reason: string;
  timestamp: string;
  cooldownRemaining: number;
}

export class SceneDirector extends EventEmitter {
  private _obsController: ObsController;
  private _socketManager: SocketManager;
  private transitionManager: TransitionManager;
  private zoomController: ZoomController;

  private currentScene: string = 'CODE_EDITOR';
  private lastSceneChange: number = Date.now();
  private config: SceneDirectorConfig;
  private automationEnabled: boolean = true;
  private idleTimer: NodeJS.Timeout | null = null;
  private decisionLog: SceneDecision[] = [];

  // Scene names (should match OBS scenes)
  private readonly SCENES = {
    CODE_EDITOR: 'CODE_EDITOR',
    TERMINAL_FOCUS: 'TERMINAL_FOCUS',
    OVERVIEW: 'OVERVIEW',
    THINKING: 'THINKING'
  };

  constructor(
    obsController: ObsController,
    socketManager: SocketManager,
    config: Partial<SceneDirectorConfig> = {}
  ) {
    super();

    this._obsController = obsController;
    this._socketManager = socketManager;
    this.transitionManager = new TransitionManager(obsController);
    this.zoomController = new ZoomController(obsController);

    // Default configuration
    this.config = {
      sceneSwitchCooldown: 5000,    // 5 seconds
      idleThreshold: 10000,          // 10 seconds
      automationEnabled: true,
      ...config
    };

    this.automationEnabled = this.config.automationEnabled;

    logger.info('🎬 SceneDirector initialized', this.config);
  }

  /**
   * Start the scene director
   */
  start(): void {
    logger.info('🎬 SceneDirector started');
    this.startIdleDetection();
    this.emit('started');
  }

  /**
   * Stop the scene director
   */
  stop(): void {
    logger.info('🎬 SceneDirector stopped');
    this.stopIdleDetection();
    this.emit('stopped');
  }

  /**
   * Handle error detection from terminal
   */
  async handleError(error: any): Promise<void> {
    if (!this.canSwitchScene()) {
      logger.debug('Scene switch on cooldown, skipping error handling');
      return;
    }

    const decision: SceneDecision = {
      sceneName: this.SCENES.TERMINAL_FOCUS,
      reason: `Error detected: ${error.type}`,
      timestamp: new Date().toISOString(),
      cooldownRemaining: this.config.sceneSwitchCooldown
    };

    this.logDecision(decision);

    try {
      await this.switchScene(this.SCENES.TERMINAL_FOCUS, decision.reason);

      // Zoom to error line if available
      if (error.line) {
        await this.zoomController.zoomToError(error.line);
      }

      // Reset idle timer since we switched
      this.resetIdleTimer();

    } catch (err) {
      logger.error('Failed to handle error event:', err);
    }
  }

  /**
   * Handle typing activity from Neovim
   */
  async handleTyping(cursorX?: number, cursorY?: number): Promise<void> {
    // Reset idle timer on any typing activity
    this.resetIdleTimer();

    // Zoom to cursor position if coordinates provided
    if (cursorX !== undefined && cursorY !== undefined) {
      try {
        await this.zoomController.zoomToCursor(cursorX, cursorY);
        logger.debug(`Zooming to cursor position: (${cursorX}, ${cursorY})`);
      } catch (err) {
        logger.error(`Failed to zoom to cursor: ${err}`);
      }
    }

    // Only switch scenes if not already on CODE_EDITOR
    if (this.currentScene === this.SCENES.CODE_EDITOR) {
      return;
    }

    if (!this.canSwitchScene()) {
      return;
    }

    const decision: SceneDecision = {
      sceneName: this.SCENES.CODE_EDITOR,
      reason: 'Typing detected in editor',
      timestamp: new Date().toISOString(),
      cooldownRemaining: this.config.sceneSwitchCooldown
    };

    this.logDecision(decision);

    try {
      await this.switchScene(this.SCENES.CODE_EDITOR, decision.reason);
    } catch (err) {
      logger.error('Failed to handle typing event:', err);
    }
  }

  /**
   * Handle idle detection (no activity for threshold period)
   */
  async handleIdle(): Promise<void> {
    if (!this.canSwitchScene()) {
      logger.debug('Scene switch on cooldown, skipping idle handling');
      return;
    }

    const decision: SceneDecision = {
      sceneName: this.SCENES.THINKING,
      reason: 'Idle period detected',
      timestamp: new Date().toISOString(),
      cooldownRemaining: this.config.sceneSwitchCooldown
    };

    this.logDecision(decision);

    try {
      await this.switchScene(this.SCENES.THINKING, decision.reason);
      // Zoom to thinking blocks for better readability
      await this.zoomController.zoomToThinkingBlocks();
    } catch (err) {
      logger.error('Failed to handle idle event:', err);
    }
  }

  /**
   * Handle git commit (brief overlay, no scene change)
   */
  async handleCommit(commit: any): Promise<void> {
    const decision: SceneDecision = {
      sceneName: this.currentScene, // Stay on current scene
      reason: `Git commit: ${commit.message}`,
      timestamp: new Date().toISOString(),
      cooldownRemaining: 0 // No cooldown for commits
    };

    this.logDecision(decision);

    // Git overlay is handled by SocketManager broadcast
    // Just log the decision, no scene switch needed
    logger.info(`📝 Git commit detected, overlay shown: ${commit.message.substring(0, 50)}`);
  }

  /**
   * Handle thinking blocks streaming
   */
  async handleThinkingBlocks(): Promise<void> {
    // If already on THINKING scene, do nothing
    if (this.currentScene === this.SCENES.THINKING) {
      return;
    }

    // If on CODE_EDITOR, just show overlay (already handled by SocketManager)
    // Don't switch scenes automatically for thinking blocks
    logger.debug('Thinking blocks detected, overlay displayed');
  }

  /**
   * Manual scene switch (bypasses cooldown and automation toggle)
   */
  async manualSwitchScene(sceneName: string): Promise<void> {
    const decision: SceneDecision = {
      sceneName,
      reason: 'Manual override',
      timestamp: new Date().toISOString(),
      cooldownRemaining: 0
    };

    this.logDecision(decision);

    try {
      await this.transitionManager.switchScene(sceneName);
      this.currentScene = sceneName;
      this.lastSceneChange = Date.now();

      this.emit('scene_changed', { sceneName, manual: true });
      this.broadcastStatus();

      logger.info(`🎬 Manual scene switch: ${sceneName}`);
    } catch (err) {
      logger.error('Failed to manually switch scene:', err);
      throw err;
    }
  }

  /**
   * Toggle automation on/off
   */
  setAutomation(enabled: boolean): void {
    this.automationEnabled = enabled;
    logger.info(`🎬 Automation ${enabled ? 'ENABLED' : 'DISABLED'}`);
    this.emit('automation_changed', { enabled });
    this.broadcastStatus();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SceneDirectorConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('🎬 Configuration updated:', this.config);
    this.emit('config_changed', this.config);
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      currentScene: this.currentScene,
      automationEnabled: this.automationEnabled,
      cooldownRemaining: this.getCooldownRemaining(),
      config: this.config,
      recentDecisions: this.decisionLog.slice(-5)
    };
  }

  /**
   * Internal: Switch scene with automation checks
   */
  private async switchScene(sceneName: string, reason: string): Promise<void> {
    if (!this.automationEnabled) {
      logger.debug('Automation disabled, skipping scene switch');
      return;
    }

    await this.transitionManager.switchScene(sceneName);
    this.currentScene = sceneName;
    this.lastSceneChange = Date.now();

    this.emit('scene_changed', { sceneName, reason, manual: false });
    this.broadcastStatus();
  }

  /**
   * Check if enough time has passed since last scene change
   */
  private canSwitchScene(): boolean {
    return Date.now() - this.lastSceneChange > this.config.sceneSwitchCooldown;
  }

  /**
   * Get remaining cooldown time in ms
   */
  private getCooldownRemaining(): number {
    const elapsed = Date.now() - this.lastSceneChange;
    const remaining = this.config.sceneSwitchCooldown - elapsed;
    return Math.max(0, remaining);
  }

  /**
   * Start idle detection timer
   */
  private startIdleDetection(): void {
    this.resetIdleTimer();
  }

  /**
   * Stop idle detection timer
   */
  private stopIdleDetection(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  /**
   * Reset idle timer (call when activity detected)
   */
  private resetIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }

    this.idleTimer = setTimeout(() => {
      this.handleIdle();
    }, this.config.idleThreshold);
  }

  /**
   * Log a scene switching decision
   */
  private logDecision(decision: SceneDecision): void {
    this.decisionLog.push(decision);

    // Keep only last 100 decisions
    if (this.decisionLog.length > 100) {
      this.decisionLog.shift();
    }

    logger.info(`🎬 DECISION: ${decision.reason} → ${decision.sceneName}`);
  }

  /**
   * Broadcast status to connected clients
   */
  private broadcastStatus(): void {
    // Use SocketManager to broadcast to all clients
    const status = this.getStatus();
    this.emit('status_update', status);
  }
}
