
"use client";

import type { ProcessingStatus } from "@/types/csv-status";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Circle, Loader2 } from "lucide-react";

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
      return "text-green-500 border-green-500/50 bg-green-500/10";
    case "running":
      return "text-yellow-500 border-yellow-500/50 bg-yellow-500/10";
    case "error":
      return "text-red-500 border-red-500/50 bg-red-500/10";
    case "not_started":
    case "enqueued":
    default:
      return "text-muted-foreground border-border bg-muted";
  }
}

const StatusDot = ({ status }: { status: ProcessingStatus | 'not_started' | 'skipped' }) => {
  const dotClass = "h-2 w-2 rounded-full mr-2";
  switch (status) {
    case "ok":
      return <span className={cn(dotClass, "bg-green-500")} />;
    case "running":
      return <Loader2 className="h-3 w-3 mr-2 animate-spin text-yellow-500" />;
    case "error":
      return <span className={cn(dotClass, "bg-red-500")} />;
    case "not_started":
    case "enqueued":
    case "skipped":
      return <span className={cn(dotClass, "bg-muted-foreground")} />;
    default:
      return <span className={cn(dotClass, "bg-gray-400")} />;
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
  if (status === 'enqueued') {
      currentStatus = 'not_started';
  }
  if(status === 'skipped'){
    mainText = "Skipped"
  }

  if (currentStatus === 'ok') {
    mainText = 'Completed';
    if (typeof startTime === 'number' && typeof endTime === 'number') {
      const duration = endTime - startTime;
      durationText = ` (${formatDuration(duration)})`;
    }
  } else if (currentStatus === 'running') {
    mainText = 'Running';
    if (typeof startTime === 'number' && typeof now === 'number') {
      const elapsed = now - startTime;
      durationText = ` (${formatDuration(elapsed)})`;
    }
  } else if (currentStatus === 'error') {
    mainText = 'Error';
  }


  const badgeDisplayLabel = `${mainText}${durationText}`;
  const ariaLabelContent = `Status: ${badgeDisplayLabel}${currentStatus === 'error' && error_message ? `. Error: ${error_message}` : ''}`;

  const badgeElement = (
    <Badge
      variant="outline"
      className={cn(
        "px-2 py-1 text-xs font-medium rounded-full flex items-center",
        getStatusClassNames(currentStatus),
        className
      )}
      aria-label={ariaLabelContent}
    >
      <StatusDot status={currentStatus} />
      <span>{badgeDisplayLabel}</span>
    </Badge>
  );

  if (currentStatus === 'error' && error_message) {
    return (
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>{badgeElement}</TooltipTrigger>
          <TooltipContent>
            <p>{error_message}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badgeElement;
}

    