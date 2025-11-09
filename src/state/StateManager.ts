/**
 * Central State Manager
 * Single source of truth for all application state
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { AppState, ObsState, MonitorState, StateUpdateEvent } from '../types/state.js';
import { ObsScene } from '../types/obs.js';

export class StateManager extends EventEmitter {
  private state: AppState;

  constructor() {
    super();

    // Initialize with default state
    this.state = {
      obs: {
        connected: false,
        currentScene: null,
        scenes: [],
        lastUpdated: new Date().toISOString(),
      },
      monitors: {
        neovim: {
          connected: false,
          currentFile: null,
          cursorPosition: null,
          lastActivity: null,
        },
        terminal: {
          lastCommand: null,
          lastOutput: null,
          lastError: null,
          lastActivity: null,
        },
        git: {
          lastCommit: null,
          branch: null,
          hasUncommittedChanges: false,
          lastActivity: null,
        },
      },
      serverStartTime: new Date().toISOString(),
      lastStateUpdate: new Date().toISOString(),
    };

    logger.info('State Manager initialized');
  }

  /**
   * Get complete application state
   */
  getState(): AppState {
    return { ...this.state };
  }

  /**
   * Get OBS state only
   */
  getObsState(): ObsState {
    return { ...this.state.obs };
  }

  /**
   * Get monitor state only
   */
  getMonitorState(): MonitorState {
    return { ...this.state.monitors };
  }

  /**
   * Update OBS state
   */
  updateObsState(update: Partial<ObsState>): void {
    const previousState = { ...this.state.obs };

    // Merge update into OBS state
    this.state.obs = {
      ...this.state.obs,
      ...update,
      lastUpdated: new Date().toISOString(),
    };

    this.state.lastStateUpdate = new Date().toISOString();

    // Log significant changes
    if (update.connected !== undefined && update.connected !== previousState.connected) {
      logger.info(`OBS connection state changed: ${update.connected ? 'connected' : 'disconnected'}`);
    }

    if (update.currentScene && update.currentScene !== previousState.currentScene) {
      logger.info(`OBS scene changed: ${previousState.currentScene} → ${update.currentScene}`);
    }

    if (update.scenes && update.scenes.length > 0) {
      logger.info(`OBS scenes updated: ${update.scenes.length} scenes`);
    }

    // Emit state update event
    this.emit('obs:updated', this.state.obs);
    this.emit('state:updated', this.getStateUpdateEvent({ obs: update }));
  }

  /**
   * Update Neovim state (for future use)
   */
  updateNeovimState(update: Partial<MonitorState['neovim']>): void {
    this.state.monitors.neovim = {
      ...this.state.monitors.neovim,
      ...update,
      lastActivity: new Date().toISOString(),
    };

    this.state.lastStateUpdate = new Date().toISOString();
    this.emit('neovim:updated', this.state.monitors.neovim);
    this.emit('state:updated', this.getStateUpdateEvent({ monitors: { neovim: update } }));
  }

  /**
   * Update Terminal state (for future use)
   */
  updateTerminalState(update: Partial<MonitorState['terminal']>): void {
    this.state.monitors.terminal = {
      ...this.state.monitors.terminal,
      ...update,
      lastActivity: new Date().toISOString(),
    };

    this.state.lastStateUpdate = new Date().toISOString();
    this.emit('terminal:updated', this.state.monitors.terminal);
    this.emit('state:updated', this.getStateUpdateEvent({ monitors: { terminal: update } }));
  }

  /**
   * Update Git state (for future use)
   */
  updateGitState(update: Partial<MonitorState['git']>): void {
    this.state.monitors.git = {
      ...this.state.monitors.git,
      ...update,
      lastActivity: new Date().toISOString(),
    };

    this.state.lastStateUpdate = new Date().toISOString();
    this.emit('git:updated', this.state.monitors.git);
    this.emit('state:updated', this.getStateUpdateEvent({ monitors: { git: update } }));
  }

  /**
   * Set OBS scenes (convenience method)
   */
  setObsScenes(scenes: ObsScene[]): void {
    this.updateObsState({ scenes });
  }

  /**
   * Set OBS connection status (convenience method)
   */
  setObsConnected(connected: boolean): void {
    this.updateObsState({ connected });
  }

  /**
   * Set current OBS scene (convenience method)
   */
  setCurrentScene(sceneName: string): void {
    this.updateObsState({ currentScene: sceneName });
  }

  /**
   * Create state update event for broadcasting
   */
  private getStateUpdateEvent(update: { obs?: Partial<ObsState>; monitors?: any }): StateUpdateEvent {
    return {
      type: 'state_update',
      timestamp: new Date().toISOString(),
      ...update,
    };
  }

  /**
   * Get state summary for logging
   */
  getStateSummary(): string {
    return JSON.stringify({
      obs: {
        connected: this.state.obs.connected,
        currentScene: this.state.obs.currentScene,
        sceneCount: this.state.obs.scenes.length,
      },
      uptime: Math.floor(
        (Date.now() - new Date(this.state.serverStartTime).getTime()) / 1000
      ),
    });
  }
}
