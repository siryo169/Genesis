import config from './config';
import { CsvStatus, PipelineRun, CsvProcessingEntry } from '@/types/csv-status';

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.apiBaseUrl;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      // Suppress error logging here; let the caller handle it
      throw err;
    }
  }

  async getPipelineStatus(): Promise<CsvProcessingEntry[]> {
    return this.request<CsvProcessingEntry[]>('/api/pipeline/status');
  }

  async getPipelineRuns(): Promise<PipelineRun[]> {
    return this.request<PipelineRun[]>('/runs');
  }

  async getPipelineRun(runId: string): Promise<any> {
    return this.request(`/runs/${runId}`);
  }

  async downloadProcessedFile(runId: string): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/runs/${runId}/download`);
    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`);
    }
    return response.blob();
  }

  async getStats(): Promise<{
    total: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    return this.request('/api/pipeline/stats');
  }

  async retryGeminiQuery(runId: string): Promise<any> {
    return this.request(`/runs/${runId}/retry_gemini_query`, { method: 'POST' });
  }
}

export const apiClient = new ApiClient(); 