"use client";

import { memo, useState } from "react";
import {
  History,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Layers,
} from "lucide-react";
import { cn, formatRelativeTime, formatDateTime, formatDuration, getNodeTypeLabel } from "@/lib/utils";
import { useWorkflowStore } from "@/lib/store/workflowStore";
import type { WorkflowRunRecord, NodeRunRecord, RunStatus, RunScope } from "@/types";

// ---- Status badge ----
function StatusBadge({ status }: { status: RunStatus }) {
  const map: Record<RunStatus, { color: string; icon: React.ReactNode; label: string }> = {
    SUCCESS: { color: "text-green-400 bg-green-500/10", icon: <CheckCircle2 className="w-3 h-3" />, label: "Success" },
    FAILED: { color: "text-red-400 bg-red-500/10", icon: <XCircle className="w-3 h-3" />, label: "Failed" },
    RUNNING: { color: "text-accent-purple bg-accent-glow", icon: <Clock className="w-3 h-3 animate-pulse" />, label: "Running" },
    PARTIAL: { color: "text-yellow-400 bg-yellow-500/10", icon: <AlertCircle className="w-3 h-3" />, label: "Partial" },
    CANCELLED: { color: "text-text-muted bg-white/5", icon: <XCircle className="w-3 h-3" />, label: "Cancelled" },
  };

  const cfg = map[status];
  return (
    <span className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium", cfg.color)}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ---- Scope badge ----
function ScopeBadge({ scope, nodeCount }: { scope: RunScope; nodeCount: number }) {
  const labels: Record<RunScope, string> = {
    FULL: "Full",
    PARTIAL: `${nodeCount} nodes`,
    SINGLE: "Single",
  };
  return (
    <span className="flex items-center gap-1 text-[10px] text-text-muted">
      <Layers className="w-2.5 h-2.5" />
      {labels[scope]}
    </span>
  );
}

// ---- Node run row ----
function NodeRunRow({ nodeRun, isLast }: { nodeRun: NodeRunRecord; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn("relative", !isLast && "pb-1")}>
      {/* Tree line */}
      {!isLast && (
        <div className="absolute left-2 top-5 bottom-0 w-px bg-white/5" />
      )}

      <div className="flex items-start gap-2">
        {/* Status dot */}
        <div
          className={cn(
            "w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 z-10",
            nodeRun.status === "SUCCESS" && "bg-green-500/20",
            nodeRun.status === "FAILED" && "bg-red-500/20",
            nodeRun.status === "RUNNING" && "bg-accent-purple/20",
            nodeRun.status === "PARTIAL" && "bg-yellow-500/20",
          )}
        >
          {nodeRun.status === "SUCCESS" && <CheckCircle2 className="w-2.5 h-2.5 text-green-400" />}
          {nodeRun.status === "FAILED" && <XCircle className="w-2.5 h-2.5 text-red-400" />}
          {nodeRun.status === "RUNNING" && <Clock className="w-2.5 h-2.5 text-accent-purple animate-pulse" />}
          {nodeRun.status === "PARTIAL" && <AlertCircle className="w-2.5 h-2.5 text-yellow-400" />}
        </div>

        <div className="flex-1 min-w-0">
          <button
            onClick={() => setExpanded((p) => !p)}
            className="w-full text-left"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-primary truncate">
                {nodeRun.nodeLabel ?? getNodeTypeLabel(nodeRun.nodeType)}
              </span>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                {nodeRun.durationMs != null && (
                  <span className="text-[10px] text-text-muted">{formatDuration(nodeRun.durationMs)}</span>
                )}
                <ChevronDown
                  className={cn("w-3 h-3 text-text-muted transition-transform", expanded && "rotate-180")}
                />
              </div>
            </div>
            <p className="text-[10px] text-text-muted">{getNodeTypeLabel(nodeRun.nodeType)}</p>
          </button>

          {expanded && (
            <div className="mt-1.5 space-y-1">
              {nodeRun.error && (
                <div className="px-2 py-1.5 rounded bg-red-500/10 border border-red-500/20">
                  <p className="text-[10px] text-red-400">{nodeRun.error}</p>
                </div>
              )}
              {nodeRun.outputs && (
                <div className="px-2 py-1.5 rounded bg-surface-elevated border border-white/5">
                  <p className="text-[10px] text-text-muted mb-0.5">Output:</p>
                  <p className="text-[11px] text-text-secondary break-all">
                    {typeof nodeRun.outputs === "object"
                      ? (
                          (nodeRun.outputs as Record<string, unknown>).text as string ??
                          (nodeRun.outputs as Record<string, unknown>).imageUrl as string ??
                          JSON.stringify(nodeRun.outputs).slice(0, 100)
                        )
                      : String(nodeRun.outputs).slice(0, 100)}
                    {JSON.stringify(nodeRun.outputs).length > 100 ? "…" : ""}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Run entry ----
function RunEntry({
  run,
  isSelected,
  onSelect,
}: {
  run: WorkflowRunRecord;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border transition-all duration-150 overflow-hidden",
        isSelected
          ? "border-accent-purple/40 bg-accent-glow"
          : "border-white/5 hover:border-white/10 bg-surface hover:bg-surface-elevated"
      )}
    >
      <button
        onClick={onSelect}
        className="w-full text-left px-3 py-2.5"
      >
        <div className="flex items-center justify-between mb-1">
          <StatusBadge status={run.status} />
          <span className="text-[10px] text-text-muted">
            {formatRelativeTime(run.startedAt)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <ScopeBadge scope={run.scope} nodeCount={run.selectedNodes.length} />
          {run.durationMs != null && (
            <span className="text-[10px] text-text-muted">{formatDuration(run.durationMs)}</span>
          )}
        </div>
        <p className="text-[10px] text-text-muted mt-0.5">
          {formatDateTime(run.startedAt)}
        </p>
      </button>

      {/* Node-level details */}
      {isSelected && run.nodeRuns.length > 0 && (
        <div className="border-t border-white/5 px-3 py-2.5 space-y-2">
          <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">
            Node Execution Details
          </p>
          {run.nodeRuns.map((nr, i) => (
            <NodeRunRow key={nr.id} nodeRun={nr} isLast={i === run.nodeRuns.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Right sidebar ----
const RightSidebar = memo(() => {
  const { isRightSidebarOpen, toggleRightSidebar, runHistory, selectedRunId, setSelectedRunId } =
    useWorkflowStore();

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={toggleRightSidebar}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 z-30",
          "w-5 h-10 rounded-l-lg",
          "bg-surface border border-r-0 border-subtle",
          "flex items-center justify-center",
          "hover:bg-surface-elevated transition-colors",
          "text-text-muted hover:text-text-primary",
          isRightSidebarOpen ? "right-80" : "right-0"
        )}
      >
        {isRightSidebarOpen ? (
          <ChevronRight className="w-3 h-3" />
        ) : (
          <ChevronLeft className="w-3 h-3" />
        )}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col h-full bg-surface border-l border-subtle",
          "transition-all duration-200 ease-out overflow-hidden flex-shrink-0",
          isRightSidebarOpen ? "w-80" : "w-0"
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-subtle flex-shrink-0">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-text-secondary" />
            <h2 className="text-sm font-semibold text-text-primary">Run History</h2>
          </div>
          {runHistory.length > 0 && (
            <span className="text-[10px] text-text-muted bg-surface-elevated px-2 py-0.5 rounded-full">
              {runHistory.length}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 min-w-80">
          {runHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <History className="w-8 h-8 text-text-muted mb-2 opacity-40" />
              <p className="text-sm text-text-muted">No runs yet</p>
              <p className="text-xs text-text-muted mt-1 opacity-60">
                Execute your workflow to see history
              </p>
            </div>
          ) : (
            runHistory.map((run) => (
              <RunEntry
                key={run.id}
                run={run}
                isSelected={selectedRunId === run.id}
                onSelect={() =>
                  setSelectedRunId(selectedRunId === run.id ? undefined : run.id)
                }
              />
            ))
          )}
        </div>
      </aside>
    </>
  );
});

RightSidebar.displayName = "RightSidebar";
export default RightSidebar;
