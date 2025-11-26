# Widget Dependencies Map

## File Structure

```
frontend/
├── widget.html          ← Entry point (served by backend)
├── widget.tsx           ← Widget React app (main code)
├── types.ts             ← TypeScript type definitions
├── src/
│   └── index.css        ← Tailwind CSS + custom styles
├── components/
│   ├── ChatWidget.tsx   ← Chat interface component
│   └── icons.tsx        ← Icon components (SVGs)
└── services/
    └── chatService.ts   ← API communication
```

---

## Dependency Tree

### Entry Point: `widget.html`
```
frontend/widget.html
    ↓
    └─ <script type="module" src="/widget.tsx">
```

**Purpose:** Static HTML file served by FastAPI
**Does:** Loads React and widget.tsx
**Dependencies:** None (HTML only)

---

### Main App: `widget.tsx`
```
frontend/widget.tsx
    ├─ import React
    ├─ import ReactDOM
    ├─ import ChatWidget           → ./components/ChatWidget.tsx
    ├─ import { Tenant, UserInfo } → ./types
    ├─ import { getApiBaseUrl, setApiBaseUrl } → ./services/chatService
    ├─ import './src/index.css'    → ./src/index.css
    └─ import { ChatBubbleIcon }   → ./components/icons
```

**Purpose:** Main widget React component
**Does:**
- Extracts widget_key and tenant_id from URL
- Fetches widget config from backend
- Creates anonymous chat user
- Creates chat session
- Renders ChatWidget or chat bubble button

**Dependencies:**
- ✅ `types.ts` - Type definitions (exists)
- ✅ `services/chatService.ts` - API calls (exists)
- ✅ `src/index.css` - Styles (exists)
- ✅ `components/ChatWidget.tsx` - Chat UI (exists)
- ✅ `components/icons.tsx` - Icons (exists)

---

### Chat Interface: `components/ChatWidget.tsx`
```
frontend/components/ChatWidget.tsx
    ├─ import { Tenant, UserInfo, Message, Topic } → ../types
    ├─ import { sendMessage, getApiBaseUrl } → ../services/chatService
    ├─ import { escalateSession, detectAutoEscalation } → ../services/escalationService
    ├─ import { getAgentNameFromMessage } → ../src/config/topic-agent-mapping
    ├─ import Markdown from 'react-markdown'
    ├─ import remarkGfm from 'remark-gfm'
    └─ import { icons... } → ./icons
```

**Purpose:** Full chat interface component
**Does:**
- Displays messages
- Handles message input
- Manages conversation state
- Supports file uploads
- Handles session escalation

**Dependencies:**
- ✅ `types.ts` - Type definitions (exists)
- ✅ `services/chatService.ts` - API calls (exists)
- ✅ `services/escalationService.ts` - Escalation logic (should exist)
- ✅ `src/config/topic-agent-mapping.ts` - Agent mapping (should exist)
- ✅ `components/icons.tsx` - Icons (exists)
- ✅ `react-markdown` - NPM package (should be installed)
- ✅ `remark-gfm` - NPM package (should be installed)

---

### Types: `types.ts`
```
frontend/types.ts
    ├─ export interface Tenant { ... }
    ├─ export interface UserInfo { ... }
    ├─ export interface Message { ... }
    └─ export interface Topic { ... }
```

**Purpose:** Shared type definitions
**Does:** Defines TypeScript interfaces
**Dependencies:** None

---

### Styles: `src/index.css`
```
frontend/src/index.css
    ├─ @import "tailwindcss"
    └─ Custom CSS rules
```

**Purpose:** Global styles for widget
**Does:** Imports Tailwind, sets container sizing
**Dependencies:** Tailwind CSS (via Vite config)

---

### Icons: `components/icons.tsx`
```
frontend/components/icons.tsx
    ├─ export ChatBubbleIcon { ... }
    ├─ export SendIcon { ... }
    ├─ export XMarkIcon { ... }
    └─ export ... { ... }
```

**Purpose:** SVG icon components
**Does:** Defines icon React components
**Dependencies:** React only

---

### API Service: `services/chatService.ts`
```
frontend/services/chatService.ts
    ├─ export function sendMessage(...) { ... }
    ├─ export function getApiBaseUrl() { ... }
    ├─ export function setApiBaseUrl(...) { ... }
    └─ ... other API functions
```

**Purpose:** API communication
**Does:** Makes HTTP requests to backend
**Dependencies:** None (uses fetch API)

---

## Build Process

### Vite Configuration
**File:** `frontend/vite.config.ts`

```typescript
{
  input: {
    main: 'index.html',
    widget: 'widget.html'  ← Builds widget separately
  }
}
```

**Build Output:**
```
frontend/dist/
├── widget.html          ← Served by /widget/{key}
├── widget-{hash}.js     ← Compiled widget.tsx + dependencies
├── index.html           ← Main app (not used by widget)
├── index-{hash}.js      ← Main app (not used by widget)
└── assets/
    ├── ChatWidget-{hash}.js
    ├── style-{hash}.css
    └── ...
```

---

## Runtime Flow

```
1. Backend serves: GET /widget/wk_xxx?tenant_id=yyy
   ↓
2. Returns: frontend/dist/widget.html
   ↓
3. Browser loads: <script src="/widget.tsx">
   ↓
4. Webpack loads: widget-{hash}.js (compiled widget.tsx)
   ↓
5. widget.tsx loads dependencies:
   ├─ ChatWidget component
   ├─ types definitions
   ├─ chatService functions
   ├─ index.css styles
   └─ icons components
   ↓
6. widget.tsx executes:
   ├─ ReactDOM.createRoot(#root)
   ├─ Renders WidgetApp component
   └─ WidgetApp initializes widget
```

---

## Dependency Status

### ✅ All Core Files Exist
- [x] widget.html
- [x] widget.tsx
- [x] types.ts
- [x] src/index.css
- [x] components/ChatWidget.tsx
- [x] components/icons.tsx
- [x] services/chatService.ts

### ✅ External Dependencies (NPM)
- [x] react
- [x] react-dom
- [x] react-markdown
- [x] remark-gfm
- [x] @vitejs/plugin-react (for Vite)
- [x] @tailwindcss/vite (for Tailwind)

### ⚠️ Potential Issues to Check
1. **Missing services:**
   - `services/escalationService.ts` - Check if used
   - `src/config/topic-agent-mapping.ts` - Check if used

2. **Build output:**
   - Does `frontend/dist/widget.html` exist after build?
   - Does `frontend/dist/widget-{hash}.js` exist?

3. **Build imports:**
   - Do all imports use correct relative paths?
   - Are all modules properly exported?

---

## How to Verify Everything Works

```bash
# 1. Check all dependencies are installed
cd frontend
npm list react react-dom react-markdown remark-gfm

# 2. Build the widget
npm run build

# 3. Verify build output
ls -la dist/widget.html
ls -la dist/widget-*.js

# 4. Check for any import errors during build
npm run build 2>&1 | grep -i "error\|not found"
```

---

## Missing Files Check

Let me verify if these optional files exist:

**services/escalationService.ts**
```bash
ls -la frontend/services/escalationService.ts
```

**src/config/topic-agent-mapping.ts**
```bash
ls -la frontend/src/config/topic-agent-mapping.ts
```

If these don't exist but are imported in ChatWidget.tsx, the build will fail.

