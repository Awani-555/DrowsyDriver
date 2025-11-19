/**
 * Custom React Hook for Webcam
 * Handles all webcam-related logic
 */

import { useRef, useState, useCallback, useEffect } from 'react';

export const useWebcam = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Start webcam stream
   */
  const startWebcam = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Request access to webcam
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });
      
      // Store stream for later
      streamRef.current = stream;
      
      // Connect stream to video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Camera access denied';
      setError(errorMsg);
      console.error('Webcam error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Stop webcam stream
   */
  const stopWebcam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  /**
   * Capture current video frame
   */
  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) {
      return null;
    }
    
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) {
      return null;
    }
    
    // Draw current video frame onto canvas
    ctx.drawImage(videoRef.current, 0, 0, 640, 480);
    
    // Return as data URL (like "data:image/jpeg;base64,...")
    return canvasRef.current.toDataURL('image/jpeg');
  }, []);

  // Cleanup when component unmounts
  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, [stopWebcam]);

  return {
    videoRef,
    canvasRef,
    isLoading,
    error,
    startWebcam,
    stopWebcam,
    captureFrame
  };
};