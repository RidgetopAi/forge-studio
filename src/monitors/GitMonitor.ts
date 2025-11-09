/**
 * Git Monitor
 * Watches for git commits and extracts commit information
 */

import { EventEmitter } from 'events';
import simpleGit, { SimpleGit, DefaultLogFields } from 'simple-git';
import chokidar, { FSWatcher } from 'chokidar';
import { logger } from '../utils/logger.js';

export interface GitCommitEvent {
  message: string;
  files: Array<{
    path: string;
    additions: number;
    deletions: number;
  }>;
  timestamp: string;
  hash?: string;
  author?: string;
}

export class GitMonitor extends EventEmitter {
  private git: SimpleGit;
  private watcher: FSWatcher | null = null;
  private repoPath: string;
  private lastCommitHash: string | null = null;
  private isProcessing: boolean = false;

  constructor(repoPath: string = process.cwd()) {
    super();
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
    logger.info(`GitMonitor initialized for repo: ${repoPath}`);
  }

  /**
   * Start monitoring git repository
   */
  async start(): Promise<void> {
    try {
      // Verify it's a git repo
      const isRepo = await this.git.checkIsRepo();
      if (!isRepo) {
        logger.warn(`Not a git repository: ${this.repoPath}`);
        return;
      }

      // Get initial commit hash
      const log = await this.git.log({ maxCount: 1 });
      this.lastCommitHash = log.latest?.hash || null;
      logger.info(`GitMonitor tracking from commit: ${this.lastCommitHash?.substring(0, 7)}`);

      // Watch for changes to .git/logs/HEAD (indicates new commits)
      const gitLogPath = `${this.repoPath}/.git/logs/HEAD`;
      this.watcher = chokidar.watch(gitLogPath, {
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 50,
        },
      });

      this.watcher.on('change', () => {
        this.handleCommit();
      });

      logger.info('GitMonitor started watching for commits');
    } catch (error) {
      logger.error(`Failed to start GitMonitor: ${error}`);
    }
  }

  /**
   * Stop monitoring
   */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
      logger.info('GitMonitor stopped');
    }
  }

  /**
   * Handle detected commit
   */
  private async handleCommit(): Promise<void> {
    // Prevent concurrent processing
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      // Get latest commit
      const log = await this.git.log({ maxCount: 1 });
      const latestCommit = log.latest;

      if (!latestCommit) {
        this.isProcessing = false;
        return;
      }

      // Check if this is a new commit
      if (latestCommit.hash === this.lastCommitHash) {
        this.isProcessing = false;
        return;
      }

      logger.info(`New commit detected: ${latestCommit.hash.substring(0, 7)} - ${latestCommit.message}`);

      // Update tracked hash
      this.lastCommitHash = latestCommit.hash;

      // Get diff summary
      const diff = await this.git.diffSummary([`${latestCommit.hash}~1`, latestCommit.hash]);

      // Build commit event
      const commitEvent: GitCommitEvent = {
        message: latestCommit.message,
        files: diff.files.map((file) => ({
          path: file.file,
          additions: 'insertions' in file ? file.insertions : 0,
          deletions: 'deletions' in file ? file.deletions : 0,
        })),
        timestamp: latestCommit.date,
        hash: latestCommit.hash,
        author: latestCommit.author_name,
      };

      // Emit event
      this.emit('commit', commitEvent);
      logger.info(`Emitted git commit event: ${commitEvent.files.length} files changed`);
    } catch (error) {
      logger.error(`Failed to process commit: ${error}`);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get current repository status
   */
  async getStatus(): Promise<any> {
    try {
      return await this.git.status();
    } catch (error) {
      logger.error(`Failed to get git status: ${error}`);
      return null;
    }
  }

  /**
   * Get recent commits
   */
  async getRecentCommits(count: number = 10): Promise<readonly DefaultLogFields[]> {
    try {
      const log = await this.git.log({ maxCount: count });
      return log.all;
    } catch (error) {
      logger.error(`Failed to get recent commits: ${error}`);
      return [];
    }
  }
}
