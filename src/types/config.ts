/**
 * Configuration type definitions
 */

export interface ServerConfig {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface ObsConfig {
  host: string;
  port: number;
  password?: string;
}

export interface Config {
  server: ServerConfig;
  obs: ObsConfig;
}
