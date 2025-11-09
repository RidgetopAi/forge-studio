/**
 * Event types for Socket.io communication between control server and overlays
 */

// Base event structure
export interface BaseEvent {
  type: string;
  timestamp: string;
}

// OBS-related events
export interface SceneSwitchEvent extends BaseEvent {
  type: 'scene_switch';
  sceneName: string;
  previousScene?: string;
}

export interface ObsConnectionEvent extends BaseEvent {
  type: 'obs_connection';
  connected: boolean;
  error?: string;
}

// Monitor events (for future phases)
export interface ActivityEvent extends BaseEvent {
  type: 'activity';
  source: 'terminal' | 'editor' | 'git' | 'thinking';
  data: any;
}

export interface ErrorDetectedEvent extends BaseEvent {
  type: 'error_detected';
  error: string;
  context?: string;
  severity?: 'minor' | 'moderate' | 'critical';
}

// Dashboard status events
export interface StatusUpdateEvent extends BaseEvent {
  type: 'status_update';
  obsConnected: boolean;
  activeScene?: string;
  clientsConnected: number;
}

// Union type for all events
export type SocketEvent =
  | SceneSwitchEvent
  | ObsConnectionEvent
  | ActivityEvent
  | ErrorDetectedEvent
  | StatusUpdateEvent;
