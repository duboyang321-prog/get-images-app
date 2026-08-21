import { generateTokenByteImage } from "./tokenbyte";
import type { GenerateImageInput } from "../types";

/** Generate a Gemini image through TokenByte's OpenAI-compatible endpoint. */
export async function generateGoogleImage(
  input: GenerateImageInput & { thinkingApiValue?: string },
  modelId: string,
  apiKey: string,
) {
  return generateTokenByteImage(input, modelId, apiKey);
}
