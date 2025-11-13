import time
import redis
from typing import Tuple, Dict, Any
from src.utils.metrics import rate_limit_violations_counter


class RateLimiter:
    """
    Redis-based rate limiting utility implementing sliding window algorithm.
    Enforces both RPM (requests per minute) and TPM (tokens per minute) limits.
    """
    
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        # Using a sliding window algorithm with 60-second TTL
        self.window_size = 60  # seconds
    
    def check_rate_limit(
        self,
        tenant_id: str,
        rpm_limit: int,
        tpm_limit: int,
        tokens_requested: int
    ) -> Tuple[bool, str, Dict[str, Any]]:
        """
        Check if a request is allowed based on rate limits.
        
        Args:
            tenant_id: Unique identifier for the tenant
            rpm_limit: Request per minute limit
            tpm_limit: Tokens per minute limit
            tokens_requested: Number of tokens in the current request
            
        Returns:
            Tuple of (is_allowed, error_message, limits_info)
        """
        current_time = int(time.time())
        current_minute = current_time // self.window_size
        
        # RPM key (requests per minute)
        rpm_key = f"rate_limit:rpm:{tenant_id}:{current_minute}"
        # TPM key (tokens per minute)
        tpm_key = f"rate_limit:tpm:{tenant_id}:{current_minute}"
        
        # Start a Redis transaction
        pipe = self.redis.pipeline()
        
        # Get current RPM and TPM values
        pipe.get(rpm_key)
        pipe.get(tpm_key)
        
        results = pipe.execute()
        current_rpm = int(results[0]) if results[0] is not None else 0
        current_tpm = int(results[0]) if results[1] is not None else 0
        
        # Check if limits are exceeded
        if current_rpm >= rpm_limit:
            error_msg = f"Rate limit exceeded: Request limit ({rpm_limit}/min) reached"
            limits_info = {
                "limit_rpm": rpm_limit,
                "limit_tpm": tpm_limit,
                "current_rpm": current_rpm,
                "current_tpm": current_tpm
            }
            # Increment Prometheus counter for rate limit violation
            rate_limit_violations_counter.labels(
                tenant_id=tenant_id,
                type="rpm"
            ).inc()
            return False, error_msg, limits_info
            
        if current_tpm + tokens_requested > tpm_limit:
            error_msg = f"Rate limit exceeded: Token limit ({tpm_limit}/min) would be exceeded by {tokens_requested} tokens"
            limits_info = {
                "limit_rpm": rpm_limit,
                "limit_tpm": tpm_limit,
                "current_rpm": current_rpm,
                "current_tpm": current_tpm,
                "tokens_requested": tokens_requested
            }
            # Increment Prometheus counter for rate limit violation
            rate_limit_violations_counter.labels(
                tenant_id=tenant_id,
                type="tpm"
            ).inc()
            return False, error_msg, limits_info
        
        # If within limits, increment counts
        pipe = self.redis.pipeline()
        pipe.incr(rpm_key)
        pipe.incrby(tpm_key, tokens_requested)
        # Set TTL for both keys to expire after 60 seconds
        pipe.expire(rpm_key, self.window_size)
        pipe.expire(tpm_key, self.window_size)
        
        pipe.execute()
        
        # Return success with limits info
        limits_info = {
            "limit_rpm": rpm_limit,
            "limit_tpm": tpm_limit,
            "current_rpm": current_rpm + 1,
            "current_tpm": current_tpm + tokens_requested
        }
        
        return True, "", limits_info
    
    def get_remaining_limits(
        self,
        tenant_id: str,
        rpm_limit: int,
        tpm_limit: int
    ) -> Dict[str, int]:
        """
        Get the remaining rate limits for a tenant.
        
        Args:
            tenant_id: Unique identifier for the tenant
            rpm_limit: Request per minute limit
            tpm_limit: Tokens per minute limit
            
        Returns:
            Dictionary with limits and remaining values
        """
        current_time = int(time.time())
        current_minute = current_time // self.window_size
        
        # RPM key
        rpm_key = f"rate_limit:rpm:{tenant_id}:{current_minute}"
        # TPM key
        tpm_key = f"rate_limit:tpm:{tenant_id}:{current_minute}"
        
        # Get current values
        pipe = self.redis.pipeline()
        pipe.get(rpm_key)
        pipe.get(tpm_key)
        
        results = pipe.execute()
        current_rpm = int(results[0]) if results[0] is not None else 0
        current_tpm = int(results[1]) if results[1] is not None else 0
        
        # Calculate remaining limits
        rpm_remaining = max(0, rpm_limit - current_rpm)
        tpm_remaining = max(0, tpm_limit - current_tpm)
        
        return {
            "rpm_limit": rpm_limit,
            "tpm_limit": tpm_limit,
            "rpm_remaining": rpm_remaining,
            "tpm_remaining": tpm_remaining
        }