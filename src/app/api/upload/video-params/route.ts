import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Returns HMAC-signed Transloadit params so the browser can upload directly,
// avoiding Vercel's serverless function body-size limit.
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = process.env.TRANSLOADIT_KEY;
  const secret = process.env.TRANSLOADIT_SECRET;

  if (!key || !secret) {
    return NextResponse.json({ error: "Transloadit not configured" }, { status: 500 });
  }

  // Transloadit requires an expires field in auth when using HMAC signatures.
  // Format: "YYYY/MM/DD HH:MM:SS+00:00" — set 1 hour from now.
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const expires = `${expiresAt.getUTCFullYear()}/${pad(expiresAt.getUTCMonth() + 1)}/${pad(expiresAt.getUTCDate())} ${pad(expiresAt.getUTCHours())}:${pad(expiresAt.getUTCMinutes())}:${pad(expiresAt.getUTCSeconds())}+00:00`;

  const authBlock = { key, expires };

  // Transloadit requires the /upload/handle step to be named ":original" (colon prefix is mandatory).
  const assemblyParams = { auth: authBlock, steps: { ":original": { robot: "/upload/handle" } } };

  const params = JSON.stringify(assemblyParams);

  const crypto = await import("crypto");
  const signature = `sha1:${crypto
    .createHmac("sha1", secret)
    .update(Buffer.from(params))
    .digest("hex")}`;

  return NextResponse.json({ params, signature });
}
