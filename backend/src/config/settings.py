"""
Configuration module for loading and validating environment variables.
"""
import os
from pathlib import Path
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load .env file from project root if it exists
load_dotenv(dotenv_path=Path(__file__).parent.parent.parent.parent / ".env")

class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    Provides default values for development but requires proper
    configuration in production.
    """
    # API Keys
    GEMINI_API_KEY: str = None

    # Pipeline Configuration
    SAMPLE_THRESHOLD: int = 600
    INPUT_DIR: str = "data/inbound"
    OUTPUT_DIR: str = "data/output"
    INVALID_DIR: str = "data/invalid"
    NOT_TABULAR_DIR: str = "data/not_tabular"
    LOGS_DIR: str = "logs"
    PIPELINE_MODE: str = os.getenv("PIPELINE_MODE", "demo")

    # Database Configuration
    DATABASE_URL: str = "sqlite:///pipeline.db"

    # API Configuration
    API_HOST: str = "localhost"
    API_PORT: int = 8000

    class Config:
        env_file = ".env"
        case_sensitive = True

    def validate_paths(self):
        """Create necessary directories if they don't exist."""
        for path in [self.INPUT_DIR, self.OUTPUT_DIR, self.INVALID_DIR, self.NOT_TABULAR_DIR, self.LOGS_DIR]:
            Path(path).mkdir(parents=True, exist_ok=True)

    def validate_api_key(self):
        """Validate that required API keys are present."""
        if not self.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY must be set in environment variables")

# Create global settings instance
settings = Settings()

# Validate settings on import
settings.validate_paths()
settings.validate_api_key() 