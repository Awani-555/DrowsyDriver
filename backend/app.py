"""
Main FastAPI application for DrowsyDriver
Real-time drowsiness detection backend
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import cv2
import numpy as np
import mediapipe as mp
from config import settings
from utils import calculate_EAR
import base64

# INITIALIZE FASTAPI AND MEDIAPIPE

app = FastAPI(
    title="DrowsyDriver API",
    description="Real-time drowsiness detection",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize MediaPipe FaceMesh
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(
    static_image_mode=False, 
    max_num_faces=1,  
    refine_landmarks=True,  
    min_detection_confidence=0.7, 
    min_tracking_confidence=0.7
)

# GLOBAL STATE (normally use database, but ok for demo)


class DetectionState:
    def __init__(self):
        self.closed_eye_counter = 0
        self.alert_triggered = False
        self.frame_count = 0
        self.drowsy_frames = 0

state = DetectionState()

# ENDPOINTS
@app.get("/api/health")
async def health_check():
    """
    Simple health check endpoint
    Use this to verify the backend is running
    """
    return {
        "status": "healthy",
        "service": "DrowsyDriver API",
        "version": "1.0.0"
    }


@app.post("/api/process-frame")
async def process_frame(file: UploadFile = File(...)):
    """
    Main endpoint for processing video frames
    
    Input:
        - file: JPG/PNG image file
    
    Output:
        {
            "ear": 0.35,
            "status": "AWAKE",
            "alert_triggered": false,
            "closed_eyes_frames": 0,
            "frame_count": 100,
            "drowsy_frames": 5
        }
    """
    
    try:
        state.frame_count += 1
        
        # Step 1: Read the uploaded file
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Validate frame
        if frame is None or frame.size == 0:
            raise HTTPException(status_code=400, detail="Invalid image file")
        
        # Step 2: Convert BGR to RGB (MediaPipe needs RGB)
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Step 3: Detect faces
        results = face_mesh.process(frame_rgb)
        
        # Check if face was detected
        if not results.face_landmarks:
            return {
                "ear": None,
                "status": "NO_FACE",
                "message": "No face detected in frame",
                "alert_triggered": False,
                "frame_count": state.frame_count
            }
        
        # Step 4: Calculate EAR
        ear = calculate_EAR(results.face_landmarks[0], frame.shape)
        
        if ear is None:
            return {
                "ear": None,
                "status": "ERROR",
                "message": "Could not calculate EAR",
                "alert_triggered": False,
                "frame_count": state.frame_count
            }
        
        # Step 5: Check for drowsiness
        if ear < settings.EAR_THRESHOLD:
            # Eyes are closed
            state.closed_eye_counter += 1
            
            if state.closed_eye_counter >= settings.CONSECUTIVE_FRAMES:
                # Eyes have been closed for long enough
                state.drowsy_frames += 1
                
                if not state.alert_triggered:
                    # First time triggering alert
                    state.alert_triggered = True
                    print("🚨 ALERT: DROWSINESS DETECTED!")
        else:
            # Eyes are open
            state.closed_eye_counter = 0
            state.alert_triggered = False
        
        # Step 6: Draw visualization
        frame = draw_visualization(frame, ear, state)
        
        # Step 7: Encode frame to base64 for sending to frontend
        _, buffer = cv2.imencode('.jpg', frame)
        frame_base64 = base64.b64encode(buffer).decode()
        
        # Step 8: Return results
        return {
            "ear": round(ear, 4),
            "status": "DROWSY" if state.alert_triggered else "AWAKE",
            "alert_triggered": state.alert_triggered,
            "closed_eyes_frames": state.closed_eye_counter,
            "frame_count": state.frame_count,
            "drowsy_frames": state.drowsy_frames,
            "frame_base64": frame_base64  # Send back annotated frame
        }
    
    except Exception as e:
        print(f"Error processing frame: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/config")
async def get_config():
    """
    Get current configuration
    """
    return {
        "ear_threshold": settings.EAR_THRESHOLD,
        "consecutive_frames": settings.CONSECUTIVE_FRAMES,
        "window_size": settings.WINDOW_SIZE
    }


@app.post("/api/config")
async def update_config(config: dict):
    """
    Update configuration
    """
    if "ear_threshold" in config:
        settings.EAR_THRESHOLD = float(config["ear_threshold"])
    
    if "consecutive_frames" in config:
        settings.CONSECUTIVE_FRAMES = int(config["consecutive_frames"])
    
    if "window_size" in config:
        settings.WINDOW_SIZE = int(config["window_size"])
    
    return {
        "status": "updated",
        "new_config": {
            "ear_threshold": settings.EAR_THRESHOLD,
            "consecutive_frames": settings.CONSECUTIVE_FRAMES,
            "window_size": settings.WINDOW_SIZE
        }
    }


@app.get("/api/stats")
async def get_stats():
    """
    Get detection statistics
    """
    drowsy_percentage = (
        (state.drowsy_frames / max(state.frame_count, 1)) * 100
    ) if state.frame_count > 0 else 0
    
    return {
        "frames_processed": state.frame_count,
        "drowsy_frames": state.drowsy_frames,
        "drowsy_percentage": round(drowsy_percentage, 2)
    }


@app.post("/api/reset")
async def reset_stats():
    """
    Reset statistics counter
    """
    state.frame_count = 0
    state.drowsy_frames = 0
    state.closed_eye_counter = 0
    state.alert_triggered = False
    
    return {"status": "reset"}


# HELPER FUNCTION: DRAW VISUALIZATION

def draw_visualization(frame, ear, state):
    """
    Draw status information on the frame
    """
    h, w = frame.shape[:2]
    
    # Determine color based on status
    status = "DROWSY!" if state.alert_triggered else "AWAKE"
    color = (0, 0, 255) if state.alert_triggered else (0, 255, 0)  # Red or Green
    
    # Draw text on frame
    cv2.putText(frame, f"EAR: {ear:.3f}", (10, 30), 
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
    
    cv2.putText(frame, status, (10, 80), 
                cv2.FONT_HERSHEY_SIMPLEX, 1.2, color, 3)
    
    cv2.putText(frame, f"Closed: {state.closed_eye_counter}/{settings.CONSECUTIVE_FRAMES}", 
                (10, 130), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    
    return frame

# RUN SERVER
if __name__ == "__main__":
    import uvicorn
    
    print("\n" + "="*60)
    print(" DrowsyDriver Backend Starting...")
    print("="*60)
    print(f"API running at http://{settings.API_HOST}:{settings.API_PORT}")
    print(f"Docs at http://localhost:8000/docs")
    print(f"EAR Threshold: {settings.EAR_THRESHOLD}")
    print(f"Consecutive Frames: {settings.CONSECUTIVE_FRAMES}")
    print("="*60 + "\n")
    
    uvicorn.run(
        app,
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=settings.DEBUG
    )