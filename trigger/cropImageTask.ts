import { task, logger } from "@trigger.dev/sdk/v3";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { CropImageTaskInput } from "@/lib/validations/schemas";

const execAsync = promisify(exec);

export const cropImageTask = task({
  id: "crop-image",
  maxDuration: 60,
  retry: { maxAttempts: 2 },

  run: async (payload: CropImageTaskInput) => {
    const startedAt = Date.now();
    logger.info("Crop image task started", { nodeId: payload.nodeId });

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nextflow-crop-"));
    const inputPath = path.join(tmpDir, "input.jpg");
    const outputPath = path.join(tmpDir, "output.jpg");

    try {
      // 1. Download the source image
      logger.info("Downloading source image", { url: payload.imageUrl });
      const response = await fetch(payload.imageUrl);
      if (!response.ok) throw new Error(`Failed to download image: ${response.statusText}`);

      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(inputPath, buffer);

      // 2. Get image dimensions with ffprobe
      const probeCmd = `ffprobe -v quiet -print_format json -show_streams "${inputPath}"`;
      const { stdout: probeOutput } = await execAsync(probeCmd);
      const probeData = JSON.parse(probeOutput);
      const videoStream = probeData.streams?.find(
        (s: { codec_type: string }) => s.codec_type === "video"
      );

      if (!videoStream) throw new Error("Could not determine image dimensions");

      const imgWidth: number = videoStream.width;
      const imgHeight: number = videoStream.height;

      // 3. Calculate pixel values from percentages
      const xPixels = Math.floor((payload.xPercent / 100) * imgWidth);
      const yPixels = Math.floor((payload.yPercent / 100) * imgHeight);
      const wPixels = Math.floor((payload.widthPercent / 100) * imgWidth);
      const hPixels = Math.floor((payload.heightPercent / 100) * imgHeight);

      // Ensure we don't exceed bounds
      const safeW = Math.min(wPixels, imgWidth - xPixels);
      const safeH = Math.min(hPixels, imgHeight - yPixels);

      logger.info("Cropping image", {
        original: { width: imgWidth, height: imgHeight },
        crop: { x: xPixels, y: yPixels, w: safeW, h: safeH },
      });

      // 4. Run FFmpeg crop
      const ffmpegCmd = `ffmpeg -i "${inputPath}" -vf "crop=${safeW}:${safeH}:${xPixels}:${yPixels}" -q:v 2 "${outputPath}" -y`;
      await execAsync(ffmpegCmd);

      // 5. Upload to Transloadit
      const outputBuffer = fs.readFileSync(outputPath);
      const uploadedUrl = await uploadToTransloadit(outputBuffer, "cropped.jpg", "image/jpeg");

      const durationMs = Date.now() - startedAt;
      logger.info("Crop image task completed", { durationMs, outputUrl: uploadedUrl });

      return {
        success: true,
        outputUrl: uploadedUrl,
        durationMs,
        dimensions: { width: safeW, height: safeH },
      };
    } finally {
      // Cleanup temp files
      try {
        fs.rmSync(tmpDir, { recursive: true });
      } catch {
        // ignore cleanup errors
      }
    }
  },
});

async function uploadToTransloadit(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const transloaditKey = process.env.NEXT_PUBLIC_TRANSLOADIT_KEY;
  const transloaditSecret = process.env.TRANSLOADIT_SECRET;

  if (!transloaditKey || !transloaditSecret) {
    throw new Error("Transloadit credentials not configured");
  }

  // Build multipart form
  const formData = new FormData();
  const blob = new Blob([buffer], { type: mimeType });
  formData.append("file", blob, filename);

  // Use simple /assemblies endpoint with store step
  const params = JSON.stringify({
    auth: { key: transloaditKey },
    steps: {
      store: {
        use: ":original",
        robot: "/s3/store",
        // For demo: store in a public bucket
        // In production, configure your S3 credentials
      },
    },
  });
  formData.append("params", params);

  const response = await fetch("https://api2.transloadit.com/assemblies", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Transloadit upload failed: ${text}`);
  }

  const data = await response.json();

  if (data.ok !== "ASSEMBLY_COMPLETED") {
    // Poll for completion
    const assemblyUrl = data.assembly_ssl_url;
    return await pollAssembly(assemblyUrl);
  }

  const result = data.results?.store?.[0];
  if (!result?.ssl_url) throw new Error("No upload URL from Transloadit");

  return result.ssl_url;
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
