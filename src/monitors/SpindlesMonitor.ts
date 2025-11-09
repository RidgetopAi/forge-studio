/**
 * Spindles Monitor
 * Receives thinking blocks from spindles-proxy and broadcasts to Socket.io clients
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';

export interface ThinkingBlockEvent {
  type: 'thinking_block';
  content: string;
  blockType: 'reasoning' | 'planning' | 'reflection';
  timestamp: string;
  sessionId: string;
  tokenCount: number;
}

export interface SpindlePayload {
  spindle: {
    id: string;
    sessionId: string | null;
    timestamp: string;
    type: string;
    content: string;
    metadata?: {
      model?: string;
      startedAt?: string;
      confidence?: string;
      tags?: string[];
    };
  };
  capturedAt: string;
}

export class SpindlesMonitor extends EventEmitter {
  private spindlesReceived: number = 0;

  constructor() {
    super();
    logger.info('SpindlesMonitor initialized');
  }

  /**
   * Process incoming spindle from spindles-proxy
   */
  processSpindle(payload: SpindlePayload): void {
    try {
      this.spindlesReceived++;

      logger.info(`🔵 SPINDLE RECEIVED: ${payload.spindle.id.substring(0, 8)}`);
      logger.info(`🔵 CONTENT: ${payload.spindle.content.substring(0, 100)}...`);

      // Classify thinking type based on content
      const blockType = this.classifyThinkingType(payload.spindle.content);

      // Transform to thinking block event
      const event: ThinkingBlockEvent = {
        type: 'thinking_block',
        content: payload.spindle.content,
        blockType,
        timestamp: payload.spindle.timestamp,
        sessionId: payload.spindle.sessionId || 'unknown',
        tokenCount: this.estimateTokenCount(payload.spindle.content)
      };

      logger.info(`🔵 EMITTING thinking_block event with blockType: ${blockType}`);

      // Emit for Socket.io broadcast
      this.emit('thinking_block', event);

      logger.info(`🔵 Spindle processed and emitted: ${payload.spindle.id.substring(0, 8)}`);
    } catch (error) {
      logger.error(`Failed to process spindle: ${error}`);
    }
  }

  /**
   * Classify thinking type based on content patterns
   */
  private classifyThinkingType(content: string): 'reasoning' | 'planning' | 'reflection' {
    const lower = content.toLowerCase();

    // Planning indicators
    if (
      lower.includes('i should') ||
      lower.includes('i need to') ||
      lower.includes('let me') ||
      lower.includes('i\'ll') ||
      lower.includes('first,') ||
      lower.includes('next,') ||
      lower.includes('then,')
    ) {
      return 'planning';
    }

    // Reflection indicators
    if (
      lower.includes('i notice') ||
      lower.includes('interesting') ||
      lower.includes('this suggests') ||
      lower.includes('looking back') ||
      lower.includes('i see that')
    ) {
      return 'reflection';
    }

    // Default to reasoning
    return 'reasoning';
  }

  /**
   * Estimate token count (rough approximation: ~4 chars per token)
   */
  private estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      spindlesReceived: this.spindlesReceived
    };
  }
}
