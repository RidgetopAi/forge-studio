/**
 * Zoom Controller
 * Handles camera zoom and pan automation in OBS
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { ObsController } from '../controllers/ObsController.js';

export interface ZoomConfig {
  targetZoom: number;      // Target zoom level (1.0 = no zoom, 1.5 = 150%, etc.)
  duration: number;        // Zoom animation duration in ms
  centerX?: number;        // X coordinate to zoom to (optional)
  centerY?: number;        // Y coordinate to zoom to (optional)
}

export interface ZoomIntensityConfig {
  errorZoomLevel: number;         // Zoom level for terminal errors (default: 1.8)
  cursorZoomLevel: number;        // Zoom level for cursor following (default: 1.5)
  thinkingBlocksZoomLevel: number; // Zoom level for thinking blocks (default: 1.8)
}

export class ZoomController extends EventEmitter {
  private obsController: ObsController;
  private currentZoom: number = 1.0;
  private targetZoom: number = 1.0;
  private isAnimating: boolean = false;
  private currentScene: string = 'CODE_EDITOR';
  private currentSourceName: string | null = null;

  // Scene item cache: sceneName -> sourceName -> itemId
  private sceneItemCache: Map<string, Map<string, number>> = new Map();

  // Configurable zoom intensity levels
  private intensityConfig: ZoomIntensityConfig = {
    errorZoomLevel: 1.8,
    cursorZoomLevel: 1.5,
    thinkingBlocksZoomLevel: 1.8,
  };

  constructor(obsController: ObsController, intensityConfig?: Partial<ZoomIntensityConfig>) {
    super();
    this.obsController = obsController;

    if (intensityConfig) {
      this.intensityConfig = { ...this.intensityConfig, ...intensityConfig };
    }

    logger.info('ZoomController initialized', this.intensityConfig);
  }

  /**
   * Update zoom intensity configuration at runtime
   */
  updateIntensityConfig(config: Partial<ZoomIntensityConfig>): void {
    this.intensityConfig = { ...this.intensityConfig, ...config };
    logger.info('Zoom intensity config updated:', this.intensityConfig);
    this.emit('config_updated', this.intensityConfig);
  }

  /**
   * Get current intensity configuration
   */
  getIntensityConfig(): ZoomIntensityConfig {
    return { ...this.intensityConfig };
  }

  /**
   * Get scene item ID (with caching)
   */
  private async getSceneItemId(sceneName: string, sourceName: string): Promise<number> {
    // Check cache first
    if (!this.sceneItemCache.has(sceneName)) {
      this.sceneItemCache.set(sceneName, new Map());
    }

    const sceneCache = this.sceneItemCache.get(sceneName)!;

    if (sceneCache.has(sourceName)) {
      return sceneCache.get(sourceName)!;
    }

    // Not in cache, fetch from OBS
    try {
      const itemId = await this.obsController.getSceneItemId(sceneName, sourceName);
      sceneCache.set(sourceName, itemId);
      return itemId;
    } catch (error) {
      logger.error(`Failed to get scene item ID for ${sourceName} in ${sceneName}: ${error}`);
      throw error;
    }
  }

  /**
   * Set current scene context for zoom operations
   */
  setSceneContext(sceneName: string, sourceName: string): void {
    this.currentScene = sceneName;
    this.currentSourceName = sourceName;
  }

  /**
   * Zoom to a specific location with smooth animation
   */
  async zoomTo(config: ZoomConfig): Promise<void> {
    if (this.isAnimating) {
      logger.warn('Zoom animation already in progress, skipping');
      return;
    }

    try {
      this.isAnimating = true;
      this.targetZoom = config.targetZoom;

      logger.info(`🔍 Zooming to ${config.targetZoom}x (${config.duration}ms)`);

      this.emit('zoom_start', {
        from: this.currentZoom,
        to: this.targetZoom,
        duration: config.duration
      });

      // Animate zoom with easing
      await this.animateZoom(
        this.currentZoom,
        config.targetZoom,
        config.centerX,
        config.centerY,
        config.duration
      );

      this.currentZoom = config.targetZoom;
      this.emit('zoom_complete', { zoom: this.currentZoom });

      logger.info(`🔍 Zoom complete: ${this.currentZoom}x`);

    } catch (error) {
      logger.error(`Failed to zoom: ${error}`);
      this.emit('zoom_error', { error });
      throw error;
    } finally {
      this.isAnimating = false;
    }
  }

  /**
   * Zoom to cursor position (for following code edits)
   */
  async zoomToCursor(x: number, y: number, zoomLevel?: number): Promise<void> {
    return this.zoomTo({
      targetZoom: zoomLevel ?? this.intensityConfig.cursorZoomLevel,
      duration: 500,
      centerX: x,
      centerY: y
    });
  }

  /**
   * Zoom to error line in terminal
   */
  async zoomToError(lineNumber: number, zoomLevel?: number): Promise<void> {
    // Estimate Y position based on line number
    // Assuming 20px per line on average
    const estimatedY = lineNumber * 20;

    return this.zoomTo({
      targetZoom: zoomLevel ?? this.intensityConfig.errorZoomLevel,
      duration: 600,
      centerY: estimatedY
    });
  }

  /**
   * Zoom to thinking blocks overlay (bottom-right corner)
   */
  async zoomToThinkingBlocks(zoomLevel?: number): Promise<void> {
    // Thinking blocks overlay is typically in bottom-right
    // Assuming 1920x1080 resolution, overlay is around x: 1600, y: 900
    // These are approximate centers for the overlay area
    const thinkingBlocksX = 1600;
    const thinkingBlocksY = 900;

    return this.zoomTo({
      targetZoom: zoomLevel ?? this.intensityConfig.thinkingBlocksZoomLevel,
      duration: 600,
      centerX: thinkingBlocksX,
      centerY: thinkingBlocksY
    });
  }

  /**
   * Reset zoom to normal view
   */
  async resetZoom(duration: number = 400): Promise<void> {
    return this.zoomTo({
      targetZoom: 1.0,
      duration
    });
  }

  /**
   * Animate zoom with easing function
   */
  private async animateZoom(
    startZoom: number,
    endZoom: number,
    centerX: number | undefined,
    centerY: number | undefined,
    durationMs: number
  ): Promise<void> {
    const startTime = Date.now();
    const frameDelay = 16; // ~60fps

    // Get scene item ID if we have a source name
    let sceneItemId: number | null = null;
    if (this.currentSourceName) {
      try {
        sceneItemId = await this.getSceneItemId(this.currentScene, this.currentSourceName);
      } catch (error) {
        logger.warn(`Could not get scene item ID, zoom will be logged only: ${error}`);
      }
    }

    const animate = async (): Promise<void> => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / durationMs, 1);

      // Ease-in-out function for smooth animation
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      const currentZoom = startZoom + (endZoom - startZoom) * eased;

      // Apply zoom to OBS scene item transform
      if (sceneItemId !== null) {
        try {
          await this.obsController.setSceneItemTransform(
            this.currentScene,
            sceneItemId,
            {
              scaleX: currentZoom,
              scaleY: currentZoom,
              positionX: centerX ? centerX * (1 - currentZoom) : undefined,
              positionY: centerY ? centerY * (1 - currentZoom) : undefined,
            }
          );
        } catch (error) {
          logger.error(`Failed to apply zoom transform: ${error}`);
        }
      } else {
        // Fallback: just log the zoom value
        logger.debug(`Zoom animation: ${currentZoom.toFixed(2)}x (progress: ${(progress * 100).toFixed(1)}%)`);
      }

      if (progress < 1) {
        await new Promise(resolve => setTimeout(resolve, frameDelay));
        await animate();
      }
    };

    await animate();
  }

  /**
   * Get current zoom status
   */
  getZoomStatus(): { currentZoom: number; isAnimating: boolean } {
    return {
      currentZoom: this.currentZoom,
      isAnimating: this.isAnimating
    };
  }
}
