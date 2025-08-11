'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { PipelineRun } from '@/types/csv-status';
import { MockDataService, MockFileInfo } from '@/lib/mock-data';

interface DataContextType {
  // State
  pipelineRuns: PipelineRun[];
  files: MockFileInfo[];
  isLoading: boolean;
  error: string | null;
  isMockMode: boolean;

  // Actions
  refreshData: () => void;
  uploadFile: (file: File) => Promise<void>;
  toggleMockMode: () => void;
  resetMockData: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

interface DataProviderProps {
  children: React.ReactNode;
  initialMockMode?: boolean;
}

export function DataProvider({ children, initialMockMode = false }: DataProviderProps) {
  const [pipelineRuns, setPipelineRuns] = useState<PipelineRun[]>([]);
  const [files, setFiles] = useState<MockFileInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMockMode, setIsMockMode] = useState(initialMockMode);

  // Check environment variable and localStorage to determine if we should use mock mode by default
  useEffect(() => {
    const shouldUseMock = process.env.NODE_ENV === 'development' || 
                          process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';
    
    // Check localStorage for user preference
    let storedPreference: boolean | null = null;
    try {
      const stored = localStorage.getItem('useMockData');
      if (stored !== null) {
        storedPreference = stored === 'true';
      }
    } catch (e) {
      // localStorage might not be available
    }
    
    const finalMode = storedPreference !== null ? storedPreference : (initialMockMode || shouldUseMock);
    setIsMockMode(finalMode);
    console.log(`DataProvider initialized in ${finalMode ? 'mock' : 'live'} mode`);
  }, [initialMockMode]);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (isMockMode) {
        console.log('Refreshing with mock data...');
        // Use mock data
        setPipelineRuns(MockDataService.getPipelineRuns());
        setFiles(MockDataService.getFiles());
      } else {
        console.log('Refreshing with live API data...');
        // Use real API calls
        try {
          const response = await fetch('/api/pipeline-runs');
          if (!response.ok) {
            throw new Error(`API responded with status: ${response.status}`);
          }
          const runs = await response.json();
          setPipelineRuns(runs);
          console.log('Successfully loaded pipeline runs from API:', runs.length);
        } catch (apiError) {
          console.error('Failed to fetch from API:', apiError);
          throw new Error('Failed to fetch pipeline runs from API');
        }
        
        // Fetch files if needed
        try {
          const filesResponse = await fetch('/api/files');
          if (filesResponse.ok) {
            const filesData = await filesResponse.json();
            setFiles(filesData);
            console.log('Successfully loaded files from API:', filesData.length);
          }
        } catch (filesError) {
          console.warn('Failed to fetch files, continuing without them:', filesError);
          setFiles([]);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.error('Error refreshing data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isMockMode]);

  // Load initial data
  useEffect(() => {
    refreshData();
  }, [isMockMode]); // Refresh when mock mode changes

  // Subscribe to mock data updates when in mock mode
  useEffect(() => {
    if (isMockMode) {
      const unsubscribe = MockDataService.onUpdate(setPipelineRuns);
      return unsubscribe;
    }
  }, [isMockMode]);

  const uploadFile = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      if (isMockMode) {
        console.log('Simulating file upload with mock data...');
        // Simulate file upload with mock data
        await MockDataService.simulateFileUpload(file.name, file.size);
      } else {
        console.log('Uploading file to real API...');
        // Real file upload
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to upload file');
        }
        
        const result = await response.json();
        console.log('File uploaded successfully:', result);
      }

      // Refresh data after upload
      await refreshData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      console.error('Error uploading file:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isMockMode, refreshData]);

  const toggleMockMode = () => {
    const newMode = !isMockMode;
    setIsMockMode(newMode);
    
    // Store preference in localStorage
    try {
      localStorage.setItem('useMockData', newMode.toString());
    } catch (e) {
      // localStorage might not be available
    }
    
    // Force refresh data with new mode
    console.log(`Switching to ${newMode ? 'mock' : 'live'} mode`);
  };

  const resetMockData = () => {
    if (isMockMode) {
      MockDataService.reset();
      setPipelineRuns(MockDataService.getPipelineRuns());
      setFiles(MockDataService.getFiles());
    }
  };

  const value: DataContextType = {
    pipelineRuns,
    files,
    isLoading,
    error,
    isMockMode,
    refreshData,
    uploadFile,
    toggleMockMode,
    resetMockData,
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

export function useData(): DataContextType {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}

// Hook for easy access to specific data pieces
export function usePipelineRuns() {
  const { pipelineRuns, isLoading, error, refreshData } = useData();
  return { pipelineRuns, isLoading, error, refreshData };
}

export function useFileUpload() {
  const { uploadFile, isLoading, error } = useData();
  return { uploadFile, isLoading, error };
}
