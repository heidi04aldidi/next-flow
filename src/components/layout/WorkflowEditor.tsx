"use client";

import { useCallback, useEffect } from "react";
import { ReactFlowProvider } from "reactflow";
import { useRouter } from "next/navigation";
import { useWorkflowStore } from "@/lib/store/workflowStore";
import TopToolbar from "./TopToolbar";
import LeftSidebar from "@/components/sidebar/LeftSidebar";
import RightSidebar from "@/components/sidebar/RightSidebar";
import WorkflowCanvas from "@/components/canvas/WorkflowCanvas";
import { getNodesToRun } from "@/lib/utils/dag";
import type { FlowNode, FlowEdge, WorkflowRunRecord } from "@/types";
import type { Viewport } from "reactflow";

interface WorkflowEditorProps {
  userId: string;
  initialWorkflow?: {
    id: string;
    name: string;
    nodes: object[];
    edges: object[];
    viewport?: object;
  } | null;
  initialRuns?: WorkflowRunRecord[];
}

export default function WorkflowEditor({
  userId,
  initialWorkflow,
  initialRuns = [],
}: WorkflowEditorProps) {
  const router = useRouter();
  const {
    workflowId,
    workflowName,
    nodes,
    edges,
    viewport,
    loadWorkflow,
    setRunHistory,
    setRunning,
    setNodeRunning,
    updateNodeData,
    markSaved,
    setSaving,
    isRightSidebarOpen,
    toggleRightSidebar,
  } = useWorkflowStore();

  // Load initial workflow and run history
  useEffect(() => {
    if (initialWorkflow) {
      loadWorkflow({
        id: initialWorkflow.id,
        name: initialWorkflow.name,
        nodes: initialWorkflow.nodes as FlowNode[],
        edges: initialWorkflow.edges as FlowEdge[],
        viewport: initialWorkflow.viewport as Viewport | undefined,
      });
    }
    if (initialRuns.length > 0) {
      setRunHistory(initialRuns);
      if (!isRightSidebarOpen) toggleRightSidebar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save workflow
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/workflows/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowId,
          name: workflowName,
          nodes,
          edges,
          viewport,
        }),
      });

      if (!response.ok) throw new Error("Save failed");

      const result = await response.json();
      markSaved();

      // Update URL if new workflow
      if (result.id && result.id !== workflowId) {
        router.replace(`/workflow?id=${result.id}`, { scroll: false });
      }
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  }, [workflowId, workflowName, nodes, edges, viewport, setSaving, markSaved, router]);

  // Run workflow
  const handleRun = useCallback(
    async (scope: "FULL" | "PARTIAL" | "SINGLE", selectedIds?: string[]) => {
      if (nodes.length === 0) return;

      setRunning(true);

      // Compute which nodes will actually run (including transitive deps for PARTIAL)
      const actualNodesToRun = getNodesToRun(nodes, edges, scope, selectedIds);
      for (const node of actualNodesToRun) {
        setNodeRunning(node.id, true);
      }

      // Open right sidebar
      if (!isRightSidebarOpen) toggleRightSidebar();

      try {
        // Auto-save before running
        if (!useWorkflowStore.getState().isSaved) {
          await handleSave();
        }

        const response = await fetch("/api/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workflowId,
            nodes,
            edges,
            scope,
            selectedNodeIds: selectedIds,
          }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error((err as { message?: string }).message ?? "Run failed");
        }

        const data = await response.json() as {
          result?: {
            nodeResults?: Record<string, {
              status: string;
              output?: { text?: string; imageUrl?: string; videoUrl?: string };
              error?: string;
            }>;
          };
          runs?: WorkflowRunRecord[];
        };

        // Update each node with its result
        for (const [nodeId, nodeResult] of Object.entries(data.result?.nodeResults ?? {})) {
          if (nodeResult.status === "SUCCESS" && nodeResult.output) {
            const updates: Record<string, unknown> = { isRunning: false, hasError: false };
            if (nodeResult.output.text) {
              updates.outputText = nodeResult.output.text;
              updates.isExpanded = true; // Auto-expand LLM output after run
            }
            if (nodeResult.output.imageUrl) updates.outputUrl = nodeResult.output.imageUrl;
            if (nodeResult.output.videoUrl) updates.uploadedUrl = nodeResult.output.videoUrl;
            updateNodeData(nodeId, updates);
          } else if (nodeResult.status === "FAILED") {
            updateNodeData(nodeId, {
              isRunning: false,
              hasError: true,
              errorMessage: nodeResult.error,
            });
          }
          setNodeRunning(nodeId, false);
        }

        // Update run history with fresh server data
        if (data.runs?.length) {
          setRunHistory(data.runs);
        }
      } catch (err) {
        console.error("Run failed:", err);
        for (const node of actualNodesToRun) {
          setNodeRunning(node.id, false);
          updateNodeData(node.id, {
            isRunning: false,
            hasError: true,
            errorMessage: err instanceof Error ? err.message : "Run failed",
          });
        }
      } finally {
        setRunning(false);
      }
    },
    [
      nodes, edges, workflowId,
      setRunning, setNodeRunning, updateNodeData, setRunHistory,
      handleSave, isRightSidebarOpen, toggleRightSidebar,
    ]
  );

  // Auto-save every 30s
  useEffect(() => {
    const timer = setInterval(() => {
      const state = useWorkflowStore.getState();
      if (!state.isSaved && !state.isSaving && state.nodes.length > 0) {
        handleSave();
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [handleSave]);

  return (
    <ReactFlowProvider>
      <div className="flex flex-col h-screen overflow-hidden bg-canvas">
        <TopToolbar userId={userId} onSave={handleSave} onRun={handleRun} />

        <div className="flex flex-1 overflow-hidden relative">
          <div className="relative flex">
            <LeftSidebar />
          </div>

          <main className="flex-1 overflow-hidden relative">
            <WorkflowCanvas />
          </main>

          <div className="relative flex">
            <RightSidebar />
          </div>
        </div>
      </div>
    </ReactFlowProvider>
  );
}
