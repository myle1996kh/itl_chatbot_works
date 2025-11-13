"""Custom exception classes for security and application errors."""


class SecurityError(Exception):
    """Raised when a security violation is detected.

    This exception is used for critical security violations such as:
    - Cross-tenant data leakage
    - Unauthorized access attempts
    - Data integrity violations

    Args:
        message: Human-readable error description
        details: Additional context about the security violation
    """

    def __init__(self, message: str, details: dict = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}

    def __str__(self):
        return f"SecurityError: {self.message}"

    def __repr__(self):
        return f"SecurityError(message={self.message!r}, details={self.details!r})"
