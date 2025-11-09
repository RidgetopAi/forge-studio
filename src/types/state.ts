/**
 * State management type definitions
 */

import { ObsScene } from './obs.js';

// OBS State
export interface ObsState {
  connected: boolean;
  currentScene: string | null;
  scenes: ObsScene[];
  lastUpdated: string;
}

// Monitor States (for future phases)
export interface NeovimState {
  connected: boolean;
  currentFile: string | null;
  cursorPosition: { line: number; column: number } | null;
  lastActivity: string | null;
}

export interface TerminalState {
  lastCommand: string | null;
  lastOutput: string | null;
  lastError: string | null;
  lastActivity: string | null;
}

export interface GitState {
  lastCommit: string | null;
  branch: string | null;
  hasUncommittedChanges: boolean;
  lastActivity: string | null;
}

export interface MonitorState {
  neovim: NeovimState;
  terminal: TerminalState;
  git: GitState;
}

// Complete Application State
export interface AppState {
  obs: ObsState;
  monitors: MonitorState;
  serverStartTime: string;
  lastStateUpdate: string;
}

// State update events
export interface StateUpdateEvent {
  type: 'state_update';
  timestamp: string;
  obs?: Partial<ObsState>;
  monitors?: Partial<MonitorState>;
}
