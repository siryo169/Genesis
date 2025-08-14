
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
import { RefreshCw, Search, Loader2, Activity, CheckCircle2, Files, X, Download, Calendar as CalendarIcon, FileQuestion, Wand2, Settings, AlertTriangle, Info, Key, Eye, EyeOff, Copy, Pencil, ChevronDown, Check, Plus, ArrowUp, Database, Cloud, Settings2, Upload, AreaChart } from "lucide-react";
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import Link from "next/link";
import { MultiSelectFilter } from "@/components/csv-monitor/MultiSelectFilter";
import { StatusBadge } from "@/components/csv-monitor/StatusBadge";


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
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<number[]>([]);
  const [fileTypeFilter, setFileTypeFilter] = useState<string[]>([]);
  const [modelFilter, setModelFilter] = useState<string[]>([]);
  const [fieldsFilter, setFieldsFilter] = useState("");
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  
  // Add ref for Processing Status table
  const processingStatusRef = useRef<HTMLDivElement>(null);

  const [pageIndex, setPageIndex] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(10);
  
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);

  // AI Model data, can be moved to a separate config file later
  const aiModels = [
    { name: 'Gemini 2.5 Flash' },
    { name: 'Gemini 2.5 Pro' },
    { name: 'Gemini 2.0 Flash' },
  ];
  const availableModels = aiModels.map(m => m.name);
  type PriorityValue = 1 | 2 | 3 | 4 | 5;
  type PriorityLabel = 'Urgent' | 'High' | 'Medium' | 'Low' | 'Very Low';
  const priorityOptions: { value: PriorityValue, label: PriorityLabel }[] = [
    { value: 1, label: "Urgent" },
    { value: 2, label: "High" },
    { value: 3, label: "Medium" },
    { value: 4, label: "Low" },
    { value: 5, label: "Very Low" },
  ];
  const [uploadPriority, setUploadPriority] = useState<PriorityValue>(3);
  const [uploadSelectedModel, setUploadSelectedModel] = useState<string>('Gemini 2.5 Flash');

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
  }, [toast]);

  const handleRefresh = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    try {
      await dataProvider.forceRefresh();
      
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
  }, [toast]);
  
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
    };
  }, []);

  const handleDownload = useCallback(async (filename: string) => {
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
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Download failed';
      toast({
        title: "Download Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [csvData, toast]);

  const handleRetry = useCallback(async (id: string) => {
    const entryToRetry = csvData.find(entry => entry.id === id);
    if (!entryToRetry) return;
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

  const handleFileUpload = useCallback(async (files: File[], model: string, priority: number) => {
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('model', model);
        formData.append('priority', priority.toString());
        
        // Use apiClient for upload
        await apiClient.request(`/api/upload`, {
          method: 'POST',
          body: formData,
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
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

  const handleShowFileDetails = useCallback((entry: CsvProcessingEntry) => {
    setSelectedFileId(entry.id);
    setIsDetailModalOpen(true);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilterText("");
    setStatusFilter([]);
    setPriorityFilter([]);
    setFileTypeFilter([]);
    setModelFilter([]);
    setFieldsFilter("");
    setDate({ from: undefined, to: undefined });
  }, []);

  const filteredData = useMemo(() => {
    let sortableItems = [...csvData];
    
    if (statusFilter.length > 0) {
      sortableItems = sortableItems.filter(entry => statusFilter.includes(getOverallStatus(entry)));
    }
    
    if (filterText) {
      sortableItems = sortableItems.filter((entry) =>
        entry.filename.toLowerCase().includes(filterText.toLowerCase())
      );
    }

    if (priorityFilter.length > 0) {
      sortableItems = sortableItems.filter(entry => priorityFilter.includes(entry.priority));
    }

    if (fileTypeFilter.length > 0) {
      sortableItems = sortableItems.filter(entry => 
        fileTypeFilter.some(ext => entry.filename.toLowerCase().endsWith(ext))
      );
    }

    if (modelFilter.length > 0) {
      sortableItems = sortableItems.filter(entry => entry.ai_model && modelFilter.includes(entry.ai_model));
    }

    if (fieldsFilter) {
      sortableItems = sortableItems.filter(entry => 
        entry.extracted_fields && entry.extracted_fields.some(field => field.toLowerCase().includes(fieldsFilter.toLowerCase()))
      );
    }
    
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
        const valA = a[sortConfig.key!];
        const valB = b[sortConfig.key!];
        
        let comparison = 0;
        if (sortConfig.key === 'priority') {
            if (priorityFilter.length > 0) {
                const priorityA = priorityFilter.includes(a.priority) ? 0 : 1;
                const priorityB = priorityFilter.includes(b.priority) ? 0 : 1;
                comparison = priorityA - priorityB;
            }
            if (comparison === 0) {
                const isRunningA = a.status === 'running' ? 1 : 0;
                const isRunningB = b.status === 'running' ? 1 : 0;
                comparison = isRunningB - isRunningA;
            }
            if (comparison === 0) {
                comparison = (a.priority || 3) - (b.priority || 3);
            }
            if (comparison === 0) {
                const dateA = a.insertion_date ? new Date(a.insertion_date).getTime() : 0;
                const dateB = b.insertion_date ? new Date(b.insertion_date).getTime() : 0;
                comparison = dateB - dateA; // Most recent first
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
    const errorCounts: Record<string, number> = {};
    csvData.forEach(entry => {
      const stages = ['classification', 'sampling', 'gemini_query', 'normalization'];
      for (const stage of stages) {
        const stat = entry.stage_stats?.[stage];
        if (stat?.status === 'error' && stat.error_message) {
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

  const errorPalette = [
    '#DA4453', // Darker Red
    '#ED5565', // Destructive Red
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


  const [tokenMetricType, setTokenMetricType] = useState<'total' | 'input' | 'output'>('total');
  const [metricsData, setMetricsData] = useState<any>(null);

  function combineDateTime(date: Date | undefined, time: string): Date | undefined {
    if (!date) return undefined;
    const [h, m] = time.split(":").map(Number);
    const d = new Date(date);
    d.setUTCHours(h, m, 0, 0);
    return d;
  }

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
      range = `${from.toISOString()},${to.toISOString()}`;
    }
    try {
      const res = await fetch(`${config.apiBaseUrl}/api/pipeline/metrics?range=${range}&bucket=${bucketParam}`);
      if (!res.ok) throw new Error('Failed to fetch metrics');
      const data = await res.json();
      setMetricsData(data);
    } catch (err) {
      setMetricsData(null);
    }
  }, [date, timeFrom, timeTo]);

  useEffect(() => {
    fetchMetricsData();
    const interval = setInterval(fetchMetricsData, config.pollingInterval);
    return () => clearInterval(interval);
  }, [fetchMetricsData]);

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
    let bucketSizeMs = oneDay;
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
  
  const statusOptions = [
    { value: "ok", label: "Completed", node: <StatusBadge status="ok" /> },
    { value: "running", label: "Running", node: <StatusBadge status="running" /> },
    { value: "error", label: "Error", node: <StatusBadge status="error" /> },
    { value: "enqueued", label: "Enqueued", node: <StatusBadge status="enqueued" /> },
  ];
  
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
       <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-sm sm:px-6">
        <div className="flex items-center gap-4">
          <Logo />
          <h1 className="text-xl font-bold tracking-tight text-foreground">Genesis</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <Link href="/settings">
            <Button variant="ghost" size="icon">
              <Settings className="h-5 w-5" />
              <span className="sr-only">Settings</span>
            </Button>
          </Link>
        </div>
      </header>
      
      <main className="flex-grow p-4 md:p-8">
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Processed Today" value={todayStats.processedToday} Icon={Activity} description="Files reaching a terminal state today." />
            <StatCard title="Success Rate Today" value={todayStats.successRateToday} Icon={CheckCircle2} description="Of files processed today." />
            <StatCard title="Files In Progress" value={todayStats.inProgress} Icon={Loader2} description="Currently running pipelines." />
            <StatCard title="Total Files" value={csvData.length} Icon={Files} description="Tracked in the system." />
          </div>

          <Accordion type="single" collapsible className="w-full" defaultValue="item-1">
            <AccordionItem value="item-1">
              <AccordionTrigger>
                <div className="flex items-center gap-2 text-lg font-semibold">
                    <AreaChart className="h-5 w-5" />
                    <span>Analytics Dashboard</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
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
                              <Line type="monotone" dataKey="successfully" stroke="var(--color-chart-2, #4ade80)" strokeWidth={2} activeDot={{ r: 8 }} dot={{ r: 4, stroke: 'var(--color-successfully, #4ade80)', strokeWidth: 2, fill: 'white' }} connectNulls={true} />
                              <Line type="monotone" dataKey="processed" stroke="var(--color-chart-1, #60a5fa)" strokeWidth={2} activeDot={{ r: 8 }} dot={{ r: 4, stroke: 'var(--color-processed, #60a5fa)', strokeWidth: 2, fill: 'white' }} connectNulls={true} />
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
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          
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
                <MultiSelectFilter
                  label="Status"
                  options={statusOptions}
                  selectedValues={statusFilter}
                  onSelectionChange={setStatusFilter}
                  className="w-auto"
                />
                <MultiSelectFilter
                  label="Priority"
                  options={priorityOptions}
                  selectedValues={priorityFilter}
                  onSelectionChange={setPriorityFilter}
                  className="w-auto"
                />
                <MultiSelectFilter
                  label="File Type"
                  options={[
                    { value: ".csv", label: "CSV" },
                    { value: ".xlsx", label: "XLSX" },
                    { value: ".xls", label: "XLS" },
                    { value: ".zip", label: "ZIP" },
                    { value: ".rar", label: "RAR" },
                    { value: ".7z", label: "7Z" },
                    { value: ".gz", label: "GZ" },
                    { value: ".tar", label: "TAR" },
                  ]}
                  selectedValues={fileTypeFilter}
                  onSelectionChange={setFileTypeFilter}
                  className="w-auto"
                />
                 <MultiSelectFilter
                  label="AI Model"
                  options={availableModels.map(m => ({ value: m, label: m }))}
                  selectedValues={modelFilter}
                  onSelectionChange={setModelFilter}
                  className="w-auto"
                />
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
                          "w-auto justify-start text-left font-normal pr-8",
                          !date && "text-muted-foreground",
                          !!(date?.from || date?.to) && "border-foreground"
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
                   {!!(date?.from || date?.to) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                      onClick={() => setDate(undefined)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <Separator orientation="vertical" className="h-6 mx-2" />
                <Button variant="ghost" onClick={handleClearFilters}>
                   Reset
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
        </div>
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
                  <Button variant="outline" size="sm" className="flex items-center gap-2 w-[120px] justify-between">
                    <span>{priorityOptions.find(p => p.value === uploadPriority)?.label}</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="min-w-[120px] p-1">
                  {priorityOptions.map(option => (
                    <div 
                      key={option.value} 
                      className="flex items-center gap-2 cursor-pointer hover:bg-muted px-2 py-1 rounded" 
                      onClick={() => {
                        setUploadPriority(option.value);
                      }}
                    >
                      <span className="inline-block w-4">{uploadPriority === option.value && <Check className="h-4 w-4 text-primary" />}</span>
                      <span>{option.label}</span>
                    </div>
                  ))}
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <FileUpload onFileUpload={files => handleFileUpload(files, uploadSelectedModel, uploadPriority)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

    