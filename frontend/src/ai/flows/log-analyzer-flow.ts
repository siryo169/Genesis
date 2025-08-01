
'use server';
/**
 * @fileOverview An AI flow for analyzing log data.
 *
 * - analyzeLogs - A function that takes a log string and returns a summary.
 * - LogAnalysisInput - The input type for the analyzeLogs function.
 * - LogAnalysisOutput - The return type for the analyzeLogs function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const LogAnalysisInputSchema = z.object({
  logs: z.string().describe('The full string content of the logs to be analyzed.'),
});
export type LogAnalysisInput = z.infer<typeof LogAnalysisInputSchema>;

const LogAnalysisOutputSchema = z.object({
  summary: z.string().describe('A brief, one-paragraph summary of the key events in the logs.'),
  errorCount: z.number().describe('The total count of ERROR level log entries.'),
  warningCount: z.number().describe('The total count of WARNING level log entries.'),
  criticalError: z.string().optional().describe('A detailed description of the most critical error found, if any.'),
  recommendation: z.string().optional().describe('A recommended action to resolve the primary issue, if applicable.'),
});
export type LogAnalysisOutput = z.infer<typeof LogAnalysisOutputSchema>;


const logAnalysisPrompt = ai.definePrompt({
  name: 'logAnalysisPrompt',
  input: { schema: LogAnalysisInputSchema },
  output: { schema: LogAnalysisOutputSchema },
  prompt: `You are a helpful DevOps assistant. Your task is to analyze the provided logs and provide a structured summary.

Carefully review the logs provided below. Identify all errors and warnings. Determine the root cause of any failures.

Logs:
\`\`\`
{{{logs}}}
\`\`\`

Based on your analysis, provide a concise summary, count the errors and warnings, identify the most critical error, and suggest a resolution. If there are no errors, you can omit the criticalError and recommendation fields.`,
});

const logAnalysisFlow = ai.defineFlow(
  {
    name: 'logAnalysisFlow',
    inputSchema: LogAnalysisInputSchema,
    outputSchema: LogAnalysisOutputSchema,
  },
  async (input) => {
    const { output } = await logAnalysisPrompt(input);
    if (!output) {
      throw new Error('Failed to get a response from the AI model.');
    }
    return output;
  }
);

export async function analyzeLogs(input: LogAnalysisInput): Promise<LogAnalysisOutput> {
  return logAnalysisFlow(input);
}
