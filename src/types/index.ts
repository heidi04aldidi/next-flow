// ============================================================
// NextFlow — Core Types
// ============================================================

import type { Node, Edge, Viewport } from "reactflow";

// ---- Node Types ----

export type NodeType =
  | "textNode"
  | "uploadImageNode"
  | "uploadVideoNode"
  | "llmNode"
  | "cropImageNode"
  | "extractFrameNode";

export type HandleType = "text" | "image" | "video" | "number" | "any";

// Base data shared by all nodes
export interface BaseNodeData {
  label: string;
  isRunning?: boolean;
  hasError?: boolean;
  errorMessage?: string;
  lastOutput?: unknown;
}

// --- Text Node ---
export interface TextNodeData extends BaseNodeData {
  content: string;
}

// --- Upload Image Node ---
export interface UploadImageNodeData extends BaseNodeData {
  uploadedUrl?: string;
  uploadedName?: string;
  uploadedSize?: number;
  mimeType?: string;
}

// --- Upload Video Node ---
export interface UploadVideoNodeData extends BaseNodeData {
  uploadedUrl?: string;
  uploadedName?: string;
  uploadedSize?: number;
  mimeType?: string;
  thumbnailUrl?: string;
}

// --- LLM Node ---
export type GeminiModel =
  | "gemini-2.0-flash"
  | "gemini-2.0-flash-thinking-exp"
  | "gemini-1.5-pro"
  | "gemini-1.5-flash"
  | "gemini-1.5-flash-8b";

export interface LLMNodeData extends BaseNodeData {
  model: GeminiModel;
  systemPromptOverride?: string; // manual fallback if no connection
  userMessageOverride?: string;  // manual fallback if no connection
  outputText?: string;
  isExpanded?: boolean;
}

// --- Crop Image Node ---
export interface CropImageNodeData extends BaseNodeData {
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
  outputUrl?: string;
}

// --- Extract Frame Node ---
export interface ExtractFrameNodeData extends BaseNodeData {
  timestamp: string; // "50%" or seconds as string
  outputUrl?: string;
}

// Union type for all node data
export type FlowNodeData =
  | TextNodeData
  | UploadImageNodeData
  | UploadVideoNodeData
  | LLMNodeData
  | CropImageNodeData
  | ExtractFrameNodeData;

// Typed React Flow nodes
export type FlowNode = Node<FlowNodeData, NodeType>;
export type FlowEdge = Edge;

// ---- Workflow ----

export interface WorkflowState {
  id: string;
  name: string;
  description?: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  viewport?: Viewport;
  updatedAt: string;
}

// ---- Run History ----

export type RunStatus = "RUNNING" | "SUCCESS" | "FAILED" | "PARTIAL" | "CANCELLED";
export type RunScope = "FULL" | "PARTIAL" | "SINGLE";

export interface NodeRunRecord {
  id: string;
  nodeId: string;
  nodeType: NodeType;
  nodeLabel?: string;
  status: RunStatus;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  error?: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
}

export interface WorkflowRunRecord {
  id: string;
  workflowId: string;
  status: RunStatus;
  scope: RunScope;
  selectedNodes: string[];
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  nodeRuns: NodeRunRecord[];
}

// ---- Execution ----

export interface ExecutionContext {
  nodeOutputs: Map<string, NodeOutput>;
  runId: string;
}

export interface NodeOutput {
  text?: string;
  imageUrl?: string;
  videoUrl?: string;
  imageUrls?: string[];
  raw?: unknown;
}

export interface ExecuteWorkflowRequest {
  workflowId: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  scope: RunScope;
  selectedNodeIds?: string[];
}

export interface ExecuteWorkflowResponse {
  runId: string;
  status: RunStatus;
  nodeResults: Record<string, NodeRunResult>;
}

export interface NodeRunResult {
  nodeId: string;
  status: RunStatus;
  output?: NodeOutput;
  error?: string;
  durationMs: number;
}

// ---- API Validation Schemas (Zod inferred) ----

export interface SaveWorkflowBody {
  workflowId?: string;
  name: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  viewport?: Viewport;
}

export interface RunWorkflowBody {
  workflowId: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  scope: RunScope;
  selectedNodeIds?: string[];
}

// ---- Connection Type Safety ----

// Maps handle IDs to their accepted types
export const HANDLE_TYPES: Record<string, HandleType[]> = {
  // LLM Node inputs
  "llm-system_prompt": ["text"],
  "llm-user_message": ["text"],
  "llm-images": ["image"],
  // Crop Image inputs
  "crop-image_url": ["image"],
  "crop-x_percent": ["text", "number"],
  "crop-y_percent": ["text", "number"],
  "crop-width_percent": ["text", "number"],
  "crop-height_percent": ["text", "number"],
  // Extract Frame inputs
  "extract-video_url": ["video"],
  "extract-timestamp": ["text", "number"],
};

// Maps node type to their output handle type
export const OUTPUT_HANDLE_TYPES: Record<NodeType, HandleType> = {
  textNode: "text",
  uploadImageNode: "image",
  uploadVideoNode: "video",
  llmNode: "text",
  cropImageNode: "image",
  extractFrameNode: "image",
};
