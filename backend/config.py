"""Shared settings; production secrets are supplied by the process environment."""
import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env", override=False)
PRODUCTION = os.getenv("APP_ENV", "development").lower() == "production"
DATA_DIR = Path(os.getenv("DATA_DIR", str(BASE_DIR / "data"))).resolve()
DB_PATH = Path(os.getenv("DATABASE_PATH", str(DATA_DIR / "glowguide.db"))).resolve()
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", str(DATA_DIR / "uploads"))).resolve()
COOKIE_SECURE = PRODUCTION or os.getenv("COOKIE_SECURE", "false").lower() == "true"
FRONTEND_DIR = BASE_DIR / "frontend"
