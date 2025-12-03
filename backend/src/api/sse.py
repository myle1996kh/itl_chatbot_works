"""
Server-Sent Events (SSE) API endpoints for real-time message streaming.
"""

import json
import asyncio
from fastapi import APIRouter, Depends, HTTPException, Path, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional

from src.config import get_db
from src.models.session import ChatSession
from src.middleware.auth import get_current_user
from src.services.sse_manager import sse_manager
from src.utils.logging import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api", tags=["sse"])

# Global manager for session list connections (tenant_id -> list of queues)
session_list_manager = {}


async def event_stream(session_id: str, queue: asyncio.Queue):
    """
    Generate SSE event stream.
    
    Yields:
        SSE-formatted messages
    """
    try:
        # Send initial connection confirmation
        yield f"data: {json.dumps({'type': 'connected', 'session_id': session_id})}\n\n"
        
        # Heartbeat interval (30 seconds)
        heartbeat_interval = 30
        last_heartbeat = asyncio.get_event_loop().time()
        
        while True:
            try:
                # Wait for message with timeout for heartbeat
                message = await asyncio.wait_for(
                    queue.get(),
                    timeout=heartbeat_interval
                )
                
                # Send message to client
                yield f"data: {json.dumps(message)}\n\n"
                
                last_heartbeat = asyncio.get_event_loop().time()
                
            except asyncio.TimeoutError:
                # Send heartbeat to keep connection alive
                current_time = asyncio.get_event_loop().time()
                if current_time - last_heartbeat >= heartbeat_interval:
                    yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
                    last_heartbeat = current_time
                    
    except asyncio.CancelledError:
        logger.info(f"SSE stream cancelled for session {session_id}")
        raise
    except Exception as e:
        logger.error(f"SSE stream error for session {session_id}: {e}")
        raise


@router.get("/{tenant_id}/session/{session_id}/stream")
async def stream_session_messages(
    tenant_id: str = Path(..., description="Tenant UUID"),
    session_id: str = Path(..., description="Session UUID"),
    token: Optional[str] = Query(None, description="JWT token for authentication"),
    db: Session = Depends(get_db),
):
    """
    Stream real-time messages for a chat session via Server-Sent Events.
    
    This endpoint establishes a persistent connection and pushes new messages
    as they arrive (e.g., from supporters).
    
    **Authentication**: Supports both admin JWT and guest JWT tokens.
    
    **Connection Lifecycle**:
    1. Client connects and receives 'connected' event
    2. Server sends heartbeat every 30s to keep connection alive
    3. New messages are pushed immediately as 'new_message' events
    4. Client can close connection anytime
    
    **Event Types**:
    - `connected`: Initial connection confirmation
    - `heartbeat`: Keep-alive ping
    - `new_message`: New chat message available
    """
    try:
        # Validate session exists and belongs to tenant
        session = db.query(ChatSession).filter(
            ChatSession.session_id == session_id,
            ChatSession.tenant_id == tenant_id
        ).first()
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # TODO: Add authentication check here if needed
        # For now, we allow public access (widget use case)
        # In production, verify token matches session's user_id
        
        logger.info(f"SSE connection request for session {session_id}")
        
        # Register connection and get message queue
        queue = await sse_manager.connect(session_id)
        
        async def cleanup():
            """Cleanup when connection closes."""
            await sse_manager.disconnect(session_id, queue)
        
        # Create streaming response
        response = StreamingResponse(
            event_stream(session_id, queue),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",  # Disable nginx buffering
            }
        )
        
        # Register cleanup on disconnect
        response.background = cleanup
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"SSE endpoint error: {e}")
        raise HTTPException(status_code=500, detail="Failed to establish SSE connection")


@router.get("/admin/tenants/{tenant_id}/sessions/stream")
async def stream_session_list_updates(
    tenant_id: str = Path(..., description="Tenant UUID"),
    token: Optional[str] = Query(None, description="JWT token for authentication"),
    db: Session = Depends(get_db),
):
    """
    Stream real-time updates for session list via Server-Sent Events.

    This endpoint is for admin/supporter dashboards to get live updates
    when sessions are created, updated, or status changes.

    **Event Types**:
    - `connected`: Initial connection confirmation
    - `heartbeat`: Keep-alive ping (every 30s)
    - `session_update`: Session was created or updated
    """
    try:
        # TODO: Add authentication check
        # For now, allow access (will add JWT verification)

        logger.info(f"SSE session list connection for tenant {tenant_id}")

        # Create queue for this connection
        queue = asyncio.Queue()

        # Register connection
        if tenant_id not in session_list_manager:
            session_list_manager[tenant_id] = []
        session_list_manager[tenant_id].append(queue)

        async def session_list_stream():
            """Generate SSE event stream for session list."""
            try:
                # Send initial connection confirmation
                yield f"data: {json.dumps({'type': 'connected', 'tenant_id': tenant_id})}\n\n"

                # Heartbeat interval (30 seconds)
                heartbeat_interval = 30
                last_heartbeat = asyncio.get_event_loop().time()

                while True:
                    try:
                        # Wait for message with timeout for heartbeat
                        message = await asyncio.wait_for(
                            queue.get(),
                            timeout=heartbeat_interval
                        )

                        # Send message to client
                        yield f"data: {json.dumps(message)}\n\n"

                        last_heartbeat = asyncio.get_event_loop().time()

                    except asyncio.TimeoutError:
                        # Send heartbeat to keep connection alive
                        current_time = asyncio.get_event_loop().time()
                        if current_time - last_heartbeat >= heartbeat_interval:
                            yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
                            last_heartbeat = current_time

            except asyncio.CancelledError:
                logger.info(f"SSE session list stream cancelled for tenant {tenant_id}")
                raise
            finally:
                # Cleanup on disconnect
                if tenant_id in session_list_manager:
                    try:
                        session_list_manager[tenant_id].remove(queue)
                        if not session_list_manager[tenant_id]:
                            del session_list_manager[tenant_id]
                    except ValueError:
                        pass

        # Create streaming response
        response = StreamingResponse(
            session_list_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            }
        )

        return response

    except Exception as e:
        logger.error(f"SSE session list endpoint error: {e}")
        raise HTTPException(status_code=500, detail="Failed to establish SSE connection")


async def broadcast_session_update(tenant_id: str, session_data: dict):
    """
    Broadcast session update to all connected clients for a tenant.

    Call this function when a session is created, updated, or status changes.

    Args:
        tenant_id: The tenant ID
        session_data: Session data to broadcast
    """
    if tenant_id not in session_list_manager or not session_list_manager[tenant_id]:
        logger.debug(f"No active session list connections for tenant {tenant_id}")
        return

    message = {
        'type': 'session_update',
        'session': session_data
    }

    queues = session_list_manager[tenant_id].copy()
    for queue in queues:
        try:
            await queue.put(message)
        except Exception as e:
            logger.error(f"Error broadcasting session update: {e}")
