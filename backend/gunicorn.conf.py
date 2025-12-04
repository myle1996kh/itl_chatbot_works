"""Gunicorn configuration for production deployment.

This config enables:
- Auto-scaling workers based on CPU cores
- Graceful reload with zero downtime
- Worker health monitoring and auto-restart
- Production-grade logging
"""
import multiprocessing
import os

# ============================================================================
# Worker Configuration
# ============================================================================

# Number of worker processes
# Formula: (2 x CPU cores) + 1
# Can be overridden with WORKERS env var
workers = int(os.getenv("WORKERS", multiprocessing.cpu_count() * 2 + 1))

# Worker class - use Uvicorn workers for ASGI support
worker_class = "uvicorn.workers.UvicornWorker"

# Worker connections (for async workers)
worker_connections = 1000

# ============================================================================
# Server Socket
# ============================================================================

# Binding address
bind = "0.0.0.0:8000"

# Backlog - number of pending connections
backlog = 2048

# ============================================================================
# Worker Lifecycle
# ============================================================================

# Timeout for workers (seconds)
# Increase if you have long-running requests
timeout = 120

# Graceful timeout for shutdown (seconds)
graceful_timeout = 30

# Keep-alive connections (seconds)
keepalive = 5

# Restart workers after N requests (prevent memory leaks)
max_requests = 1000
max_requests_jitter = 50

# ============================================================================
# Logging
# ============================================================================

# Access log
accesslog = "-"  # stdout

# Error log
errorlog = "-"  # stderr

# Log level
loglevel = os.getenv("LOG_LEVEL", "info").lower()

# Access log format
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# ============================================================================
# Process Naming
# ============================================================================

# Process name prefix
proc_name = "itl-chatbot"

# ============================================================================
# Server Hooks
# ============================================================================

def on_starting(server):
    """Called just before the master process is initialized."""
    server.log.info("Starting Gunicorn server")
    server.log.info(f"Workers: {workers}")
    server.log.info(f"Worker class: {worker_class}")
    server.log.info(f"Binding: {bind}")


def on_reload(server):
    """Called to recycle workers during a reload via SIGHUP."""
    server.log.info("Reloading workers")


def when_ready(server):
    """Called just after the server is started."""
    server.log.info("Server is ready. Spawning workers")


def worker_int(worker):
    """Called just after a worker exited on SIGINT or SIGQUIT."""
    worker.log.info(f"Worker {worker.pid} received INT or QUIT signal")


def worker_abort(worker):
    """Called when a worker received the SIGABRT signal."""
    worker.log.info(f"Worker {worker.pid} received SIGABRT signal")
