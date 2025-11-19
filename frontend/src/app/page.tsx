'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useWebcam } from '@/hooks/useWebcam';
import { api } from '@/services/api';
import { DetectionResult, Stats, Config } from '@/types';

export default function Home() {
  // Webcam hook
  const { videoRef, canvasRef, startWebcam, stopWebcam, captureFrame, error: webcamError } = useWebcam();
  
  // State
  const [isRunning, setIsRunning] = useState(false);
  const [detectionData, setDetectionData] = useState<DetectionResult | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [processedFrame, setProcessedFrame] = useState<string | null>(null);
  
  // Refs for cleanup
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Check backend connection on mount
  useEffect(() => {
    const checkBackend = async () => {
      try {
        await api.healthCheck();
        setIsBackendConnected(true);
      } catch {
        setIsBackendConnected(false);
      }
    };
    
    checkBackend();
  }, []);

  // Load config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const cfg = await api.getConfig();
        setConfig(cfg);
      } catch (err) {
        console.error('Failed to load config:', err);
      }
    };
    
    loadConfig();
  }, []);

  // Update stats every 2 seconds while running
  useEffect(() => {
    if (!isRunning) return;
    
    const statsInterval = setInterval(async () => {
      try {
        const newStats = await api.getStats();
        setStats(newStats);
      } catch (err) {
        console.error('Failed to load stats:', err);
      }
    }, 2000);
    
    return () => clearInterval(statsInterval);
  }, [isRunning]);

  /**
   * Handle Start button click
   */
  async function handleStart() {
    if (!isBackendConnected) {
      alert('Backend is not connected. Make sure the backend is running on http://localhost:8000');
      return;
    }
    
    try {
      await startWebcam();
      setIsRunning(true);
      
      // Start sending frames every 100ms (10 FPS)
      intervalRef.current = setInterval(async () => {
        await processAndSendFrame();
      }, 100);
      
    } catch (err) {
      alert('Failed to start: ' + err);
    }
  }

  /**
   * Handle Stop button click
   */
  function handleStop() {
    setIsRunning(false);
    stopWebcam();
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  }

  /**
   * Capture frame and send to backend
   */
  async function processAndSendFrame() {
    const frameDataUrl = captureFrame();
    if (!frameDataUrl) return;
    
    try {
      // Convert data URL to Blob
      const blob = await fetch(frameDataUrl).then(r => r.blob());
      
      // Send to backend
      const result = await api.processFrame(blob);
      
      setDetectionData(result);
      
      // If there's an annotated frame, display it
      if (result.frame_base64) {
        setProcessedFrame(`data:image/jpeg;base64,${result.frame_base64}`);
      }
      
      // If drowsy alert, play sound
      if (result.alert_triggered && !audioRef.current?.paused) {
        playAlert();
      }
      
    } catch (err) {
      console.error('Frame processing error:', err);
    }
  }

  /**
   * Play alert sound
   */
  function playAlert() {
    // Use a simple beep sound
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800; // 800 Hz
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  }

  /**
   * Handle reset stats
   */
  async function handleResetStats() {
    try {
      await api.resetStats();
      setStats(null);
      setDetectionData(null);
      alert('Stats reset successfully');
    } catch (err) {
      alert('Failed to reset stats: ' + err);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-2">🚗 DrowsyDriver</h1>
          <p className="text-gray-400 text-lg">Real-time Driver Drowsiness Detection</p>
          
          {/* Backend Status */}
          <div className="mt-4 flex justify-center items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isBackendConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-300">
              Backend: {isBackendConnected ? '✓ Connected' : '✗ Disconnected'}
            </span>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left: Webcam Feed (2 columns) */}
          <div className="lg:col-span-2">
            <div className="bg-slate-700 rounded-lg p-6 shadow-2xl">
              <h2 className="text-2xl font-bold text-white mb-4">📹 Live Feed</h2>
              
              {/* Video Element */}
              <div className="bg-black rounded-lg aspect-video overflow-hidden mb-4 border-2 border-slate-600">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full"
                />
              </div>

              {/* Hidden Canvas for Frame Capture */}
              <canvas
                ref={canvasRef}
                className="hidden"
                width="640"
                height="480"
              />

              {/* Error Messages */}
              {webcamError && (
                <div className="mb-4 p-3 bg-red-900 border border-red-500 text-red-200 rounded">
                  ⚠️ {webcamError}
                </div>
              )}

              {/* Control Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleStart}
                  disabled={isRunning || !isBackendConnected}
                  className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {isRunning ? '▶ Running...' : '▶ Start Detection'}
                </button>
                <button
                  onClick={handleStop}
                  disabled={!isRunning}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  ⏹ Stop Detection
                </button>
              </div>
            </div>

            {/* Processed Frame */}
            {processedFrame && isRunning && (
              <div className="mt-6 bg-slate-700 rounded-lg p-6 shadow-2xl">
                <h3 className="text-lg font-bold text-white mb-3">📊 Annotated Frame</h3>
                <img
                  src={processedFrame}
                  alt="Processed"
                  className="w-full rounded-lg border-2 border-slate-600"
                />
              </div>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="space-y-4">
            
            {/* Status Card */}
            <div className="bg-slate-700 rounded-lg p-6 shadow-2xl">
              <h3 className="text-sm text-gray-400 mb-2 uppercase tracking-wider">Current Status</h3>
              <div className={`text-4xl font-bold ${
                detectionData?.alert_triggered 
                  ? 'text-red-500' 
                  : detectionData?.status === 'NO_FACE'
                  ? 'text-yellow-500'
                  : 'text-green-500'
              }`}>
                {detectionData?.status || 'READY'}
              </div>
              {detectionData?.alert_triggered && (
                <p className="text-red-400 text-sm mt-2">🚨 ALERT TRIGGERED!</p>
              )}
            </div>

            {/* EAR Value */}
            <div className="bg-slate-700 rounded-lg p-6 shadow-2xl">
              <h3 className="text-sm text-gray-400 mb-2 uppercase tracking-wider">Eye Aspect Ratio</h3>
              <div className="text-3xl font-bold text-blue-400">
                {detectionData?.ear?.toFixed(4) || '0.0000'}
              </div>
              <div className="w-full bg-slate-600 rounded-full h-2 mt-3">
                <div
                  className={`h-2 rounded-full transition-all ${
                    (detectionData?.ear || 0) < 0.25 ? 'bg-red-500' : 'bg-green-500'
                  }`}
                  style={{
                    width: `${Math.min((detectionData?.ear || 0) * 200, 100)}%`
                  }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">Threshold: {config?.ear_threshold || 0.25}</p>
            </div>

            {/* Eyes Closed Counter */}
            <div className="bg-slate-700 rounded-lg p-6 shadow-2xl">
              <h3 className="text-sm text-gray-400 mb-2 uppercase tracking-wider">Eyes Closed Frames</h3>
              <div className="text-3xl font-bold text-yellow-400">
                {detectionData?.closed_eyes_frames || 0} / {config?.consecutive_frames || 20}
              </div>
              <div className="w-full bg-slate-600 rounded-full h-2 mt-3">
                <div
                  className="bg-yellow-500 h-2 rounded-full transition-all"
                  style={{
                    width: `${Math.min(((detectionData?.closed_eyes_frames || 0) / (config?.consecutive_frames || 20)) * 100, 100)}%`
                  }}
                />
              </div>
            </div>

            {/* Statistics */}
            {stats && (
              <div className="bg-slate-700 rounded-lg p-6 shadow-2xl">
                <h3 className="text-sm text-gray-400 mb-3 uppercase tracking-wider">Session Stats</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-300">Frames Processed:</span>
                    <span className="font-bold text-white">{stats.frames_processed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Drowsy Frames:</span>
                    <span className="font-bold text-red-400">{stats.drowsy_frames}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Drowsy %:</span>
                    <span className="font-bold text-orange-400">{stats.drowsy_percentage.toFixed(1)}%</span>
                  </div>
                </div>
                <button
                  onClick={handleResetStats}
                  className="w-full mt-4 px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white text-xs rounded transition"
                >
                  🔄 Reset Stats
                </button>
              </div>
            )}

            {/* Configuration */}
            {config && (
              <div className="bg-slate-700 rounded-lg p-6 shadow-2xl">
                <h3 className="text-sm text-gray-400 mb-3 uppercase tracking-wider">Configuration</h3>
                <div className="space-y-2 text-xs">
                  <p className="text-gray-300">
                    <span className="text-gray-400">EAR Threshold:</span>
                    <span className="float-right font-mono text-white">{config.ear_threshold}</span>
                  </p>
                  <p className="text-gray-300">
                    <span className="text-gray-400">Consecutive:</span>
                    <span className="float-right font-mono text-white">{config.consecutive_frames}</span>
                  </p>
                  <p className="text-gray-300">
                    <span className="text-gray-400">Window Size:</span>
                    <span className="float-right font-mono text-white">{config.window_size}</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Debug Info */}
        <div className="mt-8 bg-slate-700 rounded-lg p-4 text-xs text-gray-400">
          <details>
            <summary className="cursor-pointer font-semibold text-gray-300">📋 Debug Info</summary>
            <pre className="mt-2 overflow-auto max-h-40 bg-slate-800 p-2 rounded">
{JSON.stringify({
  backend_connected: isBackendConnected,
  detection_running: isRunning,
  current_status: detectionData?.status,
  api_url: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
}, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    </main>
  );
}