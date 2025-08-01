export type ProcessingStatus = 'enqueued' | 'running' | 'ok' | 'error';

export type ProcessingStep = {
  status: ProcessingStatus;
  startTime?: number; // Unix timestamp (ms)
  endTime?: number;   // Unix timestamp (ms)
  errorMessage?: string; // Optional error message
  value?: boolean; // Optional boolean value, e.g., for is_tabular result
};

export interface NormalizerChecks {
  field_mapping_check: ProcessingStep;
  uniform_format_check: ProcessingStep;
  field_verifier_check: ProcessingStep;
  field_encapsulation_check: ProcessingStep;
}

export interface StageStatsEntry {
  start_time?: string;
  end_time?: string;
  status: ProcessingStatus;
  warnings?: string[];
  error_message?: string;
}

export type StageStats = Record<string, StageStatsEntry>;

export interface CsvProcessingEntry {
  id: string;
  filename: string;
  insertion_date?: string; // ISO string from backend
  start_time?: string; // ISO string
  end_time?: string; // ISO string
  duration_ms?: number;
  status: 'enqueued' | 'running' | 'ok' | 'error';
  log_file_path?: string;
  extracted_fields: string[];
  extracted_fields_more?: boolean;
  fileSize?: string; // e.g., "1.2 MB"
  rowCount?: number;
  original_file_size?: number;
  original_row_count?: number;
  final_file_size?: number;
  final_row_count?: number;
  valid_row_percentage?: number;
  gemini_input_tokens?: number;
  gemini_output_tokens?: number;
  gemini_total_tokens?: number;
  gemini_sample_rows?: string[];
  ai_model?: string;
  invalid_lines?: number;
  estimated_cost?: number;
  invalid_line_numbers?: number[];
  stage_stats: StageStats;
}

export type CsvStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface PipelineRun {
  id: string;
  filename: string;
  status: CsvStatus;
  created_at: string;
  updated_at: string;
  error_message?: string;
  progress: number;
  classification_status: 'pending' | 'processing' | 'completed' | 'failed';
  normalization_status: 'pending' | 'processing' | 'completed' | 'failed';
  row_count?: number;
  processed_rows?: number;
}

