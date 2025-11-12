/**
 * Transition Manager
 * Handles smooth scene transitions in OBS
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { ObsController } from '../controllers/ObsController.js';

export interface TransitionConfig {
  duration: number;        // Transition duration in milliseconds
  type: 'cut' | 'fade';   // Transition type
}

export class TransitionManager extends EventEmitter {
  private obsController: ObsController;
  private isTransitioning: boolean = false;
  private defaultTransition: TransitionConfig = {
    duration: 300,
    type: 'fade'
  };

  constructor(obsController: ObsController) {
    super();
    this.obsController = obsController;
    logger.info('TransitionManager initialized');
  }

  /**
   * Switch to a new scene with transition
   */
  async switchScene(
    sceneName: string,
    config: Partial<TransitionConfig> = {}
  ): Promise<void> {
    if (this.isTransitioning) {
      logger.warn('Transition already in progress, skipping');
      return;
    }

    const transition = { ...this.defaultTransition, ...config };

    try {
      this.isTransitioning = true;
      this.emit('transition_start', { sceneName, transition });

      logger.info(`🎬 Switching to scene: ${sceneName} (${transition.type}, ${transition.duration}ms)`);

      // Switch scene using OBS controller
      await this.obsController.switchScene({ sceneName });

      // Wait for transition to complete
      await this.sleep(transition.duration);

      this.emit('transition_complete', { sceneName });
      logger.info(`🎬 Transition complete: ${sceneName}`);

    } catch (error) {
      logger.error(`Failed to switch scene: ${error}`);
      this.emit('transition_error', { sceneName, error });
      throw error;
    } finally {
      this.isTransitioning = false;
    }
  }

  /**
   * Get transition status
   */
  getTransitionStatus(): { isTransitioning: boolean } {
    return {
      isTransitioning: this.isTransitioning
    };
  }

  /**
   * Set default transition configuration
   */
  setDefaultTransition(config: Partial<TransitionConfig>): void {
    this.defaultTransition = { ...this.defaultTransition, ...config };
    logger.info(`Default transition updated:`, this.defaultTransition);
  }

  /**
   * Sleep helper for transition timing
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
