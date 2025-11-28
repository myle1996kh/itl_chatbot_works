"""
Server-Sent Events (SSE) Connection Manager

Manages active SSE connections for real-time message delivery.
Each chat session can have multiple connected clients (e.g., user on multiple tabs).
"""

import asyncio
from typing import Dict, List
from asyncio import Queue
import logging

logger = logging.getLogger(__name__)


class SSEConnectionManager:
    """Manages SSE connections for real-time message broadcasting."""
    
    def __init__(self):
        # session_id -> list of queues (one per connected client)
        self.active_connections: Dict[str, List[Queue]] = {}
        self._lock = asyncio.Lock()
    
    async def connect(self, session_id: str) -> Queue:
        """
        Register a new SSE connection for a session.
        
        Args:
            session_id: The chat session ID
            
        Returns:
            Queue for sending messages to this client
        """
        async with self._lock:
            queue = Queue()
            
            if session_id not in self.active_connections:
                self.active_connections[session_id] = []
            
            self.active_connections[session_id].append(queue)
            
            logger.info(
                f"SSE connection established for session {session_id}. "
                f"Total connections: {len(self.active_connections[session_id])}"
            )
            
            return queue
    
    async def disconnect(self, session_id: str, queue: Queue):
        """
        Unregister an SSE connection.
        
        Args:
            session_id: The chat session ID
            queue: The queue to remove
        """
        async with self._lock:
            if session_id in self.active_connections:
                try:
                    self.active_connections[session_id].remove(queue)
                    
                    # Clean up empty session entries
                    if not self.active_connections[session_id]:
                        del self.active_connections[session_id]
                    
                    logger.info(
                        f"SSE connection closed for session {session_id}. "
                        f"Remaining connections: {len(self.active_connections.get(session_id, []))}"
                    )
                except ValueError:
                    # Queue already removed
                    pass
    
    async def broadcast_message(self, session_id: str, message: dict):
        """
        Broadcast a message to all connected clients for a session.
        
        Args:
            session_id: The chat session ID
            message: Message data to broadcast
        """
        async with self._lock:
            if session_id not in self.active_connections:
                logger.debug(f"No active connections for session {session_id}")
                return
            
            queues = self.active_connections[session_id].copy()
        
        # Send to all connected clients (outside lock to avoid blocking)
        for queue in queues:
            try:
                await queue.put(message)
            except Exception as e:
                logger.error(f"Error broadcasting to queue: {e}")
    
    def get_connection_count(self, session_id: str) -> int:
        """Get number of active connections for a session."""
        return len(self.active_connections.get(session_id, []))
    
    def get_total_connections(self) -> int:
        """Get total number of active connections across all sessions."""
        return sum(len(queues) for queues in self.active_connections.values())


# Global instance
sse_manager = SSEConnectionManager()
