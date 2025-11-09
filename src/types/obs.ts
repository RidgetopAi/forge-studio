/**
 * OBS-related type definitions
 */

export interface ObsScene {
  sceneName: string;
  sceneIndex: number;
}

export interface ObsSceneList {
  currentProgramSceneName: string;
  scenes: ObsScene[];
}

export interface ObsConnectionStatus {
  connected: boolean;
  obsWebSocketVersion?: string;
  negotiatedRpcVersion?: number;
}

export interface SceneSwitchOptions {
  sceneName: string;
  smooth?: boolean;
}
