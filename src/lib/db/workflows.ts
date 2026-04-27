import { db } from "./client";
import type { FlowNode, FlowEdge, WorkflowRunRecord } from "@/types";
import type { Viewport } from "reactflow";

export async function getUserWorkflows(userId: string) {
  return db.workflow.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      updatedAt: true,
      createdAt: true,
      _count: { select: { runs: true } },
    },
  });
}

export async function getWorkflow(id: string, userId: string) {
  return db.workflow.findFirst({
    where: { id, userId },
  });
}

export async function createWorkflow(userId: string, name: string = "Untitled Workflow") {
  return db.workflow.create({
    data: {
      userId,
      name,
      nodes: [],
      edges: [],
    },
  });
}

export async function saveWorkflow(
  id: string,
  userId: string,
  data: {
    name?: string;
    nodes: FlowNode[];
    edges: FlowEdge[];
    viewport?: Viewport;
  }
) {
  return db.workflow.upsert({
    where: { id },
    create: {
      id,
      userId,
      name: data.name ?? "Untitled Workflow",
      nodes: data.nodes as object[],
      edges: data.edges as object[],
      viewport: data.viewport ?? undefined,
    },
    update: {
      name: data.name,
      nodes: data.nodes as object[],
      edges: data.edges as object[],
      viewport: data.viewport ?? undefined,
      updatedAt: new Date(),
    },
  });
}

export async function deleteWorkflow(id: string, userId: string) {
  return db.workflow.delete({
    where: { id, userId },
  });
}

export async function getWorkflowRuns(workflowId: string, userId: string) {
  return db.workflowRun.findMany({
    where: { workflowId, userId },
    orderBy: { startedAt: "desc" },
    take: 50,
    include: {
      nodeRuns: {
        orderBy: { startedAt: "asc" },
      },
    },
  });
}

export async function createWorkflowRun(
  workflowId: string,
  userId: string,
  scope: "FULL" | "PARTIAL" | "SINGLE",
  selectedNodes: string[] = []
) {
  return db.workflowRun.create({
    data: {
      workflowId,
      userId,
      scope,
      selectedNodes,
      status: "RUNNING",
    },
    include: { nodeRuns: true },
  });
}

export async function updateWorkflowRun(
  id: string,
  data: {
    status: "RUNNING" | "SUCCESS" | "FAILED" | "PARTIAL" | "CANCELLED";
    completedAt?: Date;
    durationMs?: number;
    triggerRunId?: string;
  }
) {
  return db.workflowRun.update({
    where: { id },
    data,
  });
}

export async function createNodeRun(
  workflowRunId: string,
  nodeId: string,
  nodeType: string,
  nodeLabel?: string
) {
  return db.nodeRun.create({
    data: {
      workflowRunId,
      nodeId,
      nodeType,
      nodeLabel,
      status: "RUNNING",
    },
  });
}

export async function updateNodeRun(
  id: string,
  data: {
    status: "RUNNING" | "SUCCESS" | "FAILED" | "PARTIAL" | "CANCELLED";
    inputs?: Record<string, unknown>;
    outputs?: Record<string, unknown>;
    error?: string;
    completedAt?: Date;
    durationMs?: number;
    triggerTaskId?: string;
  }
) {
  return db.nodeRun.update({
    where: { id },
    data: {
      ...data,
      inputs: data.inputs as object | undefined,
      outputs: data.outputs as object | undefined,
    },
  });
}

export function serializeRuns(runs: Awaited<ReturnType<typeof getWorkflowRuns>>): WorkflowRunRecord[] {
  return runs.map((run) => ({
    id: run.id,
    workflowId: run.workflowId,
    status: run.status as WorkflowRunRecord["status"],
    scope: run.scope as WorkflowRunRecord["scope"],
    selectedNodes: run.selectedNodes,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString(),
    durationMs: run.durationMs ?? undefined,
    nodeRuns: run.nodeRuns.map((nr) => ({
      id: nr.id,
      nodeId: nr.nodeId,
      nodeType: nr.nodeType as WorkflowRunRecord["nodeRuns"][0]["nodeType"],
      nodeLabel: nr.nodeLabel ?? undefined,
      status: nr.status as WorkflowRunRecord["nodeRuns"][0]["status"],
      inputs: (nr.inputs as Record<string, unknown>) ?? undefined,
      outputs: (nr.outputs as Record<string, unknown>) ?? undefined,
      error: nr.error ?? undefined,
      startedAt: nr.startedAt.toISOString(),
      completedAt: nr.completedAt?.toISOString(),
      durationMs: nr.durationMs ?? undefined,
    })),
  }));
}
