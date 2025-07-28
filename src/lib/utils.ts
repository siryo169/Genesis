import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  // Always show seconds, even if 0, if other parts are not present or if total duration is < 1 min.
  if (seconds > 0 || parts.length === 0 || (hours === 0 && minutes === 0)) {
    parts.push(`${seconds}s`);
  }
  
  return parts.join(' ') || '0s'; // Default to 0s if ms is 0 or very small
}
