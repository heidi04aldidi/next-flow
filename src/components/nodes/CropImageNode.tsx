"use client";

import { memo, useCallback } from "react";
import { Handle, Position, type NodeProps, useEdges } from "reactflow";
import { Crop, Image as ImageIcon } from "lucide-react";
import Image from "next/image";
import { NodeShell } from "./NodeShell";
import { useWorkflowStore } from "@/lib/store/workflowStore";
import { cn } from "@/lib/utils";
import type { CropImageNodeData } from "@/types";

interface PercentInputProps {
  label: string;
  handleId: string;
  value: number;
  connected: boolean;
  onChange: (v: number) => void;
}

function PercentInput({ label, handleId, value, connected, onChange }: PercentInputProps) {
  return (
    <div className="relative flex items-center gap-1">
      <Handle
        type="target"
        position={Position.Left}
        id={handleId}
        style={{ top: "50%" }}
      />
      <label className="text-[10px] text-text-muted w-16 ml-3 flex-shrink-0">{label}</label>
      <div className="flex items-center gap-1 flex-1">
        <input
          type="number"
          min={0}
          max={100}
          value={value}
          disabled={connected}
          onChange={(e) => onChange(Number(e.target.value))}
          onKeyDown={(e) => e.stopPropagation()}
          className={cn(
            "w-full h-7 px-2 rounded-md text-xs text-right",
            "bg-surface-elevated border border-white/5",
            "focus:outline-none focus:border-accent-purple/40 transition-colors",
            connected
              ? "opacity-50 cursor-not-allowed text-text-muted"
              : "text-text-primary hover:border-white/10"
          )}
        />
        <span className="text-[10px] text-text-muted">%</span>
        {connected && (
          <span className="text-[9px] text-accent-purple-light whitespace-nowrap">← connected</span>
        )}
      </div>
    </div>
  );
}

const CropImageNode = memo(({ id, data }: NodeProps<CropImageNodeData>) => {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const edges = useEdges();

  const isConnected = (handleId: string) =>
    edges.some((e) => e.target === id && e.targetHandle === handleId);

  const hasImageInput = isConnected("image_url");
  const hasXInput = isConnected("x_percent");
  const hasYInput = isConnected("y_percent");
  const hasWidthInput = isConnected("width_percent");
  const hasHeightInput = isConnected("height_percent");

  const update = useCallback(
    (field: keyof CropImageNodeData, value: number) => {
      updateNodeData(id, { [field]: value });
    },
    [id, updateNodeData]
  );

  return (
    <NodeShell
      nodeId={id}
      nodeType="cropImageNode"
      label={data.label}
      icon={<Crop className="w-3 h-3" />}
      isRunning={data.isRunning}
      hasError={data.hasError}
      minWidth={300}
    >
      {/* Image input handle */}
      <div className="relative flex items-center gap-2 mb-3">
        <Handle
          type="target"
          position={Position.Left}
          id="image_url"
          style={{ top: "50%" }}
        />
        <span className="text-[10px] text-text-muted ml-3">
          Image Input{" "}
          {hasImageInput ? (
            <span className="text-accent-purple-light">← connected</span>
          ) : (
            <span className="text-red-400">*</span>
          )}
        </span>
      </div>

      {/* Crop parameters */}
      <div className="space-y-2 mb-3">
        <PercentInput
          label="X offset"
          handleId="x_percent"
          value={data.xPercent}
          connected={hasXInput}
          onChange={(v) => update("xPercent", v)}
        />
        <PercentInput
          label="Y offset"
          handleId="y_percent"
          value={data.yPercent}
          connected={hasYInput}
          onChange={(v) => update("yPercent", v)}
        />
        <PercentInput
          label="Width"
          handleId="width_percent"
          value={data.widthPercent}
          connected={hasWidthInput}
          onChange={(v) => update("widthPercent", v)}
        />
        <PercentInput
          label="Height"
          handleId="height_percent"
          value={data.heightPercent}
          connected={hasHeightInput}
          onChange={(v) => update("heightPercent", v)}
        />
      </div>

      {/* Output preview */}
      {data.outputUrl && (
        <div className="rounded-lg overflow-hidden border border-white/5">
          <Image
            src={data.outputUrl}
            alt="Cropped output"
            width={280}
            height={140}
            className="w-full h-28 object-cover"
          />
        </div>
      )}

      {data.hasError && (
        <p className="text-[11px] text-red-400 mt-2">{data.errorMessage ?? "Crop failed"}</p>
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

CropImageNode.displayName = "CropImageNode";
export default CropImageNode;
