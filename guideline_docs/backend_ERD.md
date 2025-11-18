# Backend ERD – Multi‑Tenant Chatbot

This document describes the main database entities inferred from `backend/src/models` and their relationships.

> Note: This ERD is derived from SQLAlchemy models only. It does not cover any tables defined outside `backend/src`.

## Core Entities

- **Tenant (`tenants`)**
  - `tenant_id` (PK, UUID)
  - `name`
  - `domain` (unique)
  - `status` (`active`, etc.)
  - `created_at`
  - `updated_at`
  - Relationships:
    - `sessions` → `ChatSession` (1:N)
    - `users` → `User` (1:N)
    - `chat_users` → `ChatUser` (1:N)
    - `agent_permissions` → `TenantAgentPermission` (1:N)
    - `tool_permissions` → `TenantToolPermission` (1:N)
    - `llm_config` → `TenantLLMConfig` (1:1)
    - `widget_config` → `TenantWidgetConfig` (1:1)

- **ChatUser (`chat_users`)**
  - Represents end‑users/customers.
  - `user_id` (PK, UUID)
  - `tenant_id` (FK → `tenants.tenant_id`)
  - `email`
  - `username`
  - `department` (optional)
  - `created_at`
  - `last_active`
  - Constraints/Indexes:
    - Unique on (`tenant_id`, `email`)
    - Indexes for tenant/email lookups.
  - Relationships:
    - `tenant` → `Tenant`
    - `sessions` → `ChatSession` (1:N)

- **User (`users`)**
  - Represents staff/admin/supporters.
  - `user_id` (PK, UUID)
  - `tenant_id` (FK → `tenants.tenant_id`)
  - `email`
  - `username`
  - `password_hash`
  - `role` (`supporter`, `admin`, …)
  - `display_name`
  - `status`
  - `created_by` (FK → `users.user_id`, creator admin)
  - `created_at`, `updated_at`, `last_login`
  - Supporter profile:
    - `supporter_status`
    - `max_concurrent_sessions`
    - `current_sessions_count`
  - Relationships:
    - `tenant` → `Tenant`

- **ChatSession (`sessions`)**
  - Conversation session between a ChatUser and agents/supporters.
  - `session_id` (PK, UUID)
  - `tenant_id` (FK → `tenants.tenant_id`)
  - `user_id` (FK → `chat_users.user_id`)
  - `agent_id` (FK → `agent_configs.agent_id`)
  - `thread_id` (LangGraph thread)
  - `created_at`
  - `last_message_at`
  - `session_metadata` (JSONB, column `metadata`)
  - Escalation fields:
    - `assigned_user_id` (FK → `users.user_id`)
    - `escalation_status` (`none`, `pending`, `assigned`, `resolved`)
    - `escalation_reason`
    - `escalation_requested_at`
    - `escalation_assigned_at`
  - Relationships:
    - `tenant` → `Tenant`
    - `chat_user` → `ChatUser`
    - `assigned_user` → `User`
    - `agent` → `AgentConfig`
    - `messages` → `Message` (1:N)

- **Message (`messages`)**
  - Individual message in a session.
  - `message_id` (PK, UUID)
  - `session_id` (FK → `sessions.session_id`)
  - `role` (`user`, `assistant`, `system`, `supporter`)
  - `content`
  - `created_at` (column name `timestamp`)
  - `message_metadata` (JSONB, column `metadata`)
  - `sender_user_id` (FK → `users.user_id`, optional)
  - Relationships:
    - `session` → `ChatSession`
    - `sender_user` → `User`

## LLM Configuration & Output

- **LLMModel (`llm_models`)**
  - Model registry.
  - `llm_model_id` (PK, UUID)
  - Typically includes provider/model identifiers (see model file for exact fields).
  - Relationships:
    - `agent_configs` → `AgentConfig` (1:N)

- **OutputFormat (`output_formats`)**
  - Standard response formats.
  - `format_id` (PK, UUID)
  - Describes structure/formatting for agent/tool outputs.
  - Relationships:
    - `agent_configs` → `AgentConfig` (1:N)
    - `tool_configs` → `ToolConfig` (1:N)

- **TenantLLMConfig (`tenant_llm_config`)**
  - Tenant‑specific LLM configuration.
  - `config_id` (PK, UUID)
  - `tenant_id` (FK → `tenants.tenant_id`, unique)
  - Fields for provider, model, API key, etc.
  - Relationships:
    - `tenant` → `Tenant`

## Tools & Agents

- **BaseTool (`base_tools`)**
  - Abstract tool definition.
  - `base_tool_id` (PK, UUID)
  - Names, descriptions, handler class, etc.
  - Relationships:
    - `tool_configs` → `ToolConfig` (1:N)

- **ToolConfig (`tool_configs`)**
  - Concrete tool instance.
  - `tool_id` (PK, UUID)
  - `name`
  - `base_tool_id` (FK → `base_tools.base_tool_id`)
  - `config` (JSONB, tool‑specific config such as endpoint/method/headers)
  - `input_schema` (JSONB)
  - `output_format_id` (FK → `output_formats.format_id`)
  - `description`
  - `is_active`
  - `created_at`, `updated_at`
  - Relationships:
    - `base_tool` → `BaseTool`
    - `output_format` → `OutputFormat`
    - `agent_tools` → `AgentTools` (1:N)
    - `tenant_tool_permissions` → `TenantToolPermission` (1:N)

- **AgentConfig (`agent_configs`)**
  - Domain‑specific agent configuration.
  - `agent_id` (PK, UUID)
  - `name` (unique)
  - `prompt_template`
  - `llm_model_id` (FK → `llm_models.llm_model_id`)
  - `default_output_format_id` (FK → `output_formats.format_id`)
  - `description`
  - `handler_class`
  - `is_active`
  - `created_at`, `updated_at`
  - Relationships:
    - `llm_model` → `LLMModel`
    - `output_format` → `OutputFormat`
    - `agent_tools` → `AgentTools` (1:N)
    - `tenant_permissions` → `TenantAgentPermission` (1:N)

- **AgentTools (`agent_tools`)**
  - Junction table: many‑to‑many between `AgentConfig` and `ToolConfig`.
  - PK: (`agent_id`, `tool_id`)
  - `agent_id` (FK → `agent_configs.agent_id`)
  - `tool_id` (FK → `tool_configs.tool_id`)
  - `priority`
  - `created_at`
  - Relationships:
    - `agent` → `AgentConfig`
    - `tool` → `ToolConfig`

## Tenant Permissions & Widget

- **TenantAgentPermission (`tenant_agent_permissions`)**
  - Enables agents for specific tenants, with optional overrides.
  - PK: (`tenant_id`, `agent_id`)
  - `tenant_id` (FK → `tenants.tenant_id`)
  - `agent_id` (FK → `agent_configs.agent_id`)
  - `enabled`
  - `output_override_id` (FK → `output_formats.format_id`, optional)
  - `created_at`, `updated_at`
  - Relationships:
    - `tenant` → `Tenant`
    - `agent` → `AgentConfig`
    - `output_format` → `OutputFormat`

- **TenantToolPermission (`tenant_tool_permissions`)**
  - Enables tools for specific tenants.
  - PK: (`tenant_id`, `tool_id`)
  - `tenant_id` (FK → `tenants.tenant_id`)
  - `tool_id` (FK → `tool_configs.tool_id`)
  - `enabled`
  - `created_at`
  - Relationships:
    - `tenant` → `Tenant`
    - `tool` → `ToolConfig`

- **TenantWidgetConfig (`tenant_widget_config`)**
  - Widget configuration per tenant.
  - `config_id` (PK, UUID)
  - `tenant_id` (FK → `tenants.tenant_id`, unique)
  - Fields for colors, messages, theme, etc.
  - Relationships:
    - `tenant` → `Tenant`

## Supporter / Escalation

- **Supporter (`supporters`)**
  - Separate model for supporter profiles (if used beyond `User`).
  - Typically links to `users` and `tenants` for escalation routing.

## High‑Level Relationships Summary

- One **Tenant** has:
  - many **ChatUsers**
  - many **Users** (admins/supporters)
  - many **ChatSessions**
  - many **TenantAgentPermission** & **TenantToolPermission**
  - exactly one **TenantLLMConfig** and one **TenantWidgetConfig**

- One **ChatUser** has many **ChatSessions**, each having many **Messages**.

- One **AgentConfig**:
  - uses one **LLMModel** and one **OutputFormat**
  - has many **AgentTools** (links to many **ToolConfig**)
  - can be enabled for many tenants via **TenantAgentPermission**.

- One **ToolConfig**:
  - belongs to one **BaseTool**
  - may appear in many **AgentTools**
  - can be enabled for many tenants via **TenantToolPermission**.

