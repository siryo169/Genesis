"use client";

import type { NormalizerChecks, ProcessingStatus, ProcessingStep } from "@/types/csv-status";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, XCircle, Loader2, Circle, HelpCircle } from "lucide-react";
import { formatDuration } from "@/lib/utils";

interface NormalizerStatusCellProps {
  checks: NormalizerChecks;
  now?: number | undefined; 
}

const StatusIcon = ({ status }: { status: ProcessingStatus }) => {
  switch (status) {
    case "ok":
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case "running":
      return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
    case "error":
      return <XCircle className="h-5 w-5 text-red-500" />;
    case "enqueued":
      return <Circle className="h-5 w-5 text-orange-500" />;
    default:
      return <HelpCircle className="h-5 w-5 text-muted-foreground" />;
  }
};

const statusLabels = {
  field_mapping_check: "Field Mapping",
  uniform_format_check: "Uniform Format",
  field_verifier_check: "Normalization",
};

export function NormalizerStatusCell({ checks, now }: NormalizerStatusCellProps) {
  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex space-x-3 items-center">
        {(Object.keys(checks) as Array<keyof typeof statusLabels>).map((key) => {
          const step: ProcessingStep = checks[key];
          let durationText = "";
          
          if (step.status === 'running' && typeof step.startTime === 'number' && typeof now === 'number') {
            const elapsed = now - step.startTime;
            if (elapsed >= 0) {
              durationText = ` - ${formatDuration(elapsed)}`;
            } else {
              durationText = ` - (0s)`;
            }
          } else if (step.status === 'ok' && typeof step.startTime === 'number' && typeof step.endTime === 'number') {
            durationText = ` - ${formatDuration(step.endTime - step.startTime)}`;
          } else if (step.status === 'error' && typeof step.startTime === 'number' && typeof step.endTime === 'number' && step.endTime > step.startTime) {
            durationText = ` - ${formatDuration(step.endTime - step.startTime)}`;
          } else if (step.status === 'running') {
            durationText = ""; // No duration if now or startTime is undefined
          }


          let tooltipMessage = `${statusLabels[key]}: ${step.status.replace("_", " ")}${durationText}`;
          if (step.status === 'error' && step.errorMessage) {
            tooltipMessage += `\nError: ${step.errorMessage}`;
          }

          return (
            <Tooltip key={key}>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center">
                  <StatusIcon status={step.status} />
                </div>
              </TooltipTrigger>
              <TooltipContent className="whitespace-pre-wrap">
                <p className="capitalize">{tooltipMessage}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

