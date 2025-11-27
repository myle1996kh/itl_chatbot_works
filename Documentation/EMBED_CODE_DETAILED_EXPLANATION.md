# Embed Code - Detailed Explanation

## Overview

The embed code is a self-contained JavaScript snippet that:
1. Creates an iframe element dynamically
2. Points it to your widget backend
3. Injects it into the parent website
4. Handles communication between parent website and widget

---

## The Embed Code Structure

```javascript
<!-- AgentHub Chatbot Widget -->
<script>
  (function() {
    // ... code here ...
  })();
</script>
```

### Why `(function() { ... })()`?

This is an **IIFE (Immediately Invoked Function Expression)**.

**Benefits:**
- ✅ Isolates variables (prevents conflicts with parent website's code)
- ✅ Executes immediately when page loads
- ✅ Doesn't pollute global namespace
- ✅ Can be placed anywhere in HTML

**Example of why it matters:**
```javascript
// BAD - without IIFE
var chatWidget = document.createElement('iframe'); // Pollutes global
var count = 0; // Could conflict with parent's code

// GOOD - with IIFE
(function() {
  var chatWidget = document.createElement('iframe'); // Only exists inside function
  var count = 0; // Hidden from parent website
})();
```

---

## Step-by-Step Breakdown

### Step 1: Create the iframe Element

```javascript
var chatWidget = document.createElement('iframe');
chatWidget.id = 'agenthub-chat-widget';
```

**What happens:**
- Creates an HTML iframe element in memory (not yet visible)
- Sets its ID to 'agenthub-chat-widget' (for debugging/reference)

**In HTML it's like doing:**
```html
<iframe id="agenthub-chat-widget"></iframe>
```

---

### Step 2: Set the Source URL

```javascript
chatWidget.src = 'http://localhost:8000/widget/wk_Uw3yyfE_AfvkfnYEdSpo_-kdJta9JFOs?tenant_id=3105b788-b5ff-4d56-88a9-532af4ab4ded';
```

**What happens:**
- Points the iframe to your widget backend
- Browser makes a GET request to this URL
- Backend returns `widget.html` (the React app)

**URL Components:**
```
http://localhost:8000/widget/{widget_key}?tenant_id={tenant_id}
│                    │                │      │
│                    │                │      └─ Tenant ID (identifies which company)
│                    │                └─ Public widget key (validates access)
│                    └─ Widget route (serves widget.html)
└─ Your backend API
```

**Backend Flow:**
```
GET /widget/wk_xxx?tenant_id=yyy
    ↓
backend/src/main.py:236-241
    ↓
Returns frontend/dist/widget.html
    ↓
Browser renders HTML in iframe
    ↓
React app loads (widget.tsx)
    ↓
Widget initializes
```

---

### Step 3: Style the iframe

```javascript
chatWidget.style.cssText = 'position: fixed; bottom: 20px; right: 20px; width: 400px; height: 600px; border: none; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); z-index: 9999;';
```

**CSS Breakdown:**
```css
position: fixed;           /* Stays in viewport (doesn't scroll) */
bottom: 20px;              /* 20px from bottom */
right: 20px;               /* 20px from right */
width: 400px;              /* 400px wide */
height: 600px;             /* 600px tall */
border: none;              /* No border */
border-radius: 12px;       /* Rounded corners */
box-shadow: 0 4px 20px rgba(0,0,0,0.15);  /* Soft shadow */
z-index: 9999;             /* On top of everything */
```

**Visual Result:**
```
┌─────────────────────────────────────────────────────────┐
│ Website Content                                         │
│                                                         │
│ Lorem ipsum dolor...                              ┌──────┐
│                                                   │ Chat │
│ More content...                                   │ Box  │
│                                                   │400x600│
│ Even more...                                      └──────┘
│                                                   20px↑
└─────────────────────────────────────────────────────────┘
                                            20px→
```

**Why `position: fixed`?**
- Stays visible even when scrolling
- Attached to viewport, not document
- Like a floating window

**Why `z-index: 9999`?**
- Places widget on top of everything
- Ensures it's not hidden behind other elements

---

### Step 4: Set Permissions

```javascript
chatWidget.setAttribute('allow', 'microphone; camera');
```

**What happens:**
- Grants iframe permission to use mic/camera
- Required for voice input features
- Without this, browser blocks access

**Permissions:**
```
microphone  → Allow voice messages
camera      → Allow video calls (future feature)
```

---

### Step 5: Inject into Page

```javascript
document.body.appendChild(chatWidget);
```

**What happens:**
1. Takes the iframe from memory
2. Adds it to the page's `<body>` element
3. Browser renders it

**Timeline:**
```
Before append:
<body>
  <h1>Website Content</h1>
  <!-- iframe exists but not in DOM -->
</body>

After append:
<body>
  <h1>Website Content</h1>
  <iframe id="agenthub-chat-widget" src="..."></iframe>
  <!-- Now visible on page -->
</body>
```

---

### Step 6: Setup Communication Bridge

```javascript
window.addEventListener('message', function(e) {
  if (e.data.type === 'agenthub:minimize') {
    chatWidget.style.height = '80px';
    chatWidget.style.width = '80px';
    chatWidget.style.borderRadius = '50%';
  } else if (e.data.type === 'agenthub:maximize') {
    chatWidget.style.height = '600px';
    chatWidget.style.width = '400px';
    chatWidget.style.borderRadius = '12px';
  }
});
```

**What happens:**
- Listens for messages from the widget iframe
- When widget sends `agenthub:minimize`, shrink it to a circle (80x80px)
- When widget sends `agenthub:maximize`, expand back to full size (400x600px)

**Why is this needed?**

Iframes are sandboxed for security. Direct DOM access isn't allowed:
```javascript
// ❌ Won't work - security restriction
iframe.window.myFunction();

// ✅ Works - message passing
iframe.contentWindow.postMessage({ type: 'action' }, '*');
```

**Communication Flow:**

```
┌─────────────────────────────────────────┐
│ Parent Website                          │
│                                         │
│ window.addEventListener('message', ...) │ ← Listens here
│                                         │
│ ┌───────────────────────────────────┐   │
│ │ Widget iframe                     │   │
│ │                                   │   │
│ │ window.parent.postMessage({...})  │ ← Sends message
│ │                                   │   │
│ └───────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

---

## Complete Flow: What Happens When User Opens Widget

### Timeline:

```
1. Website loaded
   ↓
2. Embed code script runs (IIFE executes)
   ↓
3. iframe created and added to DOM
   ↓
4. Browser loads widget.html from backend
   ↓
5. React app (widget.tsx) initializes in iframe
   ↓
6. Widget fetches config: GET /api/widget-config?tenant_id=X&widget_key=Y
   ↓
7. Widget creates chat user: POST /api/{tenant_id}/chat_users
   ↓
8. Widget creates session: POST /api/{tenant_id}/sessions
   ↓
9. Widget ready - shows loading spinner (if not auto_open)
   ↓
10. User clicks chat bubble in iframe
   ↓
11. Widget sends postMessage: { type: 'agenthub:maximize' }
   ↓
12. Parent website receives message
   ↓
13. Parent resizes iframe from 80x80 to 400x600
   ↓
14. Full chat interface visible to user
   ↓
15. User types message in iframe
   ↓
16. Message sent to backend API
   ↓
17. Response displayed in chat
```

---

## Important Concepts

### iframe Sandboxing

**What's sandboxed:**
```javascript
// ❌ Can't access parent's variables
console.log(window.parent.secretData); // ❌ Blocked by CORS/Security

// ❌ Can't modify parent's DOM
window.parent.document.body.innerHTML = ''; // ❌ Blocked

// ✅ Can send messages
window.parent.postMessage({ type: 'action' }, '*'); // ✅ Allowed
```

**Why it matters:**
- Protects parent website from malicious iframe
- Protects widget from parent website's code
- They communicate only through `postMessage`

### URL Parameters

**Widget Key:**
```
wk_Uw3yyfE_AfvkfnYEdSpo_-kdJta9JFOs
└─ Public identifier
   - Generated when widget created
   - Used to verify access in /api/widget-config
   - Can be regenerated for security rotation
```

**Tenant ID:**
```
3105b788-b5ff-4d56-88a9-532af4ab4ded
└─ Company identifier
   - Identifies which company's data to load
   - Ensures multi-tenancy isolation
   - Public (no sensitive data)
```

---

## Security Considerations

### ✅ Safe:
- Widget key is public (verified on backend)
- Tenant ID is public (no data leak)
- CORS prevents unauthorized requests
- iframe sandbox prevents direct DOM access
- Backend validates widget_key + tenant_id match

### ⚠️ Important:
```javascript
// This is in the embed code (public script)
chatWidget.src = 'http://localhost:8000/widget/wk_xxx?tenant_id=yyy';
// Don't put secrets here! (API keys, passwords, etc)

// API keys should be stored on backend, not in embed code
```

### 🔒 Backend Security:
```python
# In backend/src/api/public_widgets.py
def get_public_widget_config(tenant_id, widget_key):
    widget = db.query(WidgetConfig).filter(...).first()

    # ✅ Validate widget_key matches tenant_id
    if widget.widget_key != widget_key:
        raise HTTPException(403, "Invalid widget key")

    # ✅ Only return public config, not secrets
    return WidgetConfigResponse(...)
```

---

## Common Customizations

### Change Position

Parent website can modify the embed code:

```javascript
// Default
chatWidget.style.cssText = '... bottom: 20px; right: 20px; ...';

// Custom - bottom-left
chatWidget.style.cssText = '... bottom: 20px; left: 20px; ...';

// Custom - top-right
chatWidget.style.cssText = '... top: 20px; right: 20px; ...';

// Custom - larger
chatWidget.style.cssText = '... width: 500px; height: 700px; ...';
```

### Disable Auto-Open

```javascript
// In backend, create widget with auto_open=false
// Then parent can control when to open:
document.getElementById('agenthub-chat-widget').style.display = 'none';

// Later...
document.getElementById('agenthub-chat-widget').style.display = 'block';
```

### Theme Customization

```javascript
// Backend returns primary_color from widget config
// widget.tsx reads it and applies to chat interface

// Parent website can customize further via CSS:
<style>
  #agenthub-chat-widget {
    --primary-color: #FF5733; /* Custom theme */
  }
</style>
```

---

## Troubleshooting

### Widget doesn't appear
```javascript
// Check console for errors
console.log('Embed code loaded');

// Verify iframe is created
document.getElementById('agenthub-chat-widget') // Should exist

// Check if URL is correct
// Should be: http://your-domain/widget/wk_xxx?tenant_id=yyy
```

### Widget shows loading spinner forever
```javascript
// Check console for API errors
// 📡 Widget config response status: 404
// 👤 Failed to create user: 500
// 🔄 Session creation failed: 403

// Common causes:
// - Backend not running
// - Invalid tenant_id or widget_key
// - CORS blocked
// - API endpoint changed
```

### postMessage not working
```javascript
// Check if parent website listening
window.addEventListener('message', function(e) {
  console.log('Message received:', e.data);
});

// Verify widget sending messages
// In widget.tsx: window.parent.postMessage(...)
```

---

## Summary

| Component | Purpose |
|-----------|---------|
| **IIFE** | Isolates code, executes immediately |
| **iframe** | Sandboxed container for widget |
| **src URL** | Points to backend widget endpoint |
| **CSS** | Positions and styles the widget |
| **allow** | Grants permissions (mic, camera) |
| **postMessage** | Enables parent-iframe communication |
| **Widget Key** | Public identifier for access control |
| **Tenant ID** | Identifies which company's data |

The embed code is essentially a **minimal launcher** that:
1. Creates a container (iframe)
2. Points it to your widget
3. Styles it
4. Handles resizing

Everything else (config loading, chat logic, state management) happens inside the iframe/React app.

