export interface MacroData {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface FoodItem {
  name: string;
  weightGrams: number;
  macros: MacroData;
  confidence: number;
}

export interface AnalysisResult {
  items: FoodItem[];
  total: MacroData;
  summary: string;
}

export enum AppState {
  IDLE = 'IDLE',
  ANALYZING_IMAGE = 'ANALYZING_IMAGE',
  RESULT_VIEW = 'RESULT_VIEW',
  PROCESSING_CORRECTION = 'PROCESSING_CORRECTION',
  ERROR = 'ERROR'
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}