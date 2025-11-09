/**
 * Configuration management for Forge Studio Control Room
 */

import { config as loadEnv } from 'dotenv';
import { Config } from '../types/index.js';

// Load environment variables
loadEnv();

/**
 * Get configuration from environment variables
 */
export function getConfig(): Config {
  return {
    server: {
      port: parseInt(process.env.PORT || '8000', 10),
      nodeEnv: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
      logLevel: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
    },
    obs: {
      host: process.env.OBS_HOST || 'localhost',
      port: parseInt(process.env.OBS_PORT || '4455', 10),
      password: process.env.OBS_PASSWORD || undefined,
    },
  };
}

// Export singleton config instance
export const config = getConfig();
