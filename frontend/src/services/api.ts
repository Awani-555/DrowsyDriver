/**
 * API Service
 * All backend API calls happen through this file
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const api = {
  /**
   * Send a video frame to backend for analysis
   */
  async processFrame(file: Blob) {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(
      `${API_BASE}/api/process-frame`,
      {
        method: 'POST',
        body: formData
      }
    );
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return response.json();
  },

  /**
   * Check if backend is running
   */
  async healthCheck() {
    const response = await fetch(`${API_BASE}/api/health`);
    return response.json();
  },

  /**
   * Get current configuration
   */
  async getConfig() {
    const response = await fetch(`${API_BASE}/api/config`);
    return response.json();
  },

  /**
   * Update configuration
   */
  async updateConfig(config: any) {
    const response = await fetch(
      `${API_BASE}/api/config`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      }
    );
    return response.json();
  },

  /**
   * Get detection statistics
   */
  async getStats() {
    const response = await fetch(`${API_BASE}/api/stats`);
    return response.json();
  },

  /**
   * Reset statistics
   */
  async resetStats() {
    const response = await fetch(
      `${API_BASE}/api/reset`,
      { method: 'POST' }
    );
    return response.json();
  }
};