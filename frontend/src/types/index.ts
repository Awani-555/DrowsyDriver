/**
 * TypeScript types for the application
 * Types = Data structure definitions
 */

export interface DetectionResult {
  ear: number | null;
  status: 'AWAKE' | 'DROWSY' | 'NO_FACE' | 'ERROR';
  alert_triggered: boolean;
  closed_eyes_frames: number;
  frame_count: number;
  drowsy_frames: number;
  frame_base64?: string;
  message?: string;
}

export interface Config {
  ear_threshold: number;
  consecutive_frames: number;
  window_size: number;
}

export interface Stats {
  frames_processed: number;
  drowsy_frames: number;
  drowsy_percentage: number;
}