
"use client";

import type { ProcessingStatus } from "@/types/csv-status";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface StatusBadgeProps {
  status: ProcessingStatus;
  startTime?: number;
  endTime?: number;
  now?: number | undefined; 
  className?: string;
  error_message?: string;
  stepValue?: boolean; // For 'is_tabular' to show True/False or similar
  isTabularStep?: boolean; // Flag to indicate this badge is for the 'is_tabular' step
}

export function getStatusClassNames(status: ProcessingStatus | 'not_started'): string {
  switch (status) {
    case "ok":
      return "bg-green-500 text-white hover:bg-green-600";
    case "running":
      return "bg-blue-500 text-white hover:bg-blue-600 animate-pulse";
    case "error":
      return "bg-red-500 text-white hover:bg-red-600";
    case "enqueued":
      return "bg-orange-500 text-white hover:bg-orange-600";
    case "not_started":
      return "bg-gray-300 text-gray-700";
    default:
      return "bg-gray-200 text-gray-800";
  }
}

export function StatusBadge({ 
  status, 
  startTime, 
  endTime, 
  now, 
  className, 
  error_message,
  stepValue,
  isTabularStep 
}: StatusBadgeProps) {
  let mainText = "";
  switch (status) {
    case "ok":
      mainText = "OK";
      break;
    case "running":
      mainText = "Running";
      break;
    case "error":
      mainText = "Error";
      break;
    case "enqueued":
      mainText = "Enqueued";
      break;
    default:
      mainText = status;
  }
  let durationText = "";

  if (isTabularStep && status === 'ok') {
    if (stepValue === true) {
      mainText = "Tabular";
    } else if (stepValue === false) {
      mainText = "Non-Tabular";
    }
  }

  if (status === 'running' && typeof startTime === 'number' && typeof now === 'number') {
    const elapsed = now - startTime;
     if (elapsed >= 0) {
        durationText = ` (${formatDuration(elapsed)})`;
    } else {
        durationText = ` (0s)`; // Should not happen often
    }
  } else if (status === 'ok' && typeof startTime === 'number' && typeof endTime === 'number') {
    const duration = endTime - startTime;
    durationText = ` (${formatDuration(duration)})`;
  } else if (status === 'error' && typeof startTime === 'number' && typeof endTime === 'number') {
     if (endTime > startTime) {
        const duration = endTime - startTime;
        durationText = ` (${formatDuration(duration)})`;
     }
  } else if (status === 'running') {
    durationText = ""; 
  }

  const badgeDisplayLabel = `${mainText}${durationText}`;
  const ariaLabelContent = `Status: ${badgeDisplayLabel}${status === 'error' && error_message ? `. Error: ${error_message}` : ''}`;

  const badgeElement = (
    <Badge
      variant="outline"
      className={cn(
        "border-transparent px-2.5 py-1 text-xs font-semibold", 
        getStatusClassNames(status),
        className
      )}
      aria-label={ariaLabelContent}
    >
      {badgeDisplayLabel}
    </Badge>
  );

  if (status === 'error' && error_message) {
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

