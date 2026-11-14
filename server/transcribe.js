import { chatCompletion } from "./ai.js";
import { AppError } from "./errors.js";
import { roleConfigured } from "./providers.js";

const PROMPT = "Transcribe the speech in this audio exactly as spoken, in the language it was spoken. "
  + "Output only the transcript, with no commentary. If there is no speech, output nothing.";

// Speech-to-text through the provider set for the "stt" job. Input is 16 kHz mono WAV.
export async function transcribe(wavBase64, userId) {
  if (!roleConfigured("stt")) throw new AppError(503, "Speech recognition is not set up yet. The admin needs to add it.");
  try {
    const text = await chatCompletion([{
      role: "user",
      content: [
        { type: "text", text: PROMPT },
        { type: "input_audio", input_audio: { data: wavBase64, format: "wav" } },
      ],
    }], { role: "stt", userId, maxTokens: 1500, temperature: 0 });
    return text.trim();
  } catch (error) {
    // Silence comes back as an empty answer, which is not an error for the user.
    if (error instanceof AppError && error.message.includes("empty answer")) return "";
    throw error;
  }
}
