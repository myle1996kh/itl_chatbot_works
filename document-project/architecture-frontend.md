# Architecture - Frontend Web Application

**Generated:** 2025-11-26
**Part:** Frontend
**Type:** Web Application
**Primary Tech:** React 19 / TypeScript / Vite

## Executive Summary

The frontend is a modern React-based web application built with TypeScript and Vite. It provides two main interfaces: an **Admin Dashboard** for managing the chatbot system and an **Embeddable Chat Widget** for end-user interactions. The application is built as a component-based SPA (Single Page Application) with Tailwind CSS for styling.

## Architecture Pattern

**Primary Pattern:** Component-Based Single Page Application

**Key Characteristics:**
- **Component Hierarchy:** Pages → Feature Components → Shared UI Components
- **State Management:** React hooks and context (lightweight, no Redux)
- **Routing:** Client-side routing (inferred from page structure)
- **Build System:** Vite for fast HMR and optimized production builds
- **Styling:** Tailwind CSS utility-first approach

## System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                     Entry Points                                  │
│                                                                   │
│  ┌─────────────────────┐        ┌──────────────────────┐        │
│  │   index.html        │        │   widget.html        │        │
│  │   (Main App)        │        │   (Embeddable)       │        │
│  └──────────┬──────────┘        └──────────┬───────────┘        │
│             │                               │                    │
│  ┌──────────▼──────────┐        ┌──────────▼───────────┐        │
│  │    index.tsx        │        │    widget.tsx        │        │
│  │  (React Bootstrap)  │        │  (Widget Bootstrap)  │        │
│  └──────────┬──────────┘        └──────────┬───────────┘        │
│             │                               │                    │
│  ┌──────────▼──────────┐        ┌──────────▼───────────┐        │
│  │    App.tsx          │        │  ChatWidget.tsx      │        │
│  │  (Main Container)   │        │  (Standalone)        │        │
│  └──────────┬──────────┘        └──────────────────────┘        │
└─────────────┼─────────────────────────────────────────────────────┘
              │
┌─────────────▼─────────────────────────────────────────────────────┐
│                    Component Layer                                 │
│                                                                    │
│  ┌──────────────────┐    ┌──────────────────┐    ┌────────────┐  │
│  │  Pages/          │    │  Components/     │    │  Shared/   │  │
│  │  - LoginPage     │    │  - ChatWidget    │    │  - icons   │  │
│  │  - Dashboard     │    │  - AdminDashboard│    │  - UI      │  │
│  │  - Settings      │    │  - UserInfoForm  │    │            │  │
│  └────────┬─────────┘    └────────┬─────────┘    └────────────┘  │
│           │                       │                               │
│           └───────────┬───────────┘                               │
│                       │                                           │
└───────────────────────┼───────────────────────────────────────────┘
                        │
┌───────────────────────▼───────────────────────────────────────────┐
│                  Services Layer                                    │
│                                                                    │
│  ┌──────────────────┐    ┌──────────────────┐    ┌────────────┐  │
│  │  API Client      │    │  State Mgmt      │    │  Utils     │  │
│  │  - REST calls    │    │  - React Context │    │  - helpers │  │
│  │  - Auth tokens   │    │  - Custom hooks  │    │  - format  │  │
│  │  - Error handling│    │  - Local state   │    │            │  │
│  └────────┬─────────┘    └──────────────────┘    └────────────┘  │
│           │                                                       │
└───────────┼───────────────────────────────────────────────────────┘
            │
            │ HTTPS/JWT
            ▼
   [Backend API]
```

## Core Components

### 1. Entry Points

#### Main Application (`index.tsx` + `index.html`)
**Purpose:** Primary admin/user interface

**Responsibilities:**
- Bootstrap React application
- Set up global providers (auth, theme)
- Initialize routing
- Render App component

#### Widget Application (`widget.tsx` + `widget.html`)
**Purpose:** Embeddable chat widget for external sites

**Responsibilities:**
- Standalone chat interface
- Configurable appearance from tenant settings
- Isolated from main app
- Can be embedded via iframe or script tag

### 2. Main Components

#### App.tsx
**Purpose:** Main application container

**Responsibilities:**
- Root component for main app
- Routing configuration
- Global state providers
- Layout structure

#### ChatWidget (`components/ChatWidget.tsx`)
**Purpose:** Chat interface component

**Features:**
- Message display with markdown rendering
- User input field
- Typing indicators
- Message history scrolling
- File attachments (PDF preview)
- Configurable styling per tenant

**State Management:**
- Local state for messages
- WebSocket/SSE for real-time updates (inferred)
- Session persistence

#### AdminDashboard (`components/AdminDashboard.tsx`)
**Purpose:** Admin panel interface

**Features:**
- Tenant management
- Agent configuration
- Tool management
- Knowledge base upload
- Session monitoring
- Analytics dashboard

**Layout:**
- Navigation sidebar
- Main content area
- Action buttons
- Data tables/grids

#### UserInfoForm (`components/UserInfoForm.tsx`)
**Purpose:** User information collection

**Usage:**
- Pre-chat form
- User registration
- Profile updates

**Fields:**
- Name, email, custom metadata
- Validation with error messages

#### LoginPage (`pages/LoginPage.tsx`)
**Purpose:** Authentication interface

**Features:**
- Login form
- JWT token management
- Redirect after auth
- Error handling

### 3. Styling System

#### Tailwind CSS (`tailwind.config.ts`)
**Approach:** Utility-first CSS

**Configuration:**
- Custom color palette
- Responsive breakpoints
- Dark mode support (likely)
- Component-specific utilities

**Usage Pattern:**
```tsx
<div className="flex flex-col p-4 bg-white rounded-lg shadow-md">
  <h2 className="text-xl font-bold text-gray-900">Title</h2>
  <p className="text-sm text-gray-600">Content</p>
</div>
```

#### Global Styles (`index.css`)
- Base Tailwind imports
- Custom CSS variables
- Global resets
- Font imports

### 4. Build System (Vite)

#### Configuration (`vite.config.ts`)
**Features:**
- React plugin with Fast Refresh
- Tailwind CSS processing
- Path aliases (`@/*` → `./`)
- Production optimization

**Build Outputs:**
- `dist/` - Optimized production build
- Code splitting
- Asset hashing
- Minification

**Dev Server:**
- Hot Module Replacement (HMR)
- Fast startup time
- Instant updates

### 5. TypeScript Configuration

#### TSConfig (`tsconfig.json`)
**Settings:**
- Target: ES2022
- Module: ESNext
- JSX: react-jsx (React 17+ transform)
- Strict mode: Enabled
- Path aliases: `@/*`

**Type Safety:**
- Type checking at compile time
- IntelliSense support
- Type definitions in `types.ts`

### 6. State Management

**Strategy:** Lightweight, no heavy frameworks

**Approaches:**
- **React Hooks:** useState, useEffect, useReducer
- **Context API:** Global state (auth, theme)
- **Custom Hooks:** Reusable stateful logic
- **Local Storage:** Persistence for settings

**State Structure (inferred):**
```tsx
// Auth Context
{
  user: User | null,
  token: string | null,
  login: (credentials) => Promise<void>,
  logout: () => void
}

// Chat State
{
  messages: Message[],
  session: Session | null,
  isTyping: boolean,
  sendMessage: (content: string) => Promise<void>
}
```

### 7. API Integration

**Pattern:** RESTful API client

**Features (inferred):**
- Base URL configuration
- JWT token in headers
- Error handling and retries
- Response parsing
- Loading states

**Example Usage:**
```tsx
// services/apiClient.ts
const apiClient = {
  chat: {
    send: (message) => fetch('/api/{tenant}/chat', {...}),
    getHistory: (sessionId) => fetch('/api/{tenant}/session/{id}', {...})
  },
  admin: {
    getAgents: () => fetch('/api/admin/agents', {...}),
    createAgent: (data) => fetch('/api/admin/agents', {...})
  }
}
```

## Component Architecture

### Component Hierarchy

```
App
├── Router
│   ├── LoginPage
│   ├── Dashboard
│   │   ├── AdminDashboard
│   │   │   ├── AgentList
│   │   │   ├── TenantList
│   │   │   └── SessionMonitor
│   │   └── UserSettings
│   └── ChatInterface
│       └── ChatWidget
│           ├── MessageList
│           │   └── MessageItem (markdown support)
│           ├── InputField
│           └── UserInfoForm
```

### Widget (Standalone)

```
widget.tsx
└── ChatWidget
    ├── MessageList
    │   └── MessageItem
    ├── InputField
    └── MinimizedButton
```

## Routing Structure (Inferred)

```
/                   → Dashboard or Login redirect
/login              → LoginPage
/dashboard          → AdminDashboard (authenticated)
/chat               → ChatWidget (authenticated)
/settings           → Settings page (authenticated)
```

## Data Flow

### Chat Flow
```
User types message
    ↓
ChatWidget captures input
    ↓
Call API: POST /api/{tenant}/chat
    ↓
Backend processes (agents, tools, RAG)
    ↓
Response received (streaming or JSON)
    ↓
Render message in MessageList (with markdown)
    ↓
Auto-scroll to bottom
```

### Admin Flow
```
Admin opens dashboard
    ↓
Load agents/tools from API
    ↓
Display in AdminDashboard
    ↓
Admin makes changes (create/update)
    ↓
Call API: POST/PUT /api/admin/*
    ↓
Refresh data
    ↓
Show success notification
```

## Styling Architecture

### Tailwind Utility Classes
- **Layout:** `flex`, `grid`, `container`
- **Spacing:** `p-4`, `m-2`, `gap-4`
- **Typography:** `text-lg`, `font-bold`, `text-gray-900`
- **Colors:** `bg-blue-500`, `text-white`
- **Responsive:** `sm:`, `md:`, `lg:`, `xl:`
- **Interactive:** `hover:`, `focus:`, `active:`

### Component Styling Pattern
```tsx
// Consistent component styling
const ChatWidget = () => (
  <div className="flex flex-col h-screen bg-gray-50">
    <header className="p-4 bg-blue-600 text-white">
      <h1 className="text-xl font-bold">Chat</h1>
    </header>
    <main className="flex-1 overflow-y-auto p-4">
      {/* Messages */}
    </main>
    <footer className="p-4 border-t">
      {/* Input */}
    </footer>
  </div>
);
```

## Markdown Rendering

**Library:** `react-markdown` + `remark-gfm`

**Features:**
- GitHub Flavored Markdown support
- Code syntax highlighting (inferred)
- Link handling
- Safe HTML rendering

**Usage in Chat:**
- Agent responses rendered as markdown
- Supports lists, code blocks, tables
- Inline formatting (bold, italic, links)

## Widget Embedding

### Embedding Methods

**1. iframe Embed:**
```html
<iframe src="https://app.example.com/widget?tenant=abc123"
        width="400" height="600"></iframe>
```

**2. Script Embed (inferred):**
```html
<script src="https://app.example.com/widget.js"></script>
<script>
  ChatWidget.init({
    tenantId: 'abc123',
    position: 'bottom-right'
  });
</script>
```

### Widget Configuration
Loaded from: `GET /api/public/widgets/{tenant}/config`

**Configurable:**
- Primary color
- Welcome message
- Position (bottom-right, bottom-left)
- Avatar image
- Company logo

## Build & Deployment

### Development
```bash
npm run dev          # Start Vite dev server (port 5173)
```

### Production Build
```bash
npm run build        # Build to dist/
npm run preview      # Preview production build
```

### Output Structure
```
dist/
├── index.html                # Main app entry
├── widget.html               # Widget entry
├── assets/
│   ├── index-[hash].js       # Main app bundle
│   ├── widget-[hash].js      # Widget bundle
│   ├── index-[hash].css      # Main app styles
│   └── widget-[hash].css     # Widget styles
└── [other assets]
```

## Performance Optimization

**Vite Optimizations:**
- Tree shaking
- Code splitting
- Lazy loading
- Asset minification
- Gzip compression

**React Optimizations:**
- React.memo for expensive components
- useMemo for computed values
- useCallback for stable functions
- Virtual scrolling for long lists (if implemented)

## Accessibility

**Features (inferred):**
- Semantic HTML
- ARIA labels
- Keyboard navigation
- Focus management
- Screen reader support

## Security

**Client-Side Security:**
- JWT stored securely (httpOnly cookies or secure localStorage)
- XSS prevention (React auto-escaping)
- CSRF protection
- Input sanitization
- Secure API calls (HTTPS only)

## Testing Strategy

**Tools (likely):**
- Jest for unit tests
- React Testing Library for component tests
- Cypress/Playwright for E2E tests (future)

**Test Coverage:**
- Component rendering
- User interactions
- API integration
- Error handling

## Future Enhancements

**Planned Features:**
- WebSocket for real-time updates
- Push notifications
- File upload/download
- Voice input
- Multi-language support (i18n)
- Offline mode (PWA)
- Advanced theming
- Mobile responsiveness improvements
