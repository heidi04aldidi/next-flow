"use client";

import { memo, useCallback, useRef, useState } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { ImageIcon, Upload, X, Loader2 } from "lucide-react";
import { NodeShell } from "./NodeShell";
import { useWorkflowStore } from "@/lib/store/workflowStore";
import { fileSize, cn } from "@/lib/utils";
import type { UploadImageNodeData } from "@/types";

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE_MB = 20;
const MAX_DIMENSION = 2048;

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new window.Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas not available")); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

const UploadImageNode = memo(({ id, data }: NodeProps<UploadImageNodeData>) => {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        setError("Please upload a JPG, PNG, WebP, or GIF image");
        return;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setError(`File must be under ${MAX_SIZE_MB}MB`);
        return;
      }

      setError(null);
      setIsUploading(true);

      try {
        const dataUrl = await compressImage(file);
        updateNodeData(id, {
          uploadedUrl: dataUrl,
          uploadedName: file.name,
          uploadedSize: file.size,
          mimeType: file.type,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to process image");
      } finally {
        setIsUploading(false);
      }
    },
    [id, updateNodeData]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) uploadFile(file);
    },
    [uploadFile]
  );

  const clearUpload = useCallback(() => {
    updateNodeData(id, {
      uploadedUrl: undefined,
      uploadedName: undefined,
      uploadedSize: undefined,
      mimeType: undefined,
    });
    if (inputRef.current) inputRef.current.value = "";
  }, [id, updateNodeData]);

  return (
    <NodeShell
      nodeId={id}
      nodeType="uploadImageNode"
      label={data.label}
      icon={<ImageIcon className="w-3 h-3" />}
      isRunning={data.isRunning}
      hasError={data.hasError}
      minWidth={280}
    >
      {data.uploadedUrl ? (
        /* Preview */
        <div className="relative rounded-lg overflow-hidden border border-white/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.uploadedUrl}
            alt={data.uploadedName ?? "Uploaded"}
            className="w-full h-40 object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 px-2 py-2 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-xs text-white/90 font-medium truncate">{data.uploadedName}</p>
              {data.uploadedSize && (
                <p className="text-[10px] text-white/50">{fileSize(data.uploadedSize)}</p>
              )}
            </div>
            <button
              onClick={clearUpload}
              className="w-6 h-6 rounded-full bg-black/50 hover:bg-black/80 flex items-center justify-center transition-colors flex-shrink-0"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
        </div>
      ) : (
        /* Drop zone */
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "h-32 rounded-lg border-2 border-dashed cursor-pointer",
            "flex flex-col items-center justify-center gap-2",
            "transition-all duration-150",
            dragOver
              ? "border-accent-purple bg-accent-glow"
              : "border-white/10 hover:border-white/20 hover:bg-white/2"
          )}
        >
          {isUploading ? (
            <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
          ) : (
            <>
              <Upload className="w-5 h-5 text-text-muted" />
              <span className="text-xs text-text-muted text-center px-2">
                Drop image here or <span className="text-accent-purple-light">browse</span>
              </span>
              <span className="text-[10px] text-text-muted">JPG, PNG, WebP, GIF · Max {MAX_SIZE_MB}MB</span>
            </>
          )}
        </div>
      )}

      {error && (
        <p className="mt-2 text-[11px] text-red-400">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadFile(file);
        }}
      />

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

UploadImageNode.displayName = "UploadImageNode";
export default UploadImageNode;
