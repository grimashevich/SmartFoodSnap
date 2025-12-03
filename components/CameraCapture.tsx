import React, { useRef } from 'react';
import { Camera, Image as ImageIcon } from 'lucide-react';

interface CameraCaptureProps {
  onImageSelected: (file: File) => void;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onImageSelected }) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImageSelected(e.target.files[0]);
    }
  };

  const triggerCamera = () => {
    cameraInputRef.current?.click();
  };

  const triggerGallery = () => {
    galleryInputRef.current?.click();
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Direct Camera Input */}
      <input
        type="file"
        accept="image/*"
        capture="environment" // Forces rear camera on mobile
        className="hidden"
        ref={cameraInputRef}
        onChange={handleFileChange}
      />
      
      {/* Gallery Input */}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        ref={galleryInputRef}
        onChange={handleFileChange}
      />

      <div className="grid grid-cols-2 gap-3 h-40">
        {/* Camera Button */}
        <button 
          onClick={triggerCamera}
          className="flex flex-col items-center justify-center gap-3 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl shadow-md transition-all active:scale-95"
          style={{ backgroundColor: 'var(--tg-theme-button-color, #3b82f6)', color: 'var(--tg-theme-button-text-color, white)' }}
        >
          <div className="p-3 bg-white/20 rounded-full">
            <Camera className="w-8 h-8" />
          </div>
          <span className="font-medium">Сделать фото</span>
        </button>

        {/* Gallery Button */}
        <button 
          onClick={triggerGallery}
          className="flex flex-col items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-2xl shadow-sm transition-all active:scale-95"
          style={{ 
            backgroundColor: 'var(--tg-theme-bg-color, white)', 
            color: 'var(--tg-theme-text-color, #374151)',
            borderColor: 'var(--tg-theme-hint-color, #e5e7eb)'
          }}
        >
          <div className="p-3 bg-gray-100 rounded-full" style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color, #f3f4f6)' }}>
            <ImageIcon className="w-8 h-8 text-gray-500" style={{ color: 'var(--tg-theme-hint-color, #6b7280)' }} />
          </div>
          <span className="font-medium">Загрузить</span>
        </button>
      </div>
    </div>
  );
};

export default CameraCapture;