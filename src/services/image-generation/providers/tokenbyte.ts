import { createOpenAI } from "@ai-sdk/openai";
import { generateImage } from "ai";
import { ConfigError } from "../errors";
import type { GenerateImageInput } from "../types";

const TOKENBYTE_BASE_URL =
  process.env.TOKENBYTE_BASE_URL?.replace(/\/$/, "") ??
  "https://api.tokenbyte.ai/v1";

// TokenByte requires the exact model title from its model catalog. The
// existing database uses the older Gemini name, so keep a small alias here to
// avoid requiring a production database migration.
const TOKENBYTE_MODEL_IDS: Record<string, string> = {
  "gpt-image-2": "gpt-image-2",
  "gemini-3-pro-image": "gemini-3-pro-image-preview",
  "gemini-3-pro-image-preview": "gemini-3-pro-image-preview",
};

const ASPECT_TO_SIZE: Record<string, `${number}x${number}`> = {
  "1:1": "1024x1024",
  "3:2": "1536x1024",
  "16:9": "1536x1024",
  "21:9": "1536x1024",
  "4:3": "1536x1024",
  "2:3": "1024x1536",
  "9:16": "1024x1536",
  "3:4": "1024x1536",
};

export async function generateTokenByteImage(
  input: GenerateImageInput,
  modelId: string,
  apiKey: string,
) {
  const tokenByteModelId = TOKENBYTE_MODEL_IDS[modelId];
  if (!tokenByteModelId) {
    throw new ConfigError(
      `Model ${modelId} is not available through the configured TokenByte keys.`,
    );
  }

  const tokenByte = createOpenAI({
    apiKey,
    baseURL: TOKENBYTE_BASE_URL,
  });

  let prompt = input.prompt;
  if (input.style) {
    prompt = `${prompt}\n\nStyle: ${input.style}`;
  }

  const size = ASPECT_TO_SIZE[input.aspectRatio ?? "1:1"] ?? "1024x1024";
  const result = await generateImage({
    model: tokenByte.image(tokenByteModelId),
    prompt,
    size,
  });

  return result.image;
}
