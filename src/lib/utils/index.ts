import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { v4 as uuidv4 } from "uuid";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId() {
  return uuidv4();
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "...";
}

export function getNodeTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    textNode: "Text",
    uploadImageNode: "Upload Image",
    uploadVideoNode: "Upload Video",
    llmNode: "LLM",
    cropImageNode: "Crop Image",
    extractFrameNode: "Extract Frame",
  };
  return labels[type] ?? type;
}

export function getNodeTypeColor(type: string): string {
  const colors: Record<string, string> = {
    textNode: "#64748b",
    uploadImageNode: "#3b82f6",
    uploadVideoNode: "#8b5cf6",
    llmNode: "#7c5cfa",
    cropImageNode: "#06b6d4",
    extractFrameNode: "#10b981",
  };
  return colors[type] ?? "#6b7280";
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// Deep clone for workflow state
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}
