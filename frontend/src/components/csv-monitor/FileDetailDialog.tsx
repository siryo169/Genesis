
"use client";

import type { CsvProcessingEntry } from "@/types/csv-status";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { getStatusClassNames } from "./StatusBadge";
import { formatDuration } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import knownHeaders from "@/known_headers.json"; 
import React, from "react";
import { Calendar, Clock, Hourglass, Database, Hash, ShieldAlert, Bot, FileText, DollarSign, BadgePercent, BrainCircuit, Scaling } from 'lucide-react';

interface FileDetailDialogProps {
  entry: CsvProcessingEntry | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const DetailRow = ({ icon: Icon, label, value }: { icon: React.FC<any>, label: string, value: React.ReactNode }) => (
  <div className="grid grid-cols-[auto,1fr] items-center gap-4 py-2 first:pt-0 last:pb-0">
    <dt className="flex items-center text-sm font-medium text-muted-foreground">
      <Icon className="h-4 w-4 mr-2 flex-shrink-0" />
      <span>{label}</span>
    </dt>
    <dd className="text-sm text-right font-mono truncate">{String(value)}</dd>
  </div>
);


const DetailSection = ({ title, children }: { title: string, children: React.ReactNode }) => (
  <div>
    <h4 className="text-base font-semibold text-foreground mb-2 flex items-center">
      {title}
    </h4>
    <dl className="divide-y divide-border/50 border-t border-b border-border/50">
      {children}
    </dl>
  </div>
);

const CRITICAL_HEADERS = [
  "digid_email",
  "pwd_plain",
  "pdata_id_ssn_number",
  "pdata_id_nid_number"
];

function formatFileSize(bytes?: number): string {
  if (bytes == null || isNaN(bytes)) return 'N/A';
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return bytes + ' bytes';
}

// Utility to format line numbers as ranges
function formatLineRanges(lines?: number[]): string {
  if (!lines || lines.length === 0) return '-';
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
  return ranges.join(', ');
}

function formatUTCDate(dateString?: string): string {
  if (!dateString) return 'N/A';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'UTC'
    }) + ' UTC';
  } catch (e) {
    return 'Invalid Date';
  }
}

export function FileDetailDialog({ entry, isOpen, onOpenChange }: FileDetailDialogProps) {
  if (!entry) return null;

  const totalDuration = entry.duration_ms
    ? formatDuration(entry.duration_ms)
    : (entry.start_time && entry.status === 'running'
        ? formatDuration(new Date().getTime() - new Date(entry.start_time).getTime()) + ' (running)'
        : "N/A");

  const invalidLines = entry.invalid_line_numbers?.length ? entry.invalid_line_numbers.length.toLocaleString() : '-';


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="truncate text-lg">{entry.filename}</DialogTitle>
          <DialogDescription>
            Detailed processing information and status for this file.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
          {/* Left Column */}
          <div className="space-y-6">
            <DetailSection title="Timestamps">
              <DetailRow icon={Calendar} label="Insertion Date" value={formatUTCDate(entry.insertion_date)} />
              <DetailRow icon={Clock} label="Processing Start" value={formatUTCDate(entry.start_time)} />
              <DetailRow icon={Clock} label="Processing End" value={formatUTCDate(entry.end_time)} />
              <DetailRow icon={Hourglass} label="Total Duration" value={totalDuration} />
            </DetailSection>

            <DetailSection title="File Metrics">
              <DetailRow icon={Database} label="Original File Size" value={formatFileSize(entry.original_file_size)} />
              <DetailRow icon={Hash} label="Original Row Count" value={entry.original_row_count?.toLocaleString() ?? 'N/A'} />
              <DetailRow icon={Database} label="Final File Size" value={formatFileSize(entry.final_file_size)} />
              <DetailRow icon={Hash} label="Final Row Count" value={entry.final_row_count?.toLocaleString() ?? 'N/A'} />
              <DetailRow icon={BadgePercent} label="Valid Row Percentage" value={entry.valid_row_percentage != null ? entry.valid_row_percentage.toFixed(2) + '%' : 'N/A'} />
              <DetailRow icon={ShieldAlert} label="Invalid Lines" value={invalidLines} />
            </DetailSection>

            <DetailSection title="AI Usage">
              <DetailRow icon={Bot} label="AI Model Used" value={entry.ai_model ?? 'N/A'} />
              <DetailRow icon={FileText} label="Gemini Input Tokens" value={entry.gemini_input_tokens?.toLocaleString() ?? 'N/A'} />
              <DetailRow icon={FileText} label="Gemini Output Tokens" value={entry.gemini_output_tokens?.toLocaleString() ?? 'N/A'} />
              <DetailRow icon={FileText} label="Gemini Total Tokens" value={entry.gemini_total_tokens?.toLocaleString() ?? 'N/A'} />
              <DetailRow icon={DollarSign} label="Estimated Cost" value={typeof entry.estimated_cost === 'number' ? `$${entry.estimated_cost.toFixed(6)}` : 'N/A'} />
            </DetailSection>

          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-semibold text-foreground">Overall Status</h3>
              <div className="flex justify-between items-center py-2 border-b border-t border-border/50 mt-1">
                <span className="text-sm text-muted-foreground">Current Status</span>
                <Badge variant="outline" className={getStatusClassNames(entry.status)}>
                    {entry.status}
                </Badge>
              </div>
            </div>

            <div>
                <h3 className="text-base font-semibold text-foreground mb-1">Processing Steps</h3>
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Step</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Duration</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                      {['classification', 'sampling', 'gemini_query', 'normalization'].map((stage) => {
                        const stat = entry.stage_stats?.[stage];
                        let duration = 'N/A';
                        if (stat?.start_time && stat?.end_time) {
                          const ms = new Date(stat.end_time).getTime() - new Date(stat.start_time).getTime();
                          duration = formatDuration(ms);
                        }
                        return (
                          <TableRow key={stage}>
                            <TableCell className="font-medium">{stage.charAt(0).toUpperCase() + stage.slice(1).replace('_', ' ')}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={getStatusClassNames(stat?.status)}>
                                {stat?.status || 'enqueued'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">{duration}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                </Table>
            </div>

            <div>
                <h3 className="text-base font-semibold text-foreground mb-2">Extracted Fields</h3>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
