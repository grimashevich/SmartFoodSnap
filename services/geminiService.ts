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
 * Helper to retry functions with exponential backoff on 429/503 errors
 */
async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    // Retry on Rate Limit (429) or Server Overload (503)
    if (retries > 0 && (error.status === 429 || error.status === 503 || error.message?.includes('429'))) {
      console.warn(`Request failed with ${error.status || '429'}. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryWithBackoff(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

/**
 * Analyzes an image to identify food and macros.
 * Tries 'gemini-3-pro-preview' first for accuracy.
 * Falls back to 'gemini-2.5-flash' if Pro is unavailable (403/404).
 */
export const analyzeFoodImage = async (base64Image: string, mimeType: string): Promise<AnalysisResult> => {
  if (!apiKey) {
    throw new Error("API Key is missing in the application configuration.");
  }

  const promptText = "Проанализируй это изображение еды. Если видишь упаковки или этикетки (например, 'Zero Sugar', 'Diet', '0 калорий'), обязательно учитывай это при расчете. Определи каждое блюдо или ингредиент, оцени их вес в граммах и рассчитай КБЖУ (Калории, Белки, Жиры, Углеводы). Укажи степень уверенности (confidence) для каждого продукта от 0.0 до 1.0. Будь максимально точным. Верни результат в формате JSON. Используй русский язык для названий и описания.";

  const contentPart = {
    parts: [
      {
        inlineData: {
          data: base64Image,
          mimeType: mimeType,
        },
      },
      {
        text: promptText,
      },
    ],
  };

  const configPart = {
    responseMimeType: "application/json",
    responseSchema: analysisResponseSchema,
  };

  return retryWithBackoff(async () => {
    try {
      // 1. Try Gemini 3 Pro Preview (Best Quality)
      console.log("Attempting analysis with gemini-3-pro-preview...");
      const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: contentPart,
        config: configPart,
      });

      const text = response.text;
      if (!text) throw new Error("No response from Gemini");
      
      return JSON.parse(text) as AnalysisResult;

    } catch (error: any) {
      console.warn("Gemini 3 Pro failed:", error.message || error.status);

      // 2. Fallback to Gemini 2.5 Flash if Pro is denied (403) or not found (404)
      if (error.status === 403 || error.status === 404 || error.message?.includes('403') || error.message?.includes('404') || error.message?.includes('PERMISSION_DENIED')) {
        console.log("Falling back to gemini-2.5-flash...");
        
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: contentPart,
          config: configPart,
        });

        const text = response.text;
        if (!text) throw new Error("No response from Gemini (Flash fallback)");
        
        return JSON.parse(text) as AnalysisResult;
      }

      // If it's another error (like 500 or network), rethrow to let retryWithBackoff handle it or fail
      throw error;
    }
  });
};

/**
 * Transcribes audio using Gemini 2.5 Flash for fast speech-to-text.
 */
export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }

  return retryWithBackoff(async () => {
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
                mimeType: audioBlob.type, 
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
  });
};

/**
 * Recalculates macros based on user correction (text) using Gemini 2.5 Flash.
 */
export const recalculateMacros = async (
  currentAnalysis: AnalysisResult,
  userCorrection: string
): Promise<AnalysisResult> => {
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }

  return retryWithBackoff(async () => {
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
        model: "gemini-2.5-flash", 
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: analysisResponseSchema,
        },
      });

      const text = response.text;
      if (!text) throw new Error("No response from Gemini");

      return JSON.parse(text) as AnalysisResult;
    } catch (error: any) {
      console.error("Recalculation failed:", error);
      throw new Error(error.message || "Recalculation failed");
    }
  });
};
