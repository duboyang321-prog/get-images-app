import { generateTokenByteGeminiImage } from "./tokenbyte-gemini";
import type { GenerateImageInput } from "../types";

/** Generate a Gemini image through TokenByte's native Gemini endpoint. */
export async function generateGoogleImage(
  input: GenerateImageInput & { thinkingApiValue?: string },
  modelId: string,
  apiKey: string,
) {
  return generateTokenByteGeminiImage(input, modelId, apiKey);
}
