"use client";

import {
  useCallback,
  useEffect,
  useRef,
  memo,
} from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useReactFlow,
  type OnConnectEnd,
  type OnConnectStart,
} from "reactflow";
import "reactflow/dist/style.css";

import { useWorkflowStore } from "@/lib/store/workflowStore";
import TextNode from "@/components/nodes/TextNode";
import UploadImageNode from "@/components/nodes/UploadImageNode";
import UploadVideoNode from "@/components/nodes/UploadVideoNode";
import LLMNode from "@/components/nodes/LLMNode";
import CropImageNode from "@/components/nodes/CropImageNode";
import ExtractFrameNode from "@/components/nodes/ExtractFrameNode";
import type { NodeType } from "@/types";

// Register custom node types
const nodeTypes = {
  textNode: TextNode,
  uploadImageNode: UploadImageNode,
  uploadVideoNode: UploadVideoNode,
  llmNode: LLMNode,
  cropImageNode: CropImageNode,
  extractFrameNode: ExtractFrameNode,
};

const WorkflowCanvas = memo(() => {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    undo,
    redo,
    deleteNode,
    setViewport,
  } = useWorkflowStore();

  const { screenToFlowPosition, fitView } = useReactFlow();
  const connectingNodeId = useRef<string | null>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;
      if (isInput) return;

      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        // React Flow handles node deletion via onNodesChange
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  // Drop node from sidebar
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const nodeType = e.dataTransfer.getData("application/nextflow-node") as NodeType;
      if (!nodeType) return;

      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      addNode(nodeType, position);
    },
    [screenToFlowPosition, addNode]
  );

  const onConnectStart: OnConnectStart = useCallback((_, { nodeId }) => {
    connectingNodeId.current = nodeId;
  }, []);

  const onConnectEnd: OnConnectEnd = useCallback(() => {
    connectingNodeId.current = null;
  }, []);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onMoveEnd={(_, viewport) => setViewport(viewport)}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        deleteKeyCode={["Delete", "Backspace"]}
        snapToGrid={false}
        connectionRadius={30}
        proOptions={{ hideAttribution: true }}
        className="bg-canvas"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.5}
          color="rgba(255,255,255,0.12)"
        />

        <Controls
          position="bottom-left"
          className="ml-4 mb-4"
          showInteractive={false}
        />

        <MiniMap
          position="bottom-right"
          className="mr-4 mb-4"
          nodeStrokeWidth={2}
          zoomable
          pannable
        />
      </ReactFlow>
    </div>
  );
});

WorkflowCanvas.displayName = "WorkflowCanvas";
export default WorkflowCanvas;
