"use client";

import { memo, useCallback, useRef, useState } from "react";
import {
  Play,
  Save,
  Download,
  Upload,
  Undo2,
  Redo2,
  GitBranch,
  Loader2,
  ChevronDown,
  CheckCircle2,
  History,
} from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { useWorkflowStore } from "@/lib/store/workflowStore";

interface TopToolbarProps {
  userId: string;
  onSave: () => Promise<void>;
  onRun: (scope: "FULL" | "PARTIAL" | "SINGLE", selectedIds?: string[]) => Promise<void>;
}

const TopToolbar = memo(({ userId, onSave, onRun }: TopToolbarProps) => {
  const {
    workflowName,
    setWorkflowName,
    isSaved,
    isSaving,
    isRunning,
    undo,
    redo,
    historyIndex,
    history,
    nodes,
    edges,
    selectedNodeIds,
    toggleRightSidebar,
    isRightSidebarOpen,
  } = useWorkflowStore();

  const [runMenuOpen, setRunMenuOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [localName, setLocalName] = useState(workflowName);
  const importRef = useRef<HTMLInputElement>(null);

  const handleExport = useCallback(() => {
    const state = useWorkflowStore.getState();
    const data = {
      name: state.workflowName,
      nodes: state.nodes,
      edges: state.edges,
      viewport: state.viewport,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.workflowName.replace(/\s+/g, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          const { loadWorkflow, workflowId } = useWorkflowStore.getState();
          loadWorkflow({
            id: data.id ?? workflowId,
            name: data.name ?? "Imported Workflow",
            nodes: data.nodes ?? [],
            edges: data.edges ?? [],
            viewport: data.viewport,
          });
        } catch {
          alert("Invalid workflow JSON file");
        }
      };
      reader.readAsText(file);
      if (importRef.current) importRef.current.value = "";
    },
    []
  );

  const handleNameSave = () => {
    setWorkflowName(localName.trim() || "Untitled Workflow");
    setIsEditingName(false);
  };

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;
  const hasSelectedNodes = selectedNodeIds.size > 0;

  return (
    <header className="flex items-center justify-between px-4 py-2.5 border-b border-subtle bg-surface flex-shrink-0 h-12 z-20">
      {/* Left: Brand + name */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-md bg-accent-purple flex items-center justify-center">
            <GitBranch className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-text-primary">NextFlow</span>
        </div>

        <div className="w-px h-4 bg-white/10" />

        {/* Workflow name */}
        {isEditingName ? (
          <input
            autoFocus
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            onBlur={handleNameSave}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") handleNameSave();
              if (e.key === "Escape") setIsEditingName(false);
            }}
            className="
              text-sm font-medium text-text-primary bg-transparent
              border-b border-accent-purple/60 focus:outline-none
              min-w-[120px] max-w-[200px]
            "
          />
        ) : (
          <button
            onClick={() => { setLocalName(workflowName); setIsEditingName(true); }}
            className="text-sm font-medium text-text-primary hover:text-white transition-colors group flex items-center gap-1"
          >
            {workflowName}
            {!isSaved && <span className="w-1.5 h-1.5 rounded-full bg-accent-purple ml-1 flex-shrink-0" />}
          </button>
        )}
      </div>

      {/* Center: Undo/redo */}
      <div className="flex items-center gap-1">
        <button
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Cmd+Z)"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Cmd+Shift+Z)"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <Redo2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Export/Import */}
        <button
          onClick={handleExport}
          title="Export workflow"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/5 transition-all"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => importRef.current?.click()}
          title="Import workflow"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/5 transition-all"
        >
          <Upload className="w-3.5 h-3.5" />
        </button>
        <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />

        <div className="w-px h-4 bg-white/10" />

        {/* History toggle */}
        <button
          onClick={toggleRightSidebar}
          className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center transition-all",
            isRightSidebarOpen
              ? "text-accent-purple-light bg-accent-glow"
              : "text-text-muted hover:text-text-primary hover:bg-white/5"
          )}
          title="Toggle run history"
        >
          <History className="w-3.5 h-3.5" />
        </button>

        {/* Save */}
        <button
          onClick={onSave}
          disabled={isSaving || isSaved}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
            isSaved
              ? "text-green-400 bg-green-500/10 cursor-default"
              : "text-text-primary bg-white/8 hover:bg-white/12 border border-white/8 hover:border-white/14",
            isSaving && "opacity-70"
          )}
        >
          {isSaving ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : isSaved ? (
            <CheckCircle2 className="w-3 h-3" />
          ) : (
            <Save className="w-3 h-3" />
          )}
          {isSaving ? "Saving…" : isSaved ? "Saved" : "Save"}
        </button>

        {/* Run with dropdown */}
        <div className="relative flex">
          <button
            onClick={() => !isRunning && onRun("FULL")}
            disabled={isRunning || nodes.length === 0}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-l-lg text-xs font-medium transition-all",
              isRunning
                ? "bg-accent-purple/60 text-white cursor-wait"
                : "bg-accent-purple hover:bg-accent-purple-light text-white",
              nodes.length === 0 && "opacity-50 cursor-not-allowed"
            )}
          >
            {isRunning ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Play className="w-3 h-3 fill-current" />
            )}
            {isRunning ? "Running…" : "Run"}
          </button>
          <button
            onClick={() => setRunMenuOpen((p) => !p)}
            disabled={isRunning}
            className={cn(
              "px-1.5 rounded-r-lg border-l border-accent-purple-dark text-white transition-all",
              isRunning
                ? "bg-accent-purple/60 cursor-wait"
                : "bg-accent-purple hover:bg-accent-purple-light"
            )}
          >
            <ChevronDown className="w-3 h-3" />
          </button>

          {runMenuOpen && !isRunning && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setRunMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 w-44 py-1 bg-surface-overlay border border-subtle rounded-lg shadow-xl">
                <button
                  onClick={() => { onRun("FULL"); setRunMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors"
                >
                  <span className="font-medium">Run Workflow</span>
                  <p className="text-text-muted text-[10px]">Execute all nodes</p>
                </button>
                {hasSelectedNodes && (
                  <button
                    onClick={() => { onRun("PARTIAL", Array.from(selectedNodeIds)); setRunMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors"
                  >
                    <span className="font-medium">Run Selected ({selectedNodeIds.size})</span>
                    <p className="text-text-muted text-[10px]">Run selected + deps</p>
                  </button>
                )}
                {selectedNodeIds.size === 1 && (
                  <button
                    onClick={() => { onRun("SINGLE", Array.from(selectedNodeIds)); setRunMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors"
                  >
                    <span className="font-medium">Run Single Node</span>
                    <p className="text-text-muted text-[10px]">Only selected node</p>
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <div className="w-px h-4 bg-white/10" />

        <UserButton
          appearance={{
            elements: {
              avatarBox: "w-6 h-6",
            },
          }}
        />
      </div>
    </header>
  );
});

TopToolbar.displayName = "TopToolbar";
export default TopToolbar;
