import config from './config';
import { CsvStatus, PipelineRun, CsvProcessingEntry } from '@/types/csv-status';

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.apiBaseUrl;
    console.log(`🔧 ApiClient initialized with baseUrl: ${this.baseUrl}`);
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const fullUrl = `${this.baseUrl}${endpoint}`;
    console.log(`🚀 Attempting request to: ${fullUrl}`);
    
    const isFormData = options.body instanceof FormData;

    try {
      const response = await fetch(fullUrl, {
        ...options,
        headers: isFormData ? options.headers : {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });
      console.log(`✅ Response received: ${response.status}`);
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      if (response.headers.get('Content-Type')?.includes('application/json')) {
        return await response.json();
      }
      return response as any;
    } catch (err) {
      console.error(`❌ Request failed for ${fullUrl}:`, err);
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

  async downloadBeProcessedFile(runId: string): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/runs/${runId}/download_be`);
    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`);
    }
    return response.blob();
  }

  async uploadFile(formData : FormData){
    return this.request('/api/upload',
      {
          method: 'POST',
          body: formData
      }
    );

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

  async updatePriority(runId: string, priority: number): Promise<any> {
    // Use FormData to avoid setting Content-Type manually
    console.log(`🔧 Updating priority for run ${runId} to ${priority}`);
    const formData = new FormData();
    formData.append('priority', priority.toString());

    const response = await fetch(`${this.baseUrl}/runs/${runId}/priority`, {
      method: 'PATCH',
      body: formData,  
    });

    if (!response.ok) {
      console.log(`✅ Priority updated successfully: ${response}`);
    }
    return response.json();
  }
}

export const apiClient = new ApiClient(); 

    