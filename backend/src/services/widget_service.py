"""Widget configuration service for generating embed codes and managing widget settings."""
import secrets
import uuid
from typing import Optional
from sqlalchemy.orm import Session
from src.models.tenant_widget_config import TenantWidgetConfig
from src.utils.encryption import encrypt_api_key
from src.utils.logging import get_logger
from src.config import settings

logger = get_logger(__name__)


class WidgetService:
    """Service for managing widget configurations and embed codes."""

    @staticmethod
    def generate_widget_key() -> str:
        """
        Generate a unique public widget key.

        Format: wk_{random_32_chars}
        Example: wk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6

        Returns:
            Unique widget key string
        """
        random_part = secrets.token_urlsafe(24)[:32]  # 32 chars
        return f"wk_{random_part}"

    @staticmethod
    def generate_widget_secret() -> str:
        """
        Generate an encrypted widget secret for verification.

        Uses Fernet encryption for secure storage.

        Returns:
            Encrypted widget secret
        """
        # Generate 64-byte random secret
        secret = secrets.token_urlsafe(48)

        # Encrypt it using Fernet (same as API key encryption)
        encrypted_secret = encrypt_api_key(secret)

        return encrypted_secret

    @staticmethod
    def generate_embed_code(
        tenant_id: str,
        widget_key: str,
        api_base_url: Optional[str] = None
    ) -> str:
        """
        Generate iframe embed code snippet for widget.

        Args:
            tenant_id: Tenant UUID
            widget_key: Public widget key
            api_base_url: Base URL for API (defaults to localhost:8000 in dev, production URL in prod)

        Returns:
            HTML iframe embed code snippet
        """
        # Use environment-based default if not provided
        if not api_base_url:
            if settings.WIDGET_BASE_URL:
                api_base_url = settings.WIDGET_BASE_URL
            elif settings.ENVIRONMENT == "production":
                # Fallback for production if config missing
                api_base_url = "https://api.agenthub.example.com"
            else:
                # Development default
                api_base_url = f"http://{settings.API_HOST}:{settings.API_PORT}"

        # Generate iframe embed code
        embed_code = f'''<!-- AgentHub Chatbot Widget -->
<script>
  (function() {{
    var chatWidget = document.createElement('iframe');
    chatWidget.id = 'agenthub-chat-widget';
    chatWidget.src = '{api_base_url}/widget/{widget_key}?tenant_id={tenant_id}';
    chatWidget.style.cssText = 'position: fixed; bottom: 20px; right: 20px; width: 400px; height: 600px; border: none; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); z-index: 9999;';
    chatWidget.setAttribute('allow', 'microphone; camera');
    document.body.appendChild(chatWidget);

    // Message handler for widget-parent communication
    window.addEventListener('message', function(e) {{
      if (e.data.type === 'agenthub:minimize') {{
        chatWidget.style.height = '80px';
        chatWidget.style.width = '80px';
        chatWidget.style.borderRadius = '50%';
      }} else if (e.data.type === 'agenthub:maximize') {{
        chatWidget.style.height = '600px';
        chatWidget.style.width = '400px';
        chatWidget.style.borderRadius = '12px';
      }}
    }});
  }})();
</script>'''

        return embed_code

    @staticmethod
    def create_widget_config(
        db: Session,
        tenant_id: uuid.UUID,
        widget_key: Optional[str] = None,
        widget_secret: Optional[str] = None,
        api_base_url: Optional[str] = None,
        **kwargs
    ) -> TenantWidgetConfig:
        """
        Create a new widget configuration for a tenant.

        Args:
            db: Database session
            tenant_id: Tenant UUID
            widget_key: Optional custom widget key (generates if not provided)
            widget_secret: Optional custom widget secret (generates if not provided)
            api_base_url: Optional dynamic base URL for embed code
            **kwargs: Additional widget config fields (theme, primary_color, etc.)

        Returns:
            TenantWidgetConfig instance
        """
        # Generate keys if not provided
        if not widget_key:
            widget_key = WidgetService.generate_widget_key()

        if not widget_secret:
            widget_secret = WidgetService.generate_widget_secret()

        # Generate embed code
        embed_code = WidgetService.generate_embed_code(
            tenant_id=str(tenant_id),
            widget_key=widget_key,
            api_base_url=api_base_url
        )

        # Create widget config
        widget_config = TenantWidgetConfig(
            config_id=uuid.uuid4(),
            tenant_id=tenant_id,
            widget_key=widget_key,
            widget_secret=widget_secret,
            embed_code_snippet=embed_code,
            **kwargs
        )

        db.add(widget_config)

        logger.info(
            "widget_config_created",
            tenant_id=str(tenant_id),
            widget_key=widget_key
        )

        return widget_config

    @staticmethod
    def get_widget_config(
        db: Session,
        tenant_id: uuid.UUID
    ) -> Optional[TenantWidgetConfig]:
        """
        Get widget configuration for a tenant.

        Args:
            db: Database session
            tenant_id: Tenant UUID

        Returns:
            TenantWidgetConfig instance or None
        """
        return db.query(TenantWidgetConfig).filter(
            TenantWidgetConfig.tenant_id == tenant_id
        ).first()

    @staticmethod
    def update_widget_config(
        db: Session,
        tenant_id: uuid.UUID,
        **kwargs
    ) -> Optional[TenantWidgetConfig]:
        """
        Update widget configuration for a tenant.

        Args:
            db: Database session
            tenant_id: Tenant UUID
            **kwargs: Fields to update

        Returns:
            Updated TenantWidgetConfig instance or None
        """
        widget_config = WidgetService.get_widget_config(db, tenant_id)

        if not widget_config:
            return None

        # Update fields
        for key, value in kwargs.items():
            if hasattr(widget_config, key) and value is not None:
                setattr(widget_config, key, value)

        db.commit()
        db.refresh(widget_config)

        logger.info(
            "widget_config_updated",
            tenant_id=str(tenant_id),
            updated_fields=list(kwargs.keys())
        )

        return widget_config

    @staticmethod
    def regenerate_widget_keys(
        db: Session,
        tenant_id: uuid.UUID,
        api_base_url: Optional[str] = None
    ) -> TenantWidgetConfig:
        """
        Regenerate widget keys for security rotation.

        Args:
            db: Database session
            tenant_id: Tenant UUID
            api_base_url: Optional dynamic base URL for embed code

        Returns:
            Updated TenantWidgetConfig instance

        Raises:
            ValueError: If widget config not found
        """
        widget_config = WidgetService.get_widget_config(db, tenant_id)

        if not widget_config:
            raise ValueError(f"Widget config not found for tenant {tenant_id}")

        # Generate new keys
        new_widget_key = WidgetService.generate_widget_key()
        new_widget_secret = WidgetService.generate_widget_secret()
        new_embed_code = WidgetService.generate_embed_code(
            tenant_id=str(tenant_id),
            widget_key=new_widget_key,
            api_base_url=api_base_url
        )

        # Update config
        widget_config.widget_key = new_widget_key
        widget_config.widget_secret = new_widget_secret
        widget_config.embed_code_snippet = new_embed_code
        from datetime import datetime
        widget_config.last_regenerated_at = datetime.utcnow()

        db.commit()
        db.refresh(widget_config)

        logger.info(
            "widget_keys_regenerated",
            tenant_id=str(tenant_id),
            new_widget_key=new_widget_key
        )

        return widget_config


# Singleton instance
widget_service = WidgetService()
