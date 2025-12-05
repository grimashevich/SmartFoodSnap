import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisResult } from "../types";

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const modelName = "gemini-2.5-flash";

// --- SCHEMAS ---

// Helper to define the structure of the JSON response we want from Gemini
const analysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Название продукта на русском языке" },
          weightGrams: { type: Type.NUMBER, description: "Вес в граммах (оценка)" },
          macros: {
            type: Type.OBJECT,
            properties: {
              calories: { type: Type.NUMBER },
              protein: { type: Type.NUMBER },
              fat: { type: Type.NUMBER },
              carbs: { type: Type.NUMBER },
            },
            required: ["calories", "protein", "fat", "carbs"],
          },
          confidence: { type: Type.NUMBER, description: "Уверенность от 0.0 до 1.0" },
        },
        required: ["name", "weightGrams", "macros", "confidence"],
      },
    },
    total: {
      type: Type.OBJECT,
      properties: {
        calories: { type: Type.NUMBER },
        protein: { type: Type.NUMBER },
        fat: { type: Type.NUMBER },
        carbs: { type: Type.NUMBER },
      },
      required: ["calories", "protein", "fat", "carbs"],
    },
    summary: { type: Type.STRING, description: "Краткий комментарий на русском языке (макс 10 слов)" },
    modelUsed: { type: Type.STRING },
  },
  required: ["items", "total", "summary"],
};

// --- SYSTEM INSTRUCTIONS ---

const SYSTEM_PROMPT = `
Ты профессиональный диетолог и эксперт по питанию.
Твоя задача: Анализировать еду (по фото или текстовому описанию), определять продукты, оценивать их вес и считать КБЖУ (Калории, Белки, Жиры, Углеводы).
Правила:
1. Всегда отвечай в формате JSON.
2. Язык названий продуктов и комментариев - Русский.
3. Если вес не указан, оценивай его визуально или используй стандартные порции.
4. Будь объективен, но если продукт неочевиден, указывай низкий уровень уверенности (confidence).
`;

// --- HELPER FUNCTIONS ---

/**
 * Converts a Blob to a Base64 string required by the SDK parts.
 */
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// --- EXPORTED SERVICES ---

/**
 * Analyzes an image to identify food and macros via Gemini.
 */
export const analyzeFoodImage = async (base64Image: string, mimeType: string): Promise<AnalysisResult> => {
  const response = await ai.models.generateContent({
    model: modelName,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Image,
          },
        },
        { text: "Проанализируй это блюдо. Определи ингредиенты, их примерный вес и КБЖУ." },
      ],
    },
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: analysisSchema,
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  
  const result = JSON.parse(text);
  result.modelUsed = "Gemini 2.5 Flash";
  return result;
};

/**
 * Analyzes text description of food to estimate macros via Gemini.
 */
export const analyzeFoodText = async (text: string): Promise<AnalysisResult> => {
  const response = await ai.models.generateContent({
    model: modelName,
    contents: {
        parts: [{ text: `Проанализируй этот прием пищи: "${text}". Рассчитай КБЖУ.` }]
    },
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: analysisSchema,
    },
  });

  const resultText = response.text;
  if (!resultText) throw new Error("No response from AI");

  const result = JSON.parse(resultText);
  result.modelUsed = "Gemini 2.5 Flash";
  return result;
};

/**
 * Transcribes audio via Gemini (Speech-to-Text).
 * We use the model to just extract text first, as doing analysis directly from audio 
 * might be less precise than Text -> Analysis pipeline for corrections.
 */
export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
  const base64Audio = await blobToBase64(audioBlob);
  
  const response = await ai.models.generateContent({
    model: modelName,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: audioBlob.type, // e.g. 'audio/webm' or 'audio/mp3'
            data: base64Audio,
          },
        },
        { text: "Transcribe exactly what is said in this audio. Return only the text, no explanations." },
      ],
    },
  });

  return response.text || "";
};

/**
 * Recalculates macros based on user correction text via Gemini.
 */
export const recalculateMacros = async (
  currentAnalysis: AnalysisResult,
  userCorrection: string
): Promise<AnalysisResult> => {
  const prompt = `
    Текущий анализ: ${JSON.stringify(currentAnalysis)}
    Исправление пользователя: "${userCorrection}"
    
    Задача:
    1. Обнови состав продуктов и вес на основе исправления пользователя.
    2. Если пользователь указывает новый вес, пересчитай КБЖУ.
    3. Если пользователь добавляет продукт, найди его КБЖУ и добавь.
    4. Если удаляет, убери из списка.
    5. Верни полностью обновленный объект JSON в том же формате.
  `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: { parts: [{ text: prompt }] },
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: analysisSchema,
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");

  const result = JSON.parse(text);
  result.modelUsed = "Gemini 2.5 Flash";
  return result;
};