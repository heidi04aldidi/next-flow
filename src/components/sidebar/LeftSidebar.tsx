"use client";

import { memo, useCallback, useState } from "react";
import {
  Type,
  ImageIcon,
  Video,
  Brain,
  Crop,
  Film,
  Search,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkflowStore } from "@/lib/store/workflowStore";
import type { NodeType } from "@/types";
import {
  SAMPLE_WORKFLOW_NODES,
  SAMPLE_WORKFLOW_EDGES,
} from "@/lib/utils/sampleWorkflow";

interface NodeButtonConfig {
  type: NodeType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const NODE_TYPES: NodeButtonConfig[] = [
  {
    type: "textNode",
    label: "Text",
    description: "Text input with output handle",
    icon: <Type className="w-4 h-4" />,
    color: "#64748b",
  },
  {
    type: "uploadImageNode",
    label: "Upload Image",
    description: "Upload and preview an image",
    icon: <ImageIcon className="w-4 h-4" />,
    color: "#3b82f6",
  },
  {
    type: "uploadVideoNode",
    label: "Upload Video",
    description: "Upload and preview a video",
    icon: <Video className="w-4 h-4" />,
    color: "#8b5cf6",
  },
  {
    type: "llmNode",
    label: "Run Any LLM",
    description: "Execute Gemini models",
    icon: <Brain className="w-4 h-4" />,
    color: "#7c5cfa",
  },
  {
    type: "cropImageNode",
    label: "Crop Image",
    description: "Crop with FFmpeg via Trigger.dev",
    icon: <Crop className="w-4 h-4" />,
    color: "#06b6d4",
  },
  {
    type: "extractFrameNode",
    label: "Extract Frame",
    description: "Extract video frame via FFmpeg",
    icon: <Film className="w-4 h-4" />,
    color: "#10b981",
  },
];

const NodeButton = memo(
  ({ config, onAdd }: { config: NodeButtonConfig; onAdd: (type: NodeType) => void }) => {
    const handleDragStart = useCallback(
      (e: React.DragEvent) => {
        e.dataTransfer.setData("application/nextflow-node", config.type);
        e.dataTransfer.effectAllowed = "move";
      },
      [config.type]
    );

    return (
      <div
        draggable
        onDragStart={handleDragStart}
        onClick={() => onAdd(config.type)}
        className="
          group flex items-center gap-3 p-2.5 rounded-xl
          border border-white/5 hover:border-white/12
          bg-surface hover:bg-surface-elevated
          cursor-pointer transition-all duration-150
          active:scale-95
        "
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
          style={{ background: `${config.color}22`, color: config.color }}
        >
          {config.icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-text-primary group-hover:text-white transition-colors">
            {config.label}
          </p>
          <p className="text-[10px] text-text-muted truncate">{config.description}</p>
        </div>
      </div>
    );
  }
);
NodeButton.displayName = "NodeButton";

const LeftSidebar = memo(() => {
  const { isLeftSidebarOpen, toggleLeftSidebar, addNode, loadWorkflow, workflowId } =
    useWorkflowStore();
  const [search, setSearch] = useState("");

  const filtered = NODE_TYPES.filter(
    (n) =>
      !search ||
      n.label.toLowerCase().includes(search.toLowerCase()) ||
      n.description.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = useCallback(
    (type: NodeType) => {
      // Drop in center-ish area with slight randomness
      addNode(type, {
        x: 300 + Math.random() * 200,
        y: 150 + Math.random() * 200,
      });
    },
    [addNode]
  );

  const loadSample = useCallback(() => {
    loadWorkflow({
      id: workflowId,
      name: "Product Marketing Kit Generator",
      nodes: SAMPLE_WORKFLOW_NODES as never,
      edges: SAMPLE_WORKFLOW_EDGES,
    });
  }, [loadWorkflow, workflowId]);

  return (
    <>
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col h-full bg-surface border-r border-subtle",
          "transition-all duration-200 ease-out overflow-hidden flex-shrink-0",
          isLeftSidebarOpen ? "w-64" : "w-0"
        )}
      >
        <div className="flex-1 overflow-y-auto p-3 space-y-4 min-w-64">
          {/* Header */}
          <div className="pt-1">
            <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
              Nodes
            </h2>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted" />
              <input
                type="text"
                placeholder="Search nodes…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                className="
                  w-full pl-7 pr-3 py-1.5 rounded-lg text-xs
                  bg-surface-elevated border border-white/5
                  text-text-primary placeholder:text-text-muted
                  focus:outline-none focus:border-accent-purple/40
                  transition-colors
                "
              />
            </div>
          </div>

          {/* Quick Access */}
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">
              Quick Access
            </p>
            <div className="space-y-1.5">
              {filtered.map((config) => (
                <NodeButton key={config.type} config={config} onAdd={handleAdd} />
              ))}
            </div>
          </div>

          {/* Sample Workflow */}
          <div className="pt-2 border-t border-subtle">
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">
              Templates
            </p>
            <button
              onClick={loadSample}
              className="
                w-full flex items-center gap-3 p-2.5 rounded-xl
                border border-accent-purple/20 hover:border-accent-purple/40
                bg-accent-glow hover:bg-accent-purple/10
                text-left transition-all duration-150 group
              "
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent-purple/20 flex-shrink-0">
                <Sparkles className="w-4 h-4 text-accent-purple-light" />
              </div>
              <div>
                <p className="text-xs font-medium text-accent-purple-light">
                  Marketing Kit
                </p>
                <p className="text-[10px] text-text-muted">
                  Full sample workflow
                </p>
              </div>
            </button>
          </div>
        </div>
      </aside>

      {/* Toggle button */}
      <button
        onClick={toggleLeftSidebar}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 z-30",
          "w-5 h-10 rounded-r-lg",
          "bg-surface border border-l-0 border-subtle",
          "flex items-center justify-center",
          "hover:bg-surface-elevated transition-colors",
          "text-text-muted hover:text-text-primary",
          isLeftSidebarOpen ? "left-64" : "left-0"
        )}
      >
        {isLeftSidebarOpen ? (
          <ChevronLeft className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
      </button>
    </>
  );
});

LeftSidebar.displayName = "LeftSidebar";
export default LeftSidebar;
