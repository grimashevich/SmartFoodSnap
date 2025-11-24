import React, { useState, useEffect } from 'react';
import { Loader2, Send, ChevronRight, Edit3, ArrowLeft, Leaf, Flame, Activity } from 'lucide-react';
import CameraCapture from './components/CameraCapture';
import NutritionChart from './components/NutritionChart';
import AudioRecorder from './components/AudioRecorder';
import { analyzeFoodImage, recalculateMacros, transcribeAudio } from './services/geminiService';
import { AnalysisResult, AppState } from './types';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [correctionText, setCorrectionText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>('');

  const handleImageSelect = async (file: File) => {
    setAppState(AppState.ANALYZING_IMAGE);
    setLoadingMessage('Изучаю фото и распознаю продукты...');
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      setSelectedImage(base64String);

      // Extract base64 data without prefix for Gemini
      const base64Data = base64String.split(',')[1];
      const mimeType = file.type;

      try {
        const result = await analyzeFoodImage(base64Data, mimeType);
        setAnalysisResult(result);
        setAppState(AppState.RESULT_VIEW);
      } catch (error) {
        setErrorMessage("Не удалось проанализировать изображение. Попробуйте другое фото.");
        setAppState(AppState.ERROR);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCorrectionSubmit = async () => {
    if (!correctionText.trim() || !analysisResult) return;
    
    setAppState(AppState.PROCESSING_CORRECTION);
    setLoadingMessage('Пересчитываю КБЖУ с учетом правок...');
    
    try {
      const newResult = await recalculateMacros(analysisResult, correctionText);
      setAnalysisResult(newResult);
      setCorrectionText('');
      setAppState(AppState.RESULT_VIEW);
    } catch (error) {
      setErrorMessage("Не удалось пересчитать данные. Попробуйте еще раз.");
      setAppState(AppState.RESULT_VIEW); // Go back to view even on error
    }
  };

  const handleAudioCorrection = async (blob: Blob) => {
    setAppState(AppState.PROCESSING_CORRECTION); 
    setLoadingMessage('Распознаю голос...');
    
    try {
      const transcription = await transcribeAudio(blob);
      setCorrectionText(transcription);
      // Automatically return to result view to let user confirm/edit text
      setAppState(AppState.RESULT_VIEW);
    } catch (error) {
      setErrorMessage("Не удалось распознать речь.");
      setAppState(AppState.RESULT_VIEW);
    }
  };

  const resetApp = () => {
    setAppState(AppState.IDLE);
    setSelectedImage(null);
    setAnalysisResult(null);
    setCorrectionText('');
    setErrorMessage(null);
  };

  const getConfidenceStyle = (score: number) => {
    const percentage = Math.round(score * 100);
    if (score >= 0.8) return { 
      className: 'bg-green-100 text-green-700 border-green-200', 
      label: `${percentage}%`,
      title: 'Высокая точность'
    };
    if (score >= 0.5) return { 
      className: 'bg-yellow-100 text-yellow-700 border-yellow-200', 
      label: `${percentage}%`,
      title: 'Средняя точность'
    };
    return { 
      className: 'bg-red-100 text-red-700 border-red-200', 
      label: `${percentage}%`,
      title: 'Низкая точность'
    };
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto shadow-2xl overflow-hidden relative">
      {/* Header */}
      <header className="bg-white px-6 py-4 shadow-sm z-30 sticky top-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-green-500 p-2 rounded-lg">
             <Leaf className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-800 tracking-tight">NutriScan AI</h1>
        </div>
        {appState !== AppState.IDLE && (
           <button onClick={resetApp} className="text-sm text-gray-500 hover:text-green-600 font-medium">
             Новое фото
           </button>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 pb-24 relative">
        
        {/* State: IDLE */}
        {appState === AppState.IDLE && (
          <div className="flex flex-col h-full justify-center space-y-8 animate-fade-in">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-gray-800">Что у нас на тарелке?</h2>
              <p className="text-gray-500">Загрузите фото еды, чтобы узнать калорийность и состав.</p>
            </div>
            <CameraCapture onImageSelected={handleImageSelect} />
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
                <div className="bg-orange-100 p-3 rounded-full mb-3">
                  <Flame className="w-6 h-6 text-orange-500" />
                </div>
                <span className="font-semibold text-gray-700">Точный подсчет</span>
                <span className="text-xs text-gray-400 mt-1">AI определяет вес</span>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
                <div className="bg-blue-100 p-3 rounded-full mb-3">
                  <Activity className="w-6 h-6 text-blue-500" />
                </div>
                <span className="font-semibold text-gray-700">Голосовой ввод</span>
                <span className="text-xs text-gray-400 mt-1">Корректируй голосом</span>
              </div>
            </div>
          </div>
        )}

        {/* State: ANALYZING (Initial Full Screen Loader) */}
        {appState === AppState.ANALYZING_IMAGE && (
          <div className="flex flex-col items-center justify-center h-full space-y-6 absolute inset-0 bg-gray-50 z-20">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-green-100 border-t-green-500 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                 <Leaf className="w-8 h-8 text-green-500 animate-pulse" />
              </div>
            </div>
            <p className="text-gray-600 font-medium text-center max-w-xs animate-pulse">
              {loadingMessage}
            </p>
          </div>
        )}

        {/* State: ERROR */}
        {appState === AppState.ERROR && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
            <div className="bg-red-50 p-6 rounded-full">
              <span className="text-4xl">😕</span>
            </div>
            <h3 className="text-lg font-bold text-gray-800">Упс, что-то пошло не так</h3>
            <p className="text-gray-500 max-w-xs">{errorMessage}</p>
            <button 
              onClick={resetApp}
              className="px-6 py-2 bg-gray-800 text-white rounded-lg shadow-lg hover:bg-gray-700 transition"
            >
              Попробовать снова
            </button>
          </div>
        )}

        {/* State: RESULT VIEW (and PROCESSING_CORRECTION via overlay) */}
        {(appState === AppState.RESULT_VIEW || appState === AppState.PROCESSING_CORRECTION) && analysisResult && (
          <div className="space-y-6 animate-fade-in-up relative">
            
            {/* Loading Overlay for Corrections */}
            {appState === AppState.PROCESSING_CORRECTION && (
               <div className="absolute inset-0 -m-4 bg-white/80 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center rounded-xl">
                  <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center animate-in zoom-in duration-200">
                    <Loader2 className="w-10 h-10 text-green-500 animate-spin mb-4" />
                    <p className="text-gray-800 font-medium text-center">{loadingMessage}</p>
                    <p className="text-xs text-gray-400 mt-2">Использую Thinking Mode</p>
                  </div>
               </div>
            )}

            {/* Top Image Preview */}
            <div className="relative h-48 rounded-xl overflow-hidden shadow-md">
              <img src={selectedImage || ''} alt="Food" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end p-4">
                <span className="text-white font-medium text-sm bg-black/30 backdrop-blur-md px-3 py-1 rounded-full">
                  Анализ завершен
                </span>
              </div>
            </div>

            {/* AI Summary */}
            <div className="bg-green-50 border border-green-100 p-4 rounded-xl text-sm text-green-900">
               <div className="flex items-start gap-2">
                  <div className="min-w-[20px] pt-0.5"><Leaf className="w-4 h-4 text-green-600"/></div>
                  <p>{analysisResult.summary}</p>
               </div>
            </div>

            {/* Chart */}
            <NutritionChart macros={analysisResult.total} />

            {/* Food Items List */}
            <div>
              <h3 className="font-bold text-gray-800 mb-3 px-1">Распознанные продукты</h3>
              <div className="space-y-3">
                {analysisResult.items.map((item, idx) => {
                  const confStyle = getConfidenceStyle(item.confidence || 0);
                  return (
                    <div key={idx} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-gray-800">{item.name}</p>
                          <div title={confStyle.title} className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${confStyle.className}`}>
                            {confStyle.label}
                          </div>
                        </div>
                        <p className="text-sm text-gray-400">{item.weightGrams} г</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-800">{Math.round(item.macros.calories)} ккал</p>
                        <p className="text-xs text-gray-400">
                          Б:{Math.round(item.macros.protein)} Ж:{Math.round(item.macros.fat)} У:{Math.round(item.macros.carbs)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Total Summary Card */}
            <div className="bg-gray-800 text-white p-5 rounded-xl shadow-lg mt-4">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Итого за прием пищи</p>
                  <p className="text-3xl font-bold">{Math.round(analysisResult.total.calories)} <span className="text-lg font-normal text-gray-400">ккал</span></p>
                </div>
                <div className="flex gap-3 text-sm">
                   <div className="text-center"><div className="font-bold text-blue-300">{Math.round(analysisResult.total.protein)}</div><div className="text-gray-500 text-xs">Белки</div></div>
                   <div className="text-center"><div className="font-bold text-orange-300">{Math.round(analysisResult.total.fat)}</div><div className="text-gray-500 text-xs">Жиры</div></div>
                   <div className="text-center"><div className="font-bold text-green-300">{Math.round(analysisResult.total.carbs)}</div><div className="text-gray-500 text-xs">Угл</div></div>
                </div>
              </div>
            </div>
            
            {/* Spacing for fixed bottom bar */}
            <div className="h-20"></div>
          </div>
        )}
      </main>

      {/* Bottom Correction Bar (Result View & Processing) */}
      {(appState === AppState.RESULT_VIEW || appState === AppState.PROCESSING_CORRECTION) && analysisResult && (
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 shadow-lg z-40 backdrop-blur-lg bg-opacity-95">
           {errorMessage && (
             <div className="absolute -top-12 left-4 right-4 bg-red-500 text-white text-xs p-2 rounded-lg text-center animate-bounce">
               {errorMessage}
             </div>
           )}
          <div className="flex gap-2 items-center">
            <AudioRecorder 
              onRecordingComplete={handleAudioCorrection} 
              isProcessing={appState === AppState.PROCESSING_CORRECTION}
            />
            <div className="flex-1 relative">
              <input
                type="text"
                value={correctionText}
                onChange={(e) => setCorrectionText(e.target.value)}
                placeholder="Исправить (напр: 'риса 200г')"
                disabled={appState === AppState.PROCESSING_CORRECTION}
                className="w-full pl-4 pr-10 py-3 bg-gray-100 rounded-full text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all disabled:opacity-50"
                onKeyDown={(e) => e.key === 'Enter' && handleCorrectionSubmit()}
              />
              {correctionText.length > 0 && appState !== AppState.PROCESSING_CORRECTION && (
                <button 
                  onClick={handleCorrectionSubmit}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 bg-green-500 text-white rounded-full hover:bg-green-600 transition"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <p className="text-[10px] text-gray-400 text-center mt-2">
            Зажмите микрофон или напишите текст для уточнения веса или состава.
          </p>
        </div>
      )}
    </div>
  );
};

export default App;