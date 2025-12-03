-- ============================================================================
-- PostgreSQL Initialization Script for ITL AgentHub
-- ============================================================================
-- This script runs automatically when the PostgreSQL container starts
-- It enables the pgvector extension required for RAG functionality

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify extension is installed
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'ITL AgentHub database initialized successfully';
    RAISE NOTICE 'pgvector extension enabled';
END $$;
