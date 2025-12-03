import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisResult } from "../types";

// Validate API Key immediately
const apiKey = process.env.API_KEY;
if (!apiKey) {
  console.error("API_KEY is missing! Make sure to set it in your environment variables.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || "dummy-key" });

// Schema for structured output
const macroSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    calories: { type: Type.NUMBER, description: "Total calories (kcal)" },
    protein: { type: Type.NUMBER, description: "Protein in grams" },
    fat: { type: Type.NUMBER, description: "Fat in grams" },
    carbs: { type: Type.NUMBER, description: "Carbohydrates in grams" },
  },
  required: ["calories", "protein", "fat", "carbs"],
};

const foodItemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "Name of the food item in Russian" },
    weightGrams: { type: Type.NUMBER, description: "Estimated weight in grams" },
    macros: macroSchema,
    confidence: { type: Type.NUMBER, description: "Confidence score between 0.0 and 1.0 indicating certainty of identification" },
  },
  required: ["name", "weightGrams", "macros", "confidence"],
};

const analysisResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: foodItemSchema,
      description: "List of identified food items",
    },
    total: macroSchema,
    summary: { type: Type.STRING, description: "A brief summary in Russian of what was found and the total nutritional value." },
  },
  required: ["items", "total", "summary"],
};

/**
 * Analyzes an image to identify food and macros using Gemini 3 Pro Preview.
 * Note: Google Search is disabled here to ensure strict JSON schema compliance.
 */
export const analyzeFoodImage = async (base64Image: string, mimeType: string): Promise<AnalysisResult> => {
  if (!apiKey) {
    throw new Error("API Key is missing in the application configuration.");
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType,
            },
          },
          {
            text: "Проанализируй это изображение еды. Определи каждое блюдо или ингредиент, оцени их вес в граммах и рассчитай КБЖУ (Калории, Белки, Жиры, Углеводы). Укажи степень уверенности (confidence) для каждого продукта от 0.0 до 1.0. Будь максимально точным. Верни результат в формате JSON. Используй русский язык для названий и описания.",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: analysisResponseSchema,
        // REMOVED: tools: [{ googleSearch: {} }] 
        // Reason: 'googleSearch' tool is incompatible with 'responseSchema' in the current API version.
        // We prioritize structured JSON data for this feature.
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    
    return JSON.parse(text) as AnalysisResult;
  } catch (error: any) {
    console.error("Analysis failed:", error);
    // Return a more descriptive error if available
    throw new Error(error.message || "Failed to analyze image");
  }
};

/**
 * Transcribes audio using Gemini 2.5 Flash for fast speech-to-text.
 */
export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }

  try {
    // Convert Blob to Base64
    const buffer = await audioBlob.arrayBuffer();
    const base64Audio = btoa(
      new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: audioBlob.type, // e.g., 'audio/webm' or 'audio/mp4'
              data: base64Audio,
            },
          },
          {
            text: "Transcribe this audio strictly verbatim. The audio contains corrections for food analysis in Russian.",
          },
        ],
      },
    });

    return response.text || "";
  } catch (error: any) {
    console.error("Transcription failed:", error);
    throw new Error(error.message || "Transcription failed");
  }
};

/**
 * Recalculates macros based on user correction (text) using Gemini 3 Pro with Thinking Mode.
 */
export const recalculateMacros = async (
  currentAnalysis: AnalysisResult,
  userCorrection: string
): Promise<AnalysisResult> => {
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }

  try {
    const prompt = `
      Исходные данные анализа еды (JSON):
      ${JSON.stringify(currentAnalysis)}

      Корректировка от пользователя:
      "${userCorrection}"

      Задание:
      1. Пойми, что именно пользователь хочет изменить (вес, название, удалить блюдо, добавить блюдо).
      2. Пересчитай КБЖУ для измененных позиций и итоговую сумму.
      3. Верни обновленный JSON объект в том же формате, включая поле confidence (для новых блюд оцени уверенность сам, для старых оставь или измени если нужно).
      4. В поле 'summary' напиши, что было изменено.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: analysisResponseSchema,
        // Using Thinking Config for complex reasoning about the state change
        thinkingConfig: {
          thinkingBudget: 32768, 
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");

    return JSON.parse(text) as AnalysisResult;
  } catch (error: any) {
    console.error("Recalculation failed:", error);
    throw new Error(error.message || "Recalculation failed");
  }
};