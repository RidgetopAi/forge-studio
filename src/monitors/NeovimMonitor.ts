/**
 * Neovim Monitor
 * Connects to Neovim via RPC and tracks buffer/cursor activity
 * Detects file changes, typing activity, and idle periods
 */

import { EventEmitter } from 'events';
import { attach, NeovimClient } from 'neovim';
import { Socket } from 'net';
import { logger } from '../utils/logger.js';
import * as path from 'path';

export interface FileUpdateEvent {
  type: 'file_update';
  path: string;
  absolutePath: string;
  filename: string;
  language: string;
  lineCount: number;
  cursorLine: number;
  cursorColumn: number;
  timestamp: string;
}

export interface TypingEvent {
  type: 'typing';
  file: string;
  timestamp: string;
}

export interface IdleEvent {
  type: 'idle';
  lastActivity: string;
  idleDuration: number;
  timestamp: string;
}

export interface NeovimConnectionConfig {
  host?: string;
  port?: number;
  idleThresholdMs?: number;
  cursorPollIntervalMs?: number;
}

export class NeovimMonitor extends EventEmitter {
  private nvim: NeovimClient | null = null;
  private socket: Socket | null = null;
  private isConnected = false;
  private currentFile = '';
  private currentBuffer: any = null;
  private lastActivity = Date.now();
  private idleCheckInterval: NodeJS.Timeout | null = null;
  private cursorPollInterval: NodeJS.Timeout | null = null;

  // Configuration
  private config: Required<NeovimConnectionConfig>;

  // State tracking
  private lastCursorLine = 0;
  private lastCursorColumn = 0;
  private isTyping = false;
  private typingTimeout: NodeJS.Timeout | null = null;

  // Reconnection tracking
  private retryTimeout: NodeJS.Timeout | null = null;
  private isRetrying = false;
  private autoRetryEnabled = false;

  constructor(config: NeovimConnectionConfig = {}) {
    super();

    // Default configuration
    this.config = {
      host: config.host || 'localhost',
      port: config.port || 6666,
      idleThresholdMs: config.idleThresholdMs || 5000, // 5 seconds
      cursorPollIntervalMs: config.cursorPollIntervalMs || 500 // 500ms
    };

    logger.info('NeovimMonitor initialized', {
      host: this.config.host,
      port: this.config.port,
      idleThreshold: `${this.config.idleThresholdMs}ms`
    });
  }

  /**
   * Connect to Neovim RPC server
   * @param retryOnFailure - If true, will retry connection every 10 seconds
   */
  async connect(retryOnFailure = false): Promise<void> {
    // Track auto-retry setting so handleDisconnect knows what to do
    this.autoRetryEnabled = retryOnFailure;

    try {
      logger.info(`Attempting to connect to Neovim at ${this.config.host}:${this.config.port}...`);

      // Create socket connection
      this.socket = new Socket();

      // Connect to Neovim RPC
      await new Promise<void>((resolve, reject) => {
        this.socket!.connect(this.config.port, this.config.host, () => {
          resolve();
        });

        this.socket!.on('error', (err) => {
          reject(err);
        });

        // Timeout after 5 seconds
        setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 5000);
      });

      // Attach to Neovim
      this.nvim = await attach({ reader: this.socket, writer: this.socket });
      this.isConnected = true;

      logger.info('Successfully connected to Neovim RPC');

      // Setup persistent error/close handlers (CRITICAL for stability)
      this.socket.on('error', (err) => {
        logger.warn(`Neovim socket error: ${err.message}`);
        this.handleDisconnect();
      });

      this.socket.on('close', () => {
        logger.info('Neovim socket closed');
        this.handleDisconnect();
      });

      // Setup event listeners
      await this.setupEventListeners();

      // Start monitoring
      this.startCursorTracking();
      this.startIdleDetection();

      // Get initial state
      await this.updateCurrentFile();

      this.emit('connected');

    } catch (error) {
      logger.warn(`Could not connect to Neovim: ${error}`);
      logger.warn('Make sure Neovim is running with RPC enabled:');
      logger.warn(`  nvim --listen ${this.config.host}:${this.config.port}`);
      this.isConnected = false;
      this.emit('connection_failed', error);

      // Auto-retry if requested (prevent stacking retries)
      if (retryOnFailure && !this.isRetrying) {
        this.isRetrying = true;
        logger.info('Will retry connection in 10 seconds...');
        this.retryTimeout = setTimeout(() => {
          this.isRetrying = false;
          this.connect(true); // Keep retrying
        }, 10000);
      }
    }
  }

  /**
   * Disconnect from Neovim
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      // Stop intervals
      if (this.cursorPollInterval) {
        clearInterval(this.cursorPollInterval);
        this.cursorPollInterval = null;
      }

      if (this.idleCheckInterval) {
        clearInterval(this.idleCheckInterval);
        this.idleCheckInterval = null;
      }

      // Close socket
      if (this.socket) {
        this.socket.destroy();
        this.socket = null;
      }

      this.nvim = null;
      this.isConnected = false;

      logger.info('Disconnected from Neovim');
      this.emit('disconnected');

    } catch (error) {
      logger.error(`Error disconnecting from Neovim: ${error}`);
    }
  }

  /**
   * Handle unexpected disconnect (called by socket error/close handlers)
   * This ensures graceful cleanup without manual intervention
   */
  private handleDisconnect(): void {
    // Prevent multiple disconnect calls
    if (!this.isConnected) {
      return;
    }

    logger.info('Handling Neovim disconnect...');

    // Mark as disconnected
    this.isConnected = false;
    this.currentFile = '';

    // Clear polling intervals
    if (this.cursorPollInterval) {
      clearInterval(this.cursorPollInterval);
      this.cursorPollInterval = null;
    }

    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
      this.idleCheckInterval = null;
    }

    // Clear typing timeout
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }

    // Clear any pending retry timeouts
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
      this.isRetrying = false;
    }

    // Emit disconnected event
    this.emit('disconnected');

    // If auto-retry is enabled, schedule reconnection
    if (this.autoRetryEnabled && !this.isRetrying) {
      this.isRetrying = true;
      logger.info('Auto-retry enabled - will attempt reconnection in 10 seconds...');
      this.retryTimeout = setTimeout(() => {
        this.isRetrying = false;
        logger.info('Attempting to reconnect to Neovim...');
        this.connect(true).catch((err) => {
          logger.warn(`Reconnection attempt failed: ${err}`);
        });
      }, 10000);
    } else {
      logger.info('Neovim disconnect handled - auto-retry not enabled');
    }
  }

  /**
   * Setup Neovim event listeners
   */
  private async setupEventListeners(): Promise<void> {
    if (!this.nvim) return;

    try {
      // Get channel ID - it's a Promise, must await it
      const channelId = await this.nvim.channelId;
      logger.info(`Setting up autocmds with channelId: ${channelId}`);

      // Use augroup to prevent duplicate autocmds on reconnection
      // This clears any existing autocmds before creating new ones
      await this.nvim.command('augroup ForgeStudioMonitor');
      await this.nvim.command('autocmd!'); // Clear all autocmds in this group
      await this.nvim.command(`autocmd TextChanged,TextChangedI * call rpcnotify(${channelId}, "buffer_changed")`);
      await this.nvim.command(`autocmd BufEnter * call rpcnotify(${channelId}, "buffer_enter")`);
      await this.nvim.command('augroup END');

      logger.info('Autocmds created in ForgeStudioMonitor augroup (duplicates prevented)');

      // Handle notifications
      this.nvim.on('notification', (method: string, args: any[]) => {
        logger.info(`📥 Neovim notification received: ${method}`, args);
        if (method === 'buffer_changed') {
          this.handleBufferChanged();
        } else if (method === 'buffer_enter') {
          this.handleBufferEnter();
        }
      });

      logger.info('Neovim event listeners configured successfully');

    } catch (error) {
      logger.error(`Failed to setup event listeners: ${error}`);
    }
  }

  /**
   * Handle buffer changed (typing)
   */
  private handleBufferChanged(): void {
    this.lastActivity = Date.now();

    if (!this.isTyping) {
      this.isTyping = true;
      this.emit('typing_start', {
        file: this.currentFile,
        timestamp: new Date().toISOString()
      });
    }

    // Reset typing timeout
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }

    // Consider typing stopped after 1 second of no changes
    this.typingTimeout = setTimeout(() => {
      this.isTyping = false;
      this.emit('typing_stop', {
        file: this.currentFile,
        timestamp: new Date().toISOString()
      });
    }, 1000);

    // Emit typing event
    const event: TypingEvent = {
      type: 'typing',
      file: this.currentFile,
      timestamp: new Date().toISOString()
    };
    this.emit('typing', event);
  }

  /**
   * Handle buffer enter (file switch)
   */
  private async handleBufferEnter(): Promise<void> {
    this.lastActivity = Date.now();
    await this.updateCurrentFile();
  }

  /**
   * Update current file information
   */
  private async updateCurrentFile(): Promise<void> {
    if (!this.nvim) return;

    try {
      // Get current buffer
      this.currentBuffer = await this.nvim.buffer;

      // Get buffer name (file path)
      const bufferName = await this.currentBuffer.name;

      // Only emit if file changed
      if (bufferName !== this.currentFile) {
        this.currentFile = bufferName;

        // Get additional info
        const lineCount = await this.currentBuffer.length;
        const [cursorLine, cursorColumn] = await this.getCursorPosition();

        // Emit file update event
        const event: FileUpdateEvent = {
          type: 'file_update',
          path: this.currentFile,
          absolutePath: this.currentFile,
          filename: path.basename(this.currentFile),
          language: this.detectLanguage(this.currentFile),
          lineCount,
          cursorLine,
          cursorColumn,
          timestamp: new Date().toISOString()
        };

        logger.info(`File changed: ${event.filename} (${event.lineCount} lines)`);
        this.emit('file_update', event);
      }

    } catch (error) {
      logger.error(`Failed to update current file: ${error}`);
    }
  }

  /**
   * Get cursor position
   */
  private async getCursorPosition(): Promise<[number, number]> {
    if (!this.nvim) return [0, 0];

    try {
      const window = await this.nvim.window;
      const cursor = await window.cursor;
      return cursor as [number, number];
    } catch (error) {
      logger.error(`Failed to get cursor position: ${error}`);
      return [0, 0];
    }
  }

  /**
   * Start cursor tracking
   */
  private startCursorTracking(): void {
    this.cursorPollInterval = setInterval(async () => {
      if (!this.isConnected || !this.nvim) return;

      try {
        const [line, column] = await this.getCursorPosition();

        // Only emit if cursor moved
        if (line !== this.lastCursorLine || column !== this.lastCursorColumn) {
          this.lastCursorLine = line;
          this.lastCursorColumn = column;
          this.lastActivity = Date.now();

          this.emit('cursor_moved', {
            line,
            column,
            file: this.currentFile,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        // Ignore errors during polling (might be disconnected)
      }
    }, this.config.cursorPollIntervalMs);
  }

  /**
   * Start idle detection
   */
  private startIdleDetection(): void {
    this.idleCheckInterval = setInterval(() => {
      const idleDuration = Date.now() - this.lastActivity;

      if (idleDuration > this.config.idleThresholdMs) {
        const event: IdleEvent = {
          type: 'idle',
          lastActivity: new Date(this.lastActivity).toISOString(),
          idleDuration,
          timestamp: new Date().toISOString()
        };

        this.emit('idle', event);
      }
    }, this.config.idleThresholdMs);
  }

  /**
   * Detect language from file extension
   */
  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();

    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescriptreact',
      '.js': 'javascript',
      '.jsx': 'javascriptreact',
      '.py': 'python',
      '.rs': 'rust',
      '.go': 'go',
      '.java': 'java',
      '.c': 'c',
      '.cpp': 'cpp',
      '.h': 'c',
      '.hpp': 'cpp',
      '.md': 'markdown',
      '.json': 'json',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.sh': 'shell',
      '.bash': 'shell',
      '.sql': 'sql'
    };

    return languageMap[ext] || 'text';
  }

  /**
   * Get current file info
   */
  getCurrentFile(): string {
    return this.currentFile;
  }

  /**
   * Check if connected
   */
  get connected(): boolean {
    return this.isConnected;
  }

  /**
   * Get monitor status
   */
  getStatus(): {
    connected: boolean;
    currentFile: string;
    isTyping: boolean;
    lastActivity: string;
    config: NeovimConnectionConfig;
  } {
    return {
      connected: this.isConnected,
      currentFile: this.currentFile,
      isTyping: this.isTyping,
      lastActivity: new Date(this.lastActivity).toISOString(),
      config: this.config
    };
  }
}
