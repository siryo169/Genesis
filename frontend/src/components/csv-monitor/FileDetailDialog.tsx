"use client";

import type { CsvProcessingEntry, ProcessingStep } from "@/types/csv-status";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { getStatusClassNames } from "./StatusBadge";
import { formatDuration } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import knownHeaders from "@/known_headers.json"; 
import React, { useState } from "react";

interface FileDetailDialogProps {
  entry: CsvProcessingEntry | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const DetailRow = ({ label, value }: { label: string, value: React.ReactNode }) => (
  <div className="grid grid-cols-3 gap-4 py-2 border-b border-border/50">
    <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
    <dd className="text-sm col-span-2">{value}</dd>
  </div>
);

// Remove StepDetailRow and old per-stage logic

const CRITICAL_HEADERS = [
  "digid_email",
  "pwd_plain",
  "pdata_id_ssn_number",
  "pdata_id_nid_number"
];

function formatFileSize(bytes?: number): string {
  if (bytes == null) return 'N/A';
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return bytes + ' bytes';
}

// Utility to format line numbers as ranges
function formatLineRanges(lines?: number[]): string[] {
  if (!lines || lines.length === 0) return ['None'];
  const sorted = [...lines].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let end = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push(start === end ? `${start}` : `[${start}-${end}]`);
      start = end = sorted[i];
    }
  }
  ranges.push(start === end ? `${start}` : `[${start}-${end}]`);
  return ranges;
}

// Update formatUTCDate to robustly handle ISO 8601 with 'Z' or '+00:00', and display as UTC
function formatUTCDate(dateString?: string): string {
  if (!dateString) return 'N/A';
  // Always parse as UTC
  let d: Date;
  if (dateString.endsWith('Z') || dateString.match(/\+\d{2}:\d{2}$/)) {
    d = new Date(dateString);
  } else {
    // fallback: treat as UTC
    d = new Date(dateString.replace(' ', 'T') + 'Z');
  }
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')} ${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}:${String(d.getUTCSeconds()).padStart(2,'0')} UTC`;
}

export function FileDetailDialog({ entry, isOpen, onOpenChange }: FileDetailDialogProps) {
  const [showAllInvalidLines, setShowAllInvalidLines] = useState(false);

  if (!entry) return null;

  const totalDuration = entry.duration_ms
    ? formatDuration(entry.duration_ms)
    : (entry.start_time && entry.status === 'running'
        ? formatDuration(Date.parse(new Date().toISOString()) - Date.parse(entry.start_time)) + ' (running)'
        : "N/A");

  const invalidLineRanges = formatLineRanges(entry.invalid_line_numbers);

  // Info message for UTC0
  const utcInfo = (
    <div className="mb-2 text-xs text-muted-foreground italic">
      All times below are shown in UTC (Coordinated Universal Time, UTC+0).
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="truncate">{entry.filename}</DialogTitle>
          <DialogDescription>
            Detailed processing information and status for this file.
          </DialogDescription>
        </DialogHeader>
        {utcInfo}
        <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-4">
                <dl className="divide-y divide-border/50">
                    <DetailRow label="Insertion Date" value={formatUTCDate(entry.insertion_date)} />
                    <DetailRow label="Processing Start" value={formatUTCDate(entry.start_time)} />
                    <DetailRow label="Processing End" value={formatUTCDate(entry.end_time)} />
                    <DetailRow label="Total Duration" value={totalDuration} />
                    <DetailRow label="Original File Size" value={formatFileSize(entry.original_file_size)} />
                    <DetailRow label="Original Row Count" value={entry.original_row_count?.toLocaleString() ?? 'N/A'} />
                    {entry.final_file_size != null && (
                      <DetailRow label="Final File Size" value={formatFileSize(entry.final_file_size)} />
                    )}
                    {entry.final_row_count != null && (
                      <DetailRow label="Final Row Count" value={entry.final_row_count.toLocaleString()} />
                    )}
                    <DetailRow label="Valid Row Percentage" value={entry.valid_row_percentage != null ? entry.valid_row_percentage.toFixed(2) + '%' : 'N/A'} />
                    <DetailRow
                      label="Invalid Lines"
                      value={
                        <>
                          {showAllInvalidLines
                            ? invalidLineRanges.join(', ')
                            : invalidLineRanges.slice(0, 5).join(', ') + (invalidLineRanges.length > 5 ? ', ...' : '')}
                          {invalidLineRanges.length > 5 && (
                            <button
                              onClick={() => setShowAllInvalidLines((v) => !v)}
                              className="ml-2 text-xs underline text-blue-600 hover:text-blue-800"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                            >
                              {showAllInvalidLines ? 'Show less' : `Show all (${invalidLineRanges.length})`}
                            </button>
                          )}
                        </>
                      }
                    />
                    <DetailRow label="AI Model Used" value={entry.ai_model ?? 'N/A'} />
                    <DetailRow label="Gemini Input Tokens" value={entry.gemini_input_tokens?.toLocaleString() ?? 'N/A'} />
                    <DetailRow label="Gemini Output Tokens" value={entry.gemini_output_tokens?.toLocaleString() ?? 'N/A'} />
                    <DetailRow label="Gemini Total Tokens" value={entry.gemini_total_tokens?.toLocaleString() ?? 'N/A'} />
                    <DetailRow label="Estimated Cost" value={typeof entry.estimated_cost === 'number' ? `$${entry.estimated_cost.toFixed(4)}` : 'N/A'} />
                    <DetailRow label="Overall Status" value={
                        <Badge variant="outline" className={getStatusClassNames(entry.status)}>
                            {entry.status}
                        </Badge>
                    } />
                </dl>

                <div>
                    <h3 className="text-lg font-semibold mt-6 mb-2">Processing Steps</h3>
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>Step</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Details</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                          {['classification', 'sampling', 'gemini_query', 'normalization'].map((stage) => {
                            const stat = entry.stage_stats?.[stage];
                            let duration = 'N/A';
                            if (stat?.start_time && stat?.end_time) {
                              const ms = Date.parse(stat.end_time) - Date.parse(stat.start_time);
                              duration = ms < 1000 ? ms.toFixed(2) + ' ms' : (ms/1000).toFixed(2) + ' s';
                            }
                            let details = 'None';
                            if (stat?.error_message) details = stat.error_message;
                            else if (stat?.warnings && stat.warnings.length > 0) details = stat.warnings.join(', ');
                            return (
                              <TableRow key={stage}>
                                <TableCell className="font-medium">{stage.charAt(0).toUpperCase() + stage.slice(1).replace('_', ' ')}</TableCell>
                                <TableCell>{duration}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={getStatusClassNames(stat?.status)}>
                                    {stat?.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">{details}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                    </Table>
                </div>

                <div>
                    <h3 className="text-lg font-semibold mt-6 mb-2">Extracted Fields</h3>
                    {entry.extracted_fields && entry.extracted_fields.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {entry.extracted_fields.map((field, idx) => {
                          let color: string | undefined = undefined;
                          let fontWeight: string | undefined = undefined;
                          if (CRITICAL_HEADERS.includes(field)) fontWeight = 'bold';
                          else if (!(field in knownHeaders)) color = 'orange';
                          return (
                            <Badge key={`${field}-${idx}`} variant="secondary" style={{ color, fontWeight }}>{field}</Badge>
                          );
                        })}
                    </div>
                    ) : (
                    <p className="text-sm text-muted-foreground">No fields extracted yet.</p>
                    )}
                </div>
            </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
