"""Prometheus metrics for monitoring application health and security."""
from prometheus_client import Counter, Histogram


# Security Metrics
rag_cross_tenant_leak_counter = Counter(
    "rag_cross_tenant_leak_total",
    "Total cross-tenant document leaks detected in RAG queries",
    ["tenant_id", "leak_source"],
)


# Performance Metrics
rag_query_latency_histogram = Histogram(
    "rag_query_latency_seconds",
    "RAG query latency in seconds",
    ["tenant_id"],
    buckets=(0.1, 0.5, 1.0, 2.0, 5.0, 10.0),
)


# Request Metrics
llm_requests_counter = Counter(
    "llm_requests_total",
    "Total LLM API requests",
    ["tenant_id", "model"],
)

llm_tokens_used_counter = Counter(
    "llm_tokens_used_total",
    "Total LLM tokens consumed",
    ["tenant_id"],
)

rate_limit_violations_counter = Counter(
    "rate_limit_violations_total",
    "Total rate limit violations",
    ["tenant_id", "type"],  # type: rpm or tpm
)
