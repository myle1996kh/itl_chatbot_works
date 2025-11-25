-- Initialize pgvector extension for AgentHub
-- This script runs automatically when the PostgreSQL container starts for the first time

-- Create pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create uuid extension (for UUID generation)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Verify extensions are installed
SELECT extname, extversion FROM pg_extension WHERE extname IN ('vector', 'uuid-ossp');

-- Performance tuning for pgvector
-- Set work_mem higher for vector operations
ALTER DATABASE chatbot_itl SET work_mem = '64MB';

-- Log success
DO $$
BEGIN
    RAISE NOTICE 'AgentHub database initialized successfully';
    RAISE NOTICE 'Extensions installed: vector, uuid-ossp';
END $$;
