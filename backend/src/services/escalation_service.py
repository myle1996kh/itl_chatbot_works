"""Escalation Service for managing human-in-loop escalations.

This service handles:
- Manual escalation requests from users
- Auto-escalation detection based on keywords
- Supporter assignment and queue management
- Escalation resolution tracking
"""
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc
from src.models.session import ChatSession
from src.models.user import User
from src.models.tenant import Tenant
from src.utils.logging import get_logger

logger = get_logger(__name__)


class EscalationService:
    """Service for managing session escalations with supporter assignment."""

    # Default escalation keywords
    DEFAULT_ESCALATION_KEYWORDS = [
        # Urgency indicators
        'urgent', 'emergency', 'asap', 'immediately', 'critical',
        'help', 'assistant', 'support',
        # Frustration indicators
        'angry', 'frustrated', 'upset', 'annoyed', 'irritated',
        'unacceptable', 'ridiculous', 'terrible', 'awful',
        # Issue severity
        'broken', 'crash', 'error', 'not working', 'fail',
        'down', 'offline', 'issue', 'problem',
        # Escalation requests
        'manager', 'supervisor', 'escalate', 'escalation',
        'speak to', 'talk to', 'human', 'person',
    ]

    def __init__(self):
        """Initialize escalation service."""
        logger.info(
            "escalation_service_initialized",
            default_keywords_count=len(self.DEFAULT_ESCALATION_KEYWORDS)
        )

    def detect_auto_escalation(
        self,
        message: str,
        custom_keywords: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Detect if a message should trigger auto-escalation.

        Args:
            message: User message to analyze
            custom_keywords: Optional custom keywords to check (in addition to defaults)

        Returns:
            Dictionary with:
            - should_escalate: bool
            - detected_keywords: List[str]
            - confidence: float (0-1)
            - reason: Optional[str]
        """
        try:
            message_lower = message.lower()
            keywords_to_check = self.DEFAULT_ESCALATION_KEYWORDS.copy()

            if custom_keywords:
                keywords_to_check.extend(custom_keywords)

            detected = []
            for keyword in keywords_to_check:
                if keyword.lower() in message_lower:
                    detected.append(keyword)

            # Calculate confidence based on number of keywords detected
            confidence = min(len(detected) / 3.0, 1.0)  # 3+ keywords = 100% confidence
            should_escalate = len(detected) > 0  # Any keyword triggers escalation

            reason = None
            if should_escalate:
                reason = f"Detected {len(detected)} escalation keyword(s): {', '.join(detected[:3])}"

            logger.debug(
                "auto_escalation_detected",
                message_length=len(message),
                detected_count=len(detected),
                should_escalate=should_escalate,
                confidence=confidence
            )

            return {
                "should_escalate": should_escalate,
                "detected_keywords": detected,
                "confidence": confidence,
                "reason": reason,
            }

        except Exception as e:
            logger.error(
                "auto_escalation_detection_failed",
                error=str(e),
                message_length=len(message)
            )
            return {
                "should_escalate": False,
                "detected_keywords": [],
                "confidence": 0.0,
                "reason": f"Detection error: {str(e)}",
            }

    def escalate_session(
        self,
        db: Session,
        session_id: str,
        tenant_id: str,
        reason: str,
        auto_detected: bool = False,
        keywords: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Escalate a chat session to require human support.

        Args:
            db: Database session
            session_id: UUID of the chat session
            tenant_id: UUID of the tenant
            reason: Reason for escalation
            auto_detected: Whether escalation was auto-detected
            keywords: Keywords that triggered auto-escalation

        Returns:
            Dictionary with escalation result
        """
        try:
            # Get the session
            session = db.query(ChatSession).filter(
                and_(
                    ChatSession.session_id == session_id,
                    ChatSession.tenant_id == tenant_id
                )
            ).first()

            if not session:
                logger.warning(
                    "escalate_session_not_found",
                    session_id=session_id,
                    tenant_id=tenant_id
                )
                return {
                    "success": False,
                    "error": "Session not found",
                }

            # Check if already escalated
            if session.escalation_status != 'none':
                logger.warning(
                    "escalate_session_already_escalated",
                    session_id=session_id,
                    current_status=session.escalation_status
                )
                return {
                    "success": False,
                    "error": f"Session already escalated with status: {session.escalation_status}",
                }

            # Update session with escalation details
            session.escalation_status = 'pending'
            session.escalation_reason = reason
            session.escalation_requested_at = datetime.utcnow()

            # Add metadata about auto-detection
            if auto_detected:
                if not session.session_metadata:
                    session.session_metadata = {}
                session.session_metadata['auto_escalation'] = {
                    'detected': True,
                    'keywords': keywords or [],
                    'detected_at': datetime.utcnow().isoformat(),
                }

            db.add(session)
            db.commit()

            # AUTO-ASSIGN: Try to find and assign available supporter
            assigned_user_id = None
            assigned_user_name = None
            auto_assigned = False

            try:
                available_staff = self.find_available_staff(db, tenant_id)

                if available_staff and len(available_staff) > 0:
                    # Get the supporter with the least current sessions (first in sorted list)
                    best_supporter = available_staff[0]

                    # Auto-assign to this supporter
                    assign_result = self.assign_user(
                        db=db,
                        session_id=session_id,
                        tenant_id=tenant_id,
                        user_id=str(best_supporter.user_id)
                    )

                    if assign_result["success"]:
                        auto_assigned = True
                        assigned_user_id = str(best_supporter.user_id)
                        assigned_user_name = best_supporter.display_name or best_supporter.username

                        logger.info(
                            "session_auto_assigned",
                            session_id=session_id,
                            assigned_user_id=assigned_user_id,
                            assigned_user_name=assigned_user_name,
                            supporter_load=f"{assign_result.get('staff_current_sessions')}/{assign_result.get('staff_max_sessions')}"
                        )
                    else:
                        logger.warning(
                            "auto_assign_failed",
                            session_id=session_id,
                            reason=assign_result.get("error")
                        )
                else:
                    logger.info(
                        "no_available_staff",
                        session_id=session_id,
                        tenant_id=tenant_id,
                        message="No supporters online - escalation remains pending"
                    )
            except Exception as assign_error:
                logger.error(
                    "auto_assign_error",
                    session_id=session_id,
                    error=str(assign_error)
                )
                # Don't fail the escalation if auto-assign fails
                # Just leave it as pending

            # Refresh session to get updated status after potential auto-assign
            db.refresh(session)

            logger.info(
                "session_escalated",
                session_id=session_id,
                tenant_id=tenant_id,
                auto_detected=auto_detected,
                auto_assigned=auto_assigned,
                final_status=session.escalation_status,
                reason=reason
            )

            return {
                "success": True,
                "session_id": session_id,
                "escalation_status": session.escalation_status,
                "escalation_requested_at": session.escalation_requested_at.isoformat(),
                "auto_assigned": auto_assigned,
                "assigned_user_id": assigned_user_id,
                "assigned_user_name": assigned_user_name,
            }

        except Exception as e:
            db.rollback()
            logger.error(
                "escalate_session_failed",
                session_id=session_id,
                tenant_id=tenant_id,
                error=str(e)
            )
            return {
                "success": False,
                "error": f"Failed to escalate session: {str(e)}",
            }

    def assign_user(
        self,
        db: Session,
        session_id: str,
        tenant_id: str,
        user_id: str
    ) -> Dict[str, Any]:
        """
        Assign a staff user to an escalated session.

        Args:
            db: Database session
            session_id: UUID of the chat session
            tenant_id: UUID of the tenant
            user_id: UUID of the staff user

        Returns:
            Dictionary with assignment result
        """
        try:
            # Verify session exists and is escalated
            session = db.query(ChatSession).filter(
                and_(
                    ChatSession.session_id == session_id,
                    ChatSession.tenant_id == tenant_id
                )
            ).first()

            if not session:
                return {
                    "success": False,
                    "error": "Session not found",
                }

            if session.escalation_status not in ['pending', 'assigned']:
                return {
                    "success": False,
                    "error": f"Session cannot be assigned (status: {session.escalation_status})",
                }

            # Verify user exists, belongs to same tenant, and is a supporter
            user = db.query(User).filter(
                and_(
                    User.user_id == user_id,
                    User.tenant_id == tenant_id,
                    User.role == 'supporter'
                )
            ).first()

            if not user:
                return {
                    "success": False,
                    "error": "User not found, not a supporter, or does not belong to this tenant",
                }

            # Check staff member availability and capacity
            if user.supporter_status not in ['online', 'available']:
                return {
                    "success": False,
                    "error": f"Staff member not available (status: {user.supporter_status}). Current status must be 'online'",
                }

            if user.current_sessions_count >= user.max_concurrent_sessions:
                return {
                    "success": False,
                    "error": f"Staff member at capacity ({user.current_sessions_count}/{user.max_concurrent_sessions}). Cannot assign more sessions.",
                }

            # Assign user and increment session counter
            session.assigned_user_id = user_id
            session.escalation_status = 'assigned'
            session.escalation_assigned_at = datetime.utcnow()

            # Increment staff member's active session count
            user.current_sessions_count += 1

            db.add(session)
            db.add(user)
            db.commit()

            logger.info(
                "user_assigned",
                session_id=session_id,
                user_id=user_id,
                tenant_id=tenant_id,
                staff_sessions_count=user.current_sessions_count
            )

            return {
                "success": True,
                "session_id": session_id,
                "assigned_user_id": user_id,
                "escalation_status": session.escalation_status,
                "escalation_assigned_at": session.escalation_assigned_at.isoformat(),
                "staff_current_sessions": user.current_sessions_count,
                "staff_max_sessions": user.max_concurrent_sessions,
            }

        except Exception as e:
            db.rollback()
            logger.error(
                "assign_user_failed",
                session_id=session_id,
                user_id=user_id,
                error=str(e)
            )
            return {
                "success": False,
                "error": f"Failed to assign user: {str(e)}",
            }

    def resolve_escalation(
        self,
        db: Session,
        session_id: str,
        tenant_id: str,
        resolution_notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Mark an escalation as resolved.

        Decrements the assigned staff member's session counter if they were assigned.

        Args:
            db: Database session
            session_id: UUID of the chat session
            tenant_id: UUID of the tenant
            resolution_notes: Optional notes on resolution

        Returns:
            Dictionary with resolution result
        """
        try:
            session = db.query(ChatSession).filter(
                and_(
                    ChatSession.session_id == session_id,
                    ChatSession.tenant_id == tenant_id
                )
            ).first()

            if not session:
                return {
                    "success": False,
                    "error": "Session not found",
                }

            if session.escalation_status == 'none':
                return {
                    "success": False,
                    "error": "Session is not escalated",
                }

            # If session was assigned to a staff member, decrement their counter
            if session.assigned_user_id:
                assigned_user = db.query(User).filter(
                    User.user_id == session.assigned_user_id
                ).first()

                if assigned_user and assigned_user.current_sessions_count > 0:
                    assigned_user.current_sessions_count -= 1
                    db.add(assigned_user)
                    logger.debug(
                        "staff_session_counter_decremented",
                        user_id=session.assigned_user_id,
                        new_count=assigned_user.current_sessions_count
                    )

            # Mark as resolved
            session.escalation_status = 'resolved'

            # Add resolution notes to metadata
            if not session.session_metadata:
                session.session_metadata = {}
            session.session_metadata['escalation_resolved'] = {
                'resolved_at': datetime.utcnow().isoformat(),
                'notes': resolution_notes,
            }

            db.add(session)
            db.commit()

            logger.info(
                "escalation_resolved",
                session_id=session_id,
                tenant_id=tenant_id,
                assigned_user_id=str(session.assigned_user_id) if session.assigned_user_id else None
            )

            return {
                "success": True,
                "session_id": session_id,
                "escalation_status": session.escalation_status,
            }

        except Exception as e:
            db.rollback()
            logger.error(
                "resolve_escalation_failed",
                session_id=session_id,
                error=str(e)
            )
            return {
                "success": False,
                "error": f"Failed to resolve escalation: {str(e)}",
            }

    def find_available_staff(
        self,
        db: Session,
        tenant_id: str
    ) -> List[User]:
        """
        Find all available supporters for a tenant.

        Supporters are available if:
        - role = 'supporter'
        - tenant_id matches
        - supporter_status = 'online' or 'available'
        - current_sessions_count < max_concurrent_sessions

        Args:
            db: Database session
            tenant_id: UUID of the tenant

        Returns:
            List of available User objects, sorted by current session count (ascending)
        """
        from src.models.user import User  # Local import to avoid circular dependency

        try:
            available_supporters = db.query(User).filter(
                and_(
                    User.tenant_id == tenant_id,
                    User.role == 'supporter',
                    User.supporter_status.in_(['online', 'available']),
                    User.current_sessions_count < User.max_concurrent_sessions
                )
            ).order_by(User.current_sessions_count.asc()).all()

            logger.debug(
                "available_supporters_found",
                tenant_id=tenant_id,
                count=len(available_supporters)
            )

            return available_supporters

        except Exception as e:
            logger.error(
                "find_available_supporters_failed",
                tenant_id=tenant_id,
                error=str(e)
            )
            return []

    def get_escalation_queue(
        self,
        db: Session,
        tenant_id: str,
        status: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get list of escalated sessions for a tenant.

        Args:
            db: Database session
            tenant_id: UUID of the tenant
            status: Optional filter by status (pending, assigned, resolved)

        Returns:
            Dictionary with escalation queue
        """
        try:
            query = db.query(ChatSession).filter(
                and_(
                    ChatSession.tenant_id == tenant_id,
                    ChatSession.escalation_status != 'none'
                )
            )

            if status:
                query = query.filter(ChatSession.escalation_status == status)

            escalations = query.order_by(
                desc(ChatSession.escalation_requested_at)
            ).all()

            # Count by status
            pending = db.query(ChatSession).filter(
                and_(
                    ChatSession.tenant_id == tenant_id,
                    ChatSession.escalation_status == 'pending'
                )
            ).count()

            assigned = db.query(ChatSession).filter(
                and_(
                    ChatSession.tenant_id == tenant_id,
                    ChatSession.escalation_status == 'assigned'
                )
            ).count()

            resolved = db.query(ChatSession).filter(
                and_(
                    ChatSession.tenant_id == tenant_id,
                    ChatSession.escalation_status == 'resolved'
                )
            ).count()

            logger.debug(
                "escalation_queue_retrieved",
                tenant_id=tenant_id,
                pending_count=pending,
                assigned_count=assigned
            )

            return {
                "success": True,
                "pending_count": pending,
                "assigned_count": assigned,
                "resolved_count": resolved,
                "escalations": escalations,
            }

        except Exception as e:
            logger.error(
                "get_escalation_queue_failed",
                tenant_id=tenant_id,
                error=str(e)
            )
            return {
                "success": False,
                "error": f"Failed to get escalation queue: {str(e)}",
                "escalations": [],
            }


def get_escalation_service() -> EscalationService:
    """Get singleton escalation service instance."""
    return EscalationService()
