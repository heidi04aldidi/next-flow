"use client";

import { memo, useCallback } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { Type } from "lucide-react";
import { NodeShell } from "./NodeShell";
import { useWorkflowStore } from "@/lib/store/workflowStore";
import type { TextNodeData } from "@/types";

const TextNode = memo(({ id, data }: NodeProps<TextNodeData>) => {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateNodeData(id, { content: e.target.value });
    },
    [id, updateNodeData]
  );

  return (
    <NodeShell
      nodeId={id}
      nodeType="textNode"
      label={data.label}
      icon={<Type className="w-3 h-3" />}
      isRunning={data.isRunning}
      hasError={data.hasError}
      minWidth={280}
    >
      <textarea
        className="
          w-full h-28 resize-none rounded-lg
          bg-surface-elevated border border-white/5
          text-text-primary text-xs placeholder:text-text-muted
          px-3 py-2.5 focus:outline-none focus:border-accent-purple/50
          transition-colors leading-relaxed
        "
        placeholder="Enter text…"
        value={data.content}
        onChange={handleChange}
        // Prevent React Flow from interpreting keyboard shortcuts
        onKeyDown={(e) => e.stopPropagation()}
      />

      {/* Output handle */}
      <div className="flex justify-end mt-2">
        <span className="text-[10px] text-text-muted mr-2">output</span>
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

TextNode.displayName = "TextNode";
export default TextNode;
