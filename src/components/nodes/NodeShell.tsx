"use client";

import { memo, useState, useCallback } from "react";
import { type NodeProps } from "reactflow";
import { MoreHorizontal, Trash2, Copy, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkflowStore } from "@/lib/store/workflowStore";
import { getNodeTypeColor } from "@/lib/utils";
import type { NodeType, FlowNodeData } from "@/types";

interface NodeShellProps {
  nodeId: string;
  nodeType: NodeType;
  label: string;
  icon?: React.ReactNode;
  isRunning?: boolean;
  hasError?: boolean;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
  minWidth?: number;
  className?: string;
}

export function NodeShell({
  nodeId,
  nodeType,
  label,
  icon,
  isRunning,
  hasError,
  children,
  headerRight,
  minWidth = 280,
  className,
}: NodeShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { deleteNode, duplicateNode } = useWorkflowStore();
  const accentColor = getNodeTypeColor(nodeType);

  return (
    <div
      className={cn(
        "rounded-xl border border-node-border bg-node-bg shadow-node",
        "transition-all duration-200",
        isRunning && "node-running border-accent-purple/60",
        hasError && "border-red-500/50",
        className
      )}
      style={{ minWidth }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2.5 rounded-t-xl border-b border-white/5"
        style={{ background: "rgba(26,26,32,0.8)" }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {icon && (
            <div
              className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
              style={{ background: `${accentColor}22` }}
            >
              <span style={{ color: accentColor }}>{icon}</span>
            </div>
          )}
          <span className="text-xs font-medium text-text-secondary truncate">
            {label}
          </span>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {headerRight}

          {/* Menu */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((p) => !p)}
              className="w-6 h-6 rounded flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/5 transition-all"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>

            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 top-7 z-50 w-36 py-1 bg-surface-overlay border border-subtle rounded-lg shadow-xl">
                  <button
                    onClick={() => { duplicateNode(nodeId); setMenuOpen(false); }}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                    Duplicate
                  </button>
                  <div className="my-1 border-t border-subtle" />
                  <button
                    onClick={() => { deleteNode(nodeId); setMenuOpen(false); }}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-3">{children}</div>
    </div>
  );
}

// ---- Handle label component ----
interface HandleLabelProps {
  label: string;
  isConnected?: boolean;
  side: "left" | "right";
}

export function HandleLabel({ label, isConnected, side }: HandleLabelProps) {
  return (
    <span
      className={cn(
        "text-[10px] text-text-muted select-none pointer-events-none",
        side === "left" ? "ml-3" : "mr-3",
        isConnected && "text-accent-purple-light"
      )}
    >
      {label}
    </span>
  );
}
