import { tasks } from "@trigger.dev/sdk/v3";
import type {
  FlowNode,
  FlowEdge,
  NodeOutput,
  RunScope,
  NodeRunResult,
} from "@/types";
import {
  topologicalSort,
  getNodesToRun,
  resolveNodeInputs,
} from "@/lib/utils/dag";
import {
  createWorkflowRun,
  createNodeRun,
  updateNodeRun,
  updateWorkflowRun,
} from "@/lib/db/workflows";
import type {
  LLMTaskInput,
  CropImageTaskInput,
  ExtractFrameTaskInput,
} from "@/lib/validations/schemas";

export interface ExecutionResult {
  runId: string;
  status: "SUCCESS" | "FAILED" | "PARTIAL";
  nodeResults: Record<string, NodeRunResult>;
  error?: string;
}

/**
 * Execute a workflow (or subset of nodes) using Trigger.dev tasks.
 * Independent nodes in the same DAG level run in parallel.
 */
export async function executeWorkflow(
  workflowId: string,
  userId: string,
  nodes: FlowNode[],
  edges: FlowEdge[],
  scope: RunScope,
  selectedNodeIds?: string[]
): Promise<ExecutionResult> {
  // 1. Determine which nodes to run
  const nodesToRun = getNodesToRun(nodes, edges, scope, selectedNodeIds);
  const runEdges = edges.filter(
    (e) =>
      nodesToRun.some((n) => n.id === e.source) &&
      nodesToRun.some((n) => n.id === e.target)
  );

  // 2. Create DB run record
  const dbRun = await createWorkflowRun(
    workflowId,
    userId,
    scope,
    selectedNodeIds ?? []
  );

  const runId = dbRun.id;
  const nodeResults: Record<string, NodeRunResult> = {};
  const nodeOutputs = new Map<string, Record<string, unknown>>();

  // 3. Topological sort → execution levels (each level runs in parallel)
  const levels = topologicalSort(nodesToRun, runEdges);

  let overallStatus: "SUCCESS" | "FAILED" | "PARTIAL" = "SUCCESS";
  const failedNodes = new Set<string>();

  // 4. Execute level by level
  for (const level of levels) {
    // Filter out nodes whose dependencies failed
    const runnableNodes = level.filter((node) => {
      const upstreams = edges
        .filter((e) => e.target === node.id)
        .map((e) => e.source);
      return upstreams.every((upId) => !failedNodes.has(upId));
    });

    if (runnableNodes.length === 0) continue;

    // Execute all nodes in this level concurrently
    const levelPromises = runnableNodes.map(async (node) => {
      const nodeStart = Date.now();

      // Create node run record
      const nodeRunRecord = await createNodeRun(
        runId,
        node.id,
        node.type ?? "unknown",
        (node.data as { label?: string })?.label
      );

      // Resolve inputs from upstream outputs
      const resolvedInputs = resolveNodeInputs(node, runEdges, nodeOutputs);

      try {
        const output = await executeNode(node, resolvedInputs, runId, nodeRunRecord.id);
        const durationMs = Date.now() - nodeStart;

        // Store output for downstream nodes
        nodeOutputs.set(node.id, serializeOutput(output));

        // Update DB
        await updateNodeRun(nodeRunRecord.id, {
          status: "SUCCESS",
          inputs: resolvedInputs as Record<string, unknown>,
          outputs: serializeOutput(output),
          completedAt: new Date(),
          durationMs,
        });

        nodeResults[node.id] = {
          nodeId: node.id,
          status: "SUCCESS",
          output,
          durationMs,
        };
      } catch (err) {
        const durationMs = Date.now() - nodeStart;
        const errorMessage = err instanceof Error ? err.message : String(err);

        failedNodes.add(node.id);
        overallStatus = overallStatus === "SUCCESS" ? "PARTIAL" : "FAILED";

        await updateNodeRun(nodeRunRecord.id, {
          status: "FAILED",
          inputs: resolvedInputs as Record<string, unknown>,
          error: errorMessage,
          completedAt: new Date(),
          durationMs,
        });

        nodeResults[node.id] = {
          nodeId: node.id,
          status: "FAILED",
          error: errorMessage,
          durationMs,
        };
      }
    });

    await Promise.all(levelPromises);
  }

  // 5. If all nodes failed, mark as FAILED
  if (failedNodes.size === nodesToRun.length) {
    overallStatus = "FAILED";
  }

  // 6. Update run record
  const totalDuration = Object.values(nodeResults).reduce(
    (sum, r) => sum + r.durationMs,
    0
  );

  await updateWorkflowRun(runId, {
    status: overallStatus,
    completedAt: new Date(),
    durationMs: totalDuration,
  });

  return { runId, status: overallStatus, nodeResults };
}

/**
 * Execute a single node via Trigger.dev
 */
async function executeNode(
  node: FlowNode,
  resolvedInputs: Record<string, unknown>,
  workflowRunId: string,
  nodeRunId: string
): Promise<NodeOutput> {
  const nodeType = node.type;

  // Text and Upload nodes don't need Trigger.dev — their value is their data
  if (nodeType === "textNode") {
    const data = node.data as { content: string };
    return { text: data.content };
  }

  if (nodeType === "uploadImageNode") {
    const data = node.data as { uploadedUrl?: string };
    if (!data.uploadedUrl) throw new Error("No image uploaded to this node");
    return { imageUrl: data.uploadedUrl };
  }

  if (nodeType === "uploadVideoNode") {
    const data = node.data as { uploadedUrl?: string };
    if (!data.uploadedUrl) throw new Error("No video uploaded to this node");
    return { videoUrl: data.uploadedUrl };
  }

  // LLM Node → Trigger.dev task
  if (nodeType === "llmNode") {
    const data = node.data as {
      model: string;
      systemPromptOverride?: string;
      userMessageOverride?: string;
    };

    const systemPrompt =
      (resolvedInputs["system_prompt"] as string | undefined) ??
      data.systemPromptOverride;
    const userMessage =
      (resolvedInputs["user_message"] as string | undefined) ??
      data.userMessageOverride ??
      "";
    const imageUrls = resolvedInputs["images"]
      ? (Array.isArray(resolvedInputs["images"])
          ? (resolvedInputs["images"] as string[])
          : [resolvedInputs["images"] as string])
      : [];

    if (!userMessage) throw new Error("LLM node requires a user message");

    const taskInput: LLMTaskInput = {
      nodeId: node.id,
      workflowRunId,
      nodeRunId,
      model: data.model as LLMTaskInput["model"],
      systemPrompt,
      userMessage,
      imageUrls,
    };

    const handle = await tasks.trigger("llm-execute", taskInput);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (handle as any).waitForCompletion();

    if (result.status === "COMPLETED" && result.output) {
      return { text: (result.output as { outputText: string }).outputText };
    }
    throw new Error(
      result.status === "FAILED"
        ? `LLM task failed: ${JSON.stringify(result)}`
        : `Unexpected task status: ${result.status}`
    );
  }

  // Crop Image Node → Trigger.dev task
  if (nodeType === "cropImageNode") {
    const data = node.data as {
      xPercent: number;
      yPercent: number;
      widthPercent: number;
      heightPercent: number;
    };

    const imageUrl = resolvedInputs["image_url"] as string | undefined;
    if (!imageUrl) throw new Error("Crop Image node requires an image input");

    const taskInput: CropImageTaskInput = {
      nodeId: node.id,
      workflowRunId,
      nodeRunId,
      imageUrl,
      xPercent: parseFloat(String(resolvedInputs["x_percent"] ?? data.xPercent)),
      yPercent: parseFloat(String(resolvedInputs["y_percent"] ?? data.yPercent)),
      widthPercent: parseFloat(String(resolvedInputs["width_percent"] ?? data.widthPercent)),
      heightPercent: parseFloat(String(resolvedInputs["height_percent"] ?? data.heightPercent)),
    };

    const handle = await tasks.trigger("crop-image", taskInput);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (handle as any).waitForCompletion();

    if (result.status === "COMPLETED" && result.output) {
      return { imageUrl: (result.output as { outputUrl: string }).outputUrl };
    }
    throw new Error(`Crop task failed: ${JSON.stringify(result)}`);
  }

  // Extract Frame Node → Trigger.dev task
  if (nodeType === "extractFrameNode") {
    const data = node.data as { timestamp: string };

    const videoUrl = resolvedInputs["video_url"] as string | undefined;
    if (!videoUrl) throw new Error("Extract Frame node requires a video input");

    const taskInput: ExtractFrameTaskInput = {
      nodeId: node.id,
      workflowRunId,
      nodeRunId,
      videoUrl,
      timestamp: String(resolvedInputs["timestamp"] ?? data.timestamp ?? "50%"),
    };

    const handle = await tasks.trigger("extract-frame", taskInput);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (handle as any).waitForCompletion();

    if (result.status === "COMPLETED" && result.output) {
      return { imageUrl: (result.output as { outputUrl: string }).outputUrl };
    }
    throw new Error(`Extract frame task failed: ${JSON.stringify(result)}`);
  }

  throw new Error(`Unknown node type: ${nodeType}`);
}

function serializeOutput(output: NodeOutput): Record<string, unknown> {
  return {
    text: output.text,
    imageUrl: output.imageUrl,
    videoUrl: output.videoUrl,
    imageUrls: output.imageUrls,
    raw: output.raw,
  };
}
