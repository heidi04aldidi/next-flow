"use client";

import { useCallback, useEffect } from "react";
import { ReactFlowProvider } from "reactflow";
import { useRouter } from "next/navigation";
import { useWorkflowStore } from "@/lib/store/workflowStore";
import TopToolbar from "./TopToolbar";
import LeftSidebar from "@/components/sidebar/LeftSidebar";
import RightSidebar from "@/components/sidebar/RightSidebar";
import WorkflowCanvas from "@/components/canvas/WorkflowCanvas";
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
    addRunToHistory,
    updateRunInHistory,
    setRunning,
    setNodeRunning,
    updateNodeData,
    markSaved,
    setSaving,
    isRightSidebarOpen,
    toggleRightSidebar,
    runHistory,
  } = useWorkflowStore();

  // Load initial workflow
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

      // Optimistically set all nodes to running
      const nodesToRun = scope === "FULL"
        ? nodes
        : nodes.filter((n) => selectedIds?.includes(n.id));

      for (const node of nodesToRun) {
        setNodeRunning(node.id, true);
      }

      // Open right sidebar
      if (!isRightSidebarOpen) toggleRightSidebar();

      try {
        // Save first if not saved
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
          throw new Error(err.message ?? "Run failed");
        }

        const result = await response.json();

        // Update node data with results
        for (const [nodeId, nodeResult] of Object.entries(
          result.nodeResults as Record<string, { status: string; output?: { text?: string; imageUrl?: string }; error?: string }>
        )) {
          if (nodeResult.status === "SUCCESS" && nodeResult.output) {
            const updates: Record<string, unknown> = {
              isRunning: false,
              hasError: false,
            };

            if (nodeResult.output.text) {
              updates.outputText = nodeResult.output.text;
              updates.isExpanded = false;
            }
            if (nodeResult.output.imageUrl) {
              updates.outputUrl = nodeResult.output.imageUrl;
            }

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

        // Add to history
        if (result.run) {
          addRunToHistory(result.run);
        }

        // Refresh history from server
        fetchRunHistory();
      } catch (err) {
        console.error("Run failed:", err);
        // Clear running states on error
        for (const node of nodesToRun) {
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
      setRunning, setNodeRunning, updateNodeData,
      addRunToHistory, handleSave, isRightSidebarOpen, toggleRightSidebar,
    ]
  );

  const fetchRunHistory = useCallback(async () => {
    try {
      const response = await fetch(`/api/workflows/${workflowId}/runs`);
      if (response.ok) {
        const runs = await response.json();
        setRunHistory(runs);
      }
    } catch {
      // ignore
    }
  }, [workflowId, setRunHistory]);

  // Auto-save on interval
  useEffect(() => {
    const timer = setInterval(() => {
      const state = useWorkflowStore.getState();
      if (!state.isSaved && !state.isSaving && state.nodes.length > 0) {
        handleSave();
      }
    }, 30000); // 30s auto-save

    return () => clearInterval(timer);
  }, [handleSave]);

  return (
    <ReactFlowProvider>
      <div className="flex flex-col h-screen overflow-hidden bg-canvas">
        {/* Top toolbar */}
        <TopToolbar userId={userId} onSave={handleSave} onRun={handleRun} />

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden relative">
          {/* Left sidebar */}
          <div className="relative flex">
            <LeftSidebar />
          </div>

          {/* Canvas */}
          <main className="flex-1 overflow-hidden relative">
            <WorkflowCanvas />
          </main>

          {/* Right sidebar */}
          <div className="relative flex">
            <RightSidebar />
          </div>
        </div>
      </div>
    </ReactFlowProvider>
  );
}
