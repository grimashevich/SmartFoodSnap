import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  isProcessing: boolean;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({ onRecordingComplete, isProcessing }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        onRecordingComplete(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerIntervalRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Не удалось получить доступ к микрофону.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  // CSS for the waveform animation
  const barStyle = (delay: string) => ({
    animation: 'sound-wave 1s ease-in-out infinite',
    animationDelay: delay,
  });

  return (
    <div className="flex items-center">
      <style>{`
        @keyframes sound-wave {
          0%, 100% { height: 4px; }
          50% { height: 16px; }
        }
      `}</style>
      
      {isProcessing ? (
        <button disabled className="p-3 rounded-full bg-gray-100 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </button>
      ) : isRecording ? (
        <div className="flex items-center gap-3 bg-red-50 px-4 py-2 rounded-full border border-red-100 animate-in fade-in duration-200">
          <div className="flex items-center gap-1 h-6">
            <div className="w-1 bg-red-500 rounded-full" style={barStyle('0.0s')}></div>
            <div className="w-1 bg-red-500 rounded-full" style={barStyle('0.1s')}></div>
            <div className="w-1 bg-red-500 rounded-full" style={barStyle('0.2s')}></div>
            <div className="w-1 bg-red-500 rounded-full" style={barStyle('0.3s')}></div>
          </div>
          <span className="text-red-600 font-mono text-sm w-10 text-center">{formatTime(recordingTime)}</span>
          <button
            onClick={stopRecording}
            className="p-1.5 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors shadow-sm"
            title="Остановить"
          >
            <Square className="w-3 h-3 fill-current" />
          </button>
        </div>
      ) : (
        <button
          onClick={startRecording}
          className="p-3 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors shadow-sm hover:shadow-md"
          title="Записать голосовое сообщение"
        >
          <Mic className="w-6 h-6" />
        </button>
      )}
    </div>
  );
};

export default AudioRecorder;