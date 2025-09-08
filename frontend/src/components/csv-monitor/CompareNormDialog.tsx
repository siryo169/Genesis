"use client";

import {Dialog, DialogContent, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import { apiClient } from "@/lib/api-client";
import { useEffect, useState } from "react";
import { toast, useToast } from "@/hooks/use-toast";

interface CompareNormDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  entry_ID: string | null;
  entry_FileName: string;
  onDownload: (fileName: string, blob: Blob) => void;
}

export function CompareNormDialog({ isOpen, onOpenChange, entry_ID, entry_FileName, onDownload }: CompareNormDialogProps) {
  const [originalLines, setOriginalLines] = useState<string[]>([]);
  const [normalizedLines, setNormalizedLines] = useState<string[]>([]);
  const [loadingOriginal, setLoadingOriginal] = useState(false);
  const [loadingNormalized, setLoadingNormalized] = useState(false);

  useEffect(() => {
    if (!entry_ID || !isOpen) return;

    const fetchOriginal = async () => {
      setLoadingOriginal(true);
      try {
        const originalSample = await apiClient.getOriginalSample(entry_ID);
        setOriginalLines(originalSample.original_lines ?? []);
      } catch (error) {
        console.error("Error fetching original sample:", error);
        setOriginalLines([]);
      } finally {
        setLoadingOriginal(false);
      }
    };

    const fetchNormalized = async () => {
      setLoadingNormalized(true);
      try {
        const normalizedSample = await apiClient.getNormalizedSample(entry_ID);
        setNormalizedLines(normalizedSample.normalized_lines ?? []);
      } catch (error) {
        console.error("Error fetching normalized sample:", error);
        setNormalizedLines([]);
      } finally {
        setLoadingNormalized(false);
      }
    };

    fetchOriginal();
    fetchNormalized();
  }, [entry_ID]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Comparison Original vs Normalized file</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-8 mt-4">
          {/* Columna Original */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Original</h3>
            <div className="font-mono text-sm bg-muted rounded-md p-4 overflow-auto">
              {loadingOriginal ? (
                <div>Loading...</div>
              ) : (
                originalLines.map((line, i) => (
                  <div key={i} className="grid grid-cols-[2rem,1fr] gap-4">
                    <span className="text-muted-foreground select-none">{(i + 1).toString().padStart(2, '0')}</span>
                    <span className="whitespace-pre">
                      {line.replace(/[\r\n]+/g, ' ')}
                    </span> 
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Columna Normalized */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Normalized</h3>
            <div className="font-mono text-sm bg-muted rounded-md p-4 overflow-auto">
              {loadingNormalized ? (
                <div>Loading...</div>
              ) : (
                normalizedLines.map((line, i) => (
                  <div key={i} className="grid grid-cols-[2rem,1fr] gap-4">
                    <span className="text-muted-foreground select-none">{(i + 1).toString().padStart(2, '0')}</span>
                    <span className="whitespace-pre">
                      {line.replace(/[\r\n]+/g, ' ')}
                    </span> 
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <button className="mt-4 p-4 bg-muted" onClick={() => {
          toast({
            title: "Download Started",
            description: `Downloading ${entry_FileName}...`,
          });
          onDownload(entry_FileName, new Blob());
        }}>
          Download Normalized
        </button>
      </DialogContent>
    </Dialog>
  );
}
