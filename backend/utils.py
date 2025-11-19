"""
Utility functions for drowsiness detection
Eye Aspect Ratio (EAR) calculation
"""

import math

# These are the indices of eye landmarks from MediaPipe
LEFT_EYE = [33, 160, 158, 133, 153, 144]
RIGHT_EYE = [263, 387, 385, 362, 380, 373]


def euclidean_distance(p1, p2):
    """
    Calculate straight-line distance between two points
    
    Args:
        p1: (x1, y1) - first point
        p2: (x2, y2) - second point
    
    Returns:
        float: distance between points
    
    Example:
        distance((0, 0), (3, 4)) returns 5.0
    """
    return math.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2)


def calculate_EAR(landmarks, frame_shape):
    """
    Calculate Eye Aspect Ratio from facial landmarks
    
    Args:
        landmarks: MediaPipe face landmarks object
        frame_shape: (height, width, channels) of the frame
    
    Returns:
        float: EAR value (0.1-0.4 typically)
                Higher = eyes more open
                Lower = eyes more closed
    
    Formula:
        EAR = (||p2 - p6|| + ||p3 - p5||) / (2 * ||p1 - p4||)
        where p1-p6 are the 6 eye landmark points
    """
    
    h, w, _ = frame_shape  
    
    try:
        if landmarks is None:
            return None
        
        # Convert landmark coordinates from normalized (0-1) to pixel values
        points = []
        for idx in LEFT_EYE + RIGHT_EYE:  
            lm = landmarks.landmark[idx] 
            x = int(lm.x * w)  
            y = int(lm.y * h)  
            points.append((x, y))
        
        # Split into left and right eyes
        left_eye = points[:6]  
        right_eye = points[6:]  
        
        # Calculate EAR for one eye
        def calculate_eye_ear(eye):
            vertical1 = euclidean_distance(eye[1], eye[5])  
            vertical2 = euclidean_distance(eye[2], eye[4])  
            horizontal = euclidean_distance(eye[0], eye[3])  
            
            # Apply formula
            ear = (vertical1 + vertical2) / (2.0 * horizontal)
            return ear
        
        # Calculate for both eyes and average them
        left_ear = calculate_eye_ear(left_eye)
        right_ear = calculate_eye_ear(right_eye)
        
        return (left_ear + right_ear) / 2.0
    
    except Exception as e:
        print(f"Error calculating EAR: {e}")
        return None