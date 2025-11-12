/**
 * Terminal Monitor
 * Wraps a PTY terminal session and monitors output for errors
 * Uses node-pty to capture real-time stdout/stderr
 */

import { EventEmitter } from 'events';
import * as pty from 'node-pty';
import { ErrorDetector, DetectedError } from './ErrorDetector.js';
import { logger } from '../utils/logger.js';

export interface TerminalOutput {
  data: string;
  timestamp: string;
  type: 'stdout' | 'stderr';
}

export interface TerminalConfig {
  shell?: string;
  cwd?: string;
  env?: { [key: string]: string };
  cols?: number;
  rows?: number;
}

export class TerminalMonitor extends EventEmitter {
  private pty: pty.IPty | null = null;
  private errorDetector: ErrorDetector;
  private outputBuffer: string[] = [];
  private maxBufferLines = 1000;
  private isRunning = false;
  private config: TerminalConfig;

  constructor(config: TerminalConfig = {}) {
    super();
    this.errorDetector = new ErrorDetector();

    // Default configuration
    this.config = {
      shell: config.shell || process.env.SHELL || '/bin/bash',
      cwd: config.cwd || process.cwd(),
      env: config.env || process.env as { [key: string]: string },
      cols: config.cols || 80,
      rows: config.rows || 30
    };

    logger.info('TerminalMonitor initialized', {
      shell: this.config.shell,
      cwd: this.config.cwd
    });
  }

  /**
   * Start the terminal session
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('TerminalMonitor already running');
      return;
    }

    try {
      // Spawn PTY terminal
      this.pty = pty.spawn(this.config.shell!, [], {
        name: 'xterm-256color',
        cols: this.config.cols!,
        rows: this.config.rows!,
        cwd: this.config.cwd!,
        env: this.config.env!
      });

      // Listen for data output
      this.pty.onData((data: string) => {
        this.handleOutput(data);
      });

      // Listen for exit
      this.pty.onExit(({ exitCode, signal }) => {
        logger.info(`Terminal exited`, { exitCode, signal });
        this.emit('exit', { exitCode, signal });
        this.isRunning = false;
      });

      this.isRunning = true;
      logger.info('Terminal session started', { pid: this.pty.pid });
      this.emit('started', { pid: this.pty.pid });
    } catch (error) {
      logger.error('Failed to start terminal session', { error });
      this.emit('error', error);
    }
  }

  /**
   * Stop the terminal session
   */
  stop(): void {
    if (!this.isRunning || !this.pty) {
      return;
    }

    try {
      this.pty.kill();
      this.pty = null;
      this.isRunning = false;
      logger.info('Terminal session stopped');
      this.emit('stopped');
    } catch (error) {
      logger.error('Error stopping terminal', { error });
    }
  }

  /**
   * Send command to terminal
   */
  write(data: string): void {
    if (!this.pty || !this.isRunning) {
      logger.warn('Cannot write to terminal: not running');
      return;
    }

    this.pty.write(data);
    logger.debug('Wrote to terminal', { data: data.trim() });
  }

  /**
   * Execute a command (write + enter)
   */
  execute(command: string): void {
    this.write(command + '\r');
    logger.info('Executed command', { command });
  }

  /**
   * Handle terminal output
   */
  private handleOutput(data: string): void {
    // Add to output buffer
    this.addToBuffer(data);

    // Emit raw output event
    const output: TerminalOutput = {
      data,
      timestamp: new Date().toISOString(),
      type: 'stdout'
    };
    this.emit('output', output);

    // Check for errors
    this.checkForErrors(data);
  }

  /**
   * Check output for errors
   */
  private checkForErrors(data: string): void {
    const error = this.errorDetector.detect(data);

    if (error) {
      logger.warn('Error detected in terminal output', {
        type: error.type,
        severity: error.severity,
        message: error.message.substring(0, 100)
      });

      // Emit error event
      this.emit('error_detected', error);
    }
  }

  /**
   * Add data to output buffer
   */
  private addToBuffer(data: string): void {
    const lines = data.split('\n');
    this.outputBuffer.push(...lines);

    // Trim buffer if too large
    if (this.outputBuffer.length > this.maxBufferLines) {
      const excess = this.outputBuffer.length - this.maxBufferLines;
      this.outputBuffer.splice(0, excess);
    }
  }

  /**
   * Get recent output buffer
   */
  getRecentOutput(lineCount = 50): string {
    const startIndex = Math.max(0, this.outputBuffer.length - lineCount);
    return this.outputBuffer.slice(startIndex).join('\n');
  }

  /**
   * Get full output buffer
   */
  getFullOutput(): string {
    return this.outputBuffer.join('\n');
  }

  /**
   * Clear output buffer
   */
  clearBuffer(): void {
    this.outputBuffer = [];
    logger.debug('Terminal buffer cleared');
  }

  /**
   * Get recent errors
   */
  getRecentErrors(): DetectedError[] {
    return this.errorDetector.getRecentErrors();
  }

  /**
   * Clear recent errors
   */
  clearErrors(): void {
    this.errorDetector.clearRecentErrors();
  }

  /**
   * Resize terminal
   */
  resize(cols: number, rows: number): void {
    if (this.pty) {
      this.pty.resize(cols, rows);
      logger.debug('Terminal resized', { cols, rows });
    }
  }

  /**
   * Check if terminal is running
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Get terminal PID
   */
  get pid(): number | undefined {
    return this.pty?.pid;
  }

  /**
   * Get terminal process info
   */
  getProcessInfo(): { pid?: number; shell: string; cwd: string; running: boolean } {
    return {
      pid: this.pty?.pid,
      shell: this.config.shell!,
      cwd: this.config.cwd!,
      running: this.isRunning
    };
  }
}
