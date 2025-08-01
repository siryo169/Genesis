"use client";

import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FileUploadProps {
  onFileUpload: (files: File[]) => void;
  className?: string;
}

export function FileUpload({ onFileUpload, className }: FileUploadProps) {
  const { toast } = useToast();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileUpload(acceptedFiles);
      toast({
        title: `${acceptedFiles.length} file(s) added to queue`,
        description: `Started processing: ${acceptedFiles.map(f => f.name).join(', ')}`,
        variant: 'default',
      });
    }
  }, [onFileUpload, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'text/tab-separated-values': ['.tsv'],
      'text/plain': ['.txt', '.dat', '.data', '.psv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.oasis.opendocument.spreadsheet': ['.ods'],
      'application/zip': ['.zip'],
      'application/x-7z-compressed': ['.7z'],
      'application/x-tar': ['.tar'],
      'application/gzip': ['.gz', '.tar.gz', '.tgz'],
      'application/x-rar-compressed': ['.rar'],
    },
  });

  return (
    <div
      {...getRootProps()}
      className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-muted transition-colors ${
        isDragActive ? 'border-primary' : 'border-border'
      } ${className}`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
        <UploadCloud className="w-10 h-10 mb-4 text-muted-foreground" />
        {isDragActive ? (
          <p className="text-lg font-semibold text-primary">Drop the files here ...</p>
        ) : (
          <>
            <p className="mb-2 text-sm text-muted-foreground">
              <span className="font-semibold text-primary">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-muted-foreground">
              <span className="block">Supported files: <b>CSV, TSV, PSV, DAT, DATA, TXT, XLS, XLSX, ODS</b></span>
              <span className="block">Compressed: <b>ZIP, 7Z, TAR, TAR.GZ, TGZ, GZ, RAR</b></span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
