"use client";

import { memo, useCallback, useState } from "react";
import { Handle, Position, type NodeProps, useEdges } from "reactflow";
import { Brain, ChevronDown, ChevronUp, Play, Loader2 } from "lucide-react";
import { NodeShell } from "./NodeShell";
import { useWorkflowStore } from "@/lib/store/workflowStore";
import { cn, truncate } from "@/lib/utils";
import type { LLMNodeData, GeminiModel } from "@/types";

const GEMINI_MODELS: { value: GeminiModel; label: string; speed: string }[] = [
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash", speed: "Fast" },
  { value: "gemini-2.0-flash-thinking-exp", label: "Gemini 2.0 Flash Thinking", speed: "Experimental" },
  { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro", speed: "Powerful" },
  { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash", speed: "Fast" },
  { value: "gemini-1.5-flash-8b", label: "Gemini 1.5 Flash 8B", speed: "Fastest" },
];

const LLMNode = memo(({ id, data }: NodeProps<LLMNodeData>) => {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const edges = useEdges();
  const [modelOpen, setModelOpen] = useState(false);

  // Check which input handles have connections
  const hasSystemPromptConnection = edges.some(
    (e) => e.target === id && e.targetHandle === "system_prompt"
  );
  const hasUserMessageConnection = edges.some(
    (e) => e.target === id && e.targetHandle === "user_message"
  );
  const hasImagesConnection = edges.some(
    (e) => e.target === id && e.targetHandle === "images"
  );

  const selectedModel = GEMINI_MODELS.find((m) => m.value === data.model) ?? GEMINI_MODELS[0];

  const toggleExpand = useCallback(() => {
    updateNodeData(id, { isExpanded: !data.isExpanded });
  }, [id, data.isExpanded, updateNodeData]);

  return (
    <NodeShell
      nodeId={id}
      nodeType="llmNode"
      label={data.label}
      icon={<Brain className="w-3 h-3" />}
      isRunning={data.isRunning}
      hasError={data.hasError}
      minWidth={300}
    >
      {/* Model selector */}
      <div className="relative mb-3">
        <button
          onClick={() => setModelOpen((p) => !p)}
          className="
            w-full flex items-center justify-between px-2.5 py-2
            bg-surface-elevated border border-white/5
            rounded-lg text-xs text-text-primary
            hover:border-white/10 transition-colors
          "
        >
          <span>{selectedModel.label}</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-text-muted">{selectedModel.speed}</span>
            <ChevronDown className="w-3 h-3 text-text-muted" />
          </div>
        </button>

        {modelOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setModelOpen(false)} />
            <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-surface-overlay border border-subtle rounded-lg shadow-xl py-1">
              {GEMINI_MODELS.map((model) => (
                <button
                  key={model.value}
                  onClick={() => {
                    updateNodeData(id, { model: model.value });
                    setModelOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors",
                    model.value === data.model
                      ? "text-accent-purple-light bg-accent-glow"
                      : "text-text-secondary hover:text-text-primary hover:bg-white/5"
                  )}
                >
                  <span>{model.label}</span>
                  <span className="text-text-muted text-[10px]">{model.speed}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Input handles */}
      <div className="space-y-2">
        {/* System Prompt */}
        <div className="relative flex items-center">
          <Handle
            type="target"
            position={Position.Left}
            id="system_prompt"
            style={{ top: "50%" }}
          />
          <div className="w-full">
            <label className="text-[10px] text-text-muted mb-1 block ml-3">
              System Prompt
              {hasSystemPromptConnection && (
                <span className="ml-1 text-accent-purple-light">← connected</span>
              )}
            </label>
            <textarea
              className={cn(
                "w-full h-12 resize-none rounded-md",
                "bg-surface-elevated border border-white/5",
                "text-xs placeholder:text-text-muted",
                "px-2.5 py-1.5 focus:outline-none focus:border-accent-purple/40",
                "transition-colors leading-relaxed",
                hasSystemPromptConnection
                  ? "text-text-muted opacity-50 cursor-not-allowed"
                  : "text-text-primary"
              )}
              placeholder={hasSystemPromptConnection ? "Using connected input" : "Optional system instructions…"}
              value={data.systemPromptOverride ?? ""}
              disabled={hasSystemPromptConnection}
              onChange={(e) => updateNodeData(id, { systemPromptOverride: e.target.value })}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
        </div>

        {/* User Message */}
        <div className="relative flex items-center">
          <Handle
            type="target"
            position={Position.Left}
            id="user_message"
            style={{ top: "50%" }}
          />
          <div className="w-full">
            <label className="text-[10px] text-text-muted mb-1 block ml-3">
              User Message
              {hasUserMessageConnection && (
                <span className="ml-1 text-accent-purple-light">← connected</span>
              )}
              <span className="ml-1 text-red-400">*</span>
            </label>
            <textarea
              className={cn(
                "w-full h-16 resize-none rounded-md",
                "bg-surface-elevated border border-white/5",
                "text-xs placeholder:text-text-muted",
                "px-2.5 py-1.5 focus:outline-none focus:border-accent-purple/40",
                "transition-colors leading-relaxed",
                hasUserMessageConnection
                  ? "text-text-muted opacity-50 cursor-not-allowed"
                  : "text-text-primary"
              )}
              placeholder={hasUserMessageConnection ? "Using connected input" : "Your message to the LLM…"}
              value={data.userMessageOverride ?? ""}
              disabled={hasUserMessageConnection}
              onChange={(e) => updateNodeData(id, { userMessageOverride: e.target.value })}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
        </div>

        {/* Images */}
        <div className="flex items-center gap-2 ml-3">
          <Handle
            type="target"
            position={Position.Left}
            id="images"
            style={{ top: "50%" }}
          />
          <span className="text-[10px] text-text-muted">
            Images{" "}
            {hasImagesConnection && (
              <span className="text-accent-purple-light">← connected</span>
            )}
          </span>
        </div>
      </div>

      {/* Output / Result */}
      {data.outputText ? (
        <div className="mt-3 rounded-lg bg-surface border border-white/5 overflow-hidden">
          <div
            className="flex items-center justify-between px-2.5 py-1.5 bg-surface-elevated border-b border-white/5 cursor-pointer"
            onClick={toggleExpand}
          >
            <span className="text-[10px] text-text-secondary font-medium">Output</span>
            {data.isExpanded ? (
              <ChevronUp className="w-3 h-3 text-text-muted" />
            ) : (
              <ChevronDown className="w-3 h-3 text-text-muted" />
            )}
          </div>
          <div
            className={cn(
              "px-2.5 py-2 text-xs text-text-primary leading-relaxed overflow-auto",
              data.isExpanded ? "max-h-60" : "max-h-16"
            )}
          >
            {data.isExpanded ? data.outputText : truncate(data.outputText, 120)}
          </div>
        </div>
      ) : data.isRunning ? (
        <div className="mt-3 flex items-center gap-2 px-2.5 py-2 rounded-lg bg-surface border border-white/5">
          <Loader2 className="w-3 h-3 text-accent-purple animate-spin" />
          <span className="text-xs text-text-secondary">Running…</span>
        </div>
      ) : data.hasError ? (
        <div className="mt-3 px-2.5 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-xs text-red-400">{data.errorMessage ?? "Execution failed"}</p>
        </div>
      ) : null}

      {/* Output source handle */}
      <div className="flex justify-end mt-2">
        <span className="text-[10px] text-text-muted mr-2">text output</span>
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

LLMNode.displayName = "LLMNode";
export default LLMNode;
