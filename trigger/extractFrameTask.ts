import { task, logger } from "@trigger.dev/sdk/v3";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { ExtractFrameTaskInput } from "@/lib/validations/schemas";

const execAsync = promisify(exec);

export const extractFrameTask = task({
  id: "extract-frame",
  maxDuration: 120,
  retry: { maxAttempts: 2 },

  run: async (payload: ExtractFrameTaskInput) => {
    const startedAt = Date.now();
    logger.info("Extract frame task started", {
      nodeId: payload.nodeId,
      timestamp: payload.timestamp,
    });

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nextflow-frame-"));
    const videoExt = getVideoExtension(payload.videoUrl);
    const inputPath = path.join(tmpDir, `input.${videoExt}`);
    const outputPath = path.join(tmpDir, "frame.jpg");

    try {
      // 1. Download the video
      logger.info("Downloading video", { url: payload.videoUrl });
      const response = await fetch(payload.videoUrl);
      if (!response.ok) throw new Error(`Failed to download video: ${response.statusText}`);

      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(inputPath, buffer);

      // 2. Get video duration with ffprobe
      const probeCmd = `ffprobe -v quiet -print_format json -show_streams "${inputPath}"`;
      const { stdout: probeOutput } = await execAsync(probeCmd);
      const probeData = JSON.parse(probeOutput);
      const videoStream = probeData.streams?.find(
        (s: { codec_type: string }) => s.codec_type === "video"
      );

      if (!videoStream) throw new Error("Could not determine video stream");

      const duration = parseFloat(videoStream.duration ?? "0");
      logger.info("Video info", { duration, fps: videoStream.r_frame_rate });

      // 3. Resolve timestamp
      const seekTime = resolveTimestamp(payload.timestamp, duration);
      logger.info("Extracting frame at", { seekTime, timestamp: payload.timestamp });

      // 4. Extract frame with FFmpeg
      const ffmpegCmd = `ffmpeg -ss ${seekTime} -i "${inputPath}" -frames:v 1 -q:v 2 "${outputPath}" -y`;
      await execAsync(ffmpegCmd);

      if (!fs.existsSync(outputPath)) {
        throw new Error("FFmpeg did not produce an output frame");
      }

      // 5. Upload to Transloadit
      const frameBuffer = fs.readFileSync(outputPath);
      const uploadedUrl = await uploadFrameToTransloadit(frameBuffer);

      const durationMs = Date.now() - startedAt;
      logger.info("Extract frame completed", { durationMs, outputUrl: uploadedUrl });

      return {
        success: true,
        outputUrl: uploadedUrl,
        extractedAtSeconds: seekTime,
        videoDuration: duration,
        durationMs,
      };
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true });
      } catch {
        // ignore
      }
    }
  },
});

function resolveTimestamp(timestamp: string, duration: number): number {
  const trimmed = timestamp.trim();

  // Percentage format: "50%" → half duration
  if (trimmed.endsWith("%")) {
    const percent = parseFloat(trimmed.slice(0, -1)) / 100;
    return Math.min(duration * percent, duration - 0.1);
  }

  // Time format: "HH:MM:SS" or "MM:SS"
  if (trimmed.includes(":")) {
    const parts = trimmed.split(":").map(Number);
    let seconds = 0;
    if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    else if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
    return Math.min(seconds, duration - 0.1);
  }

  // Numeric seconds
  const seconds = parseFloat(trimmed);
  if (!isNaN(seconds)) return Math.min(seconds, duration - 0.1);

  // Default: middle of video
  return duration / 2;
}

function getVideoExtension(url: string): string {
  const match = url.match(/\.(mp4|mov|webm|m4v|avi)(\?|$)/i);
  return match?.[1]?.toLowerCase() ?? "mp4";
}

async function uploadFrameToTransloadit(buffer: Buffer): Promise<string> {
  const transloaditKey = process.env.NEXT_PUBLIC_TRANSLOADIT_KEY;
  const transloaditSecret = process.env.TRANSLOADIT_SECRET;

  if (!transloaditKey || !transloaditSecret) {
    throw new Error("Transloadit credentials not configured");
  }

  const formData = new FormData();
  const blob = new Blob([new Uint8Array(buffer)], { type: "image/jpeg" });
  formData.append("file", blob, "frame.jpg");

  const params = JSON.stringify({
    auth: { key: transloaditKey },
    steps: {
      store: {
        use: ":original",
        robot: "/s3/store",
      },
    },
  });
  formData.append("params", params);

  const response = await fetch("https://api2.transloadit.com/assemblies", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) throw new Error("Transloadit upload failed");
  const data = await response.json();

  if (data.ok === "ASSEMBLY_COMPLETED") {
    const result = data.results?.store?.[0];
    if (result?.ssl_url) return result.ssl_url;
  }

  // Poll
  return await pollAssembly(data.assembly_ssl_url);
}

async function pollAssembly(assemblyUrl: string, maxAttempts = 30): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const response = await fetch(assemblyUrl);
    const data = await response.json();

    if (data.ok === "ASSEMBLY_COMPLETED") {
      const result = data.results?.store?.[0];
      if (result?.ssl_url) return result.ssl_url;
    }
    if (data.error) throw new Error(`Assembly failed: ${data.error}`);
  }
  throw new Error("Assembly timed out");
}
