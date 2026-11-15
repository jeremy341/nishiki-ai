import { chatCompletion } from "./ai.js";
import { AppError } from "./errors.js";
import { getPrefs } from "./prefs.js";
import { roleConfigured } from "./providers.js";

// The model must write down what was said, in the language it was said in. Without a hint it tends to
// answer a German recording with an English translation, so the likely language is named.
function promptFor(userId) {
  const prefs = getPrefs(userId);
  const language = prefs.language === "en" ? "English" : prefs.language === "de" ? "German" : prefs.uiLanguage === "en" ? "English" : "German";
  const other = language === "German" ? "English" : "German";
  return `Transcribe this audio word for word. The speaker speaks ${language}. Write every ${language} word in ${language}, with correct spelling, umlauts and punctuation. `
    + `Only a sentence that is clearly spoken in ${other} or another language is written in that language; a single ${other} word inside a ${language} sentence stays as said. `
    + "Never translate and never answer. Output only the transcript, with no commentary. If there is no speech, output nothing.";
}

// Speech-to-text through the provider set for the "stt" job. Input is 16 kHz mono WAV.
export async function transcribe(wavBase64, userId) {
  if (!roleConfigured("stt")) throw new AppError(503, "Speech recognition is not set up yet. The admin needs to add it.");
  try {
    const text = await chatCompletion([{
      role: "user",
      content: [
        { type: "text", text: promptFor(userId) },
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
