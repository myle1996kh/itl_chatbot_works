"""Unit tests for auth bypass prevention in production."""
import pytest
import os
from fastapi import HTTPException
from unittest.mock import patch, MagicMock
from pydantic import ValidationError


class TestSettingsValidation:
    """Test Settings class validation for DISABLE_AUTH."""

    def test_disable_auth_true_production_raises_error(self):
        """Test DISABLE_AUTH=true + ENVIRONMENT=production → ValueError."""
        # Test by directly instantiating Settings with invalid config
        from src.config import Settings

        with patch.dict(
            os.environ,
            {
                "DISABLE_AUTH": "true",
                "ENVIRONMENT": "production",
                "DATABASE_URL": "postgresql://test:test@localhost:5432/test",
            },
            clear=True,
        ):
            # Attempt to create Settings with invalid config
            with pytest.raises(ValidationError) as exc_info:
                Settings()

            # Verify error message
            assert "DISABLE_AUTH cannot be true in production" in str(exc_info.value)

    def test_disable_auth_true_development_allowed(self):
        """Test DISABLE_AUTH=true + ENVIRONMENT=development → Allow."""
        from src.config import Settings

        with patch.dict(
            os.environ,
            {
                "DISABLE_AUTH": "true",
                "ENVIRONMENT": "development",
                "DATABASE_URL": "postgresql://test:test@localhost:5432/test",
            },
            clear=True,
        ):
            # Should not raise error
            test_settings = Settings()
            assert test_settings.DISABLE_AUTH is True
            assert test_settings.ENVIRONMENT == "development"

    def test_disable_auth_false_production_allowed(self):
        """Test DISABLE_AUTH=false + ENVIRONMENT=production → Allow."""
        from src.config import Settings

        with patch.dict(
            os.environ,
            {
                "DISABLE_AUTH": "false",
                "ENVIRONMENT": "production",
                "DATABASE_URL": "postgresql://test:test@localhost:5432/test",
                "JWT_PUBLIC_KEY": "test-key",
            },
            clear=True,
        ):
            # Should not raise error
            test_settings = Settings()
            assert test_settings.DISABLE_AUTH is False
            assert test_settings.ENVIRONMENT == "production"

    def test_disable_auth_true_staging_allowed(self):
        """Test DISABLE_AUTH=true + ENVIRONMENT=staging → Allow."""
        from src.config import Settings

        with patch.dict(
            os.environ,
            {
                "DISABLE_AUTH": "true",
                "ENVIRONMENT": "staging",
                "DATABASE_URL": "postgresql://test:test@localhost:5432/test",
            },
            clear=True,
        ):
            # Should not raise error
            test_settings = Settings()
            assert test_settings.DISABLE_AUTH is True
            assert test_settings.ENVIRONMENT == "staging"


class TestMiddlewareRuntimeCheck:
    """Test middleware runtime checks for auth bypass in production."""

    @pytest.mark.asyncio
    async def test_get_current_user_production_bypass_rejected(self):
        """Test get_current_user rejects bypass in production runtime."""
        # Mock settings
        mock_settings = MagicMock()
        mock_settings.DISABLE_AUTH = True
        mock_settings.ENVIRONMENT = "production"

        with patch("src.middleware.auth.settings", mock_settings):
            from src.middleware.auth import get_current_user

            with pytest.raises(HTTPException) as exc_info:
                await get_current_user(credentials=None)

            assert exc_info.value.status_code == 500
            assert "Authentication bypass not allowed in production" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_get_current_user_development_bypass_allowed(self):
        """Test get_current_user allows bypass in development."""
        mock_settings = MagicMock()
        mock_settings.DISABLE_AUTH = True
        mock_settings.ENVIRONMENT = "development"

        with patch("src.middleware.auth.settings", mock_settings):
            from src.middleware.auth import get_current_user

            result = await get_current_user(credentials=None)

            assert result["test_mode"] is True
            assert result["tenant_id"] == "2628802d-1dff-4a98-9325-704433c5d3ab"

    @pytest.mark.asyncio
    async def test_get_current_tenant_production_bypass_rejected(self):
        """Test get_current_tenant rejects bypass in production runtime."""
        mock_settings = MagicMock()
        mock_settings.DISABLE_AUTH = True
        mock_settings.ENVIRONMENT = "production"

        with patch("src.middleware.auth.settings", mock_settings):
            from src.middleware.auth import get_current_tenant

            with pytest.raises(HTTPException) as exc_info:
                await get_current_tenant(credentials=None)

            assert exc_info.value.status_code == 500
            assert "Authentication bypass not allowed in production" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_verify_tenant_access_production_bypass_rejected(self):
        """Test verify_tenant_access rejects bypass in production runtime."""
        mock_settings = MagicMock()
        mock_settings.DISABLE_AUTH = True
        mock_settings.ENVIRONMENT = "production"

        with patch("src.middleware.auth.settings", mock_settings):
            from src.middleware.auth import verify_tenant_access

            with pytest.raises(HTTPException) as exc_info:
                await verify_tenant_access(
                    tenant_id_path="test-tenant", credentials=None
                )

            assert exc_info.value.status_code == 500
            assert "Authentication bypass not allowed in production" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_require_admin_role_production_bypass_rejected(self):
        """Test require_admin_role rejects bypass in production runtime."""
        mock_settings = MagicMock()
        mock_settings.DISABLE_AUTH = True
        mock_settings.ENVIRONMENT = "production"

        with patch("src.middleware.auth.settings", mock_settings):
            from src.middleware.auth import require_admin_role

            with pytest.raises(HTTPException) as exc_info:
                await require_admin_role(credentials=None)

            assert exc_info.value.status_code == 500
            assert "Authentication bypass not allowed in production" in exc_info.value.detail


class TestStartupValidation:
    """Test startup validation prevents unsafe production config."""

    @pytest.mark.asyncio
    async def test_startup_rejects_disable_auth_in_production(self):
        """Test startup validation prevents app start with DISABLE_AUTH=true."""
        mock_settings = MagicMock()
        mock_settings.ENVIRONMENT = "production"
        mock_settings.DISABLE_AUTH = True
        mock_settings.JWT_PUBLIC_KEY = "test-key"
        mock_settings.API_HOST = "0.0.0.0"
        mock_settings.API_PORT = 8000

        with patch("src.main.settings", mock_settings):
            from src.main import startup_event

            with pytest.raises(RuntimeError) as exc_info:
                await startup_event()

            assert "Unsafe production settings" in str(exc_info.value)
            assert "DISABLE_AUTH=true" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_startup_rejects_missing_jwt_key_in_production(self):
        """Test startup validation prevents app start without JWT_PUBLIC_KEY."""
        mock_settings = MagicMock()
        mock_settings.ENVIRONMENT = "production"
        mock_settings.DISABLE_AUTH = False
        mock_settings.JWT_PUBLIC_KEY = ""
        mock_settings.API_HOST = "0.0.0.0"
        mock_settings.API_PORT = 8000

        with patch("src.main.settings", mock_settings):
            from src.main import startup_event

            with pytest.raises(RuntimeError) as exc_info:
                await startup_event()

            assert "Unsafe production settings" in str(exc_info.value)
            assert "JWT_PUBLIC_KEY not set" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_startup_allows_safe_production_config(self):
        """Test startup succeeds with safe production config."""
        mock_settings = MagicMock()
        mock_settings.ENVIRONMENT = "production"
        mock_settings.DISABLE_AUTH = False
        mock_settings.JWT_PUBLIC_KEY = "valid-public-key"
        mock_settings.API_HOST = "0.0.0.0"
        mock_settings.API_PORT = 8000

        with patch("src.main.settings", mock_settings):
            from src.main import startup_event

            # Should not raise error
            await startup_event()

    @pytest.mark.asyncio
    async def test_startup_allows_development_with_disable_auth(self):
        """Test startup allows DISABLE_AUTH=true in development."""
        mock_settings = MagicMock()
        mock_settings.ENVIRONMENT = "development"
        mock_settings.DISABLE_AUTH = True
        mock_settings.JWT_PUBLIC_KEY = ""
        mock_settings.API_HOST = "0.0.0.0"
        mock_settings.API_PORT = 8000

        with patch("src.main.settings", mock_settings):
            from src.main import startup_event

            # Should not raise error
            await startup_event()


class TestIntegrationScenarios:
    """Integration tests for auth bypass prevention."""

    @pytest.mark.asyncio
    async def test_full_request_flow_production_bypass_rejected(self):
        """Test full request flow rejects auth bypass in production."""
        mock_settings = MagicMock()
        mock_settings.DISABLE_AUTH = True
        mock_settings.ENVIRONMENT = "production"

        with patch("src.middleware.auth.settings", mock_settings):
            from src.middleware.auth import get_current_user, get_current_tenant

            # Test get_current_user
            with pytest.raises(HTTPException) as exc_info:
                await get_current_user(credentials=None)
            assert exc_info.value.status_code == 500

            # Test get_current_tenant
            with pytest.raises(HTTPException) as exc_info:
                await get_current_tenant(credentials=None)
            assert exc_info.value.status_code == 500

    @pytest.mark.asyncio
    async def test_full_request_flow_development_bypass_allowed(self):
        """Test full request flow allows bypass in development."""
        mock_settings = MagicMock()
        mock_settings.DISABLE_AUTH = True
        mock_settings.ENVIRONMENT = "development"

        with patch("src.middleware.auth.settings", mock_settings):
            from src.middleware.auth import get_current_user, get_current_tenant

            # Test get_current_user
            user = await get_current_user(credentials=None)
            assert user["test_mode"] is True

            # Test get_current_tenant
            tenant_id = await get_current_tenant(credentials=None)
            assert tenant_id == "2628802d-1dff-4a98-9325-704433c5d3ab"
