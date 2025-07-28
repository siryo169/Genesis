"""
Main entry point for the CSV processing pipeline.
Run with: python -m src.main
"""
import uvicorn
from .config.settings import settings
from .api.app import app

def main():
    """Start the FastAPI application."""
    uvicorn.run(
        "src.api.app:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=False
    )

if __name__ == "__main__":
    main() 