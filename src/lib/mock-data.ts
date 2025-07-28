import { PipelineRun, CsvStatus } from '@/types/csv-status';

const SAMPLE_FILENAMES = [
  'customer_data_2024.csv',
  'sales_report_q1.csv',
  'inventory_march.csv',
  'employee_records.csv',
  'transactions_2024.csv',
];

function getRandomStatus(): CsvStatus {
  const statuses: CsvStatus[] = ['pending', 'processing', 'completed', 'failed'];
  return statuses[Math.floor(Math.random() * statuses.length)];
}

function getRandomDate(start: Date, end: Date): string {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString();
}

export function generateMockData(count: number = 5): PipelineRun[] {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  return Array.from({ length: count }, (_, index) => {
    const status = getRandomStatus();
    const created_at = getRandomDate(yesterday, now);
    
    return {
      id: `run-${Math.random().toString(36).substr(2, 9)}`,
      filename: SAMPLE_FILENAMES[index % SAMPLE_FILENAMES.length],
      status,
      created_at,
      updated_at: new Date().toISOString(),
      progress: status === 'completed' ? 100 : Math.floor(Math.random() * 100),
      classification_status: status === 'pending' ? 'pending' : getRandomStatus(),
      normalization_status: status === 'pending' || status === 'processing' ? 'pending' : getRandomStatus(),
      row_count: Math.floor(Math.random() * 10000) + 1000,
      processed_rows: Math.floor(Math.random() * 10000),
      error_message: status === 'failed' ? 'Sample error message' : undefined,
    };
  });
} 