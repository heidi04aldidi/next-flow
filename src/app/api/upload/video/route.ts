import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const key = process.env.TRANSLOADIT_KEY;
    const secret = process.env.TRANSLOADIT_SECRET;
    const templateId = process.env.TRANSLOADIT_VIDEO_TEMPLATE_ID;

    if (!key || !secret || !templateId) {
      return NextResponse.json(
        { error: "Transloadit not configured" },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      "video/mp4",
      "video/quicktime",
      "video/webm",
      "video/x-m4v",
      "video/mpeg",
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: MP4, MOV, WEBM, M4V" },
        { status: 400 }
      );
    }

    // Max 500MB
    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 500MB" },
        { status: 400 }
      );
    }

    // Build Transloadit params
    const params = JSON.stringify({
      auth: { key },
      template_id: templateId,
    });

    const crypto = await import("crypto");
    const sig = crypto
      .createHmac("sha1", secret)
      .update(Buffer.from(params))
      .digest("hex");

    const transloaditForm = new FormData();
    transloaditForm.append("params", params);
    transloaditForm.append("signature", `sha1:${sig}`);
    transloaditForm.append("file", file);

    const response = await fetch("https://api2.transloadit.com/assemblies", {
      method: "POST",
      body: transloaditForm,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[upload video] Transloadit error:", errorText);
      return NextResponse.json({ error: "Upload failed" }, { status: 502 });
    }

    const assembly = await response.json();

    // Poll for completion (videos take longer — 60 attempts = ~60s)
    const url = await pollAssembly(assembly.assembly_ssl_url, 60);

    return NextResponse.json({ url }, { status: 200 });
  } catch (error) {
    console.error("[upload video]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function pollAssembly(assemblyUrl: string, maxAttempts: number): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(assemblyUrl);
    const data = await res.json();

    if (data.ok === "ASSEMBLY_COMPLETED") {
      const results = data.results;
      const firstStep = Object.keys(results)[0];
      if (firstStep && results[firstStep]?.[0]?.ssl_url) {
        return results[firstStep][0].ssl_url;
      }
      throw new Error("No output found in assembly results");
    }

    if (data.error) {
      throw new Error(`Transloadit assembly error: ${data.error}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error("Assembly timed out");
}
