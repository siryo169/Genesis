
"use client";

import type { ProcessingStatus } from "@/types/csv-status";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Circle, Loader, CheckCircle2, XCircle } from "lucide-react";

interface StatusBadgeProps {
  status: ProcessingStatus | 'not_started' | 'skipped';
  startTime?: number;
  endTime?: number;
  now?: number | undefined; 
  className?: string;
  error_message?: string;
  stepValue?: boolean; 
  isTabularStep?: boolean;
}

export function getStatusClassNames(status: ProcessingStatus | 'not_started' | 'skipped'): string {
  switch (status) {
    case "ok":
      return "text-green-700 border-green-500/50 bg-green-500/10 dark:text-green-300";
    case "running":
      return "text-blue-700 border-blue-500/50 bg-blue-500/10 dark:text-blue-300";
    case "error":
      return "text-destructive border-destructive/50 bg-destructive/10";
    case "not_started":
    case "enqueued":
    case "skipped":
    default:
      return "text-muted-foreground border-border bg-muted";
  }
}

const StatusIcon = ({ status }: { status: ProcessingStatus | 'not_started' | 'skipped' }) => {
  const iconClass = "h-4 w-4";
  switch (status) {
    case "ok":
      return <CheckCircle2 className={cn(iconClass, "text-green-500")} />;
    case "running":
      return <Loader className={cn(iconClass, "animate-spin text-blue-500")} />;
    case "error":
      return <XCircle className={cn(iconClass, "text-destructive")} />;
    case "not_started":
    case "enqueued":
    case "skipped":
      return <Circle className={cn(iconClass, "text-muted-foreground")} />;
    default:
      return <Circle className={cn(iconClass, "text-gray-400")} />;
  }
};

export function StatusBadge({ 
  status, 
  startTime, 
  endTime, 
  now, 
  className, 
  error_message,
}: StatusBadgeProps) {
  let mainText = "Not Started";
  let durationText = "";
  
  // Normalize status
  let currentStatus = status;
  if (status === 'enqueued') currentStatus = 'not_started';
  if (status === 'skipped') mainText = "Skipped";

  if (currentStatus === 'ok') {
    mainText = 'Completed';
    if (typeof startTime === 'number' && typeof endTime === 'number') {
      const duration = endTime - startTime;
      durationText = formatDuration(duration);
    }
  } else if (currentStatus === 'running') {
    mainText = 'Running';
    if (typeof startTime === 'number' && typeof now === 'number') {
      const elapsed = now - startTime;
      durationText = formatDuration(elapsed);
    }
  } else if (currentStatus === 'error') {
    mainText = 'Error';
  }

  const badgeDisplayLabel = `${mainText}`;
  const ariaLabelContent = `Status: ${mainText}${currentStatus === 'ok' && durationText ? ` (took ${durationText})` : ''}${currentStatus === 'error' && error_message ? `. Error: ${error_message}` : ''}`;

  const badgeElement = (
    <Badge
      variant="outline"
      className={cn(
        "px-2 text-sm font-medium rounded-full flex items-center justify-center h-[22px] whitespace-nowrap gap-1",
        getStatusClassNames(currentStatus),
        className
      )}
      aria-label={ariaLabelContent}
    >
      <StatusIcon status={currentStatus} />
      <span>{badgeDisplayLabel}</span>
    </Badge>
  );

  const tooltipContent = [
    error_message,
    status === 'ok' ? `Duration: ${durationText}` : null
  ].filter(Boolean).join('\n');


  if (tooltipContent) {
    return (
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>{badgeElement}</TooltipTrigger>
          <TooltipContent className="whitespace-pre-wrap">
            <p>{tooltipContent}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badgeElement;
}

    
