"use client";

import { memo, useCallback, useRef, useState } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { Video, Upload, X, Loader2 } from "lucide-react";
import { NodeShell } from "./NodeShell";
import { useWorkflowStore } from "@/lib/store/workflowStore";
import { fileSize, cn } from "@/lib/utils";
import type { UploadVideoNodeData } from "@/types";

const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"];
const MAX_SIZE_MB = 100;
const TRANSLOADIT_API = "https://api2.transloadit.com/assemblies";

async function pollAssemblyUntilDone(
  assemblyUrl: string,
  maxAttempts = 120
): Promise<Record<string, unknown>> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await fetch(assemblyUrl);
    const data: Record<string, unknown> = await res.json();
    if (data.ok === "ASSEMBLY_COMPLETED") return data;
    if (data.error) throw new Error(`Assembly failed: ${data.error}`);
  }
  throw new Error("Video upload timed out");
}

function extractUrlFromAssembly(assembly: Record<string, unknown>): string {
  const results = assembly.results as Record<string, { ssl_url?: string }[]> | undefined;
  for (const step of Object.values(results ?? {})) {
    if (step?.[0]?.ssl_url) return step[0].ssl_url;
  }
  throw new Error("No video URL returned from upload service");
}

const UploadVideoNode = memo(({ id, data }: NodeProps<UploadVideoNodeData>) => {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusText, setStatusText] = useState("");

  const uploadFile = useCallback(
    async (file: File) => {
      if (!ACCEPTED_VIDEO_TYPES.includes(file.type) && !file.name.match(/\.(mp4|mov|webm|m4v)$/i)) {
        setError("Please upload an MP4, MOV, WebM, or M4V video");
        return;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setError(`File must be under ${MAX_SIZE_MB}MB`);
        return;
      }

      setError(null);
      setIsUploading(true);
      setUploadProgress(0);
      setStatusText("Getting upload credentials…");

      try {
        // 1. Fetch HMAC-signed params from the server (tiny request, no size limit issues)
        const paramsRes = await fetch("/api/upload/video-params");
        if (!paramsRes.ok) {
          const err = await paramsRes.json().catch(() => ({})) as Record<string, string>;
          throw new Error(err.error ?? "Failed to get upload credentials");
        }
        const { params, signature } = await paramsRes.json() as { params: string; signature: string };

        // 2. Upload directly from the browser to Transloadit (bypasses Next.js body-size limit)
        setStatusText("Uploading…");
        const formData = new FormData();
        formData.append("params", params);
        formData.append("signature", signature);
        formData.append("file", file);

        const assembly = await new Promise<Record<string, unknown>>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              setUploadProgress(Math.round((e.loaded / e.total) * 100));
            }
          };
          xhr.onload = () => {
            try {
              const responseData = JSON.parse(xhr.responseText) as Record<string, unknown>;
              if (xhr.status >= 400) {
                reject(new Error((responseData.error as string) ?? "Upload failed"));
              } else {
                resolve(responseData);
              }
            } catch {
              reject(new Error("Invalid response from upload service"));
            }
          };
          xhr.onerror = () => reject(new Error("Upload failed – network error"));
          xhr.open("POST", TRANSLOADIT_API);
          xhr.send(formData);
        });

        // 3. Poll until the assembly finishes processing
        let finalAssembly = assembly;
        if (assembly.ok !== "ASSEMBLY_COMPLETED") {
          setStatusText("Processing…");
          setUploadProgress(100);
          finalAssembly = await pollAssemblyUntilDone(assembly.assembly_ssl_url as string);
        }

        // 4. Extract the public CDN URL and store it in node state
        const videoUrl = extractUrlFromAssembly(finalAssembly);
        updateNodeData(id, {
          uploadedUrl: videoUrl,
          uploadedName: file.name,
          uploadedSize: file.size,
          mimeType: file.type,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
        setStatusText("");
      }
    },
    [id, updateNodeData]
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
      nodeType="uploadVideoNode"
      label={data.label}
      icon={<Video className="w-3 h-3" />}
      isRunning={data.isRunning}
      hasError={data.hasError}
      minWidth={300}
    >
      {data.uploadedUrl ? (
        /* Video preview */
        <div className="relative rounded-lg overflow-hidden border border-white/5">
          <video
            src={data.uploadedUrl}
            controls
            className="w-full h-36 object-cover bg-black"
            preload="metadata"
            crossOrigin="anonymous"
          />
          <button
            onClick={clearUpload}
            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 hover:bg-black/80 flex items-center justify-center transition-colors"
          >
            <X className="w-3 h-3 text-white" />
          </button>
          {data.uploadedName && (
            <div className="px-2 py-1.5 bg-surface border-t border-white/5">
              <p className="text-xs text-text-secondary truncate">{data.uploadedName}</p>
              {data.uploadedSize && (
                <p className="text-[10px] text-text-muted">{fileSize(data.uploadedSize)}</p>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Drop zone */
        <div
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) uploadFile(file);
          }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "h-32 rounded-lg border-2 border-dashed cursor-pointer",
            "flex flex-col items-center justify-center gap-2",
            "transition-all duration-150",
            dragOver
              ? "border-accent-purple bg-accent-glow"
              : "border-white/10 hover:border-white/20"
          )}
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-2 w-full px-6">
              <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
              <div className="w-full bg-surface-elevated rounded-full h-1">
                <div
                  className="bg-accent-purple h-1 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <span className="text-[10px] text-text-muted">
                {statusText || `${uploadProgress}%`}
              </span>
            </div>
          ) : (
            <>
              <Upload className="w-5 h-5 text-text-muted" />
              <span className="text-xs text-text-muted text-center px-2">
                Drop video here or <span className="text-accent-purple-light">browse</span>
              </span>
              <span className="text-[10px] text-text-muted">MP4, MOV, WebM · Max {MAX_SIZE_MB}MB</span>
            </>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-[11px] text-red-400">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_VIDEO_TYPES.join(",") + ",.mp4,.mov,.webm,.m4v"}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadFile(file);
        }}
      />

      {/* Output handle */}
      <div className="flex justify-end mt-2">
        <span className="text-[10px] text-text-muted mr-2">video</span>
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

UploadVideoNode.displayName = "UploadVideoNode";
export default UploadVideoNode;
