import { ProviderError } from "../errors";
import type { GenerateImageInput } from "../types";

const TOKENBYTE_OPENAI_BASE_URL =
  process.env.TOKENBYTE_BASE_URL?.replace(/\/$/, "") ??
  "https://api.tokenbyte.ai/v1";

const TOKENBYTE_GEMINI_BASE_URL =
  process.env.TOKENBYTE_GEMINI_BASE_URL?.replace(/\/$/, "") ??
  TOKENBYTE_OPENAI_BASE_URL.replace(/\/v1$/, "");

const TOKENBYTE_GEMINI_MODEL_IDS: Record<string, string> = {
  "gemini-3-pro-image": "gemini-3-pro-image-preview",
  "gemini-3-pro-image-preview": "gemini-3-pro-image-preview",
};

type GeminiInlineData = {
  mimeType?: unknown;
  mime_type?: unknown;
  data?: unknown;
};

type GeminiPart = {
  text?: unknown;
  thought?: unknown;
  inlineData?: GeminiInlineData;
  inline_data?: GeminiInlineData;
};

type GeminiResponse = {
  error?: { message?: unknown };
  promptFeedback?: { blockReason?: unknown };
  candidates?: Array<{
    finishReason?: unknown;
    content?: { parts?: GeminiPart[] };
  }>;
};

function upstreamErrorMessage(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const message = (body as GeminiResponse).error?.message;
  return typeof message === "string" && message.trim() ? message.trim() : undefined;
}

function noImageDetails(body: GeminiResponse): string {
  const details: string[] = [];
  const blockReason = body.promptFeedback?.blockReason;
  if (typeof blockReason === "string" && blockReason) {
    details.push(`prompt blocked: ${blockReason}`);
  }

  const finishReasons = body.candidates
    ?.map((candidate) => candidate.finishReason)
    .filter((reason): reason is string => typeof reason === "string" && !!reason);
  if (finishReasons?.length) {
    details.push(`finish reason: ${[...new Set(finishReasons)].join(", ")}`);
  }

  const responseText = body.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text)
    .filter((text): text is string => typeof text === "string" && !!text.trim())
    .join(" ")
    .trim();
  if (responseText) {
    details.push(`provider response: ${responseText.slice(0, 500)}`);
  }

  return details.length ? ` (${details.join("; ")})` : "";
}

/** Generate a Gemini image through new-api's native Gemini endpoint. */
export async function generateTokenByteGeminiImage(
  input: GenerateImageInput & { thinkingApiValue?: string },
  modelId: string,
  apiKey: string,
) {
  const tokenByteModelId = TOKENBYTE_GEMINI_MODEL_IDS[modelId];
  if (!tokenByteModelId) {
    throw new ProviderError(
      `TokenByte Gemini model ${modelId} is not configured for native image generation.`,
    );
  }

  let prompt = input.prompt;
  if (input.style) {
    prompt = `${prompt}\n\nStyle: ${input.style}`;
  }

  const endpoint = `${TOKENBYTE_GEMINI_BASE_URL}/v1beta/models/${encodeURIComponent(tokenByteModelId)}:generateContent`;
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: {
            aspectRatio: input.aspectRatio ?? "1:1",
          },
          ...(input.thinkingApiValue
            ? { thinkingConfig: { thinkingLevel: input.thinkingApiValue } }
            : {}),
        },
      }),
    });
  } catch (error) {
    throw new ProviderError(
      `TokenByte Gemini request could not be sent: ${error instanceof Error ? error.message : String(error)}`,
      error,
    );
  }

  const responseText = await response.text();
  let body: GeminiResponse;
  try {
    body = JSON.parse(responseText) as GeminiResponse;
  } catch (error) {
    throw new ProviderError(
      `TokenByte Gemini returned invalid JSON (HTTP ${response.status}): ${responseText.slice(0, 1_500)}`,
      error,
    );
  }

  if (!response.ok) {
    const detail =
      responseText.trim().slice(0, 1_500) ||
      upstreamErrorMessage(body) ||
      response.statusText ||
      "Unknown error";
    throw new ProviderError(
      `TokenByte Gemini request failed (HTTP ${response.status}): ${detail}`,
    );
  }

  const parts = body.candidates?.flatMap(
    (candidate) => candidate.content?.parts ?? [],
  );
  for (const part of parts ?? []) {
    if (part.thought === true) continue;
    const inlineData = part.inlineData ?? part.inline_data;
    const mediaType = inlineData?.mimeType ?? inlineData?.mime_type;
    if (
      inlineData &&
      typeof inlineData.data === "string" &&
      inlineData.data &&
      typeof mediaType === "string" &&
      mediaType.startsWith("image/")
    ) {
      return {
        uint8Array: new Uint8Array(Buffer.from(inlineData.data, "base64")),
        mediaType,
      };
    }
  }

  throw new ProviderError(
    `TokenByte Gemini returned no inline image${noImageDetails(body)}.`,
  );
}
