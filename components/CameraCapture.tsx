import React, { useRef } from 'react';
import { Camera, Upload, ImagePlus } from 'lucide-react';

interface CameraCaptureProps {
  onImageSelected: (file: File) => void;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onImageSelected }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImageSelected(e.target.files[0]);
    }
  };

  const triggerSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-gray-300 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer" onClick={triggerSelect}>
      <input
        type="file"
        accept="image/*"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileChange}
      />
      <div className="flex flex-col items-center space-y-3 text-gray-500">
        <div className="p-4 bg-white rounded-full shadow-sm">
          <ImagePlus className="w-8 h-8 text-blue-500" />
        </div>
        <div className="text-center">
          <p className="font-medium text-gray-700">Нажмите, чтобы загрузить фото</p>
          <p className="text-sm text-gray-400">или сделайте снимок</p>
        </div>
      </div>
    </div>
  );
};

export default CameraCapture;
