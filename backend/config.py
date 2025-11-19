"""
Configuration file for the backend
All settings are defined here for easy modification
"""

class Settings:
    # Detection parameters
    EAR_THRESHOLD = 0.25  
    CONSECUTIVE_FRAMES = 20 
    WINDOW_SIZE = 10 
    
    # API settings
    API_HOST = "0.0.0.0"  
    API_PORT = 8000
    DEBUG = True  
    
    # CORS settings 
    CORS_ORIGINS = ["*"] 

settings = Settings()