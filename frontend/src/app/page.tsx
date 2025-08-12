"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { CsvProcessingEntry, ProcessingStatus } from "@/types/csv-status";
import { analyzeLogs, type LogAnalysisOutput } from "@/ai/flows/log-analyzer-flow";
import { CsvStatusTable } from "@/components/csv-monitor/CsvStatusTable";
import { StatCard } from "@/components/csv-monitor/StatCard";
import { FileUpload } from "@/components/csv-monitor/FileUpload";
import { FileDetailDialog } from "@/components/csv-monitor/FileDetailDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Search, Loader2, Activity, CheckCircle2, Files, X, Download, Calendar as CalendarIcon, FileQuestion, Wand2, Settings, AlertTriangle, Info, Key, Eye, EyeOff, Copy, Pencil, ChevronDown, Check, Plus, ArrowUp, Database, Cloud, Settings2, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend as RechartsLegend, PieChart, Pie, Cell } from "recharts";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format as formatDate, differenceInDays } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Logo } from "@/components/icons/Logo";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { apiClient } from "@/lib/api-client";
import { dataProvider } from "@/lib/data-provider";
import config from "@/lib/config";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

// Mock logs for analysis
const mockLogs = `
2025-06-23 12:18:05,257 - src.pipeline.watcher - INFO - New CSV detected: sample3_copy.csv
2025-06-23 12:18:05,263 - src.pipeline.orchestrator - INFO - Pipeline stage classification: running
2025-06-23 12:18:05,265 - src.pipeline.classifier - WARNING - Row 4 has 2 columns, expected 3
2025-06-23 12:18:05,266 - src.pipeline.orchestrator - INFO - Pipeline stage classification: ok
2025-06-23 12:18:05,268 - src.pipeline.orchestrator - INFO - Pipeline stage sampling: running
2025-06-23 12:18:05,269 - src.pipeline.sampler - INFO - Extracted 4 uniformly sampled rows from sample3_copy.csv
2025-06-23 12:18:05,269 - src.pipeline.orchestrator - INFO - Pipeline stage sampling: ok
2025-06-23 12:18:05,271 - src.pipeline.orchestrator - INFO - Pipeline stage gemini_query: running
2025-06-23 12:18:05,273 - src.pipeline.gemini_query - INFO - Querying Gemini API for header mapping...
2025-06-23 12:18:07,032 - src.pipeline.gemini_query - INFO - Successfully received and parsed mapping from Gemini. 3 columns matched.
2025-06-23 12:18:07,033 - src.pipeline.orchestrator - INFO - Pipeline stage gemini_query: ok
2025-06-23 12:18:07,040 - src.pipeline.orchestrator - INFO - Pipeline stage verification: running
2025-06-23 12:18:07,043 - src.pipeline.normalizer - ERROR - Verification failed: Row 4 has 2 columns, expected 3
2025-06-23 12:18:07,043 - src.pipeline.orchestrator - ERROR - Pipeline failed for sample3_copy.csv: Verification failed
2025-06-23 12:18:07,047 - src.pipeline.orchestrator - INFO - Pipeline stage verification: error
`.trim();

export default function CsvMonitorPage() {
  const [csvData, setCsvData] = useState<CsvProcessingEntry[]>([]);
  const [filterText, setFilterText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [sortConfig, setSortConfig] = useState<{ key: keyof CsvProcessingEntry | null; direction: 'ascending' | 'descending' }>({ key: 'priority', direction: 'ascending' });
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
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [fileTypeFilter, setFileTypeFilter] = useState("all");
  const [modelFilter, setModelFilter] = useState("all");
  const [fieldsFilter, setFieldsFilter] = useState("");
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);

  // Settings State
  const [showSuccessToast, setShowSuccessToast] = useState(true);
  
  // Add ref for Processing Status table
  const processingStatusRef = useRef<HTMLDivElement>(null);

  const [modelInfoDialog, setModelInfoDialog] = useState<{ open: boolean, model: string | null }>({ open: false, model: null });
  const [keyDialog, setKeyDialog] = useState<{ open: boolean, model: string | null }>({ open: false, model: null });
  
  // Mock mode toggle state - initialize with default value, update from dataProvider in useEffect
  const [isMockMode, setIsMockMode] = useState(true);
  
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
  const [pageIndex, setPageIndex] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(10);

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
  const availableModels = aiModels.map(m => m.name);

  // SENSITIVE_FIELDS declaration moved here to fix linter error
  const SENSITIVE_FIELDS: string[] = [
    'Email', 'Password', 'SSN', 'NID', 'Address', 'Credit Card', 'Phone', 'Bank Account', 'DOB', 'Passport', 'Driver License'
  ];
  
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);

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
    
    // Sync toggle state with dataProvider mode on client
    setIsMockMode(dataProvider.getCurrentMode() === 'mock');
    
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

  const handlePriorityChange = useCallback(async (entryId: string, newPriority: number) => {
    try{
      await apiClient.updatePriority(entryId, newPriority);
      // Update the local state immediately
      setCsvData(prevData => prevData.map(entry =>
        entry.id === entryId ? { ...entry, priority: newPriority } : entry
      ));

      toast({
        title: "Priority Updated",
        description: `Priority for ${entryId} updated to ${newPriority}`,
        variant: "default",
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update priority';
      toast({
        title: "Priority Update Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [csvData, toast]);

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
      setIsUploadDialogOpen(false);
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

  const handleClearFilters = useCallback(() => {
    setFilterText("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setFileTypeFilter("all");
    setModelFilter("all");
    setFieldsFilter("");
    setDate({ from: undefined, to: undefined });
  }, []);

  const filteredData = useMemo(() => {
    let sortableItems = [...csvData];
    
    // Status filter
    if (statusFilter !== 'all') {
      sortableItems = sortableItems.filter(entry => getOverallStatus(entry) === statusFilter);
    }
    
    // Filename filter
    if (filterText) {
      sortableItems = sortableItems.filter((entry) =>
        entry.filename.toLowerCase().includes(filterText.toLowerCase())
      );
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      sortableItems = sortableItems.filter(entry => (entry.priority || 3) === parseInt(priorityFilter));
    }

    // File type filter
    if (fileTypeFilter !== 'all') {
      sortableItems = sortableItems.filter(entry => entry.filename.toLowerCase().endsWith(fileTypeFilter));
    }

    // AI Model filter
    if (modelFilter !== 'all') {
      sortableItems = sortableItems.filter(entry => entry.ai_model === modelFilter);
    }

    // Extracted Fields filter
    if (fieldsFilter) {
      sortableItems = sortableItems.filter(entry => 
        entry.extracted_fields && entry.extracted_fields.some(field => field.toLowerCase().includes(fieldsFilter.toLowerCase()))
      );
    }
    
    // Date Range filter
    if (date?.from) {
      sortableItems = sortableItems.filter(entry => 
        entry.insertion_date && new Date(entry.insertion_date) >= date.from!
      );
    }
    if (date?.to) {
      sortableItems = sortableItems.filter(entry => 
        entry.insertion_date && new Date(entry.insertion_date) <= date.to!
      );
    }


    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        // Primary sort: by the selected column
        const valA = a[sortConfig.key!];
        const valB = b[sortConfig.key!];
        
        let comparison = 0;
        if (sortConfig.key === 'priority') {
          // Custom sorting for priority (default mode)
          
          // 1. Primary level: 'running' always on top
          const isRunningA = a.status === 'running' ? 1 : 0;
          const isRunningB = b.status === 'running' ? 1 : 0;
          comparison = isRunningB - isRunningA;
          
          // 2. Secondary level: priority (1-5, only if not running or both are running)
          if (comparison === 0) {
            comparison = (a.priority || 3) - (b.priority || 3);
          }
          
          // 3. Tertiary level: date (newest first)
          if (comparison === 0) {
            const dateA = a.insertion_date ? new Date(a.insertion_date).getTime() : 0;
            const dateB = b.insertion_date ? new Date(b.insertion_date).getTime() : 0;
            comparison = dateB - dateA;
          }
          
          // 4. Quaternary level: secondary status (enqueued -> ok -> error)
          if (comparison === 0) {
            const statusOrder = { 'enqueued': 1, 'ok': 2, 'error': 3, 'running': 0 };
            const statusA = statusOrder[a.status] || 999;
            const statusB = statusOrder[b.status] || 999;
            comparison = statusA - statusB;
          }
          
        } else if (sortConfig.key === 'insertion_date') {
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
  }, [csvData, filterText, statusFilter, priorityFilter, fileTypeFilter, modelFilter, fieldsFilter, date, sortConfig, getOverallStatus]);

  const paginatedData = useMemo(() => {
    const start = pageIndex * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, pageIndex, pageSize]);

  const pageCount = Math.ceil(filteredData.length / pageSize);

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

  // Palette for error chart sectors - more reddish
  const errorPalette = [
    '#ED5565', // Destructive Red
    '#DA4453', // Darker Red
    '#FC6E51', // Orange-Red
    '#FFCE54', // Yellow
    '#A0D468', // Light Green (for less critical)
    '#48CFAD', // Mint Green
    '#4FC1E9', // Light Blue
    '#5D76FF', // Primary Blue
    '#AC92EC', // Lavender
    '#EC87C0', // Pink
  ];

  const errorChartConfig = useMemo(() => {
    return Object.fromEntries(
      errorAnalysisData.map((entry: { key: string; name: string }, i: number) => [
        entry.key,
        { label: entry.name, color: errorPalette[i % errorPalette.length] }
      ])
    );
  }, [errorAnalysisData]);

  function toggleField(field: string) {
    setSelectedFields(prev => prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]);
  }

  // Handle data source mode toggle
  const handleModeToggle = (checked: boolean) => {
    const newMode = checked ? 'mock' : 'real';
    setIsMockMode(checked);
    dataProvider.switchMode(newMode);
    
    // Show toast notification
    toast({
      title: "Data Source Changed",
      description: `Switched to ${checked ? 'Mock Data' : 'Live API'} mode`,
      variant: "default",
    });
    
    // Refresh page to see changes
    window.location.reload();
  };

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
  
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 flex flex-col">
       <header className="mb-8 sticky top-0 z-50 bg-background/80 backdrop-blur-sm -mx-4 -mt-4 px-4 pt-4 pb-4 border-b sm:-mx-8 sm:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span className="h-10 w-10 text-primary"><Logo /></span>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="hidden md:block">
              <TabsList>
                <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge 
              variant={isMockMode ? "secondary" : "default"} 
              className="flex items-center gap-1"
            >
              {isMockMode ? (
                <>
                  <Database className="h-3 w-3" />
                  Mock Data
                </>
              ) : (
                <>
                  <Cloud className="h-3 w-3" />
                  Live API
                </>
              )}
            </Badge>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Settings className="h-5 w-5" />
                  <span className="sr-only">Settings</span>
                </Button>
              </SheetTrigger>
              <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Settings</SheetTitle>
                  </SheetHeader>
                  <div className="space-y-8 mt-4">
                  {/* Data Source Section */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Settings2 className="h-5 w-5" />
                        Data Source
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Switch between mock data and live API.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="space-y-1">
                          <Label htmlFor="mock-mode-toggle" className="text-sm font-medium">
                            {isMockMode ? 'Mock Data Mode' : 'Live API Mode'}
                          </Label>
                        </div>
                        <Switch 
                          id="mock-mode-toggle"
                          checked={isMockMode}
                          onCheckedChange={handleModeToggle}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Notifications Section */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Notifications</CardTitle>
                      <CardDescription className="text-xs">Configure how and when you receive notifications.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-4">
                        <Label htmlFor="notif-email" className="text-sm">Email</Label>
                        <Switch id="notif-email" />
                      </div>
                       <div className="flex items-center gap-4">
                        <Label htmlFor="notif-telegram" className="text-sm">Telegram</Label>
                        <Switch id="notif-telegram" />
                      </div>
                    </CardContent>
                  </Card>
                   {/* AI Models Table Section */}
                  <Card>
                    <CardHeader>
                      <CardTitle  className="text-base">AI Models & API Keys</CardTitle>
                      <CardDescription className="text-xs">Manage your API keys and view model details.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr>
                            <th className="text-left p-2 font-medium text-muted-foreground">Model</th>
                            <th className="text-right p-2 font-medium text-muted-foreground">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aiModels.map(model => (
                            <tr key={model.name} className={`border-t ${activeModel === model.name ? 'bg-primary/10' : ''}`}>
                              <td className="p-2 font-medium">{model.name}</td>
                              <td className="p-2 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant={activeModel === model.name ? 'secondary' : 'ghost'}
                                    size="icon"
                                    onClick={() => setActiveModel(model.name)}
                                    aria-label={activeModel === model.name ? 'Active model' : 'Activate model'}
                                    className="h-7 w-7"
                                  >
                                    <Check className={`h-4 w-4 ${activeModel === model.name ? 'text-primary' : ''}`} />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setModelInfoDialog({ open: true, model: model.name })}>
                                    <Info className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setKeyDialog({ open: true, model: model.name })}>
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
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      
      <main className="flex-grow">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsContent value="dashboard" className="mt-6 space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard title="Processed Today" value={todayStats.processedToday} Icon={Activity} description="Files reaching a terminal state today." />
              <StatCard title="Success Rate Today" value={todayStats.successRateToday} Icon={CheckCircle2} description="Of files processed today." />
              <StatCard title="Files In Progress" value={todayStats.inProgress} Icon={Loader2} description="Currently running pipelines." />
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
                <CardContent className="h-[250px] flex items-center justify-center">
                  {errorAnalysisData.length > 0 ? (
                    <ChartContainer config={errorChartConfig} className="w-full h-full">
                      <ResponsiveContainer>
                        <PieChart>
                          <RechartsTooltip
                            cursor={{ strokeDasharray: "3 3" }}
                            content={<ChartTooltipContent hideLabel />}
                          />
                          <Pie
                            data={errorAnalysisData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={60}
                            strokeWidth={5}
                          >
                            {errorAnalysisData.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={errorPalette[index % errorPalette.length]}
                              />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                      <CheckCircle2 className="w-12 h-12 mb-4 text-green-500" />
                      <h3 className="text-lg font-semibold">No Errors Found</h3>
                      <p className="text-sm">Everything is running smoothly!</p>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card className="shadow-lg">
                <CardHeader>
                   <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Token Consumption</CardTitle>
                        <CardDescription>Total tokens used by AI models.</CardDescription>
                    </div>
                    <RadioGroup value={tokenMetricType} onValueChange={(v) => setTokenMetricType(v as 'total' | 'input' | 'output')} className="flex">
                        <div className="flex items-center space-x-1">
                        <RadioGroupItem value="total" id="total" />
                        <Label htmlFor="total" className="text-xs">Total</Label>
                        </div>
                        <div className="flex items-center space-x-1">
                        <RadioGroupItem value="input" id="input" />
                        <Label htmlFor="input" className="text-xs">Input</Label>
                        </div>
                        <div className="flex items-center space-x-1">
                        <RadioGroupItem value="output" id="output" />
                        <Label htmlFor="output" className="text-xs">Output</Label>
                        </div>
                    </RadioGroup>
                   </div>
                </CardHeader>
                <CardContent className="pl-2">
                  {tokenChartData.length > 0 ? (
                    <ChartContainer config={{}} className="h-[250px] w-full">
                        <ResponsiveContainer>
                        <LineChart data={tokenChartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                            <XAxis dataKey="time" tickLine={false} axisLine={false} tickMargin={8} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                            <YAxis tickLine={false} axisLine={false} tickMargin={8} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                            <RechartsTooltip content={<ChartTooltipContent />} />
                            <Line dataKey="value" type="monotone" strokeWidth={2} stroke="var(--color-chart-1)" />
                        </LineChart>
                        </ResponsiveContainer>
                    </ChartContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[250px] text-center text-muted-foreground">
                        <FileQuestion className="w-12 h-12 mb-4" />
                        <h3 className="text-lg font-semibold">No Token Data</h3>
                        <p className="text-sm">No token usage data available for this period.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle>Estimated Cost</CardTitle>
                  <CardDescription>Total estimated cost of AI model usage.</CardDescription>
                </CardHeader>
                <CardContent className="pl-2">
                  {costChartData.length > 0 ? (
                    <ChartContainer config={{}} className="h-[250px] w-full">
                        <ResponsiveContainer>
                        <LineChart data={costChartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                            <XAxis dataKey="time" tickLine={false} axisLine={false} tickMargin={8} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                            <YAxis tickLine={false} axisLine={false} tickMargin={8} stroke="hsl(var(--muted-foreground))" fontSize={12} dataKey="value" tickFormatter={(v) => `$${v.toFixed(3)}`} />
                            <RechartsTooltip content={<ChartTooltipContent formatter={(v) => `$${Number(v).toFixed(4)}`} />} />
                            <Line dataKey="value" type="monotone" strokeWidth={2} stroke="var(--color-chart-2)" />
                        </LineChart>
                        </ResponsiveContainer>
                    </ChartContainer>
                  ) : (
                     <div className="flex flex-col items-center justify-center h-[250px] text-center text-muted-foreground">
                        <FileQuestion className="w-12 h-12 mb-4" />
                        <h3 className="text-lg font-semibold">No Cost Data</h3>
                        <p className="text-sm">No cost data available for this period.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            
            <div className="flex flex-col flex-grow min-h-0 pt-6">
              <div className="flex items-center justify-between gap-4 mb-4">
                <h2 className="text-2xl font-bold tracking-tight">Processing Status</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2 mb-4">
                  <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Filter by filename..."
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        className="pl-10 w-48"
                        aria-label="Filter by filename"
                      />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="ok">Completed</SelectItem>
                        <SelectItem value="running">Running</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                        <SelectItem value="enqueued">Enqueued</SelectItem>
                      </SelectContent>
                  </Select>
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Priorities</SelectItem>
                        <SelectItem value="1">Urgent</SelectItem>
                        <SelectItem value="2">High</SelectItem>
                        <SelectItem value="3">Medium</SelectItem>
                        <SelectItem value="4">Low</SelectItem>
                        <SelectItem value="5">Very Low</SelectItem>
                      </SelectContent>
                  </Select>
                  <Select value={fileTypeFilter} onValueChange={setFileTypeFilter}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="File Type" />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="all">All File Types</SelectItem>
                          <SelectItem value=".csv">CSV</SelectItem>
                          <SelectItem value=".xlsx">XLSX</SelectItem>
                          <SelectItem value=".xls">XLS</SelectItem>
                          <SelectItem value=".zip">ZIP</SelectItem>
                          <SelectItem value=".rar">RAR</SelectItem>
                          <SelectItem value=".7z">7Z</SelectItem>
                          <SelectItem value=".gz">GZ</SelectItem>
                          <SelectItem value=".tar">TAR</SelectItem>
                      </SelectContent>
                  </Select>
                  <Select value={modelFilter} onValueChange={setModelFilter}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="AI Model" />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="all">All AI Models</SelectItem>
                          {availableModels.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                  </Select>
                  <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Filter by fields..."
                        value={fieldsFilter}
                        onChange={(e) => setFieldsFilter(e.target.value)}
                        className="pl-10 w-48"
                        aria-label="Filter by extracted fields"
                      />
                  </div>
                  <div className="relative">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          id="date"
                          variant={"outline"}
                          className={cn(
                            "w-[300px] justify-start text-left font-normal",
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
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          initialFocus
                          mode="range"
                          defaultMonth={date?.from}
                          selected={date}
                          onSelect={setDate}
                          numberOfMonths={2}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <Button variant="ghost" onClick={handleClearFilters}>
                      <X className="mr-2 h-4 w-4" /> Clear All
                  </Button>
                  <div className="flex-grow"></div>
                  <Button
                    onClick={() => setIsUploadDialogOpen(true)}
                    className="h-10 w-10 p-0"
                    aria-label="Upload files"
                  >
                    <Plus className="h-6 w-6" />
                  </Button>
              </div>

              <Card className="shadow-xl flex flex-col flex-grow relative">
                <CardContent className="flex flex-col flex-grow p-0">
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
                      data={paginatedData} 
                      sortConfig={sortConfig} 
                      requestSort={requestSort} 
                      now={currentTime}
                      onDownload={handleDownload}
                      onRowClick={handleShowFileDetails}
                      onRetry={handleRetry}
                      onPriorityChange={handlePriorityChange}
                    />
                  )}
                </CardContent>
              </Card>
              <div className="pt-4">
                <DataTablePagination
                  pageIndex={pageIndex}
                  pageCount={pageCount}
                  pageSize={pageSize}
                  setPageIndex={setPageIndex}
                  setPageSize={setPageSize}
                  canPreviousPage={pageIndex > 0}
                  canNextPage={pageIndex < pageCount - 1}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
      
      <footer className="mt-12 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Genesis. All rights reserved.</p>
      </footer>

      <FileDetailDialog entry={selectedFile} isOpen={isDetailModalOpen} onOpenChange={setIsDetailModalOpen} />
      
       <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Files</DialogTitle>
            <DialogDescription>
              Drag and drop files or click to select them. Configure AI model and priority for the upload.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
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
        </DialogContent>
      </Dialog>
      
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
