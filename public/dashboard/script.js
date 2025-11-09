/**
 * Forge Studio Dashboard Client
 */

class DashboardClient {
  constructor() {
    this.socket = null;
    this.currentScene = null;
    this.scenes = [];
    this.init();
  }

  /**
   * Initialize dashboard
   */
  init() {
    this.connectSocket();
    this.setupEventListeners();
  }

  /**
   * Connect to Socket.io
   */
  connectSocket() {
    this.socket = io();

    this.socket.on('connect', async () => {
      console.log('Connected to server');
      this.updateSocketStatus(true);

      // Identify as dashboard
      this.socket.emit('identify', { type: 'dashboard', name: 'Main Dashboard' });

      this.addLogEntry('Connected to server', 'obs-event');

      // Fetch initial state on connect
      await this.loadInitialState();
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      this.updateSocketStatus(false);
      this.addLogEntry('Disconnected from server', 'error');
    });

    // Listen for OBS connection events
    this.socket.on('obs_connection', (data) => {
      console.log('OBS connection status:', data);
      this.updateObsStatus(data.connected);

      if (data.connected) {
        this.addLogEntry('OBS connected', 'obs-event');
        this.fetchScenes();
      } else {
        this.addLogEntry(data.error || 'OBS disconnected', 'error');
      }
    });

    // Listen for scene changes
    this.socket.on('scene_switch', (data) => {
      console.log('Scene switched:', data);
      this.currentScene = data.sceneName;
      this.updateCurrentScene(data.sceneName);
      this.updateSceneButtons();
      this.addLogEntry(`Scene switched to: ${data.sceneName}`, 'scene-switch');
    });

    // Listen for status updates
    this.socket.on('status_update', (data) => {
      console.log('Status update:', data);
      this.updateObsStatus(data.obsConnected);
      if (data.activeScene) {
        this.currentScene = data.activeScene;
        this.updateCurrentScene(data.activeScene);
      }
      this.updateClientCount(data.clientsConnected);
    });

    // Listen for state updates (new pattern)
    this.socket.on('state_update', (data) => {
      console.log('State update:', data);

      if (data.obs) {
        // Update OBS connection status
        if (data.obs.connected !== undefined) {
          this.updateObsStatus(data.obs.connected);
          if (data.obs.connected) {
            this.addLogEntry('OBS connected', 'obs-event');
          }
        }

        // Update scenes if provided
        if (data.obs.scenes && data.obs.scenes.length > 0) {
          this.scenes = data.obs.scenes;
          this.renderSceneList();
        }

        // Update current scene
        if (data.obs.currentScene) {
          this.currentScene = data.obs.currentScene;
          this.updateCurrentScene(data.obs.currentScene);
          this.updateSceneButtons();
        }
      }
    });

    // Ping server periodically
    setInterval(() => {
      if (this.socket.connected) {
        this.socket.emit('ping');
      }
    }, 10000);
  }

  /**
   * Load initial state from server
   */
  async loadInitialState() {
    try {
      const response = await fetch('/api/state');

      if (!response.ok) {
        throw new Error('Failed to load state');
      }

      const state = await response.json();
      console.log('Initial state loaded:', state);

      // Update OBS state
      if (state.obs) {
        this.updateObsStatus(state.obs.connected);

        if (state.obs.scenes && state.obs.scenes.length > 0) {
          this.scenes = state.obs.scenes;
          this.currentScene = state.obs.currentScene;
          this.renderSceneList();
          this.updateCurrentScene(this.currentScene);
        } else if (!state.obs.connected) {
          this.renderSceneError();
        }
      }

      this.addLogEntry('Initial state loaded', 'obs-event');
    } catch (error) {
      console.error('Failed to load initial state:', error);
      this.addLogEntry('Failed to load initial state', 'error');
      this.renderSceneError();
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Will be used for manual controls later
  }

  /**
   * Fetch scenes from server
   */
  async fetchScenes() {
    try {
      const response = await fetch('/api/obs/scenes');

      if (!response.ok) {
        throw new Error('Failed to fetch scenes');
      }

      const data = await response.json();
      this.scenes = data.scenes;
      this.currentScene = data.currentProgramSceneName;

      this.renderSceneList();
      this.updateCurrentScene(this.currentScene);
    } catch (error) {
      console.error('Failed to fetch scenes:', error);
      this.renderSceneError();
    }
  }

  /**
   * Render scene list
   */
  renderSceneList() {
    const sceneList = document.getElementById('scene-list');

    if (this.scenes.length === 0) {
      sceneList.innerHTML = '<p class="loading">No scenes available</p>';
      return;
    }

    sceneList.innerHTML = this.scenes
      .map(scene => `
        <button
          class="scene-button ${scene.sceneName === this.currentScene ? 'active' : ''}"
          data-scene="${scene.sceneName}"
          onclick="dashboard.switchScene('${scene.sceneName}')"
        >
          ${scene.sceneName}
        </button>
      `)
      .join('');
  }

  /**
   * Render scene error
   */
  renderSceneError() {
    const sceneList = document.getElementById('scene-list');
    sceneList.innerHTML = '<p class="loading">Failed to load scenes. Is OBS connected?</p>';
  }

  /**
   * Switch scene
   */
  async switchScene(sceneName) {
    try {
      const response = await fetch('/api/obs/scene/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sceneName }),
      });

      if (!response.ok) {
        throw new Error('Failed to switch scene');
      }

      console.log(`Switched to scene: ${sceneName}`);
    } catch (error) {
      console.error('Failed to switch scene:', error);
      this.addLogEntry(`Failed to switch scene: ${error.message}`, 'error');
    }
  }

  /**
   * Update current scene display
   */
  updateCurrentScene(sceneName) {
    const sceneDisplay = document.querySelector('.scene-name');
    sceneDisplay.textContent = sceneName || '-';
  }

  /**
   * Update scene buttons
   */
  updateSceneButtons() {
    const buttons = document.querySelectorAll('.scene-button');
    buttons.forEach(button => {
      if (button.dataset.scene === this.currentScene) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
  }

  /**
   * Update OBS status indicator
   */
  updateObsStatus(connected) {
    const statusEl = document.getElementById('obs-status');
    statusEl.textContent = connected ? 'Connected' : 'Disconnected';
    statusEl.className = `status ${connected ? 'connected' : 'disconnected'}`;
  }

  /**
   * Update Socket status indicator
   */
  updateSocketStatus(connected) {
    const statusEl = document.getElementById('socket-status');
    statusEl.textContent = connected ? 'Connected' : 'Disconnected';
    statusEl.className = `status ${connected ? 'connected' : 'disconnected'}`;
  }

  /**
   * Update client count
   */
  updateClientCount(count) {
    const countEl = document.getElementById('client-count');
    countEl.textContent = count || 0;
  }

  /**
   * Add entry to event log
   */
  addLogEntry(message, type = '') {
    const eventLog = document.getElementById('event-log');
    const timestamp = new Date().toLocaleTimeString();

    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `
      <span class="timestamp">[${timestamp}]</span>
      <span class="log-message">${message}</span>
    `;

    // Clear "waiting for events" message
    if (eventLog.querySelector('.log-entry .timestamp').textContent === 'Waiting for events...') {
      eventLog.innerHTML = '';
    }

    eventLog.insertBefore(entry, eventLog.firstChild);

    // Limit log entries to 50
    while (eventLog.children.length > 50) {
      eventLog.removeChild(eventLog.lastChild);
    }
  }
}

// Initialize dashboard
const dashboard = new DashboardClient();
