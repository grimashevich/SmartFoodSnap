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
  modelUsed?: string;
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

declare global {
  interface Window {
    Telegram: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        BackButton: {
          show: () => void;
          hide: () => void;
          onClick: (cb: () => void) => void;
          offClick: (cb: () => void) => void;
          isVisible: boolean;
        };
        MainButton: {
          show: () => void;
          hide: () => void;
          setText: (text: string) => void;
          onClick: (cb: () => void) => void;
          offClick: (cb: () => void) => void;
          showProgress: (leaveActive: boolean) => void;
          hideProgress: () => void;
          isActive: boolean;
          isVisible: boolean;
        };
        themeParams: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          link_color?: string;
          button_color?: string;
          button_text_color?: string;
          secondary_bg_color?: string;
        };
        initDataUnsafe?: any;
      };
    };
  }
}