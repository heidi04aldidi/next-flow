"use client";

import { memo, useCallback } from "react";
import { Handle, Position, type NodeProps, useEdges } from "reactflow";
import { Film } from "lucide-react";
import Image from "next/image";
import { NodeShell } from "./NodeShell";
import { useWorkflowStore } from "@/lib/store/workflowStore";
import { cn } from "@/lib/utils";
import type { ExtractFrameNodeData } from "@/types";

const ExtractFrameNode = memo(({ id, data }: NodeProps<ExtractFrameNodeData>) => {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const edges = useEdges();

  const hasVideoInput = edges.some((e) => e.target === id && e.targetHandle === "video_url");
  const hasTimestampInput = edges.some((e) => e.target === id && e.targetHandle === "timestamp");

  return (
    <NodeShell
      nodeId={id}
      nodeType="extractFrameNode"
      label={data.label}
      icon={<Film className="w-3 h-3" />}
      isRunning={data.isRunning}
      hasError={data.hasError}
      minWidth={280}
    >
      {/* Video input */}
      <div className="relative flex items-center gap-2 mb-3">
        <Handle
          type="target"
          position={Position.Left}
          id="video_url"
          style={{ top: "50%" }}
        />
        <span className="text-[10px] text-text-muted ml-3">
          Video Input{" "}
          {hasVideoInput ? (
            <span className="text-accent-purple-light">← connected</span>
          ) : (
            <span className="text-red-400">*</span>
          )}
        </span>
      </div>

      {/* Timestamp input */}
      <div className="relative flex items-center gap-2">
        <Handle
          type="target"
          position={Position.Left}
          id="timestamp"
          style={{ top: "50%" }}
        />
        <div className="flex items-center gap-2 flex-1 ml-3">
          <label className="text-[10px] text-text-muted flex-shrink-0">Timestamp</label>
          <input
            type="text"
            value={data.timestamp}
            disabled={hasTimestampInput}
            onChange={(e) => updateNodeData(id, { timestamp: e.target.value })}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="50% or 3.5"
            className={cn(
              "flex-1 h-7 px-2 rounded-md text-xs",
              "bg-surface-elevated border border-white/5",
              "focus:outline-none focus:border-accent-purple/40 transition-colors",
              hasTimestampInput
                ? "opacity-50 cursor-not-allowed text-text-muted"
                : "text-text-primary hover:border-white/10"
            )}
          />
          {hasTimestampInput && (
            <span className="text-[9px] text-accent-purple-light whitespace-nowrap">← connected</span>
          )}
        </div>
      </div>

      <p className="text-[10px] text-text-muted ml-3 mt-1">
        Use "50%" for middle, or seconds (e.g., "3.5")
      </p>

      {/* Output frame preview */}
      {data.outputUrl && (
        <div className="mt-3 rounded-lg overflow-hidden border border-white/5">
          <Image
            src={data.outputUrl}
            alt="Extracted frame"
            width={280}
            height={140}
            className="w-full h-28 object-cover"
          />
          <div className="px-2 py-1 bg-surface border-t border-white/5">
            <p className="text-[10px] text-text-muted">Frame extracted</p>
          </div>
        </div>
      )}

      {data.hasError && (
        <p className="text-[11px] text-red-400 mt-2">{data.errorMessage ?? "Frame extraction failed"}</p>
      )}

      {/* Output handle */}
      <div className="flex justify-end mt-2">
        <span className="text-[10px] text-text-muted mr-2">image</span>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        style={{ top: "auto", bottom: "18px" }}
      />
    </NodeShell>
  );
});

ExtractFrameNode.displayName = "ExtractFrameNode";
export default ExtractFrameNode;
