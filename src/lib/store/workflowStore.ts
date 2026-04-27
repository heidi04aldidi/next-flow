"use client";

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type Viewport,
} from "reactflow";
import { v4 as uuidv4 } from "uuid";
import type {
  FlowNode,
  FlowEdge,
  WorkflowRunRecord,
  RunScope,
  NodeType,
  TextNodeData,
  UploadImageNodeData,
  UploadVideoNodeData,
  LLMNodeData,
  CropImageNodeData,
  ExtractFrameNodeData,
} from "@/types";
import { wouldCreateCycle, isValidConnection } from "@/lib/utils/dag";
import { deepClone } from "@/lib/utils";

// ---- History snapshot for undo/redo ----
interface HistorySnapshot {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

// ---- Store State ----
interface WorkflowStore {
  // Identity
  workflowId: string;
  workflowName: string;
  isSaved: boolean;
  isSaving: boolean;
  lastSavedAt?: Date;

  // Flow state
  nodes: FlowNode[];
  edges: FlowEdge[];
  viewport: Viewport;

  // Undo/redo
  history: HistorySnapshot[];
  historyIndex: number;

  // Selection
  selectedNodeIds: Set<string>;

  // Execution
  isRunning: boolean;
  runningNodeIds: Set<string>;
  currentRunId?: string;

  // Run history (right sidebar)
  runHistory: WorkflowRunRecord[];
  selectedRunId?: string;

  // UI state
  isLeftSidebarOpen: boolean;
  isRightSidebarOpen: boolean;
  showSampleWorkflow: boolean;

  // Actions — Nodes
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (type: NodeType, position?: { x: number; y: number }) => void;
  updateNodeData: (nodeId: string, data: Partial<FlowNode["data"]>) => void;
  deleteNode: (nodeId: string) => void;
  duplicateNode: (nodeId: string) => void;

  // Actions — History
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;

  // Actions — Workflow
  setWorkflowName: (name: string) => void;
  setWorkflowId: (id: string) => void;
  setNodes: (nodes: FlowNode[]) => void;
  setEdges: (edges: FlowEdge[]) => void;
  setViewport: (viewport: Viewport) => void;
  markSaved: () => void;
  markUnsaved: () => void;
  setSaving: (saving: boolean) => void;
  loadWorkflow: (workflow: {
    id: string;
    name: string;
    nodes: FlowNode[];
    edges: FlowEdge[];
    viewport?: Viewport;
  }) => void;
  resetWorkflow: () => void;

  // Actions — Execution
  setRunning: (running: boolean) => void;
  setNodeRunning: (nodeId: string, running: boolean) => void;
  setCurrentRunId: (runId?: string) => void;

  // Actions — Selection
  toggleNodeSelection: (nodeId: string) => void;
  clearSelection: () => void;
  selectAll: () => void;

  // Actions — Run History
  setRunHistory: (runs: WorkflowRunRecord[]) => void;
  addRunToHistory: (run: WorkflowRunRecord) => void;
  updateRunInHistory: (run: WorkflowRunRecord) => void;
  setSelectedRunId: (id?: string) => void;

  // Actions — UI
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  setShowSampleWorkflow: (show: boolean) => void;
}

// ---- Default node data factories ----
const createDefaultNodeData = (type: NodeType): FlowNode["data"] => {
  switch (type) {
    case "textNode":
      return { label: "Text", content: "" } as TextNodeData;
    case "uploadImageNode":
      return { label: "Upload Image" } as UploadImageNodeData;
    case "uploadVideoNode":
      return { label: "Upload Video" } as UploadVideoNodeData;
    case "llmNode":
      return {
        label: "LLM",
        model: "gemini-2.0-flash",
        isExpanded: false,
      } as LLMNodeData;
    case "cropImageNode":
      return {
        label: "Crop Image",
        xPercent: 0,
        yPercent: 0,
        widthPercent: 100,
        heightPercent: 100,
      } as CropImageNodeData;
    case "extractFrameNode":
      return { label: "Extract Frame", timestamp: "50%" } as ExtractFrameNodeData;
  }
};

const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };

// ---- Store ----
export const useWorkflowStore = create<WorkflowStore>()(
  subscribeWithSelector((set, get) => ({
    workflowId: uuidv4(),
    workflowName: "Untitled Workflow",
    isSaved: false,
    isSaving: false,
    nodes: [],
    edges: [],
    viewport: DEFAULT_VIEWPORT,
    history: [],
    historyIndex: -1,
    selectedNodeIds: new Set(),
    isRunning: false,
    runningNodeIds: new Set(),
    runHistory: [],
    isLeftSidebarOpen: true,
    isRightSidebarOpen: false,
    showSampleWorkflow: false,

    // ---- Nodes ----
    onNodesChange: (changes) => {
      set((state) => ({
        nodes: applyNodeChanges(changes, state.nodes) as FlowNode[],
        isSaved: false,
      }));
    },

    onEdgesChange: (changes) => {
      set((state) => ({
        edges: applyEdgeChanges(changes, state.edges),
        isSaved: false,
      }));
    },

    onConnect: (connection) => {
      const state = get();
      if (!connection.source || !connection.target) return;

      // Cycle detection
      if (wouldCreateCycle(state.nodes, state.edges, connection.source, connection.target)) {
        console.warn("Connection would create a cycle — blocked");
        return;
      }

      // Type validation
      if (connection.targetHandle) {
        const sourceNode = state.nodes.find((n) => n.id === connection.source);
        if (sourceNode) {
          const result = isValidConnection(
            sourceNode.type as NodeType,
            connection.targetHandle
          );
          if (!result.valid) {
            console.warn("Invalid connection:", result.reason);
            return;
          }
        }
      }

      // Remove existing connections to the same target handle (single-connection handles)
      const multiHandles = ["images"]; // handles that accept multiple connections
      let newEdges = state.edges;
      if (connection.targetHandle && !multiHandles.includes(connection.targetHandle)) {
        newEdges = state.edges.filter(
          (e) =>
            !(e.target === connection.target && e.targetHandle === connection.targetHandle)
        );
      }

      state.pushHistory();

      const edge: FlowEdge = {
        ...connection,
        id: `e-${connection.source}-${connection.target}-${connection.targetHandle ?? "default"}`,
        type: "smoothstep",
        animated: true,
        style: {
          stroke: "rgba(124, 92, 250, 0.8)",
          strokeWidth: 2,
        },
      };

      set({
        edges: addEdge(edge, newEdges),
        isSaved: false,
      });
    },

    addNode: (type, position) => {
      const state = get();
      state.pushHistory();

      // Compute auto-position in canvas center if not provided
      const pos = position ?? {
        x: 150 + Math.random() * 100,
        y: 150 + Math.random() * 100,
      };

      const newNode: FlowNode = {
        id: uuidv4(),
        type,
        position: pos,
        data: createDefaultNodeData(type),
      };

      set((s) => ({
        nodes: [...s.nodes, newNode],
        isSaved: false,
      }));
    },

    updateNodeData: (nodeId, data) => {
      set((state) => ({
        nodes: state.nodes.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
        ),
        isSaved: false,
      }));
    },

    deleteNode: (nodeId) => {
      const state = get();
      state.pushHistory();
      set((s) => ({
        nodes: s.nodes.filter((n) => n.id !== nodeId),
        edges: s.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
        isSaved: false,
      }));
    },

    duplicateNode: (nodeId) => {
      const state = get();
      const node = state.nodes.find((n) => n.id === nodeId);
      if (!node) return;
      state.pushHistory();

      const newNode: FlowNode = {
        ...deepClone(node),
        id: uuidv4(),
        position: { x: node.position.x + 40, y: node.position.y + 40 },
        selected: false,
      };

      set((s) => ({
        nodes: [...s.nodes, newNode],
        isSaved: false,
      }));
    },

    // ---- History ----
    pushHistory: () => {
      const { nodes, edges, history, historyIndex } = get();
      const snapshot: HistorySnapshot = {
        nodes: deepClone(nodes),
        edges: deepClone(edges),
      };
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(snapshot);
      // Max 50 history entries
      if (newHistory.length > 50) newHistory.shift();
      set({ history: newHistory, historyIndex: newHistory.length - 1 });
    },

    undo: () => {
      const { historyIndex, history } = get();
      if (historyIndex <= 0) return;
      const prev = history[historyIndex - 1];
      set({
        nodes: deepClone(prev.nodes),
        edges: deepClone(prev.edges),
        historyIndex: historyIndex - 1,
        isSaved: false,
      });
    },

    redo: () => {
      const { historyIndex, history } = get();
      if (historyIndex >= history.length - 1) return;
      const next = history[historyIndex + 1];
      set({
        nodes: deepClone(next.nodes),
        edges: deepClone(next.edges),
        historyIndex: historyIndex + 1,
        isSaved: false,
      });
    },

    // ---- Workflow ----
    setWorkflowName: (name) => set({ workflowName: name, isSaved: false }),
    setWorkflowId: (id) => set({ workflowId: id }),
    setNodes: (nodes) => set({ nodes }),
    setEdges: (edges) => set({ edges }),
    setViewport: (viewport) => set({ viewport }),
    markSaved: () => set({ isSaved: true, lastSavedAt: new Date() }),
    markUnsaved: () => set({ isSaved: false }),
    setSaving: (saving) => set({ isSaving: saving }),

    loadWorkflow: ({ id, name, nodes, edges, viewport }) => {
      set({
        workflowId: id,
        workflowName: name,
        nodes,
        edges,
        viewport: viewport ?? DEFAULT_VIEWPORT,
        isSaved: true,
        history: [],
        historyIndex: -1,
      });
    },

    resetWorkflow: () => {
      set({
        workflowId: uuidv4(),
        workflowName: "Untitled Workflow",
        nodes: [],
        edges: [],
        viewport: DEFAULT_VIEWPORT,
        isSaved: false,
        history: [],
        historyIndex: -1,
        selectedNodeIds: new Set(),
        runHistory: [],
      });
    },

    // ---- Execution ----
    setRunning: (running) => set({ isRunning: running }),
    setNodeRunning: (nodeId, running) => {
      set((state) => {
        const updated = new Set(state.runningNodeIds);
        if (running) updated.add(nodeId);
        else updated.delete(nodeId);
        return {
          runningNodeIds: updated,
          nodes: state.nodes.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, isRunning: running } } : n
          ),
        };
      });
    },
    setCurrentRunId: (runId) => set({ currentRunId: runId }),

    // ---- Selection ----
    toggleNodeSelection: (nodeId) => {
      set((state) => {
        const updated = new Set(state.selectedNodeIds);
        if (updated.has(nodeId)) updated.delete(nodeId);
        else updated.add(nodeId);
        return { selectedNodeIds: updated };
      });
    },
    clearSelection: () => set({ selectedNodeIds: new Set() }),
    selectAll: () => {
      const { nodes } = get();
      set({ selectedNodeIds: new Set(nodes.map((n) => n.id)) });
    },

    // ---- Run History ----
    setRunHistory: (runs) => set({ runHistory: runs }),
    addRunToHistory: (run) =>
      set((state) => ({ runHistory: [run, ...state.runHistory] })),
    updateRunInHistory: (run) =>
      set((state) => ({
        runHistory: state.runHistory.map((r) => (r.id === run.id ? run : r)),
      })),
    setSelectedRunId: (id) => set({ selectedRunId: id }),

    // ---- UI ----
    toggleLeftSidebar: () =>
      set((s) => ({ isLeftSidebarOpen: !s.isLeftSidebarOpen })),
    toggleRightSidebar: () =>
      set((s) => ({ isRightSidebarOpen: !s.isRightSidebarOpen })),
    setShowSampleWorkflow: (show) => set({ showSampleWorkflow: show }),
  }))
);
