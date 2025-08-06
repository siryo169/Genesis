import config from './config';
import { apiClient } from './api-client';
import { mockCsvData, generateMockUpdate } from './mock-data';
import { CsvProcessingEntry } from '@/types/csv-status';

export class DataProvider {
  private mode: 'mock' | 'real';
  private mockUpdateInterval: NodeJS.Timeout | null = null;
  private fallbackInterval: NodeJS.Timeout | null = null;
  private listeners: Set<(data: CsvProcessingEntry[]) => void> = new Set();
  private currentData: CsvProcessingEntry[] = [];
  private ws: WebSocket | null = null;
  private clientInitialized = false;

  constructor() {
    // Check localStorage for saved mode preference, default to 'mock'
    // Only access localStorage if we're in the browser
    let savedMode: 'mock' | 'real' | null = null;
    if (typeof window !== 'undefined') {
      savedMode = localStorage.getItem('dataSourceMode') as 'mock' | 'real' | null;
    }
    this.mode = savedMode || 'mock';
    console.log(`DataProvider initialized in ${this.mode} mode`);
    this.init();
  }

  private init() {
    if (this.mode === 'mock') {
      this.initMockMode();
    } else {
      this.initRealMode();
    }
  }

  private initMockMode() {
    // Start with initial mock data
    this.currentData = [...mockCsvData];
    this.notifyListeners();

    // Update mock data periodically with small changes
    this.mockUpdateInterval = setInterval(() => {
      this.currentData = generateMockUpdate();
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
      // Clear any existing fallback interval before creating new WebSocket
      if (this.fallbackInterval) {
        clearInterval(this.fallbackInterval);
        this.fallbackInterval = null;
      }

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
        // Start fallback polling if not already running
        if (!this.fallbackInterval) {
          console.log('Starting fallback polling due to WebSocket error');
          this.fallbackInterval = setInterval(() => this.fetchRealData(), config.pollingInterval);
        }
      };
      
      this.ws.onclose = (event) => {
        console.warn('WebSocket closed:', event.code, event.reason);
        this.notifyErrorListeners(new Error('WebSocket closed'));
        
        // Start fallback polling if not already running
        if (!this.fallbackInterval) {
          console.log('Starting fallback polling due to WebSocket close');
          this.fallbackInterval = setInterval(() => this.fetchRealData(), config.pollingInterval);
        }
        
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
        // Clear fallback polling when WebSocket is connected
        if (this.fallbackInterval) {
          console.log('Clearing fallback polling - WebSocket connected');
          clearInterval(this.fallbackInterval);
          this.fallbackInterval = null;
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.notifyErrorListeners(error);
      // Start fallback polling if not already running
      if (!this.fallbackInterval) {
        console.log('Starting fallback polling due to WebSocket creation error');
        this.fallbackInterval = setInterval(() => this.fetchRealData(), config.pollingInterval);
      }
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
    if (typeof window !== 'undefined' && !this.clientInitialized) {
      this.initializeForClient();
    }
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
    if (this.mode === 'mock') {
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
    if (this.mode === 'mock') {
      this.currentData = generateMockUpdate();
      this.notifyListeners();
    } else {
      await this.fetchRealData();
    }
  }

  // New method to switch between mock and real modes
  switchMode(newMode: 'mock' | 'real') {
    if (this.mode === newMode) return; // No change needed
    
    // Save preference to localStorage only if we're in the browser
    if (typeof window !== 'undefined') {
      localStorage.setItem('dataSourceMode', newMode);
    }
    
    // Cleanup current mode resources (but keep listeners)
    this.cleanupResources();
    
    // Switch to new mode
    this.mode = newMode;
    console.log(`DataProvider switched to ${this.mode} mode`);
    
    // Reinitialize with new mode
    this.init();
  }

  // Get current mode
  getCurrentMode(): 'mock' | 'real' {
    return this.mode;
  }

  // Clean up resources only (intervals and websocket)
  private cleanupResources() {
    if (this.mockUpdateInterval) {
      clearInterval(this.mockUpdateInterval);
      this.mockUpdateInterval = null;
    }
    if (this.fallbackInterval) {
      clearInterval(this.fallbackInterval);
      this.fallbackInterval = null;
    }
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close(1000, 'DataProvider mode switch');
      }
      this.ws = null;
    }
  }

  cleanup() {
    this.cleanupResources();
    // Clear all listeners only on full cleanup
    this.listeners.clear();
    this.errorListeners.clear();
  }
}

// Export singleton instance
export const dataProvider = new DataProvider(); 
