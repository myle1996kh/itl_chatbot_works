"""
Test configuration and fixtures
"""
import pytest
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Add backend directory to Python path
backend_dir = Path(__file__).parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Load test environment
if os.path.exists(".env.test"):
    load_dotenv(".env.test")
else:
    load_dotenv(".env")  # Fallback to regular .env

@pytest.fixture(scope="session")
def test_tenant_id():
    """Test tenant ID"""
    return "3105b788-b5ff-4d56-88a9-532af4ab4ded"

@pytest.fixture(scope="session")
def test_jwt_token():
    """Test JWT token - load from environment or file"""
    # Try to load from file if it exists
    token_file = "jwt_test_token.txt"
    if os.path.exists(token_file):
        with open(token_file, 'r') as f:
            return f.read().strip()
    
    # Or return a mock token for development
    return os.getenv("TEST_JWT_TOKEN", "")

@pytest.fixture(scope="function")
def db_session():
    """Database session fixture with automatic rollback"""
    from src.database.connection import get_db_session
    
    with get_db_session() as session:
        yield session
        # Rollback after each test to keep database clean
        session.rollback()

@pytest.fixture(scope="session")
def test_client():
    """FastAPI test client"""
    from fastapi.testclient import TestClient
    from src.main import app
    
    return TestClient(app)
