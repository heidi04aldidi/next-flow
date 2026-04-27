import { z } from "zod";

// ---- Shared ----

const ViewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number(),
});

const NodePositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const FlowNodeSchema = z.object({
  id: z.string(),
  type: z.enum([
    "textNode",
    "uploadImageNode",
    "uploadVideoNode",
    "llmNode",
    "cropImageNode",
    "extractFrameNode",
  ]),
  position: NodePositionSchema,
  data: z.record(z.unknown()),
  selected: z.boolean().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
});

const FlowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
  type: z.string().optional(),
  animated: z.boolean().optional(),
  style: z.record(z.unknown()).optional(),
});

// ---- Workflow ----

export const SaveWorkflowSchema = z.object({
  workflowId: z.string().optional(),
  name: z.string().min(1).max(100),
  nodes: z.array(FlowNodeSchema),
  edges: z.array(FlowEdgeSchema),
  viewport: ViewportSchema.optional(),
});

export type SaveWorkflowInput = z.infer<typeof SaveWorkflowSchema>;

// ---- Run Workflow ----

export const RunWorkflowSchema = z.object({
  workflowId: z.string(),
  nodes: z.array(FlowNodeSchema),
  edges: z.array(FlowEdgeSchema),
  scope: z.enum(["FULL", "PARTIAL", "SINGLE"]),
  selectedNodeIds: z.array(z.string()).optional(),
});

export type RunWorkflowInput = z.infer<typeof RunWorkflowSchema>;

// ---- LLM Task ----

export const LLMTaskSchema = z.object({
  nodeId: z.string(),
  workflowRunId: z.string(),
  nodeRunId: z.string(),
  model: z.enum([
    "gemini-2.0-flash",
    "gemini-2.0-flash-thinking-exp",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
  ]),
  systemPrompt: z.string().optional(),
  userMessage: z.string(),
  imageUrls: z.array(z.string()).optional(),
});

export type LLMTaskInput = z.infer<typeof LLMTaskSchema>;

// ---- Crop Image Task ----

export const CropImageTaskSchema = z.object({
  nodeId: z.string(),
  workflowRunId: z.string(),
  nodeRunId: z.string(),
  imageUrl: z.string().url(),
  xPercent: z.number().min(0).max(100).default(0),
  yPercent: z.number().min(0).max(100).default(0),
  widthPercent: z.number().min(1).max(100).default(100),
  heightPercent: z.number().min(1).max(100).default(100),
});

export type CropImageTaskInput = z.infer<typeof CropImageTaskSchema>;

// ---- Extract Frame Task ----

export const ExtractFrameTaskSchema = z.object({
  nodeId: z.string(),
  workflowRunId: z.string(),
  nodeRunId: z.string(),
  videoUrl: z.string().url(),
  timestamp: z.string().default("50%"),
});

export type ExtractFrameTaskInput = z.infer<typeof ExtractFrameTaskSchema>;

// ---- Upload ----

export const UploadCompleteSchema = z.object({
  nodeId: z.string(),
  url: z.string().url(),
  name: z.string(),
  size: z.number(),
  mimeType: z.string(),
});
