"use client";

import type { CsvProcessingEntry } from "@/types/csv-status";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge, getStatusClassNames } from "./StatusBadge";
import { NormalizerStatusCell } from "./NormalizerStatusCell";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Download, CheckCircle2, XCircle, Circle, RefreshCcw, LogsIcon, Wand2 } from "lucide-react"; 
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import React, { useState } from "react";
import knownHeaders from "@/known_headers.json"; 
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api-client';
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { LogAnalysisOutput } from '@/ai/flows/log-analyzer-flow';
import { Badge } from "@/components/ui/badge";

interface CsvStatusTableProps {
  data: CsvProcessingEntry[];
  sortConfig: { key: keyof CsvProcessingEntry | null; direction: 'ascending' | 'descending' };
  requestSort: (key: keyof CsvProcessingEntry) => void;
  now: number | undefined; 
  onDownload: (filename: string) => void;
  onRetry: (id: string) => void;
  onRowClick: (entry: CsvProcessingEntry) => void;
}

const truncateFields = (fields: string[], maxLength: number = 50) => {
  const joined = fields.join(", ");
  if (joined.length > maxLength) {
    return joined.substring(0, maxLength - 3) + "...";
  }
  return joined;
};

const CRITICAL_HEADERS = [
  "digid_email",
  "pwd_plain",
  "pdata_id_ssn_number",
  "pdata_id_nid_number"
];

export function CsvStatusTable({ data, sortConfig, requestSort, now, onDownload, onRetry, onRowClick }: CsvStatusTableProps) {
  const getSortIndicator = (key: keyof CsvProcessingEntry) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
    }
    return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50 group-hover:opacity-100" />;
  };
  
  const [moreIdx, setMoreIdx] = useState<string | null>(null);
  const [moreDialogEntryId, setMoreDialogEntryId] = useState<string | null>(null);
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [logDialogEntry, setLogDialogEntry] = useState<CsvProcessingEntry | null>(null);
  const [logContent, setLogContent] = useState<string>('');
  const [logSearch, setLogSearch] = useState('');
  const [logLoading, setLogLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<Record<string, LogAnalysisOutput | { error: string }>>({});

  const handleOpenLogDialog = async (entry: CsvProcessingEntry) => {
    setLogDialogEntry(entry);
    setLogDialogOpen(true);
    setLogLoading(true);
    try {
      const run = await apiClient.getPipelineRun(entry.id);
      setLogContent(run.log_contents || 'No logs found.');
    } catch (e) {
      setLogContent('Failed to load logs.');
    }
    setLogLoading(false);
  };

  const handleDownloadLog = () => {
    if (!logDialogEntry) return;
    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${logDialogEntry.filename}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAnalyzeLogs = async () => {
    if (!logDialogEntry) return;
    setAiLoading(true);
    try {
      const result = await import("@/ai/flows/log-analyzer-flow").then(m => m.analyzeLogs({ logs: logContent }));
      setAiResult(prev => ({ ...prev, [logDialogEntry.id]: result }));
    } catch (e) {
      setAiResult(prev => ({ ...prev, [logDialogEntry.id]: { error: "Failed to analyze logs." } }));
    }
    setAiLoading(false);
  };

  // Helper to highlight search matches in log lines
  function highlightMatches(line: string, search: string) {
    if (!search) return line;
    const regex = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = line.split(regex);
    return parts.map((part, i) =>
      regex.test(part)
        ? <mark key={i} style={{ background: 'yellow', color: 'black', padding: 0 }}>{part}</mark>
        : part
    );
  }

  const moreDialogEntry = React.useMemo(
    () => data.find(e => e.id === moreDialogEntryId) || null,
    [data, moreDialogEntryId]
  );

  // Add state for the Gemini Subsample Rows dialog
  const [sampleRowsDialogId, setSampleRowsDialogId] = useState<string | null>(null);
  const sampleRowsDialogEntry = React.useMemo(
    () => data.find(e => e.id === sampleRowsDialogId) || null,
    [data, sampleRowsDialogId]
  );

  // Add or import the robust UTC formatter at the top (copy from FileDetailDialog if needed):
  function formatUTCDate(dateString?: string): string {
    if (!dateString) return 'N/A';
    let d: Date;
    if (dateString.endsWith('Z') || dateString.match(/\+\d{2}:\d{2}$/)) {
      d = new Date(dateString);
    } else {
      d = new Date(dateString.replace(' ', 'T') + 'Z');
    }
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')} ${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}:${String(d.getUTCSeconds()).padStart(2,'0')} UTC`;
  }

  return (
    <>
    <ScrollArea className="min-h-[400px] flex-grow rounded-md border shadow-sm">
      <table className="min-w-full border-collapse relative">
        <TableHeader className="bg-muted sticky top-0 z-10">
          <TableRow>
            <TableHead>
                <Button variant="ghost" onClick={() => requestSort('filename')} className="px-2 py-1 group text-xs">
                Filename {getSortIndicator('filename')}
              </Button>
            </TableHead>
            <TableHead>
              <Button variant="ghost" onClick={() => requestSort('insertion_date')} className="px-2 py-1 group">
                Insertion Date {getSortIndicator('insertion_date')}
              </Button>
            </TableHead>
            <TableHead>
               <span className="px-2 py-1 group text-xs">Classifier</span>
            </TableHead>
            <TableHead>
                <Button variant="ghost" disabled className="px-2 py-1 group text-xs">
                File Type
              </Button>
            </TableHead>
            <TableHead>
              <span className="px-2 py-1 group text-xs">Sampling</span>
            </TableHead>
            <TableHead>
              <span className="px-2 py-1 group text-xs">Gemini Query</span>
            </TableHead>
            <TableHead>Extracted Fields</TableHead>
            <TableHead>
              <span className="px-2 py-1 group text-xs">Normalizer</span>
            </TableHead>
            <TableHead className="text-right px-4">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                No files found. Try uploading a new file or clearing your filters.
              </TableCell>
            </TableRow>
          ) : (
            data.map((entry) => {
              const isFullyCompleted = 
                entry.stage_stats?.classification?.status === 'ok' &&
                entry.stage_stats?.sampling?.status === 'ok' &&
                entry.stage_stats?.gemini_query?.status === 'ok' &&
                entry.stage_stats?.normalization?.status === 'ok';

              const hasError = [
                entry.stage_stats?.classification,
                entry.stage_stats?.sampling,
                entry.stage_stats?.gemini_query,
                entry.stage_stats?.normalization
              ].some(step => step && step.status === 'error');

              return (
                <TableRow key={entry.id} className="hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => onRowClick(entry)}>
                    <TableCell className="font-medium py-3 px-4 whitespace-nowrap text-xs max-w-[260px] overflow-hidden text-ellipsis" title={entry.filename}>
                      <TooltipProvider delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="block overflow-hidden text-ellipsis whitespace-nowrap max-w-[240px]">{entry.filename}</span>
                          </TooltipTrigger>
                          <TooltipContent>{entry.filename}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="py-3 px-4 text-sm text-muted-foreground text-nowrap">
                      {formatUTCDate(entry.insertion_date)}
                  </TableCell>
                  <TableCell className="py-3 px-4">
                    <StatusBadge 
                      status={entry.status === 'enqueued' ? 'enqueued' : entry.stage_stats?.classification?.status} 
                      startTime={entry.stage_stats?.classification?.start_time ? new Date(entry.stage_stats.classification.start_time).getTime() : undefined}
                      endTime={entry.stage_stats?.classification?.end_time ? new Date(entry.stage_stats.classification.end_time).getTime() : undefined}
                      error_message={entry.stage_stats?.classification?.error_message}
                      now={now} 
                    />
                  </TableCell>
                    <TableCell className="py-3 px-4 text-center text-xs">
                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="font-medium">
                            {(() => {
                              const step = entry.stage_stats?.classification;
                              if (step?.status === 'ok') {
                                return 'Tabular'; // or other logic if you want to distinguish
                              }
                              return '';
                            })()}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="capitalize">
                           {(() => {
                              const step = entry.stage_stats?.classification;
                              if (step?.status === 'ok') {
                                return 'File type: Tabular';
                              }
                              return 'Status: Enqueued';
                            })()}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="py-3 px-4 align-middle">
                    <div className="relative flex flex-col items-center justify-center" style={{ minHeight: 10 }}>
                      <div className="flex items-center justify-center h-full">
                        <StatusBadge
                          status={entry.stage_stats?.sampling?.status}
                          startTime={entry.stage_stats?.sampling?.start_time ? new Date(entry.stage_stats.sampling.start_time).getTime() : undefined}
                          endTime={entry.stage_stats?.sampling?.end_time ? new Date(entry.stage_stats.sampling.end_time).getTime() : undefined}
                          error_message={entry.stage_stats?.sampling?.error_message}
                          now={now}
                        />
                      </div>
                      {entry.stage_stats?.sampling?.status === 'ok' && entry.gemini_sample_rows && entry.gemini_sample_rows.length > 0 && (
                        <span
                          className="underline text-blue-600 cursor-pointer text-xs mt-1"
                          style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 4 }}
                          onClick={e => {
                            e.stopPropagation();
                            setSampleRowsDialogId(entry.id);
                          }}
                        >
                          Inspect
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-3 px-4">
                    <StatusBadge 
                      status={entry.stage_stats?.gemini_query?.status}
                      startTime={entry.stage_stats?.gemini_query?.start_time ? new Date(entry.stage_stats.gemini_query.start_time).getTime() : undefined}
                      endTime={entry.stage_stats?.gemini_query?.end_time ? new Date(entry.stage_stats.gemini_query.end_time).getTime() : undefined}
                      error_message={entry.stage_stats?.gemini_query?.error_message}
                      now={now}
                    />
                  </TableCell>
                  <TableCell className="py-3 px-4 text-sm text-muted-foreground" title={entry.extracted_fields ? entry.extracted_fields.join(", ") : "No fields extracted"}>
                    {(() => {
                      if (!entry.extracted_fields) {
                        return <span className="text-muted-foreground">No fields extracted</span>;
                      }
                      const headers = entry.extracted_fields.slice(0, 4);
                      const prioritized = headers.filter(h => CRITICAL_HEADERS.includes(h));
                      const rest = headers.filter(h => !CRITICAL_HEADERS.includes(h));
                      const sortedHeaders = [...prioritized, ...rest];

                      return sortedHeaders.map((field, idx) => {
                        let color: string | undefined = undefined;
                        let fontWeight: string | undefined = undefined;
                        if (CRITICAL_HEADERS.includes(field)) {
                          color = 'black';
                          fontWeight = 'bold';
                        } else if (!(field in knownHeaders)) {
                          color = 'orange';
                        }
                        return (
                          <Badge key={`${field}-${idx}`} variant="secondary" style={{ color, fontWeight }} className="mr-1 mb-1 px-1.5 py-0.5 text-xs">
                            {field}
                          </Badge>
                        );
                      });
                    })()}
                    {entry.stage_stats?.gemini_query?.status === 'ok' && !entry.stage_stats?.gemini_query?.error_message && (
                      <span
                        className="underline text-blue-600 cursor-pointer text-xs ml-1"
                        onClick={e => {
                          e.stopPropagation();
                          setMoreDialogEntryId(entry.id);
                        }}
                      >
                        More
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-3 px-4">
                    <StatusBadge
                      status={entry.stage_stats?.normalization?.status}
                      startTime={entry.stage_stats?.normalization?.start_time ? new Date(entry.stage_stats.normalization.start_time).getTime() : undefined}
                      endTime={entry.stage_stats?.normalization?.end_time ? new Date(entry.stage_stats.normalization.end_time).getTime() : undefined}
                      error_message={entry.stage_stats?.normalization?.error_message}
                      now={now}
                    />
                  </TableCell>
                  {/* Remove normalizer_checks substages columns */}
                  <TableCell className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                       {hasError && (
                        <>
                          {entry.stage_stats?.gemini_query?.status === 'error' && (
                            <TooltipProvider delayDuration={100}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="outline" size="icon" onClick={(e) => { e.stopPropagation(); onRetry(entry.id); }}>
                                    <RefreshCcw className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Retry</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          <TooltipProvider delayDuration={100}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="outline" size="icon" onClick={(e) => { e.stopPropagation(); handleOpenLogDialog(entry); }}>
                                  <LogsIcon className="h-4 w-4" />
                        </Button>
                              </TooltipTrigger>
                              <TooltipContent>Logs</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </>
                      )}
                      {isFullyCompleted && (
                          <>
                            <TooltipProvider delayDuration={100}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onDownload(entry.filename); }}>
                                    <Download className="mr-0 h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Download</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider delayDuration={100}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleOpenLogDialog(entry); }}>
                                    <LogsIcon className="mr-0 h-3.5 w-3.5" />
                        </Button>
                                </TooltipTrigger>
                                <TooltipContent>Logs</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </table>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
      <Dialog open={logDialogOpen} onOpenChange={setLogDialogOpen}>
        <DialogContent className="w-[80vw] max-w-10xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Logs for {logDialogEntry?.filename}</DialogTitle>
            <DialogDescription>Inspect the processing logs for this file. Use the search bar to find specific warnings or messages.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Input
              placeholder="Search logs..."
              value={logSearch}
              onChange={e => setLogSearch(e.target.value)}
              className="w-full"
            />
            <Button variant="secondary" onClick={handleDownloadLog} disabled={!logContent}>
              <Download className="h-4 w-4 mr-1" /> Download
            </Button>
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="default" onClick={handleAnalyzeLogs} disabled={!logContent || aiLoading} className="flex items-center">
                    <Wand2 className="h-4 w-4 mr-1" /> Analyze with AI
                    {aiLoading && <span className="ml-2 animate-spin"><Loader2 className="h-4 w-4" /></span>}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Analyze this log with AI</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <ScrollArea className="h-[50vh] border rounded bg-muted p-2">
            <pre className="whitespace-pre-wrap text-xs font-mono">
              {logLoading ? 'Loading logs...' :
                logContent
                  .split('\n')
                  .filter(line => !logSearch || line.toLowerCase().includes(logSearch.toLowerCase()))
                  .map((line, idx) => <React.Fragment key={idx}>{highlightMatches(line, logSearch)}{"\n"}</React.Fragment>)
              }
            </pre>
          </ScrollArea>
          {logDialogEntry && aiResult[logDialogEntry.id] && (
            <div className="mt-4">
              {'error' in aiResult[logDialogEntry.id] ? (
                <Alert variant="destructive">{(aiResult[logDialogEntry.id] as { error: string }).error}</Alert>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>AI Log Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p><strong>Summary:</strong> {(aiResult[logDialogEntry.id] as LogAnalysisOutput).summary}</p>
                    <p><strong>Errors:</strong> {(aiResult[logDialogEntry.id] as LogAnalysisOutput).errorCount}</p>
                    <p><strong>Warnings:</strong> {(aiResult[logDialogEntry.id] as LogAnalysisOutput).warningCount}</p>
                    {(aiResult[logDialogEntry.id] as LogAnalysisOutput).criticalError && <p><strong>Critical Error:</strong> {(aiResult[logDialogEntry.id] as LogAnalysisOutput).criticalError}</p>}
                    {(aiResult[logDialogEntry.id] as LogAnalysisOutput).recommendation && <p><strong>Recommendation:</strong> {(aiResult[logDialogEntry.id] as LogAnalysisOutput).recommendation}</p>}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* More Dialog for all fields and subsample rows */}
      <Dialog open={!!moreDialogEntry} onOpenChange={open => setMoreDialogEntryId(open ? moreDialogEntryId : null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Extracted Fields</DialogTitle>
          </DialogHeader>
          {moreDialogEntry && (
            <div className="space-y-4 overflow-x-auto">
              <div>
                <strong>Fields ({moreDialogEntry.extracted_fields ? moreDialogEntry.extracted_fields.length : 0}):</strong>
                <div className="flex flex-wrap gap-2 mt-2">
                  {moreDialogEntry.extracted_fields ? moreDialogEntry.extracted_fields.map((field, idx) => {
                    let color: string | undefined = undefined;
                    let fontWeight: string | undefined = undefined;
                    if (CRITICAL_HEADERS.includes(field)) {
                      color = 'black';
                      fontWeight = 'bold';
                    } else if (!(field in knownHeaders)) {
                      color = 'orange';
                    }
                    return (
                      <Badge key={`${field}-${idx}`} variant="secondary" style={{ color, fontWeight }} className="px-1.5 py-0.5 text-xs">
                        {field}
                      </Badge>
                    );
                  }) : <span className="text-muted-foreground">No fields extracted</span>}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Add the new Gemini Subsample Rows dialog */}
      <Dialog open={!!sampleRowsDialogEntry} onOpenChange={open => setSampleRowsDialogId(open ? sampleRowsDialogId : null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Gemini Subsample Rows</DialogTitle>
            <DialogDescription>Sample of the rows sent to Gemini for this file.</DialogDescription>
          </DialogHeader>
          {sampleRowsDialogEntry && sampleRowsDialogEntry.gemini_sample_rows && sampleRowsDialogEntry.gemini_sample_rows.length > 0 ? (
            <div className="mt-2 border rounded bg-muted w-full" style={{ minWidth: 400, maxHeight: 320, overflowY: 'auto', overflowX: 'auto' }}>
              {sampleRowsDialogEntry.gemini_sample_rows.slice(0, 10).map((line, ridx) => (
                <pre
                  key={ridx}
                  className="font-mono text-xs px-2 py-1 border-b border-border last:border-b-0 whitespace-pre"
                  style={{ margin: 0 }}
                >
                  {line}
                </pre>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No sample rows available.</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-green-500';
    case 'processing':
      return 'bg-blue-500';
    case 'failed':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
}
