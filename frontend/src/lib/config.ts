export type AppMode = 'demo' | 'real';

export interface AppConfig {
  mode: AppMode;
  apiBaseUrl: string;
  wsBaseUrl: string;
  pollingInterval: number; // in milliseconds
}

const config: AppConfig = {
  mode: (process.env.NEXT_PUBLIC_PIPELINE_MODE as AppMode) || 'real',
  apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  wsBaseUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000',
  pollingInterval: 1000, // 1 second
};

export default config;