1. Chat User (Widget) Role
   - Components: ChatWidget.tsx, EmbeddedWidget.tsx, UserInfoForm.tsx
   - Functionality:
     - Standalone chat widget for end-users
     - Collects user information before starting sessions
     - Real-time communication with SSE
     - Session history and escalation features
     - File attachment capabilities
   - Entry Point: widget.tsx - designed as an embeddable widget with
     iframe support

  2. Supporter Role 
   - Pages: /support, /support/chat/:sessionId, /support/history,
     /support/profile, /support/stats
   - Components: SupportLayout.tsx
   - Functionality:
     - Dashboard to manage assigned sessions
     - Real-time chat interface with users
     - Session resolution and categorization
     - Escalation management
     - User information panel

  3. Admin Role
   - Pages: All under /admin route (Dashboard, Tenants, Users, Agents,
     Tools, Knowledge Base, Escalations, etc.)
   - Components: AdminLayout.tsx
   - Functionality:
     - Multi-tenant management
     - User role management (Admin/Supporter/Tenant Users)
     - Agent configuration
     - Tool templates management
     - Knowledge base management
     - System overview with stats and health monitoring

  4. UI/UX Patterns Analysis
   - Layout System: Role-specific layouts with sidebar navigation
   - Styling: Tailwind CSS with custom animations
   - Authentication: JWT-based with role-based routing
   - Real-time Features: Server-Sent Events (SSE) for live updates
   - Responsive Design: Tailwind CSS utility classes

  5. Routing & Navigation Structure
   - React Router v6: Role-based protected routes
   - Authentication Flow: LoginPage → Dashboard redirect based on role
   - Navigation Consistency: Each role has dedicated layout with specific
     navigation

  6. Theming Approach
   - Tailwind CSS: Primary colors configurable per tenant
   - CSS-in-JS: For dynamic styling (like the markdown updates I made)
   - Theme Interface: Configurable header text, welcome messages, and
     primary colors

  7. Shared Components
   - Common Elements: Icons, message input/list components
   - Service Layer: Well-structured API service files
   - Types: Comprehensive TypeScript interfaces
   - Layouts: Role-specific wrapper components

  8. Potential Improvements Identified
   - Performance: Consider virtualization for long message lists
   - Accessibility: More ARIA labels and keyboard navigation
   - Error Handling: More consistent error boundaries
   - State Management: Could benefit from a state management library
     (Redux/Zustand)
   - Component Reusability: Some logic could be more modular
   - Testing: No visible test files to ensure quality
   - Caching: Implement caching strategies for better performance
   