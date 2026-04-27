import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import sharp from "sharp";
import type { FlowNode, FlowEdge, NodeOutput, RunScope, NodeRunResult } from "@/types";
import { topologicalSort, getNodesToRun, resolveNodeInputs } from "@/lib/utils/dag";
import {
  createWorkflowRun,
  createNodeRun,
  updateNodeRun,
  updateWorkflowRun,
} from "@/lib/db/workflows";

export interface ExecutionResult {
  runId: string;
  status: "SUCCESS" | "FAILED" | "PARTIAL";
  nodeResults: Record<string, NodeRunResult>;
  error?: string;
}

export async function executeWorkflow(
  workflowId: string,
  userId: string,
  nodes: FlowNode[],
  edges: FlowEdge[],
  scope: RunScope,
  selectedNodeIds?: string[]
): Promise<ExecutionResult> {
  const nodesToRun = getNodesToRun(nodes, edges, scope, selectedNodeIds);
  const runEdges = edges.filter(
    (e) =>
      nodesToRun.some((n) => n.id === e.source) &&
      nodesToRun.some((n) => n.id === e.target)
  );

  const dbRun = await createWorkflowRun(workflowId, userId, scope, selectedNodeIds ?? []);
  const runId = dbRun.id;
  const nodeResults: Record<string, NodeRunResult> = {};
  const nodeOutputs = new Map<string, Record<string, unknown>>();

  const levels = topologicalSort(nodesToRun, runEdges);
  let overallStatus: "SUCCESS" | "FAILED" | "PARTIAL" = "SUCCESS";
  const failedNodes = new Set<string>();

  for (const level of levels) {
    const runnableNodes = level.filter((node) => {
      const upstreams = edges.filter((e) => e.target === node.id).map((e) => e.source);
      return upstreams.every((upId) => !failedNodes.has(upId));
    });

    if (runnableNodes.length === 0) continue;

    const levelPromises = runnableNodes.map(async (node) => {
      const nodeStart = Date.now();
      const nodeRunRecord = await createNodeRun(
        runId,
        node.id,
        node.type ?? "unknown",
        (node.data as { label?: string })?.label
      );

      const resolvedInputs = resolveNodeInputs(node, runEdges, nodeOutputs);

      try {
        const output = await executeNode(node, resolvedInputs);
        const durationMs = Date.now() - nodeStart;

        nodeOutputs.set(node.id, serializeOutput(output));

        await updateNodeRun(nodeRunRecord.id, {
          status: "SUCCESS",
          inputs: resolvedInputs as Record<string, unknown>,
          outputs: serializeOutput(output),
          completedAt: new Date(),
          durationMs,
        });

        nodeResults[node.id] = { nodeId: node.id, status: "SUCCESS", output, durationMs };
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

        nodeResults[node.id] = { nodeId: node.id, status: "FAILED", error: errorMessage, durationMs };
      }
    });

    await Promise.all(levelPromises);
  }

  if (failedNodes.size === nodesToRun.length && nodesToRun.length > 0) {
    overallStatus = "FAILED";
  }

  const totalDuration = Object.values(nodeResults).reduce((sum, r) => sum + r.durationMs, 0);
  await updateWorkflowRun(runId, { status: overallStatus, completedAt: new Date(), durationMs: totalDuration });

  return { runId, status: overallStatus, nodeResults };
}

async function executeNode(
  node: FlowNode,
  resolvedInputs: Record<string, unknown>
): Promise<NodeOutput> {
  const nodeType = node.type;

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

  if (nodeType === "llmNode") {
    return executeLLMNode(node, resolvedInputs);
  }

  if (nodeType === "cropImageNode") {
    return executeCropImageNode(node, resolvedInputs);
  }

  if (nodeType === "extractFrameNode") {
    return executeExtractFrameNode(node, resolvedInputs);
  }

  throw new Error(`Unknown node type: ${nodeType}`);
}

async function executeLLMNode(
  node: FlowNode,
  resolvedInputs: Record<string, unknown>
): Promise<NodeOutput> {
  const data = node.data as {
    model: string;
    systemPromptOverride?: string;
    userMessageOverride?: string;
  };

  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_GEMINI_API_KEY is not configured");

  const systemPrompt =
    (resolvedInputs["system_prompt"] as string | undefined) ?? data.systemPromptOverride;
  const userMessage =
    (resolvedInputs["user_message"] as string | undefined) ?? data.userMessageOverride ?? "";
  const imageUrls: string[] = resolvedInputs["images"]
    ? Array.isArray(resolvedInputs["images"])
      ? (resolvedInputs["images"] as string[])
      : [resolvedInputs["images"] as string]
    : [];

  if (!userMessage) throw new Error("LLM node requires a user message");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: data.model, systemInstruction: systemPrompt });

  const parts: Part[] = [{ text: userMessage }];

  for (const imageUrl of imageUrls) {
    try {
      let base64: string;
      let mimeType: string;

      if (imageUrl.startsWith("data:")) {
        const commaIdx = imageUrl.indexOf(",");
        base64 = imageUrl.slice(commaIdx + 1);
        mimeType = imageUrl.match(/data:([^;]+)/)?.[1] ?? "image/jpeg";
      } else {
        const res = await fetch(imageUrl);
        if (!res.ok) continue;
        base64 = Buffer.from(await res.arrayBuffer()).toString("base64");
        mimeType = res.headers.get("content-type") ?? "image/jpeg";
      }

      parts.push({
        inlineData: {
          data: base64,
          mimeType: mimeType as "image/jpeg" | "image/png" | "image/webp",
        },
      });
    } catch {
      // skip images that fail to load
    }
  }

  const result = await model.generateContent({ contents: [{ role: "user", parts }] });
  return { text: result.response.text() };
}

async function executeCropImageNode(
  node: FlowNode,
  resolvedInputs: Record<string, unknown>
): Promise<NodeOutput> {
  const data = node.data as {
    xPercent: number;
    yPercent: number;
    widthPercent: number;
    heightPercent: number;
  };

  const imageUrl = resolvedInputs["image_url"] as string | undefined;
  if (!imageUrl) throw new Error("Crop Image node requires an image input");

  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error("Failed to download image for cropping");
  const buffer = Buffer.from(await res.arrayBuffer());

  const image = sharp(buffer);
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) throw new Error("Could not determine image dimensions");

  const xPct = parseFloat(String(resolvedInputs["x_percent"] ?? data.xPercent));
  const yPct = parseFloat(String(resolvedInputs["y_percent"] ?? data.yPercent));
  const wPct = parseFloat(String(resolvedInputs["width_percent"] ?? data.widthPercent));
  const hPct = parseFloat(String(resolvedInputs["height_percent"] ?? data.heightPercent));

  const left = Math.max(0, Math.floor((xPct / 100) * metadata.width));
  const top = Math.max(0, Math.floor((yPct / 100) * metadata.height));
  const width = Math.min(Math.floor((wPct / 100) * metadata.width), metadata.width - left);
  const height = Math.min(Math.floor((hPct / 100) * metadata.height), metadata.height - top);

  const croppedBuffer = await image.extract({ left, top, width, height }).jpeg({ quality: 90 }).toBuffer();

  // Try uploading via Transloadit image template
  const uploadedUrl = await uploadCroppedImage(croppedBuffer).catch(() => null);
  if (uploadedUrl) return { imageUrl: uploadedUrl };

  // Fallback: base64 data URL
  return { imageUrl: `data:image/jpeg;base64,${croppedBuffer.toString("base64")}` };
}

async function executeExtractFrameNode(
  node: FlowNode,
  resolvedInputs: Record<string, unknown>
): Promise<NodeOutput> {
  const data = node.data as { timestamp: string };
  const videoUrl = resolvedInputs["video_url"] as string | undefined;
  if (!videoUrl) throw new Error("Extract Frame node requires a video input");

  const timestamp = String(resolvedInputs["timestamp"] ?? data.timestamp ?? "50%");
  const imageUrl = await extractFrameViaTransloadit(videoUrl, timestamp);
  return { imageUrl };
}

async function uploadCroppedImage(buffer: Buffer): Promise<string> {
  const key = process.env.TRANSLOADIT_KEY ?? process.env.NEXT_PUBLIC_TRANSLOADIT_KEY;
  const templateId =
    process.env.TRANSLOADIT_IMAGE_TEMPLATE_ID ?? process.env.NEXT_PUBLIC_TRANSLOADIT_IMAGE_TEMPLATE_ID;
  if (!key || !templateId) throw new Error("Transloadit not configured");

  const formData = new FormData();
  formData.append(
    "file",
    new Blob([new Uint8Array(buffer)], { type: "image/jpeg" }),
    "cropped.jpg"
  );
  formData.append("params", JSON.stringify({ auth: { key }, template_id: templateId }));

  const res = await fetch("https://api2.transloadit.com/assemblies", { method: "POST", body: formData });
  if (!res.ok) throw new Error("Transloadit upload failed");

  let data = await res.json();
  if (data.ok !== "ASSEMBLY_COMPLETED") {
    data = await pollTransloaditAssembly(data.assembly_ssl_url);
  }

  for (const steps of Object.values(data.results ?? {}) as { ssl_url?: string }[][]) {
    if (steps?.[0]?.ssl_url) return steps[0].ssl_url;
  }
  throw new Error("No output URL from Transloadit");
}

async function extractFrameViaTransloadit(videoUrl: string, timestamp: string): Promise<string> {
  const key = process.env.TRANSLOADIT_KEY ?? process.env.NEXT_PUBLIC_TRANSLOADIT_KEY;
  if (!key) throw new Error("TRANSLOADIT_KEY is not configured");

  const thumbsStep: Record<string, unknown> = {
    robot: "/video/thumbs",
    use: "imported",
    count: 1,
    format: "jpg",
    width: 1280,
    height: 720,
    resize_strategy: "fit",
  };

  const trimmed = timestamp.trim();
  if (trimmed.endsWith("%")) {
    thumbsStep.percentages = [parseFloat(trimmed) / 100];
  } else if (trimmed.includes(":")) {
    const parts = trimmed.split(":").map(Number);
    let secs = 0;
    if (parts.length === 3) secs = parts[0] * 3600 + parts[1] * 60 + parts[2];
    else if (parts.length === 2) secs = parts[0] * 60 + parts[1];
    thumbsStep.offsets = [secs];
  } else {
    const secs = parseFloat(trimmed);
    thumbsStep.offsets = [isNaN(secs) ? 0 : secs];
  }

  const formData = new FormData();
  formData.append(
    "params",
    JSON.stringify({
      auth: { key },
      steps: {
        imported: { robot: "/http/import", url: videoUrl },
        thumbed: thumbsStep,
      },
    })
  );

  const res = await fetch("https://api2.transloadit.com/assemblies", { method: "POST", body: formData });
  if (!res.ok) throw new Error("Transloadit frame extraction request failed");

  let data = await res.json();
  if (data.ok !== "ASSEMBLY_COMPLETED") {
    data = await pollTransloaditAssembly(data.assembly_ssl_url, 120);
  }

  const result = (data.results?.thumbed as { ssl_url?: string }[] | undefined)?.[0];
  if (!result?.ssl_url) throw new Error("No frame URL returned from Transloadit");
  return result.ssl_url;
}

async function pollTransloaditAssembly(
  assemblyUrl: string,
  maxAttempts = 60
): Promise<Record<string, unknown>> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const res = await fetch(assemblyUrl);
    const data = await res.json();
    if (data.ok === "ASSEMBLY_COMPLETED") return data;
    if (data.error) throw new Error(`Transloadit assembly failed: ${data.error}`);
  }
  throw new Error("Transloadit assembly timed out");
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
