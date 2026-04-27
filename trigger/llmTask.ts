import { task, logger } from "@trigger.dev/sdk/v3";
import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import type { LLMTaskInput } from "@/lib/validations/schemas";

export const llmTask = task({
  id: "llm-execute",
  maxDuration: 120, // 2 minutes
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 5000,
    factor: 2,
  },

  run: async (payload: LLMTaskInput, { ctx }) => {
    const startedAt = Date.now();
    logger.info("LLM task started", { nodeId: payload.nodeId, model: payload.model });

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_GEMINI_API_KEY is not configured");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: payload.model,
      systemInstruction: payload.systemPrompt,
    });

    // Build content parts
    const parts: Part[] = [];

    // Add text
    if (payload.userMessage) {
      parts.push({ text: payload.userMessage });
    }

    // Add images (fetch and convert to base64)
    if (payload.imageUrls?.length) {
      for (const imageUrl of payload.imageUrls) {
        try {
          const response = await fetch(imageUrl);
          if (!response.ok) {
            logger.warn(`Failed to fetch image: ${imageUrl}`);
            continue;
          }
          const buffer = await response.arrayBuffer();
          const base64 = Buffer.from(buffer).toString("base64");
          const mimeType = response.headers.get("content-type") ?? "image/jpeg";

          parts.push({
            inlineData: {
              data: base64,
              mimeType: mimeType as "image/jpeg" | "image/png" | "image/webp",
            },
          });
        } catch (err) {
          logger.warn(`Could not load image ${imageUrl}:`, { error: String(err) });
        }
      }
    }

    if (parts.length === 0) {
      throw new Error("No valid content to send to LLM");
    }

    logger.info("Calling Gemini API", {
      model: payload.model,
      partsCount: parts.length,
      hasImages: (payload.imageUrls?.length ?? 0) > 0,
    });

    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
    });

    const responseText = result.response.text();
    const durationMs = Date.now() - startedAt;

    logger.info("LLM task completed", { durationMs, outputLength: responseText.length });

    return {
      success: true,
      outputText: responseText,
      durationMs,
      model: payload.model,
      usage: {
        promptTokens: result.response.usageMetadata?.promptTokenCount,
        candidateTokens: result.response.usageMetadata?.candidatesTokenCount,
        totalTokens: result.response.usageMetadata?.totalTokenCount,
      },
    };
  },
});
