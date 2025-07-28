"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { CsvProcessingEntry, ProcessingStatus, ProcessingStep, NormalizerChecks } from "@/types/csv-status";
import { analyzeLogs, type LogAnalysisOutput } from "@/ai/flows/log-analyzer-flow";
import { CsvStatusTable } from "@/components/csv-monitor/CsvStatusTable";
import { StatCard } from "@/components/csv-monitor/StatCard";
import { FileUpload } from "@/components/csv-monitor/FileUpload";
import { FileDetailDialog } from "@/components/csv-monitor/FileDetailDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Search, Loader2, Activity, CheckCircle2, Loader, Files, X, Download, Calendar as CalendarIcon, FileQuestion, Wand2, Settings, AlertTriangle, Info, Key, Eye, EyeOff, Copy, Pencil, ChevronDown, Check, Plus, ArrowUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { formatDuration, cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend as RechartsLegend, PieChart, Pie, Cell } from "recharts";
import { ChartContainer, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format as formatDate, differenceInDays, subDays, addMinutes, setHours, setMinutes } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Logo } from "@/components/icons/Logo";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { apiClient } from "@/lib/api-client";
import config from "@/lib/config";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { dataProvider } from '@/lib/data-provider';

// Timestamp helpers
const nowStatic = Date.now(); // Use a static "now" for initial mock data for consistency
const sec = (s: number) => s * 1000;
const min = (m: number) => m * 60000;

const createStep = (status: ProcessingStatus, startTime?: number, endTime?: number, errorMessage?: string, value?: boolean): ProcessingStep => {
  const step: ProcessingStep = { status };
  if (startTime) step.startTime = startTime;
  if (endTime) step.endTime = endTime;
  if (status === 'error' && errorMessage) step.errorMessage = errorMessage;
  if (value !== undefined ) step.value = value;
  return step;
};

const mockLogs = `
2025-06-23 12:18:05,257 - src.pipeline.watcher - INFO - New CSV detected: /Users/davidortega/Desktop/CSV_Pipeline/backend/data/inbound/sample3_copy.csv
2025-06-23 12:18:05,263 - src.pipeline.orchestrator - INFO - Pipeline stage classification: running
2025-06-23 12:18:05,265 - src.pipeline.classifier - WARNING - Row 4 has 2 columns, expected 3
2025-06-23 12:18:05,266 - src.pipeline.orchestrator - INFO - Pipeline stage classification: ok
2025-06-23 12:18:05,268 - src.pipeline.orchestrator - INFO - Pipeline stage sampling: running
2025-06-23 12:18:05,269 - src.pipeline.sampler - INFO - Extracted 4 uniformly sampled rows from /Users/davidortega/Desktop/CSV_Pipeline/backend/data/inbound/sample3_copy.csv
2025-06-23 12:18:05,269 - src.pipeline.orchestrator - INFO - Pipeline stage sampling: ok
2025-06-23 12:18:05,271 - src.pipeline.orchestrator - INFO - Pipeline stage gemini_query: running
2025-06-23 12:18:05,273 - src.pipeline.gemini_query - INFO - Querying Gemini API for header mapping...
2025-06-23 12:18:07,032 - src.pipeline.gemini_query - INFO - Successfully received and parsed mapping from Gemini. 3 columns matched.
2025-06-23 12:18:07,033 - src.pipeline.gemini_query - DEBUG - Gemini response content: {
  "header_mapping": {
    "0": "pdata_pdata_fullname",
    "1": "digid_email",
    "2": "location_address"
  },
  "normalization_map": {
    "pdata_pdata_fullname": false,
    "digid_email": true,
    "location_address": false
  },
  "matched_columns_count": 3,
  "input_has_header": true
}
2025-06-23 12:18:07,033 - src.pipeline.orchestrator - INFO - Pipeline stage gemini_query: ok
2025-06-23 12:18:07,040 - src.pipeline.orchestrator - INFO - Pipeline stage verification: running
2025-06-23 12:18:07,043 - src.pipeline.normalizer - INFO - Normalizer initialized with header mapping and normalization rules.
2025-06-23 12:18:07,043 - src.pipeline.normalizer - ERROR - Verification failed: Row 4 has 2 columns, expected 3
2025-06-23 12:18:07,043 - src.pipeline.orchestrator - ERROR - Pipeline failed for sample3_copy.csv: Verification failed: Verification failed: Row 4 has 2 columns, expected 3
2025-06-23 12:18:07,047 - src.pipeline.orchestrator - INFO - Pipeline stage verification: error
2025-06-23 12:18:07,050 - src.pipeline.orchestrator - WARNING - Pipeline processing for sample3_copy.csv ended with ERRORS (run ID: 95f7a344-9cf6-40a0-9dc9-3b9ec6f6d512). Check the log file for details.
2025-06-23 12:18:07,051 - src.pipeline.watcher - WARNING - Processing of /Users/davidortega/Desktop/CSV_Pipeline/backend/data/inbound/sample3_copy.csv ended with ERRORS (run ID: 95f7a344-9cf6-40a0-9dc9-3b9ec6f6d512). Check logs for details.
`.trim();

// Remove PIPELINE_ORDER and NORMALIZER_PIPELINE_ORDER and all normalizer_checks logic
// Only use entry.normalization for normalization status, error, and timing
// Remove MainPipelineStepKey and any code referencing 'classifier', 'is_tabular', 'gemini_query', 'normalization' fields directly on CsvProcessingEntry
// Remove any code that tries to use entry.classifier, entry.is_tabular, entry.gemini_query, entry.normalization


export default function CsvMonitorPage() {
  const [csvData, setCsvData] = useState<CsvProcessingEntry[]>([]);
  const [filterText, setFilterText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [sortConfig, setSortConfig] = useState<{ key: keyof CsvProcessingEntry | null; direction: 'ascending' | 'descending' }>({ key: 'insertion_date', direction: 'descending' });
  const [currentTime, setCurrentTime] = useState<number | undefined>(undefined);
  // Default: last 2 hours
  const defaultTo = new Date();
  defaultTo.setMinutes(defaultTo.getUTCMinutes());
  defaultTo.setHours(defaultTo.getUTCHours());
  const defaultFrom = new Date(defaultTo.getTime() - 2 * 60 * 60 * 1000);
  defaultFrom.setMinutes(defaultFrom.getUTCMinutes());
  defaultFrom.setHours(defaultFrom.getUTCHours());
  const [date, setDate] = React.useState<DateRange | undefined>({
    from: defaultFrom,
    to: defaultTo,
  });
  const [timeFrom, setTimeFrom] = useState<string>(defaultFrom.toTimeString().slice(0,5));
  const [timeTo, setTimeTo] = useState<string>(defaultTo.toTimeString().slice(0,5));
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isAnalyzingLogs, setIsAnalyzingLogs] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<LogAnalysisOutput | null>(null);
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);

  // Settings State
  const [showSuccessToast, setShowSuccessToast] = useState(true);
  const [selectedModel, setSelectedModel] = useState("gemini-2.0-flash");

  // Add state for active tab
  const [activeTab, setActiveTab] = useState('dashboard');

  // Add ref for Processing Status table
  const processingStatusRef = useRef<HTMLDivElement>(null);

  const [modelInfoDialog, setModelInfoDialog] = useState<{ open: boolean, model: string | null }>({ open: false, model: null });
  const [keyDialog, setKeyDialog] = useState<{ open: boolean, model: string | null }>({ open: false, model: null });
  const [showFullKey, setShowFullKey] = useState<{ [model: string]: boolean }>({});
  const [modelKeys, setModelKeys] = useState<{ [model: string]: string }>({
    'Gemini 2.5 Pro': 'AIzaSyA1234567890XyZ',
    'Gemini 2.5 Flash': 'AIzaSyB1234567890AbC',
    'Gemini 2.0 Flash': 'AIzaSyC1234567890Def',
    'o3': 'o3sk-1234567890xyz',
    'GPT-4.1 mini': 'sk-1234567890abcd',
    'Claude 3.7 Sonnet': 'claude-1234567890efg',
  });
  const [editKey, setEditKey] = useState<string>('');

  const [selectedFields, setSelectedFields] = useState<string[]>([
    'Email', 'Password', 'SSN', 'NID', 'Credit Card', 'Bank Account'
  ]);
  const [notifyLogic, setNotifyLogic] = useState<'AND' | 'OR'>('OR');
  const [multiSelectOpen, setMultiSelectOpen] = useState(false);

  const aiModels = [
    {
      name: 'Gemini 2.5 Pro',
      pricing: '$7 per 1M input tokens, $21 per 1M output tokens',
      release: '2024-06',
      url: 'https://cloud.google.com/vertex-ai/docs/generative-ai/model-reference/gemini',
      details: 'Best for high-accuracy, complex tasks. Supports long context.'
    },
    {
      name: 'Gemini 2.5 Flash',
      pricing: '$0.35 per 1M input tokens, $1.05 per 1M output tokens',
      release: '2024-06',
      url: 'https://cloud.google.com/vertex-ai/docs/generative-ai/model-reference/gemini',
      details: 'Optimized for speed and cost, good for chat and summarization.'
    },
    {
      name: 'Gemini 2.0 Flash',
      pricing: '$0.35 per 1M input tokens, $1.05 per 1M output tokens',
      release: '2024-03',
      url: 'https://cloud.google.com/vertex-ai/docs/generative-ai/model-reference/gemini',
      details: 'Previous fast Gemini model.'
    },
    {
      name: 'o3',
      pricing: 'TBD',
      release: '2024-06',
      url: 'https://openrouter.ai/models/open-orca-3',
      details: 'Open source, high-context, multi-modal.'
    },
    {
      name: 'GPT-4.1 mini',
      pricing: '$5 per 1M input tokens, $15 per 1M output tokens',
      release: '2024-05',
      url: 'https://platform.openai.com/docs/models/gpt-4',
      details: 'OpenAI, smaller context, fast.'
    },
    {
      name: 'Claude 3.7 Sonnet',
      pricing: '$3 per 1M input tokens, $15 per 1M output tokens',
      release: '2024-06',
      url: 'https://www.anthropic.com/news/claude-3-7',
      details: 'Anthropic, strong at reasoning, long context.'
    },
  ];

  const [activeModel, setActiveModel] = useState<string>('Gemini 2.5 Flash');

  const [uploadPriority, setUploadPriority] = useState<'Normal' | 'High'>('Normal');
  const [uploadSelectedModel, setUploadSelectedModel] = useState<string>('Gemini 2.5 Flash');
  const [aiPopoverOpen, setAiPopoverOpen] = useState(false);
  const availableModels = aiModels.map(m => m.name);

  // SENSITIVE_FIELDS declaration moved here to fix linter error
  const SENSITIVE_FIELDS: string[] = [
    'Email', 'Password', 'SSN', 'NID', 'Address', 'Credit Card', 'Phone', 'Bank Account', 'DOB', 'Passport', 'Driver License'
  ];

  function censorKey(key: string) {
    if (key.length <= 8) return '*'.repeat(key.length);
    return key.slice(0, 4) + '*'.repeat(key.length - 8) + key.slice(-4);
  }

  function handleCopyKey(model: string) {
    navigator.clipboard.writeText(modelKeys[model]);
    toast({ title: 'Key copied to clipboard.' });
  }

  function handleEditKey(model: string) {
    setEditKey(modelKeys[model]);
  }

  function handleSaveKey(model: string) {
    setModelKeys(prev => ({ ...prev, [model]: editKey }));
    setKeyDialog({ open: false, model: null });
    toast({ title: 'Key updated.' });
  }

  const getOverallStatus = useCallback((entry: CsvProcessingEntry): ProcessingStatus => {
    const stageKeys = ['classification', 'sampling', 'gemini_query', 'normalization'];
    const allStats = stageKeys.map(key => entry.stage_stats?.[key]);
    if (entry.status === 'error' || allStats.some(stat => stat && stat.status === 'error')) {
      return 'error';
    }
    if (entry.status === 'running' || allStats.some(stat => stat && stat.status === 'running')) {
      return 'running';
    }
    if (entry.status === 'ok') {
      return 'ok';
    }
    return 'enqueued';
  }, []);

  const fetchPipelineData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    setError(null);
    
    try {
      const data = await apiClient.getPipelineStatus();
      setCsvData(data);
      
      if (!isSilent && showSuccessToast) {
        toast({
          title: "Data Refreshed",
          description: "Processing statuses have been updated.",
          variant: "default", 
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch pipeline data';
      setError(errorMessage);
      
      if (!isSilent) {
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      if (!isSilent) setIsLoading(false);
      setIsInitialLoading(false);
    }
  }, [toast, showSuccessToast]);

  const handleRefresh = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    try {
      await dataProvider.forceRefresh();
      if (!isSilent && showSuccessToast) {
        toast({
          title: "Data Refreshed",
          description: "Processing statuses have been updated.",
          variant: "default", 
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh data';
      setError(errorMessage);
      if (!isSilent) {
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  }, [toast, showSuccessToast]);
  
  useEffect(() => {
    const unsubscribe = dataProvider.subscribe(
      (data: CsvProcessingEntry[]) => {
        if (Array.isArray(data)) {
          setCsvData(data);
          setIsInitialLoading(false);
          setError(null); // clear error if we get data
        }
      },
      (err: any) => {
        setError('Backend unreachable');
        setIsInitialLoading(false);
      }
    );
    setCurrentTime(Date.now());
    const timerId = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => {
      clearInterval(timerId);
      unsubscribe();
      // Don't call dataProvider.cleanup() here since it's a singleton
    };
  }, []);

  const handleDownload = useCallback(async (filename: string) => {
    // Find the entry by filename
    const entry = csvData.find(e => e.filename === filename);
    if (!entry) {
      toast({
        title: "Download Error",
        description: "File not found",
        variant: "destructive",
      });
      return;
    }

    try {
      const blob = await apiClient.downloadProcessedFile(entry.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `normalized_${entry.filename}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      if (showSuccessToast) {
        toast({
          title: "Download Started",
          description: `Downloading ${entry.filename}...`,
          variant: "default",
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Download failed';
      toast({
        title: "Download Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [csvData, toast, showSuccessToast]);

  const handleRetry = useCallback(async (id: string) => {
    const entryToRetry = csvData.find(entry => entry.id === id);
    if (!entryToRetry) return;
    // Only allow retry for gemini_query stage errors
    if (entryToRetry.stage_stats?.gemini_query?.status === 'error' && entryToRetry.status === 'error') {
      try {
        toast({
          title: "Retrying Gemini Query...",
          description: `Retrying Gemini Query for ${entryToRetry.filename}`,
          variant: "default",
        });
        await apiClient.retryGeminiQuery(entryToRetry.id);
        toast({
          title: "Retry Successful",
          description: `Gemini Query and subsequent stages retried for ${entryToRetry.filename}`,
          variant: "default",
        });
        await handleRefresh(true);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Retry failed';
        toast({
          title: "Retry Failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Retry Not Available",
        description: "Retry is only available for files that failed at the Gemini Query stage.",
        variant: "default",
      });
    }
  }, [csvData, toast, fetchPipelineData]);

  const handleFileUpload = useCallback(async (files: File[], model: string = '', priority: boolean = false) => {
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        if (model) formData.append('model', model);
        if (priority) formData.append('priority', 'true');
        const response = await fetch(`${config.apiBaseUrl}/api/upload`, {
          method: 'POST',
          body: formData,
        });
        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }
      }
      toast({
        title: "Upload Successful",
        description: `${files.length} file(s) uploaded and queued for processing.`,
        variant: "default",
      });
      fetchPipelineData();
      setActiveTab('dashboard');
      setSortConfig({ key: 'insertion_date', direction: 'descending' });
      setTimeout(() => {
        if (processingStatusRef.current) {
          processingStatusRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'File upload failed';
      toast({
        title: "Upload Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [toast, fetchPipelineData]);

  const handleDownloadRange = useCallback(() => {
    if (!date?.from || !date.to) {
        toast({
            title: "Please select a date range",
            description: "You must select a start and end date to download files.",
            variant: "destructive",
        });
        return;
    }

    toast({
      title: "Bulk Download",
      description: "Bulk download functionality will be implemented in a future update.",
      variant: "default",
    });
  }, [date, toast]);

  const handleShowFileDetails = useCallback((entry: CsvProcessingEntry) => {
    setSelectedFileId(entry.id);
    setIsDetailModalOpen(true);
  }, []);
  
  const handleAnalyzeLogs = useCallback(async () => {
    setIsAnalyzingLogs(true);
    try {
        const result = await analyzeLogs({ logs: mockLogs });
        setAnalysisResult(result);
        setIsAnalysisModalOpen(true);
    } catch(e) {
        console.error(e);
        toast({
            title: "Analysis Failed",
            description: "Could not analyze logs. Please try again.",
            variant: "destructive"
        });
    } finally {
        setIsAnalyzingLogs(false);
    }
  }, [toast]);


  const handleClearFilters = useCallback(() => {
    setFilterText("");
    setStatusFilter("all");
  }, []);

  const filteredData = useMemo(() => {
    let sortableItems = [...csvData];
    
    if (statusFilter !== 'all') {
      sortableItems = sortableItems.filter(entry => getOverallStatus(entry) === statusFilter);
    }
    
    if (filterText) {
      sortableItems = sortableItems.filter((entry) =>
        entry.filename.toLowerCase().includes(filterText.toLowerCase())
      );
    }

    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        const valA = a[sortConfig.key!];
        const valB = b[sortConfig.key!];
        
        let comparison = 0;
        if (sortConfig.key === 'insertion_date') {
          // Handle insertion_date sorting
          const dateA = valA ? new Date(valA as string).getTime() : 0;
          const dateB = valB ? new Date(valB as string).getTime() : 0;
          comparison = dateA - dateB;
        } else {
          comparison = String(valA).localeCompare(String(valB));
        }
        
        return sortConfig.direction === 'ascending' ? comparison : -comparison;
      });
    }
    return sortableItems;
  }, [csvData, filterText, sortConfig, statusFilter, getOverallStatus]);

  const requestSort = (key: keyof CsvProcessingEntry) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const todayStats = useMemo(() => {
    if (!currentTime) {
      return { processedToday: 0, successRateToday: "N/A", inProgress: 0 };
    }

    const now = new Date(currentTime);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

    let processedTodayCount = 0;
    let successfulTodayCount = 0;
    let inProgressCount = 0;

    csvData.forEach(entry => {
      const isRunning = getOverallStatus(entry) === 'running';
      if (isRunning) {
        inProgressCount++;
      }
      let finalStepTime: number | undefined = undefined;
      const isFullyCompleted = getOverallStatus(entry) === 'ok';
      if (isFullyCompleted) {
        finalStepTime = entry.stage_stats?.normalization?.end_time ? new Date(entry.stage_stats.normalization.end_time).getTime() : undefined;
      } else {
        // Find the last error or halt time among the stages
        const stages = ['classification', 'sampling', 'gemini_query', 'normalization'];
        for (const stage of stages) {
          const stat = entry.stage_stats?.[stage];
          if (stat?.status === 'error' && stat.end_time) {
            finalStepTime = new Date(stat.end_time).getTime();
            break;
          }
        }
      }
      if (finalStepTime && finalStepTime >= startOfToday && finalStepTime <= endOfToday) {
        processedTodayCount++;
        if (isFullyCompleted) {
          successfulTodayCount++;
        }
      }
    });
    const successRate = processedTodayCount > 0 ? ((successfulTodayCount / processedTodayCount) * 100).toFixed(0) + "%" : "N/A";
    return {
      processedToday: processedTodayCount,
      successRateToday: successRate,
      inProgress: inProgressCount,
    };
  }, [csvData, currentTime, getOverallStatus]);

  const throughputChartData = useMemo(() => {
    if (!currentTime || !date?.from) return [];
    const getFinalProcessingInfo = (entry: CsvProcessingEntry): { time: number | undefined; isSuccess: boolean } => {
      const isFullySuccessful = getOverallStatus(entry) === 'ok';
      let finalTime: number | undefined = undefined;
      if (isFullySuccessful) {
        finalTime = entry.stage_stats?.normalization?.end_time ? new Date(entry.stage_stats.normalization.end_time).getTime() : undefined;
      } else {
        // Find the last error or halt time among the stages
        const stages = ['classification', 'sampling', 'gemini_query', 'normalization'];
        for (const stage of stages) {
          const stat = entry.stage_stats?.[stage];
          if (stat?.status === 'error' && stat.end_time) {
            finalTime = new Date(stat.end_time).getTime();
            break;
          }
        }
      }
      return { time: finalTime, isSuccess: isFullySuccessful };
    };

    const data = [];
    const startDate = new Date(date.from);
    startDate.setHours(0, 0, 0, 0);
    const endDate = date.to ? new Date(date.to) : new Date(startDate);
    endDate.setHours(23, 59, 59, 999);

    const numDays = differenceInDays(endDate, startDate) + 1;

    if (numDays >= 7) { // Daily aggregation
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const startOfDay = new Date(d);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(d);
            endOfDay.setHours(23, 59, 59, 999);

            const dayString = formatDate(d, 'MMM d');
            
            let totalProcessed = 0;
            let successfullyProcessed = 0;

            csvData.forEach(entry => {
                const { time, isSuccess } = getFinalProcessingInfo(entry);
                if (time && time >= startOfDay.getTime() && time <= endOfDay.getTime()) {
                    totalProcessed++;
                    if (isSuccess) {
                        successfullyProcessed++;
                    }
                }
            });
            data.push({ day: dayString, processed: totalProcessed, successfully: successfullyProcessed });
        }
    } else if (numDays > 1) { // 4-hour chunks for 2-6 days
        let currentChunkStart = new Date(startDate);
        while(currentChunkStart <= endDate) {
            const currentChunkEnd = new Date(currentChunkStart);
            currentChunkEnd.setHours(currentChunkEnd.getHours() + 4);

            const chunkLabel = formatDate(currentChunkStart, 'MMM d, HH:mm');
            
            let totalProcessed = 0;
            let successfullyProcessed = 0;

            csvData.forEach(entry => {
                const { time, isSuccess } = getFinalProcessingInfo(entry);
                if (time && time >= currentChunkStart.getTime() && time < currentChunkEnd.getTime()) {
                    totalProcessed++;
                    if (isSuccess) {
                        successfullyProcessed++;
                    }
                }
            });
            data.push({ day: chunkLabel, processed: totalProcessed, successfully: successfullyProcessed });
            currentChunkStart = currentChunkEnd;
        }
    } else { // 1 day, grouped by 2-hour chunks
        let currentChunkStart = new Date(startDate);
        while(currentChunkStart < endDate) {
            const currentChunkEnd = new Date(currentChunkStart);
            currentChunkEnd.setHours(currentChunkEnd.getHours() + 2);

            const startHour = formatDate(currentChunkStart, 'HH:mm');
            const endHour = formatDate(currentChunkEnd, 'HH:mm');
            const chunkLabel = `${startHour}-${endHour}`;
            
            let totalProcessed = 0;
            let successfullyProcessed = 0;

            csvData.forEach(entry => {
                const { time, isSuccess } = getFinalProcessingInfo(entry);
                if (time && time >= currentChunkStart.getTime() && time < currentChunkEnd.getTime()) {
                    totalProcessed++;
                    if (isSuccess) {
                        successfullyProcessed++;
                    }
                }
            });
            data.push({ day: chunkLabel, processed: totalProcessed, successfully: successfullyProcessed });
            currentChunkStart = currentChunkEnd;
        }
    }
    return data;
  }, [csvData, currentTime, date, getOverallStatus]);

  const errorAnalysisData = useMemo(() => {
    // Group errors by stage and reason
    const errorCounts: Record<string, number> = {};
    csvData.forEach(entry => {
      const stages = ['classification', 'sampling', 'gemini_query', 'normalization'];
      for (const stage of stages) {
        const stat = entry.stage_stats?.[stage];
        if (stat?.status === 'error' && stat.error_message) {
          // Parse error_message as '<stage>: <reason>'
          let stageName = stage;
          let reason = stat.error_message;
          const match = /^([a-zA-Z_]+):\s*(.*)$/.exec(stat.error_message);
          if (match) {
            stageName = match[1];
            reason = match[2];
          }
          const label = `${stageName.charAt(0).toUpperCase() + stageName.slice(1)}: ${reason}`;
          errorCounts[label] = (errorCounts[label] || 0) + 1;
        }
      }
    });
    const chartData = Object.entries(errorCounts)
      .map(([label, value]) => ({
        name: label,
        key: label,
        value: value,
      }))
      .sort((a, b) => b.value - a.value);
    return chartData;
  }, [csvData]);

  // Palette for error chart sectors
  const errorPalette = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
    "hsl(var(--chart-6, #8884d8))",
    "hsl(var(--chart-7, #82ca9d))",
    "hsl(var(--chart-8, #ffc658))",
    "hsl(var(--chart-9, #ff8042))",
    "hsl(var(--chart-10, #a4de6c))",
  ];

  const errorChartConfig = useMemo(() => {
    return Object.fromEntries(
      errorAnalysisData.map((entry: { key: string; name: string }, i: number) => [
        entry.key,
        { label: entry.name, color: errorPalette[i % errorPalette.length] }
      ])
    );
  }, [errorAnalysisData]);

  // Define a color palette for error types
  const errorColors = [
    '#EF4444', // red
    '#F59E42', // orange
    '#FBBF24', // yellow
    '#10B981', // green
    '#3B82F6', // blue
    '#6366F1', // indigo
    '#8B5CF6', // violet
    '#EC4899', // pink
    '#6B7280', // gray
  ];

  function toggleField(field: string) {
    setSelectedFields(prev => prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]);
  }

  function toggleUploadModel(model: string) {
    setUploadSelectedModel(model);
  }

  useEffect(() => {
    if (keyDialog.open) {
      setEditKey('');
    }
  }, [keyDialog.open]);

  // Add state for token/cost graph
  const [tokenMetricType, setTokenMetricType] = useState<'total' | 'input' | 'output'>('total');
  const [metricsData, setMetricsData] = useState<any>(null);

  // Helper to combine date and time
  function combineDateTime(date: Date | undefined, time: string): Date | undefined {
    if (!date) return undefined;
    const [h, m] = time.split(":").map(Number);
    const d = new Date(date);
    d.setUTCHours(h, m, 0, 0);
    return d;
  }

  // Fetch metrics data
  const fetchMetricsData = useCallback(async () => {
    let range = 'auto';
    let bucketParam = 'auto';
    let from = combineDateTime(date?.from, timeFrom);
    let to = combineDateTime(date?.to, timeTo);
    if (from && to) {
      const ms = to.getTime() - from.getTime();
      const days = Math.ceil(ms / (24*60*60*1000));
      const oneHour = 60 * 60 * 1000;
      if (ms <= 2 * oneHour) bucketParam = '15min';
      else if (ms <= 4 * oneHour) bucketParam = '30min';
      else if (ms <= 24 * oneHour) bucketParam = 'hour';
      else if (days <= 7) bucketParam = 'day';
      else bucketParam = 'week';
      // Use ISO strings for custom range
      range = `${from.toISOString()},${to.toISOString()}`;
    }
    try {
      const res = await fetch(`${config.apiBaseUrl}/api/pipeline/metrics?range=${range}&bucket=${bucketParam}`);
      if (!res.ok) throw new Error('Failed to fetch metrics');
      const data = await res.json();
      setMetricsData(data);
    } catch (err) {
      // Suppress error logging and set metrics data to null if backend is unreachable
      setMetricsData(null);
    }
  }, [date, timeFrom, timeTo]);

  useEffect(() => {
    fetchMetricsData();
    const interval = setInterval(fetchMetricsData, config.pollingInterval);
    return () => clearInterval(interval);
  }, [fetchMetricsData]);

  // Prepare chart data for tokens and cost with dynamic bucketing
  function getDynamicBuckets(buckets: string[]) {
    if (!buckets || buckets.length === 0) return { bucketLabels: [], bucketIndices: [] };
    const times = buckets.map(b => new Date(b).getTime());
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const totalMs = maxTime - minTime;
    const oneMin = 60 * 1000;
    const fifteenMin = 15 * oneMin;
    const thirtyMin = 30 * oneMin;
    const oneHour = 60 * oneMin;
    const oneDay = 24 * oneHour;
    let bucketSizeMs = oneDay; // default: 1 day
    let labelFormat = (d: Date) => d.toLocaleDateString('en-US', { timeZone: 'UTC' });
    if (totalMs <= 2 * oneHour) {
      bucketSizeMs = fifteenMin;
      labelFormat = (d: Date) => `${d.getUTCHours()}:${d.getUTCMinutes().toString().padStart(2, '0')}`;
    } else if (totalMs <= 4 * oneHour) {
      bucketSizeMs = thirtyMin;
      labelFormat = (d: Date) => `${d.getUTCHours()}:${d.getUTCMinutes().toString().padStart(2, '0')}`;
    } else if (totalMs <= oneDay) {
      bucketSizeMs = oneHour;
      labelFormat = (d: Date) => d.getUTCHours() + ':00';
    } else if (totalMs <= 3 * oneDay) {
      bucketSizeMs = 6 * oneHour;
      labelFormat = (d: Date) => `${d.getUTCMonth()+1}/${d.getUTCDate()} ${d.getUTCHours()}:00`;
    } else if (totalMs <= 7 * oneDay) {
      bucketSizeMs = 12 * oneHour;
      labelFormat = (d: Date) => `${d.getUTCMonth()+1}/${d.getUTCDate()} ${d.getUTCHours()}:00`;
    } else {
      bucketSizeMs = oneDay;
      labelFormat = (d: Date) => d.toLocaleDateString('en-US', { timeZone: 'UTC' });
    }
    // Build new buckets
    const bucketLabels: string[] = [];
    const bucketIndices: number[][] = [];
    let bucketStart = minTime;
    let i = 0;
    while (bucketStart <= maxTime) {
      const bucketEnd = bucketStart + bucketSizeMs;
      const indices: number[] = [];
      for (; i < times.length; i++) {
        if (times[i] >= bucketStart && times[i] < bucketEnd) {
          indices.push(i);
        } else if (times[i] >= bucketEnd) {
          break;
        }
      }
      bucketLabels.push(labelFormat(new Date(bucketStart)));
      bucketIndices.push(indices);
      bucketStart = bucketEnd;
    }
    return { bucketLabels, bucketIndices };
  }

  const tokenChartData = useMemo(() => {
    if (!metricsData) return [];
    const { bucketLabels, bucketIndices } = getDynamicBuckets(metricsData.buckets);
    return bucketLabels.map((label, idx) => {
      const indices = bucketIndices[idx];
      const sum = indices.reduce((acc, i) => acc + (metricsData.token_consumption[tokenMetricType][i] || 0), 0);
      return { time: label, value: sum };
    });
  }, [metricsData, tokenMetricType]);

  const costChartData = useMemo(() => {
    if (!metricsData) return [];
    const { bucketLabels, bucketIndices } = getDynamicBuckets(metricsData.buckets);
    return bucketLabels.map((label, idx) => {
      const indices = bucketIndices[idx];
      const sum = indices.reduce((acc, i) => acc + (metricsData.cost[i] || 0), 0);
      return { time: label, value: sum };
    });
  }, [metricsData]);

  const selectedFile = useMemo(
    () => csvData.find(e => e.id === selectedFileId) || null,
    [csvData, selectedFileId]
  );

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <header className="mb-8">
        <div className="flex items-center space-x-3">
          <span className="h-10 w-10 text-primary"><Logo /></span>
          {/* <h1 className="text-4xl font-headline font-bold tracking-tight">
            Genesis
          </h1> */}
        </div>
        <p className="text-muted-foreground mt-1">
          Dashboard for data processing pipeline status.
        </p>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="dashboard">
        <TabsList className="grid w-full grid-cols-3 md:w-[400px]">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="mt-6 space-y-6">
          {/* Remove old always-visible calendar and time pickers here */}
          {/* Place the new date pickers above the throughput chart */}
          <div className="flex flex-col md:flex-row gap-4 items-center mb-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={"outline"}
                  className={cn(
                    "w-full sm:w-[260px] justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date?.from ? (
                    date.to ? (
                      <>
                        {formatDate(date.from, "LLL dd, y")} -{" "}
                        {formatDate(date.to, "LLL dd, y")}
                      </>
                    ) : (
                      formatDate(date.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={date?.from}
                  selected={date}
                  onSelect={setDate}
                  numberOfMonths={2}
                  toDate={new Date()}
                />
              </PopoverContent>
            </Popover>
            <div className="flex items-center gap-2">
              <Label>From (UTC):</Label>
              <Input type="time" value={timeFrom} onChange={e => setTimeFrom(e.target.value)} />
              <Label>To (UTC):</Label>
              <Input type="time" value={timeTo} onChange={e => setTimeTo(e.target.value)} />
            </div>
            <Button onClick={() => {
              // Snap date range to selected times
              if (date?.from && date?.to) {
                setDate({
                  from: combineDateTime(date.from, timeFrom),
                  to: combineDateTime(date.to, timeTo),
                });
              }
            }}>Apply</Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Processed Today" value={todayStats.processedToday} Icon={Activity} description="Files reaching a terminal state today." />
            <StatCard title="Success Rate Today" value={todayStats.successRateToday} Icon={CheckCircle2} description="Of files processed today." />
            <StatCard title="Files In Progress" value={todayStats.inProgress} Icon={Loader} description="Currently running pipelines." />
            <StatCard title="Total Files" value={csvData.length} Icon={Files} description="Tracked in the system." />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-lg">
              <CardHeader>
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <CardTitle>Throughput</CardTitle>
                    <CardDescription>Files processed and successful over time.</CardDescription>
                  </div>
                  {/* No date picker or download button here */}
                </div>
              </CardHeader>
              <CardContent className="pl-2">
                {throughputChartData.length > 0 ? (
                  <ChartContainer config={{}} className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={throughputChartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tickMargin={8} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <RechartsTooltip
                          cursor={{strokeDasharray: '3 3'}}
                          content={<ChartTooltipContent indicator="dot" />}
                        />
                        <RechartsLegend verticalAlign="top" height={36} />
                        <Line type="monotone" dataKey="successfully" stroke="var(--color-successfully, #4ade80)" strokeWidth={2} activeDot={{ r: 8 }} dot={{ r: 4, stroke: 'var(--color-successfully, #4ade80)', strokeWidth: 2, fill: 'white' }} connectNulls={true} />
                        <Line type="monotone" dataKey="processed" stroke="var(--color-processed, #60a5fa)" strokeWidth={2} activeDot={{ r: 8 }} dot={{ r: 4, stroke: 'var(--color-processed, #60a5fa)', strokeWidth: 2, fill: 'white' }} connectNulls={true} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[250px] text-center text-muted-foreground">
                      <FileQuestion className="w-12 h-12 mb-4" />
                      <h3 className="text-lg font-semibold">No Data Available</h3>
                      <p className="text-sm">There are no processed files in the selected date range.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle>Error Analysis</CardTitle>
                    <CardDescription>Breakdown of common failure points.</CardDescription>
                </CardHeader>
                <CardContent>
                    {errorAnalysisData.length > 0 ? (
                        <ChartContainer config={errorChartConfig}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <RechartsTooltip
                                        cursor={{strokeDasharray: '3 3'}}
                                        content={<ChartTooltipContent nameKey="name" hideLabel />}
                                    />
                                    <Pie data={errorAnalysisData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} labelLine={false} label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                                        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                        const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
                                        const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));
                                        return (percent > 0.05) ? <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central">
                                            {`${(percent * 100).toFixed(0)}%`}
                                        </text> : null;
                                    }}>
                                        {(errorAnalysisData || []).map((entry: any, idx: number) => (
                                            <Cell key={`cell-${entry.key}`} fill={errorColors[idx % errorColors.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsLegend verticalAlign="bottom" height={36} iconSize={10} />
                                </PieChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-[250px] text-center text-muted-foreground">
                            <CheckCircle2 className="w-12 h-12 mb-4 text-green-500" />
                            <h3 className="text-lg font-semibold">No Errors Found</h3>
                            <p className="text-sm">Everything is running smoothly!</p>
                        </div>
                    )}
                </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Token Consumption Graph */}
            <Card className="shadow-lg">
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <CardTitle>Token Consumption</CardTitle>
                    <CardDescription>Cumulative tokens used per {metricsData && metricsData.buckets.length > 0 && metricsData.buckets[0].length > 13 ? 'hour' : 'day'}.</CardDescription>
                  </div>
                  <div className="flex gap-2 mt-2 sm:mt-0">
                    <Button size="sm" variant={tokenMetricType === 'total' ? 'default' : 'outline'} onClick={() => setTokenMetricType('total')}>Total</Button>
                    <Button size="sm" variant={tokenMetricType === 'input' ? 'default' : 'outline'} onClick={() => setTokenMetricType('input')}>Input</Button>
                    <Button size="sm" variant={tokenMetricType === 'output' ? 'default' : 'outline'} onClick={() => setTokenMetricType('output')}>Output</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {tokenChartData.length > 0 ? (
                  <ChartContainer config={{ token: { label: tokenMetricType.charAt(0).toUpperCase() + tokenMetricType.slice(1) + ' Tokens', color: 'hsl(var(--chart-1))' } }} className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={tokenChartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="time" tickLine={false} axisLine={false} tickMargin={8} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tickMargin={8} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <RechartsTooltip cursor={{strokeDasharray: '3 3'}} formatter={v => v.toLocaleString()} />
                        <RechartsLegend verticalAlign="top" height={36} />
                        <Line type="monotone" dataKey="value" stroke="var(--color-token)" strokeWidth={2} activeDot={{ r: 8 }} name={tokenMetricType.charAt(0).toUpperCase() + tokenMetricType.slice(1) + ' Tokens'} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[250px] text-center text-muted-foreground">
                    <FileQuestion className="w-12 h-12 mb-4" />
                    <h3 className="text-lg font-semibold">No Data Available</h3>
                    <p className="text-sm">No token data in the selected date range.</p>
                  </div>
                )}
              </CardContent>
            </Card>
            {/* Cost Estimation Graph */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Cost Estimation</CardTitle>
                <CardDescription>Cumulative estimated cost per {metricsData && metricsData.buckets.length > 0 && metricsData.buckets[0].length > 13 ? 'hour' : 'day'}.</CardDescription>
              </CardHeader>
              <CardContent>
                {costChartData.length > 0 ? (
                  <ChartContainer config={{ cost: { label: 'Estimated Cost ($)', color: 'hsl(var(--chart-2))' } }} className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={costChartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="time" tickLine={false} axisLine={false} tickMargin={8} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis allowDecimals={true} tickLine={false} axisLine={false} tickMargin={8} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <RechartsTooltip cursor={{strokeDasharray: '3 3'}} formatter={v => typeof v === 'number' ? `$${v.toFixed(4)}` : v} />
                        <RechartsLegend verticalAlign="top" height={36} />
                        <Line type="monotone" dataKey="value" stroke="var(--color-cost)" strokeWidth={2} activeDot={{ r: 8 }} name="Estimated Cost ($)" />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[250px] text-center text-muted-foreground">
                    <FileQuestion className="w-12 h-12 mb-4" />
                    <h3 className="text-lg font-semibold">No Data Available</h3>
                    <p className="text-sm">No cost data in the selected date range.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-xl" ref={processingStatusRef}>
            <CardHeader>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <CardTitle className="text-2xl">Processing Status</CardTitle>
                <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto flex-wrap">
                  <div className="relative w-full sm:w-auto sm:flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Filter by filename..."
                      value={filterText}
                      onChange={(e) => setFilterText(e.target.value)}
                      className="pl-10 w-full"
                      aria-label="Filter by filename"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full sm:w-[150px]">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="running">Running</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                  </Select>
                  <Button variant="ghost" onClick={handleClearFilters} className="w-full sm:w-auto">
                      <X className="mr-2 h-4 w-4" /> Clear
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isInitialLoading ? (
                <div className="flex flex-col items-center justify-center h-[500px] text-center text-muted-foreground">
                  <Loader2 className="w-12 h-12 mb-4 animate-spin" />
                  <h3 className="text-lg font-semibold">Loading Pipeline Data</h3>
                  <p className="text-sm">Fetching processing status from backend...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center h-[500px] text-center text-muted-foreground">
                  <AlertTriangle className="w-12 h-12 mb-4 text-red-500" />
                  <h3 className="text-lg font-semibold">Error Loading Data</h3>
                  <p className="text-sm">{error}</p>
                  <Button onClick={() => fetchPipelineData()} className="mt-4">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry
                  </Button>
                </div>
              ) : (
                <CsvStatusTable 
                  data={filteredData} 
                  sortConfig={sortConfig} 
                  requestSort={requestSort} 
                  now={currentTime}
                  onDownload={handleDownload}
                  onRowClick={handleShowFileDetails}
                  onRetry={handleRetry}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="upload" className="mt-6">
            <Card>
                <CardHeader>
                    <CardTitle>Upload Files</CardTitle>
                    <CardDescription>Drag and drop files here or click to select files to add them to the processing queue.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col gap-4 mb-4">
                      <div className="flex items-center gap-4">
                        <Label className="text-base">AI Model Override</Label>
                        <Select value={uploadSelectedModel} onValueChange={setUploadSelectedModel}>
                          <SelectTrigger className="w-[220px]">
                            <SelectValue placeholder="Select model..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableModels.map(model => (
                              <SelectItem key={model} value={model}>{model}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-4">
                        <Label className="text-base">Priority</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="flex items-center gap-2">
                              {uploadPriority}
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="min-w-[120px]">
                            {['Normal', 'High'].map(option => (
                              <div key={option} className="flex items-center gap-2 cursor-pointer hover:bg-muted px-2 py-1 rounded" onClick={() => setUploadPriority(option as 'Normal' | 'High')}>
                                <span className="inline-block w-4">{uploadPriority === option && <Check className="h-4 w-4 text-primary" />}</span>
                                <span>{option}</span>
                              </div>
                            ))}
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                    <FileUpload onFileUpload={files => handleFileUpload(files, uploadSelectedModel, uploadPriority === 'High')} />
                </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="settings" className="mt-6">
          <div className="space-y-8">
            {/* Notifications Section */}
            <Card>
              <CardHeader>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>Configure how and when you receive notifications.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                    <Label htmlFor="notif-email" className="text-base">Email Notifications</Label>
                    <Switch id="notif-email" />
                    <Input type="email" placeholder="your@email.com" className="w-64" />
                  </div>
                  <div className="flex items-center gap-4">
                    <Label htmlFor="notif-telegram" className="text-base">Telegram Notifications</Label>
                    <Switch id="notif-telegram" />
                    <Input type="text" placeholder="@yourhandle or chat id" className="w-64" />
                  </div>
                  <div className="border-t my-2" />
                  <div className="flex flex-col gap-2">
                    <Label className="text-base">Advanced Options</Label>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base">Notify on pipeline failure</span>
                      <Switch id="notif-failure" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap gap-2 items-center min-h-[40px]">
                        {selectedFields.map(field => (
                          <div
                            key={field}
                            className="relative group bg-muted px-3 py-1 rounded-full flex items-center text-sm font-medium cursor-pointer hover:bg-primary/10 transition-colors"
                          >
                            {field}
                            <button
                              className="absolute -top-2 -right-2 bg-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity border shadow"
                              style={{ fontSize: 10 }}
                              onClick={e => { e.stopPropagation(); setSelectedFields(prev => prev.filter(f => f !== field)); }}
                              tabIndex={-1}
                              aria-label={`Remove ${field}`}
                            >
                              <X className="h-3 w-3 text-red-500" />
                            </button>
                          </div>
                        ))}
                        <div className="relative">
                          <button
                            className="bg-muted px-2 py-1 rounded-full flex items-center text-sm font-medium hover:bg-primary/10 transition-colors border"
                            onClick={() => setMultiSelectOpen(v => !v)}
                            aria-label="Add field"
                            type="button"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                          {multiSelectOpen && (
                            <div className="absolute z-10 mt-2 bg-white border rounded shadow-lg p-2 min-w-[160px] max-h-48 overflow-auto">
                              {SENSITIVE_FIELDS.filter((f: string) => !selectedFields.includes(f)).map((field: string) => (
                                <div key={field} className="flex items-center gap-2 cursor-pointer hover:bg-muted px-2 py-1 rounded" onClick={() => { setSelectedFields(prev => [...prev, field]); setMultiSelectOpen(false); }}>
                                  <span>{field}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          variant={notifyLogic === 'AND' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setNotifyLogic('AND')}
                          className={notifyLogic === 'AND' ? 'font-bold' : ''}
                        >
                          AND
                        </Button>
                        <Button
                          variant={notifyLogic === 'OR' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setNotifyLogic('OR')}
                          className={notifyLogic === 'OR' ? 'font-bold' : ''}
                        >
                          OR
                        </Button>
                        <span className="text-xs text-muted-foreground ml-2">Send notification if <b>{notifyLogic}</b> of the selected fields are present in a CSV</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            {/* AI Models Table Section */}
            <Card>
              <CardHeader>
                <CardTitle>AI Models & API Keys</CardTitle>
                <CardDescription>Manage your API keys and view model details.</CardDescription>
              </CardHeader>
              <CardContent>
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left p-2">Model</th>
                      <th className="text-right p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiModels.map(model => (
                      <tr key={model.name} className={`border-t ${activeModel === model.name ? 'bg-primary/10' : ''}`}>
                        <td className="p-2 font-medium">{model.name}</td>
                        <td className="p-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant={activeModel === model.name ? 'default' : 'outline'}
                              size="icon"
                              onClick={() => setActiveModel(model.name)}
                              aria-label={activeModel === model.name ? 'Active model' : 'Activate model'}
                              className={activeModel === model.name ? 'font-bold' : ''}
                            >
                              <Check className={`h-4 w-4 ${activeModel === model.name ? 'font-bold' : ''}`} />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setModelInfoDialog({ open: true, model: model.name })}>
                              <Info className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setKeyDialog({ open: true, model: model.name })}>
                              <Key className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      
      <footer className="mt-12 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Genesis. All rights reserved.</p>
      </footer>
      <FileDetailDialog entry={selectedFile} isOpen={isDetailModalOpen} onOpenChange={setIsDetailModalOpen} />
      <AlertDialog open={isAnalysisModalOpen} onOpenChange={setIsAnalysisModalOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Log Analysis Summary</AlertDialogTitle>
                <AlertDialogDescription>
                    {analysisResult?.summary}
                </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="text-sm space-y-2">
                <p><strong>Errors Found:</strong> {analysisResult?.errorCount}</p>
                <p><strong>Warnings Found:</strong> {analysisResult?.warningCount}</p>
                {analysisResult?.criticalError && <p><strong>Critical Error:</strong> {analysisResult.criticalError}</p>}
                {analysisResult?.recommendation && <p><strong>Recommendation:</strong> {analysisResult.recommendation}</p>}
            </div>
            <AlertDialogFooter>
                <AlertDialogAction onClick={() => setIsAnalysisModalOpen(false)}>Close</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Info Dialog rendered outside the table for correct overlay behavior */}
      <Dialog open={modelInfoDialog.open} onOpenChange={open => setModelInfoDialog({ open, model: open ? modelInfoDialog.model : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modelInfoDialog.model} Info</DialogTitle>
          </DialogHeader>
          {aiModels.filter(m => m.name === modelInfoDialog.model).map(model => (
            <div key={model.name} className="space-y-2">
              <div><b>Pricing:</b> {model.pricing}</div>
              <div><b>Release Date:</b> {model.release}</div>
              <div><b>Details:</b> {model.details}</div>
              <div><b>More Info:</b> <a href={model.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{model.url}</a></div>
            </div>
          ))}
        </DialogContent>
      </Dialog>
      {/* Key Dialog rendered outside the table for correct overlay behavior */}
      <Dialog open={keyDialog.open} onOpenChange={open => setKeyDialog({ open, model: open ? keyDialog.model : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{keyDialog.model} API Key</DialogTitle>
          </DialogHeader>
          {aiModels.filter(m => m.name === keyDialog.model).map(model => (
            <div key={model.name}>
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono bg-muted px-2 py-1 rounded">
                  {showFullKey[model.name] ? modelKeys[model.name] : censorKey(modelKeys[model.name] || '')}
                </span>
                <Button variant="ghost" size="icon" onClick={() => setShowFullKey(prev => ({ ...prev, [model.name]: !prev[model.name] }))}>
                  {showFullKey[model.name] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleCopyKey(model.name)}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleEditKey(model.name)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex gap-2 items-center">
                <Input value={editKey} onChange={e => setEditKey(e.target.value)} className="w-full" />
                <Button onClick={() => handleSaveKey(model.name)} variant="secondary">Save</Button>
              </div>
            </div>
          ))}
        </DialogContent>
      </Dialog>
    </div>
  );
}
