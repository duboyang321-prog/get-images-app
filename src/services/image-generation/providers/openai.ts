import { generateTokenByteImage } from "./tokenbyte";
import type { GenerateImageInput } from "../types";

export async function generateOpenAIImage(
  input: GenerateImageInput,
  modelId: string,
  apiKey: string,
) {
  return generateTokenByteImage(input, modelId, apiKey);
}
