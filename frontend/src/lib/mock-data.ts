

import type { CsvProcessingEntry, ProcessingStatus } from '@/types/csv-status';

// Timestamp helpers
const nowStatic = Date.now();
const sec = (s: number) => s * 1000;
const min = (m: number) => m * 60000;

const createStageStats = (status: ProcessingStatus | 'skipped', startOffset?: number, endOffset?: number, errorMessage?: string) => {
  const stats: any = { status };
  if (startOffset !== undefined) stats.start_time = new Date(nowStatic + startOffset).toISOString();
  if (endOffset !== undefined) stats.end_time = new Date(nowStatic + endOffset).toISOString();
  if (status === 'error' && errorMessage) stats.error_message = errorMessage;
  return stats;
};

// Mock CSV processing entries with realistic data
export const mockCsvData: CsvProcessingEntry[] = [
  {
    id: "1",
    filename: "customer_data_2024.csv",
    status: "ok",
    priority: "medium",
    insertion_date: new Date(nowStatic - min(30)).toISOString(),
    extracted_fields: ["name", "email", "phone", "address"],
    rowCount: 15423,
    fileSize: "2.1 MB",
    original_row_count: 15500,
    final_row_count: 15423,
    valid_row_percentage: 99.5,
    gemini_input_tokens: 1250,
    gemini_output_tokens: 350,
    gemini_total_tokens: 1600,
    estimated_cost: 0.0045,
    ai_model: "Gemini 2.5 Flash",
    stage_stats: {
      classification: createStageStats('ok', -min(30), -min(29)),
      sampling: createStageStats('ok', -min(29), -min(28)),
      gemini_query: createStageStats('ok', -min(28), -min(25)),
      normalization: createStageStats('ok', -min(25), -min(20))
    }
  },
  {
    id: "2",
    filename: "sales_report_Q4.csv",
    status: "running",
    priority: "high",
    insertion_date: new Date(nowStatic - min(15)).toISOString(),
    extracted_fields: ["product_id", "sales_amount", "date"],
    rowCount: 8756,
    fileSize: "1.8 MB",
    original_row_count: 8756,
    ai_model: "Gemini 2.5 Flash",
    stage_stats: {
      classification: createStageStats('ok', -min(15), -min(14)),
      sampling: createStageStats('ok', -min(14), -min(13)),
      gemini_query: createStageStats('running', -min(13)),
      normalization: createStageStats('enqueued')
    }
  },
  {
    id: "3",
    filename: "employee_records.csv",
    status: "error",
    priority: "urgent",
    insertion_date: new Date(nowStatic - min(45)).toISOString(),
    extracted_fields: ["employee_id", "department", "salary"],
    rowCount: 2340,
    fileSize: "0.9 MB",
    original_row_count: 2340,
    ai_model: "Gemini 2.5 Flash",
    stage_stats: {
      classification: createStageStats('ok', -min(45), -min(44)),
      sampling: createStageStats('ok', -min(44), -min(43)),
      gemini_query: createStageStats('error', -min(43), -min(42), 'gemini_query: API rate limit exceeded'),
      normalization: createStageStats('enqueued')
    }
  },
  {
    id: "4",
    filename: "inventory_snapshot.csv",
    status: "ok",
    priority: "low",
    insertion_date: new Date(nowStatic - min(60)).toISOString(),
    extracted_fields: ["item_code", "quantity", "location", "last_updated"],
    rowCount: 12987,
    fileSize: "3.2 MB",
    original_row_count: 13100,
    final_row_count: 12987,
    valid_row_percentage: 99.1,
    gemini_input_tokens: 2100,
    gemini_output_tokens: 450,
    gemini_total_tokens: 2550,
    estimated_cost: 0.0078,
    ai_model: "Gemini 2.5 Flash",
    stage_stats: {
      classification: createStageStats('ok', -min(60), -min(59)),
      sampling: createStageStats('ok', -min(59), -min(58)),
      gemini_query: createStageStats('ok', -min(58), -min(55)),
      normalization: createStageStats('ok', -min(55), -min(50))
    }
  },
  {
    id: "5",
    filename: "transaction_log.csv",
    status: "enqueued",
    priority: "medium",
    insertion_date: new Date(nowStatic - min(5)).toISOString(),
    extracted_fields: [],
    rowCount: 45678,
    fileSize: "8.7 MB",
    original_row_count: 45678,
    stage_stats: {
      classification: createStageStats('enqueued'),
      sampling: createStageStats('enqueued'),
      gemini_query: createStageStats('enqueued'),
      normalization: createStageStats('enqueued')
    }
  },
  {
    id: "6",
    filename: "user_analytics.csv",
    status: "error",
    priority: "low",
    insertion_date: new Date(nowStatic - min(90)).toISOString(),
    extracted_fields: ["user_id", "session_duration"],
    rowCount: 5432,
    fileSize: "1.1 MB",
    original_row_count: 5432,
    ai_model: "Gemini 2.5 Flash",
    stage_stats: {
      classification: createStageStats('ok', -min(90), -min(89)),
      sampling: createStageStats('error', -min(89), -min(88), 'sampling: Invalid file format detected'),
      gemini_query: createStageStats('enqueued'),
      normalization: createStageStats('enqueued')
    }
  },
  {
    id: "7",
    filename: "marketing_leads.csv",
    status: "running",
    priority: "high",
    insertion_date: new Date(nowStatic - min(10)).toISOString(),
    extracted_fields: ["lead_id", "company", "contact_email", "interest_level"],
    rowCount: 3456,
    fileSize: "0.7 MB",
    original_row_count: 3456,
    gemini_input_tokens: 890,
    gemini_output_tokens: 240,
    gemini_total_tokens: 1130,
    estimated_cost: 0.0032,
    ai_model: "Gemini 2.5 Flash",
    stage_stats: {
      classification: createStageStats('ok', -min(10), -min(9)),
      sampling: createStageStats('ok', -min(9), -min(8)),
      gemini_query: createStageStats('ok', -min(8), -min(5)),
      normalization: createStageStats('running', -min(5))
    }
  },
  {
    id: "8",
    filename: "financial_summary.csv",
    status: "ok",
    priority: "very-low",
    insertion_date: new Date(nowStatic - min(120)).toISOString(),
    extracted_fields: ["account_id", "balance", "currency", "last_transaction"],
    rowCount: 7890,
    fileSize: "1.5 MB",
    original_row_count: 7920,
    final_row_count: 7890,
    valid_row_percentage: 99.6,
    gemini_input_tokens: 1780,
    gemini_output_tokens: 420,
    gemini_total_tokens: 2200,
    estimated_cost: 0.0067,
    ai_model: "Gemini 2.5 Flash",
    stage_stats: {
      classification: createStageStats('ok', -min(120), -min(119)),
      sampling: createStageStats('ok', -min(119), -min(118)),
      gemini_query: createStageStats('ok', -min(118), -min(115)),
      normalization: createStageStats('ok', -min(115), -min(110))
    }
  },
  // New mock entries for error chart
  {
    id: "9",
    filename: "malformed_data.csv",
    status: "error",
    priority: "medium",
    insertion_date: new Date(nowStatic - min(50)).toISOString(),
    extracted_fields: [],
    rowCount: 100,
    fileSize: "0.1 MB",
    original_row_count: 100,
    ai_model: "Gemini 2.5 Flash",
    stage_stats: {
      classification: createStageStats('error', -min(50), -min(49), 'classification: Parsing Failed - Inconsistent delimiters'),
      sampling: createStageStats('enqueued'),
      gemini_query: createStageStats('enqueued'),
      normalization: createStageStats('enqueued')
    }
  },
  {
    id: "10",
    filename: "archive.zip",
    status: "error",
    priority: "medium",
    insertion_date: new Date(nowStatic - min(55)).toISOString(),
    extracted_fields: [],
    rowCount: 1,
    fileSize: "5.0 MB",
    original_row_count: 1,
    ai_model: "Gemini 2.5 Flash",
    stage_stats: {
      classification: createStageStats('error', -min(55), -min(54), 'classification: Unsupported File Type'),
      sampling: createStageStats('enqueued'),
      gemini_query: createStageStats('enqueued'),
      normalization: createStageStats('enqueued')
    }
  },
  {
    id: "11",
    filename: "large_file_timeout.csv",
    status: "error",
    priority: "low",
    insertion_date: new Date(nowStatic - min(65)).toISOString(),
    extracted_fields: ["id", "data"],
    rowCount: 100000,
    fileSize: "25 MB",
    original_row_count: 100000,
    ai_model: "Gemini 2.5 Flash",
    stage_stats: {
      classification: createStageStats('ok', -min(65), -min(64)),
      sampling: createStageStats('ok', -min(64), -min(63)),
      gemini_query: createStageStats('error', -min(63), -min(62), 'gemini_query: Timeout after 180 seconds'),
      normalization: createStageStats('enqueued')
    }
  },
  {
    id: "12",
    filename: "no_mapping.csv",
    status: "error",
    priority: "high",
    insertion_date: new Date(nowStatic - min(70)).toISOString(),
    extracted_fields: [],
    rowCount: 500,
    fileSize: "0.5 MB",
    original_row_count: 500,
    ai_model: "Gemini 2.5 Flash",
    stage_stats: {
      classification: createStageStats('ok', -min(70), -min(69)),
      sampling: createStageStats('ok', -min(69), -min(68)),
      gemini_query: createStageStats('ok', -min(68), -min(67)),
      normalization: createStageStats('error', -min(67), -min(66), 'normalization: No known headers matched')
    }
  }
];

// Simulate dynamic updates for running processes
export const generateMockUpdate = (): CsvProcessingEntry[] => {
  return mockCsvData.map(entry => {
    if (entry.status === 'running') {
      // Simulate progress in running entries
      const random = Math.random();
      if (random < 0.1) {
        // 10% chance to complete
        return {
          ...entry,
          status: 'ok',
          stage_stats: {
            ...entry.stage_stats,
            normalization: createStageStats('ok', -min(5), 0)
          }
        };
      } else if (random < 0.05) {
        // 5% chance to error
        return {
          ...entry,
          status: 'error',
          stage_stats: {
            ...entry.stage_stats,
            normalization: createStageStats('error', -min(5), 0, 'normalization: Data validation failed')
          }
        };
      }
    }
    return entry;
  });
}; 

    
