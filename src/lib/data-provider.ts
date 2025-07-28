import config from './config';
import { apiClient } from './api-client';
import { generateMockData } from './mock-data';
import { CsvStatus, PipelineRun, CsvProcessingEntry } from '@/types/csv-status';

export class DataProvider {
  private mode: 'demo' | 'real';
  private mockUpdateInterval: NodeJS.Timeout | null = null;
  private listeners: Set<(data: CsvProcessingEntry[]) => void> = new Set();
  private currentData: CsvProcessingEntry[] = [];
  private ws: WebSocket | null = null;

  constructor() {
    this.mode = config.mode;
    this.init();
  }

  private init() {
    if (this.mode === 'demo') {
      this.initDemoMode();
    } else {
      this.initRealMode();
    }
  }

  private initDemoMode() {
    // Start with initial mock data
    this.currentData = generateMockData() as unknown as CsvProcessingEntry[];
    this.notifyListeners();

    // Update mock data periodically
    this.mockUpdateInterval = setInterval(() => {
      this.currentData = generateMockData() as unknown as CsvProcessingEntry[];
      this.notifyListeners();
    }, config.pollingInterval);
  }

  private initRealMode() {
    // Initial fetch
    this.fetchRealData();

    // Set up WebSocket connection for real-time updates
    this.connectWebSocket();
  }

  private connectWebSocket() {
    try {
      this.ws = new WebSocket(config.wsBaseUrl + '/ws/pipeline');
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.currentData = data;
          this.notifyListeners();
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
          this.notifyErrorListeners(error);
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.notifyErrorListeners(error);
        // Fallback to polling if WebSocket fails
        const fallbackInterval = setInterval(() => this.fetchRealData(), config.pollingInterval);
        
        // Clear fallback if WebSocket reconnects
        if (this.ws) {
          this.ws.onopen = () => {
            clearInterval(fallbackInterval);
          };
        }
      };
      
      this.ws.onclose = (event) => {
        console.warn('WebSocket closed:', event.code, event.reason);
        this.notifyErrorListeners(new Error('WebSocket closed'));
        
        // Try to reconnect after a delay, but only if we're still in real mode
        setTimeout(() => {
          if (this.mode === 'real' && (!this.ws || this.ws.readyState === WebSocket.CLOSED)) {
            console.log('Attempting to reconnect WebSocket...');
            this.connectWebSocket();
          }
        }, 5000);
      };
      
      this.ws.onopen = () => {
        console.log('WebSocket connected successfully');
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.notifyErrorListeners(error);
    }
  }

  private async fetchRealData() {
    try {
      const data = await apiClient.getPipelineStatus();
      this.currentData = data;
      this.notifyListeners();
    } catch (error) {
      this.notifyErrorListeners(error);
      console.error('Failed to fetch pipeline status:', error);
    }
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.currentData));
  }

  private errorListeners: Set<(err: any) => void> = new Set();

  private notifyErrorListeners(err: any) {
    this.errorListeners.forEach(listener => listener(err));
  }

  subscribe(listener: (data: CsvProcessingEntry[]) => void, onError?: (err: any) => void) {
    this.listeners.add(listener);
    if (onError) this.errorListeners.add(onError);
    // Immediately notify with current data
    listener(this.currentData);
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
      if (onError) this.errorListeners.delete(onError);
    };
  }

  async getStats() {
    if (this.mode === 'demo') {
      const total = this.currentData.length;
      return {
        total,
        processing: this.currentData.filter(item => item.status === 'running').length,
        completed: this.currentData.filter(item => item.status === 'ok').length,
        failed: this.currentData.filter(item => item.status === 'error').length,
      };
    }

    try {
      return await apiClient.getStats();
    } catch (err) {
      // Suppress error and return null or a default object
      return null;
    }
  }

  async forceRefresh() {
    if (this.mode === 'demo') {
      this.currentData = generateMockData() as unknown as CsvProcessingEntry[];
      this.notifyListeners();
    } else {
      await this.fetchRealData();
    }
  }

  cleanup() {
    if (this.mockUpdateInterval) {
      clearInterval(this.mockUpdateInterval);
      this.mockUpdateInterval = null;
    }
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close(1000, 'DataProvider cleanup');
      }
      this.ws = null;
    }
    // Clear all listeners
    this.listeners.clear();
    this.errorListeners.clear();
  }
}

// Export singleton instance
export const dataProvider = new DataProvider(); 