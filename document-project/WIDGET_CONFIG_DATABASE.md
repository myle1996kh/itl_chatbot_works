# Widget Configuration & Database Mapping

How chat widget configurations connect to the database and flow through the system.

## 📦 TenantWidgetConfig Model

**File**: `backend/src/models/tenant_widget_config.py`

### Complete Model Definition

```python
class TenantWidgetConfig(Base):
    """Configuration for embeddable chat widget per tenant."""

    __tablename__ = "tenant_widget_configs"

    # Primary & Foreign Keys
    config_id: UUID                 # Primary key - unique config identifier
    tenant_id: UUID                 # Foreign key to tenants (unique per tenant)

    # Widget Identification
    widget_key: str                 # Public identifier for embed code
    widget_secret: str              # Encrypted secret for verification

    # Appearance Settings
    theme: str                      # "light", "dark", "auto" (default: "light")
    primary_color: str              # Hex color (default: "#3B82F6")
    position: str                   # Widget position (default: "bottom-right")
    custom_css: str                 # Custom CSS overrides (nullable)

    # Behavior Settings
    auto_open: bool                 # Auto-open on page load (default: False)
    welcome_message: str            # Initial greeting (nullable)
    placeholder_text: str           # Input placeholder (default: "Type your message...")

    # Security Settings
    allowed_domains: list[str]      # Whitelist of parent domains
    max_session_duration: int       # Session timeout in seconds (default: 3600)
    rate_limit_per_minute: int      # Messages per minute (default: 20)

    # Feature Flags
    enable_file_upload: bool        # Enable file uploads (default: False)
    enable_voice_input: bool        # Enable voice input (default: False)
    enable_conversation_history: bool  # Show history (default: True)

    # Embed Code
    embed_script_url: str           # CDN URL for widget.js (nullable)
    embed_code_snippet: str         # Ready-to-copy HTML snippet (nullable)

    # Metadata
    created_at: datetime
    updated_at: datetime
    last_regenerated_at: datetime   # When widget_key was last rotated (nullable)
```

## 🎨 Widget Configuration Fields Reference

### Identification Fields

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `widget_key` | String(64) | Generated UUID | Public identifier for embed scripts |
| `widget_secret` | String(255) | Generated + Encrypted | Secret for verifying requests |

**Usage**:
- `widget_key`: Included in embed code, visible to customers
- `widget_secret`: Never exposed, used server-side for verification

**Generation Example**:
```python
widget_key = str(uuid.uuid4())[:20].replace('-', '')  # e.g., "550e8400e29b41d4a71"
widget_secret = Fernet(fernet_key).encrypt(
    str(uuid.uuid4()).encode()
).decode()  # Encrypted UUID
```

### Appearance Settings

| Field | Type | Options | Default | Purpose |
|-------|------|---------|---------|---------|
| `theme` | String(20) | light, dark, auto | light | Widget color scheme |
| `primary_color` | String(7) | Hex color | #3B82F6 | Brand color |
| `position` | String(20) | bottom-right, bottom-left, top-right, top-left | bottom-right | Widget placement |
| `custom_css` | Text | Any CSS | NULL | Custom styling |

**Example Configuration**:
```json
{
  "theme": "dark",
  "primary_color": "#FF6B35",
  "position": "bottom-left",
  "custom_css": ".chat-widget { font-family: 'Poppins', sans-serif; }"
}
```

**CSS Variables Available**:
```css
--widget-primary-color: #3B82F6;
--widget-text-color: #1F2937;
--widget-bg-color: #FFFFFF;
--widget-border-radius: 8px;
--widget-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

### Behavior Settings

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `auto_open` | Boolean | False | Auto-open on page load |
| `welcome_message` | Text | NULL | Greeting message |
| `placeholder_text` | String(255) | "Type your message..." | Input placeholder |

**Example**:
```json
{
  "auto_open": true,
  "welcome_message": "Hi! How can we help you today? 👋",
  "placeholder_text": "Ask me anything..."
}
```

### Security Settings

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `allowed_domains` | JSONB Array | [] | CORS whitelist |
| `max_session_duration` | Integer | 3600 | Session timeout (seconds) |
| `rate_limit_per_minute` | Integer | 20 | Message rate limit |

**Example Allowed Domains**:
```json
{
  "allowed_domains": [
    "example.com",
    "app.example.com",
    "support.example.com",
    "*.example.com"  // Wildcard subdomain
  ]
}
```

**Security Validation**:
- Widget request must include `Referer` header
- Referer domain must be in `allowed_domains` list
- `widget_key` must match requesting domain
- Rate limits enforced per tenant globally

### Feature Flags

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `enable_file_upload` | Boolean | False | Allow file attachments |
| `enable_voice_input` | Boolean | False | Enable voice transcription |
| `enable_conversation_history` | Boolean | True | Show message history |

**Feature Implications**:
- `enable_file_upload=true` → Need file storage service
- `enable_voice_input=true` → Need speech-to-text API
- `enable_conversation_history=true` → Load previous messages on widget open

### Embed Code Fields

| Field | Type | Purpose |
|-------|------|---------|
| `embed_script_url` | String(500) | CDN URL to widget.js |
| `embed_code_snippet` | Text | Ready-to-copy HTML |

**Example Embed Script URL**:
```
https://cdn.example.com/widgets/chat-widget-v1.0.js
```

**Example Embed Code Snippet**:
```html
<!-- Copy this to your website -->
<script>
  (function() {
    var script = document.createElement('script');
    script.src = 'https://cdn.example.com/widgets/chat-widget-v1.0.js';
    script.setAttribute('data-widget-key', '550e8400e29b41d4a71');
    script.setAttribute('data-tenant-id', 'tenant-uuid');
    document.head.appendChild(script);
  })();
</script>

<!-- Or use this tag directly: -->
<chat-widget
  widget-key="550e8400e29b41d4a71"
  tenant-id="tenant-uuid"
  position="bottom-right"
></chat-widget>
```

## 🔄 Widget Configuration Lifecycle

### 1. Widget Creation (Admin API)

**Endpoint**: `POST /api/admin/widget-configs`

**Request**:
```json
{
  "tenant_id": "880e8400-e29b-41d4-a716-446655440003",
  "theme": "light",
  "primary_color": "#3B82F6",
  "position": "bottom-right",
  "auto_open": false,
  "welcome_message": "Welcome to our chat!",
  "allowed_domains": ["example.com"],
  "rate_limit_per_minute": 20,
  "enable_conversation_history": true
}
```

**Processing**:
1. Validate `tenant_id` exists
2. Check tenant doesn't already have widget config
3. Generate unique `widget_key`
4. Generate and encrypt `widget_secret`
5. Create `TenantWidgetConfig` row
6. Generate embed code snippet
7. Return config with generated values

**Database Insert**:
```sql
INSERT INTO tenant_widget_configs (
    config_id, tenant_id, widget_key, widget_secret,
    theme, primary_color, position, auto_open, welcome_message,
    placeholder_text, allowed_domains, max_session_duration,
    rate_limit_per_minute, enable_conversation_history,
    created_at, updated_at
) VALUES (
    '550e8400-e29b-41d4-a716-446655440000',  -- UUID
    '880e8400-e29b-41d4-a716-446655440003',  -- tenant_id
    '550e8400e29b41d4a71',                   -- widget_key (generated)
    'gAAAAABlUxz...',                        -- widget_secret (encrypted)
    'light',
    '#3B82F6',
    'bottom-right',
    false,
    'Welcome to our chat!',
    'Type your message...',
    '["example.com"]',                       -- JSONB array
    3600,
    20,
    true,
    NOW(),
    NOW()
);
```

**Response**:
```json
{
  "config_id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "880e8400-e29b-41d4-a716-446655440003",
  "widget_key": "550e8400e29b41d4a71",
  "widget_secret": "gAAAAABlUxz...",
  "theme": "light",
  "primary_color": "#3B82F6",
  "position": "bottom-right",
  "auto_open": false,
  "welcome_message": "Welcome to our chat!",
  "allowed_domains": ["example.com"],
  "rate_limit_per_minute": 20,
  "enable_conversation_history": true,
  "embed_script_url": "https://cdn.example.com/widgets/chat-widget-v1.0.js",
  "embed_code_snippet": "<script>...</script>",
  "created_at": "2025-11-19T10:00:00Z",
  "updated_at": "2025-11-19T10:00:00Z"
}
```

### 2. Widget Configuration Update

**Endpoint**: `PATCH /api/admin/widget-configs/{tenant_id}`

**Request** (partial update):
```json
{
  "theme": "dark",
  "primary_color": "#FF6B35",
  "position": "bottom-left"
}
```

**Processing**:
1. Query existing config by `tenant_id`
2. Update specified fields
3. Update `updated_at` timestamp
4. Regenerate `embed_code_snippet` if necessary

**Database Update**:
```sql
UPDATE tenant_widget_configs
SET theme = 'dark',
    primary_color = '#FF6B35',
    position = 'bottom-left',
    updated_at = NOW()
WHERE tenant_id = '880e8400-e29b-41d4-a716-446655440003';
```

### 3. Widget Key Regeneration (Security)

**Endpoint**: `POST /api/admin/widget-configs/{tenant_id}/regenerate-key`

**Purpose**: Rotate `widget_key` for security (e.g., if exposed)

**Processing**:
1. Query config by `tenant_id`
2. Generate new `widget_key`
3. Generate new encrypted `widget_secret`
4. Update `last_regenerated_at`
5. Regenerate `embed_code_snippet`
6. Notify tenant to update embed code on their site

**Database Update**:
```sql
UPDATE tenant_widget_configs
SET widget_key = 'new_key_generated',
    widget_secret = 'encrypted_new_secret',
    updated_at = NOW(),
    last_regenerated_at = NOW()
WHERE tenant_id = '880e8400-e29b-41d4-a716-446655440003';
```

### 4. Widget Retrieval (Widget JavaScript)

**Endpoint**: `GET /api/widgets/{widget_key}/config`

**Purpose**: Frontend widget.js fetches configuration

**Processing**:
1. Query config by `widget_key`
2. Get `Referer` header from request
3. Extract domain from Referer
4. Check domain in `allowed_domains`
5. If allowed: return safe config (no secrets)
6. If not allowed: return 403 Forbidden

**Query**:
```sql
SELECT theme, primary_color, position, auto_open, welcome_message,
       placeholder_text, enable_conversation_history
FROM tenant_widget_configs
WHERE widget_key = '550e8400e29b41d4a71';
```

**Response** (safe, no secrets):
```json
{
  "tenant_id": "880e8400-e29b-41d4-a716-446655440003",
  "theme": "light",
  "primary_color": "#3B82F6",
  "position": "bottom-right",
  "auto_open": false,
  "welcome_message": "Welcome to our chat!",
  "placeholder_text": "Type your message...",
  "enable_conversation_history": true,
  "chat_api_endpoint": "/api/880e8400-e29b-41d4-a716-446655440003/chat"
}
```

## 📊 Database Schema & Relationships

### Table Definition

```sql
CREATE TABLE tenant_widget_configs (
    config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL UNIQUE,
    widget_key VARCHAR(64) NOT NULL UNIQUE,
    widget_secret VARCHAR(255) NOT NULL,

    -- Appearance
    theme VARCHAR(20) DEFAULT 'light',
    primary_color VARCHAR(7) DEFAULT '#3B82F6',
    position VARCHAR(20) DEFAULT 'bottom-right',
    custom_css TEXT,

    -- Behavior
    auto_open BOOLEAN DEFAULT false,
    welcome_message TEXT,
    placeholder_text VARCHAR(255) DEFAULT 'Type your message...',

    -- Security
    allowed_domains JSONB DEFAULT '[]',
    max_session_duration INTEGER DEFAULT 3600,
    rate_limit_per_minute INTEGER DEFAULT 20,

    -- Features
    enable_file_upload BOOLEAN DEFAULT false,
    enable_voice_input BOOLEAN DEFAULT false,
    enable_conversation_history BOOLEAN DEFAULT true,

    -- Embed Code
    embed_script_url VARCHAR(500),
    embed_code_snippet TEXT,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_regenerated_at TIMESTAMP,

    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    INDEX idx_widget_key (widget_key),
    INDEX idx_tenant_id (tenant_id)
);
```

### Relationships

```
Tenants
├── tenant_id (PK)
├── name
└──────── ONE-TO-ONE ────────→ TenantWidgetConfigs
          (tenant_id FK)      ├── config_id (PK)
                              ├── tenant_id (FK, UNIQUE)
                              └── widget_key, theme, position, etc.
```

## 🔒 Security Considerations

### 1. Domain Whitelisting

**Validation**:
```python
# When widget.js loads from frontend
request_referer = request.headers.get("Referer")  # e.g., "https://example.com/page"
widget_domain = urllib.parse.urlparse(request_referer).netloc  # e.g., "example.com"

config = db.query(TenantWidgetConfig).filter(
    TenantWidgetConfig.widget_key == widget_key
).first()

if widget_domain not in config.allowed_domains:
    raise HTTPException(status_code=403, detail="Domain not whitelisted")
```

**Wildcard Subdomain Matching**:
```python
def is_domain_allowed(requested_domain: str, allowed_list: List[str]) -> bool:
    for allowed in allowed_list:
        if allowed.startswith("*."):
            # Wildcard: *.example.com matches api.example.com, app.example.com
            base_domain = allowed[2:]  # Remove "*."
            if requested_domain.endswith(base_domain):
                return True
        elif allowed == requested_domain:
            # Exact match
            return True
    return False
```

### 2. Widget Secret Encryption

**Encryption Example**:
```python
from cryptography.fernet import Fernet

# Server-side
fernet_key = os.getenv("FERNET_KEY")  # e.g., "vF3-jASDJKASJDKajsdklasjdklasdkl="
cipher = Fernet(fernet_key)

# On widget creation
widget_secret = str(uuid.uuid4())
encrypted_secret = cipher.encrypt(widget_secret.encode()).decode()
# Store encrypted_secret in DB

# When verifying requests
decrypted_secret = cipher.decrypt(encrypted_secret.encode()).decode()
# Compare with request signature
```

### 3. Rate Limiting

**Implementation**:
```python
# In chat endpoint
widget_config = db.query(TenantWidgetConfig).filter(
    TenantWidgetConfig.tenant_id == tenant_id
).first()

# Check rate limit
current_minute = int(time.time()) // 60
message_count = redis_client.incr(
    f"widget:{tenant_id}:{widget_config.widget_key}:msgs:{current_minute}"
)
redis_client.expire(f"widget:{tenant_id}:...", 60)

if message_count > widget_config.rate_limit_per_minute:
    raise HTTPException(status_code=429, detail="Rate limit exceeded")
```

### 4. Session Duration

**Validation**:
```python
session = db.query(ChatSession).filter(
    ChatSession.session_id == session_id
).first()

elapsed = (datetime.now() - session.created_at).total_seconds()
max_duration = db.query(TenantWidgetConfig).filter(
    TenantWidgetConfig.tenant_id == tenant_id
).first().max_session_duration

if elapsed > max_duration:
    raise HTTPException(status_code=410, detail="Session expired")
```

## 🔌 Widget-to-Chat Flow

```
1. User visits customer website
                │
                ▼
2. Website loads widget.js with widget_key
                │
                ▼
3. Widget.js GETs /api/widgets/{widget_key}/config
                │
                ├─→ Server checks Referer against allowed_domains
                │
                ├─→ Returns safe config (theme, colors, messages)
                │
                ▼
4. Widget renders with config (theme, position, colors)
                │
                ▼
5. User types message and presses Enter
                │
                ▼
6. Widget POSTs to /api/{tenant_id}/chat
   ├─ message: "What's my invoice status?"
   ├─ user_id: "user-uuid"
   ├─ session_id: null (or existing session)
   └─ metadata: { widget_key: "550e8400e29b41d4a71" }
                │
                ├─→ Server verifies widget_key
                ├─→ Checks rate_limit_per_minute
                ├─→ Creates session if needed
                ├─→ Routes through SupervisorAgent/DomainAgent
                │
                ▼
7. Server returns ChatResponse
                │
                ▼
8. Widget displays agent response
                │
                ▼
9. User continues conversation (within session)
                │
                └─→ Sessions timeout after max_session_duration
```

## 📋 Widget Configuration Checklist

### Setup

- [ ] Create `TenantWidgetConfig` for your tenant
- [ ] Configure `theme` (light/dark) and `primary_color`
- [ ] Set `position` (bottom-right, bottom-left, etc.)
- [ ] Add your domain to `allowed_domains`
- [ ] Set `rate_limit_per_minute` (recommend 20-50)
- [ ] Set `max_session_duration` (default 3600 seconds = 1 hour)
- [ ] Enable feature flags as needed
- [ ] Copy embed code snippet to your website

### Testing

- [ ] Open website with widget embed code
- [ ] Verify widget appears in correct position
- [ ] Test sending message (should create session)
- [ ] Verify conversation history appears
- [ ] Test rate limiting (send 20+ messages in 1 minute)
- [ ] Test domain whitelist (access from unauthorized domain should fail)
- [ ] Test session timeout (wait > max_session_duration, session should expire)

### Monitoring

- [ ] Check rate limit headers in responses
- [ ] Monitor `messages` table for widget activity
- [ ] Track chat session duration
- [ ] Monitor error logs for domain/security issues

---

This design enables secure, configurable chat widget embedding across multiple customer websites.
