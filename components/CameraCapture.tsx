import React, { useRef, useState, useEffect } from 'react';
import { Camera, Image as ImageIcon, X, Zap, ZapOff, RefreshCcw } from 'lucide-react';

interface CameraCaptureProps {
  onImageSelected: (file: File) => void;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onImageSelected }) => {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  
  // This ref tracks the active stream to ensure we can stop it on unmount/close
  const activeStreamRef = useRef<MediaStream | null>(null);

  // Effect to handle Camera Lifecycle
  useEffect(() => {
    let mounted = true;

    const initCamera = async () => {
      // Only initialize if the UI is open
      if (!isCameraOpen) return;

      try {
        setCameraError(null);
        
        // 1. Get the stream
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: facingMode,
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: false
        });

        // 2. Store it for cleanup
        activeStreamRef.current = stream;

        // 3. Attach to video element (which now exists because isCameraOpen is true)
        if (mounted && videoRef.current) {
          videoRef.current.srcObject = stream;
          // Ensure video plays (sometimes needed on mobile)
          try {
            await videoRef.current.play();
          } catch (e) {
            console.error("Play error:", e);
          }
        } else {
          // If component unmounted or ref is missing, stop immediately
          stream.getTracks().forEach(track => track.stop());
        }

      } catch (err: any) {
        console.error("Camera access error:", err);
        if (mounted) {
          setCameraError("Не удалось открыть камеру. Проверьте разрешения.");
          // Don't close immediately so user sees the error, but maybe offer retry
        }
      }
    };

    initCamera();

    // Cleanup function: runs when facingMode changes, isCameraOpen becomes false, or component unmounts
    return () => {
      mounted = false;
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach(track => track.stop());
        activeStreamRef.current = null;
      }
    };
  }, [isCameraOpen, facingMode]);

  const openCamera = () => {
    setIsCameraOpen(true);
  };

  const closeCamera = () => {
    setIsCameraOpen(false);
    setCameraError(null);
  };

  const switchCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Set canvas size to match video resolution
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw the current frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert to blob/file
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], "camera_capture.jpg", { type: "image/jpeg" });
            closeCamera();
            onImageSelected(file);
          }
        }, 'image/jpeg', 0.9);
      }
    }
  };

  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImageSelected(e.target.files[0]);
    }
  };

  const triggerGallery = () => {
    galleryInputRef.current?.click();
  };

  // Render Full Screen Camera Overlay
  if (isCameraOpen) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
           {/* Video Feed */}
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="absolute inset-0 w-full h-full object-cover" 
          />
          
          {/* Top Controls */}
          <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start bg-gradient-to-b from-black/50 to-transparent z-10">
             <button 
               onClick={closeCamera}
               className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30"
             >
               <X className="w-6 h-6" />
             </button>
             
             <button 
               onClick={switchCamera}
               className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30"
             >
               <RefreshCcw className="w-6 h-6" />
             </button>
          </div>
          
          {/* Bottom Controls (Shutter) */}
          <div className="absolute bottom-0 left-0 right-0 p-8 flex justify-center items-center bg-gradient-to-t from-black/50 to-transparent z-10 pb-12">
             <button 
               onClick={capturePhoto}
               className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center bg-white/20 active:scale-95 transition-transform shadow-lg"
             >
               <div className="w-16 h-16 bg-white rounded-full"></div>
             </button>
          </div>
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Error Message if camera failed */}
      {cameraError && (
        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 text-center mb-2">
          {cameraError}
        </div>
      )}

      {/* Gallery Input (Hidden) */}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        ref={galleryInputRef}
        onChange={handleGalleryChange}
      />

      <div className="grid grid-cols-2 gap-3 h-40">
        {/* Camera Button */}
        <button 
          onClick={openCamera}
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