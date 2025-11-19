# Widget User Auth Flow (Bearer Token) – DISABLE_AUTH = False

This document explains how **end users of the embedded chat widget** should obtain and send a **Bearer token** when `settings.DISABLE_AUTH == False`, in combination with `TenantWidgetConfig`.

> Important: This service **verifies** JWTs (via `JWT_PUBLIC_KEY`) but does **not issue** them. Tokens must be created by your authentication system (IdP or your own backend).

## 1. What the backend expects

For chat users using the widget:

- Endpoint: `POST /api/{tenant_id}/chat`
- Middleware/dependencies:
  - `Authorization: Bearer <JWT>` header is required.
  - `get_current_tenant` extracts `tenant_id` from the JWT.
  - `chat_endpoint` compares:
    - `tenant_id` path parameter vs. `tenant_id` from JWT.
    - If they differ (and `DISABLE_AUTH == False`) → `403 Access denied to this tenant`.

So every widget request must include a **valid JWT** where:

- `payload["tenant_id"]` == the tenant’s ID.
- `payload["sub"]` is the user identifier (can be real user or anonymous session).

## 2. Recommended patterns to issue tokens

### Option A – Use your existing IdP / SSO (authenticated users)

Use this when your product already has login (SAML, OIDC, Keycloak, Cognito, etc.).

1. **User logs into your app**  
   - Your frontend redirects to your IdP and obtains an auth session/JWT.

2. **Your backend receives/owns a JWT** for that user:  
   - Contains at least `sub` (user id) and `tenant_id`.
   - Signed by the same key whose public part is configured as `JWT_PUBLIC_KEY` in this chatbot service.

3. **Expose a small endpoint from your app**, e.g. `/widget/token`:
   - Checks the current logged-in user/session.
   - Returns a **short-lived JWT** (e.g. 5–15 minutes) with:
     - `sub`: user id from your system.
     - `tenant_id`: tenant that owns the widget.
     - Optional `roles`: `["user"]`.

4. **Widget initialization**:

   - The host page embeds the widget and calls your `/widget/token` endpoint (with cookies/session).
   - It passes the returned token into the widget config, e.g.:

   ```js
   window.ChatWidget.init({
     tenantId: "<TENANT_UUID>",
     apiBaseUrl: "https://chat-api.example.com",
     bearerToken: "<JWT_FROM_WIDGET_TOKEN_ENDPOINT>"
   });
   ```

5. **Widget requests**:

   - Widget JS sets `Authorization: Bearer <JWT>` on every request to `/api/{tenant_id}/chat`.

Result:

- Backend validates JWT signature and tenant.
- Chat user is authenticated as your logged-in user (`sub`).

### Option B – Anonymous/guest users using widget_key + widget_secret

Use when visitors can chat **without logging into your app**.

1. **Tenant widget configuration** (`TenantWidgetConfig`):
   - Each tenant has:
     - `widget_key` – public identifier used in embed code.
     - `widget_secret` – server-side secret, stored encrypted.
     - `allowed_domains` – list of allowed website origins.

2. **Create a “widget handshake” endpoint** in your app (not in this repo yet), e.g.:

   - `POST /widget/handshake`
   - Request from browser includes:
     - `widget_key`
     - current page `origin`
   - Your backend:
     - Looks up `TenantWidgetConfig` by `widget_key`.
     - Verifies `origin` is in `allowed_domains`.
     - Derives `tenant_id` from config.
     - Generates a **temporary anonymous ID** (e.g. UUID) for `sub`.
     - Issues a **short-lived JWT** signed with your private key:
       - `sub`: generated anonymous ID.
       - `tenant_id`: tenant from widget config.
       - Optional `roles`: `["user"]`.

3. **Widget initialization**:

   ```js
   async function initChatWidget() {
     const res = await fetch("/widget/handshake", {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({
         widget_key: "<TENANT_WIDGET_KEY>",
         origin: window.location.origin
       })
     });
     const { token, tenant_id } = await res.json();

     window.ChatWidget.init({
       tenantId: tenant_id,
       apiBaseUrl: "https://chat-api.example.com",
       bearerToken: token
     });
   }

   initChatWidget();
   ```

4. **Widget requests**:

   - Use the `token` from handshake as Bearer token on `/api/{tenant_id}/chat`.

Result:

- Backend sees a valid JWT with `tenant_id` and an anonymous `sub`.
- Tenant scoping is enforced; domain access is controlled by `allowed_domains`.

## 3. How `TenantWidgetConfig` fits in

- `widget_key`: used by your frontend to identify which tenant’s widget to load.
- `widget_secret`: used ONLY by your backend to verify that a request is legitimate (e.g., HMAC or signing logic in the handshake endpoint).
- `allowed_domains`: prevents other sites from embedding the widget by validating `origin` during handshake.
- Other fields (`theme`, `position`, etc.) are purely UI/behavioral and don’t affect auth.

## 4. Summary of user flow with tenant widget

When `DISABLE_AUTH == False`:

1. Page loads and embeds the tenant’s widget (using `widget_key`).
2. Widget (or host page) calls your backend to **get a JWT**:
   - Either from an existing login session (Option A),
   - Or via a widget handshake using `widget_key` / `allowed_domains` (Option B).
3. Widget stores that JWT and includes `Authorization: Bearer <JWT>` for all calls to `/api/{tenant_id}/chat`.
4. The chatbot backend:
   - Verifies the JWT signature with `JWT_PUBLIC_KEY`.
   - Extracts `tenant_id` and compares to URL path.
   - Processes chat normally if everything matches.

This is how end-users obtain and use Bearer tokens in a way that aligns with `TenantWidgetConfig` and the existing auth middleware.

