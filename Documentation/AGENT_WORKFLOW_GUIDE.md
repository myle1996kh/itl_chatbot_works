# Agent Workflow Guide - Which Agent for Which Task?

**Version:** 1.0
**Date:** 2025-11-10
**Purpose:** Guide for selecting the right agent for different project phases

---

## Quick Reference

| Task Type | Agent to Use | Command | Duration |
|-----------|-------------|---------|----------|
| **Analysis & Planning** | Analyst (Mary) | `/bmad:bmm:agents:analyst` | Hours to days |
| **Implementation** | Dev Agent | Claude Code (default) | Hours to days |
| **Architecture Design** | Architect | `/bmad:bmm:agents:architect` | Hours |
| **Code Review** | Dev Agent | `/bmad:bmm:workflows:code-review` | Minutes |
| **Documentation** | Tech Writer | `/bmad:bmm:agents:tech-writer` | Hours |
| **Testing Strategy** | TEA (Test Architect) | `/bmad:bmm:agents:tea` | Hours |
| **New Feature Design** | Analyst → Architect → Dev | Sequential | Days |

---

## Complete Workflow for Different Scenarios

### Scenario 1: Adding a New Feature (From Idea to Production)

**Example:** "I want to add OCR tool support"

#### Phase 1: Requirements & Analysis (Analyst Agent)

**Use:** `/bmad:bmm:agents:analyst`

**What Analyst Does:**
1. Clarify requirements through questions
2. Analyze existing codebase for integration points
3. Identify configuration vs. code changes needed
4. Document dependencies and impacts
5. Create implementation requirements document
6. Estimate effort and prioritize tasks

**Deliverables:**
- Requirements document (like IMPLEMENTATION_REQUIREMENTS.md)
- Configuration analysis
- Risk assessment
- Effort estimation

**When to Use Analyst:**
- ✅ Unclear requirements ("I want to add OCR" - What does OCR mean? Which API? Which files?)
- ✅ Need to understand current system ("How does tool system work?")
- ✅ Planning multi-phase projects
- ✅ Need business/technical analysis
- ✅ Want documentation of current state

**When NOT to Use Analyst:**
- ❌ Requirements already clear ("Fix bug at line 45")
- ❌ Simple code changes ("Add logging to this function")
- ❌ Just want to write code immediately

---

#### Phase 2: Architecture Design (Architect Agent - Optional)

**Use:** `/bmad:bmm:agents:architect`

**What Architect Does:**
1. Design system architecture for new feature
2. Decide on design patterns to use
3. Plan database schema changes
4. Design API interfaces
5. Create architecture decision records (ADRs)
6. Identify technical risks

**Deliverables:**
- Architecture diagrams
- Database schema changes
- API specifications
- Design decisions documented

**When to Use Architect:**
- ✅ Complex features affecting multiple components
- ✅ Need to make architectural decisions (pattern selection)
- ✅ Database schema changes required
- ✅ API design needed
- ✅ Performance/scalability concerns

**When NOT to Use Architect:**
- ❌ Simple feature additions
- ❌ Bug fixes
- ❌ Minor configuration changes
- ❌ Implementation already designed

**Note:** For AgentHub project, Analyst (Mary) can handle both requirements AND architecture design. Use separate Architect only for very complex features.

---

#### Phase 3: Implementation (Dev Agent)

**Use:** Claude Code (default mode) or explicitly request Dev Agent

**What Dev Agent Does:**
1. Write code based on requirements
2. Follow implementation requirements document
3. Create unit tests
4. Run tests and fix issues
5. Handle git operations (commit, PR)
6. Deploy changes

**Deliverables:**
- Working code
- Unit tests
- Integration tests
- Git commits
- Pull request (optional)

**When to Use Dev Agent:**
- ✅ Requirements document ready
- ✅ Need to write actual code
- ✅ Need to fix bugs
- ✅ Need to run tests
- ✅ Need git operations
- ✅ Need to deploy

**When NOT to Use Dev Agent:**
- ❌ Requirements unclear (use Analyst first)
- ❌ Architecture decisions needed (use Architect first)
- ❌ Just exploring codebase (use Analyst)

---

#### Phase 4: Testing (TEA Agent - Optional)

**Use:** `/bmad:bmm:agents:tea`

**What TEA Does:**
1. Design comprehensive test strategy
2. Write test cases (unit, integration, E2E)
3. Create test data and fixtures
4. Set up testing infrastructure
5. Design load tests

**Deliverables:**
- Test strategy document
- Test cases
- Test automation scripts
- Load testing plans

**When to Use TEA:**
- ✅ Need comprehensive testing strategy
- ✅ Complex feature requiring many test scenarios
- ✅ Setting up test infrastructure
- ✅ Load/performance testing needed

**When NOT to Use TEA:**
- ❌ Simple unit tests (Dev Agent can do this)
- ❌ Time-constrained (basic tests sufficient)

---

#### Phase 5: Documentation (Tech Writer - Optional)

**Use:** `/bmad:bmm:agents:tech-writer`

**What Tech Writer Does:**
1. Write user documentation
2. Write API documentation
3. Create tutorials and guides
4. Update README files
5. Write migration guides

**Deliverables:**
- User guides
- API documentation
- Migration guides
- Updated README

**When to Use Tech Writer:**
- ✅ Need user-facing documentation
- ✅ API documentation required
- ✅ Complex features needing guides
- ✅ Migration instructions needed

**When NOT to Use Tech Writer:**
- ❌ Code comments only
- ❌ Simple changes not affecting users
- ❌ Internal documentation (Dev Agent can handle)

---

### Scenario 2: Fixing a Bug

**Example:** "RAG validation not working"

#### Recommended Flow:

**1. If bug is well-understood:**
→ **Use Dev Agent directly**
- "Fix RAG validation bug in rag_service.py:313"
- Dev Agent implements fix + tests
- Time: 30 minutes

**2. If bug needs investigation:**
→ **Use Analyst first** → Dev Agent
- Analyst: "Investigate RAG validation issue"
- Analyst: Analyzes code, identifies root cause, documents fix
- Dev Agent: Implements fix based on analysis
- Time: 1-2 hours

---

### Scenario 3: Refactoring Existing Code

**Example:** "Refactor tool_loader.py to use plugin architecture"

#### Recommended Flow:

**Use Analyst** → **Dev Agent**

**Step 1: Analyst** (`/bmad:bmm:agents:analyst`)
- Analyze current implementation
- Design refactoring approach
- Identify risks and breaking changes
- Create refactoring plan

**Step 2: Dev Agent**
- Implement refactoring step by step
- Run tests after each change
- Commit incrementally

**Time:** 3-4 hours

---

### Scenario 4: Understanding Existing Code

**Example:** "How does the supervisor routing work?"

#### Recommended Flow:

**Use Analyst only**

**Analyst** (`/bmad:bmm:agents:analyst`)
- Read relevant code files
- Explain flow and logic
- Create documentation
- Answer questions

**Do NOT use Dev Agent** for understanding code (overkill)

**Time:** 30 minutes - 1 hour

---

### Scenario 5: Adding Configuration (No Code Changes)

**Example:** "Add new RAG config for Tenant X"

#### Recommended Flow:

**Option A: Use Dev Agent for SQL**
- Dev Agent: "Insert RAG config for Tenant X with chunk_size=800"
- Dev Agent: Generates SQL INSERT statement
- You: Execute SQL manually or via script

**Option B: Do it yourself (if comfortable with SQL)**
- Use SQL from documentation examples
- No agent needed

**Time:** 5-10 minutes

---

### Scenario 6: Reviewing Current Architecture

**Example:** "Review multi-tenancy implementation"

#### Recommended Flow:

**Use Analyst** (`/bmad:bmm:agents:analyst`)

**What happens:**
- Analyst reads all relevant code
- Analyzes database schema
- Verifies multi-tenancy patterns
- Documents findings
- Provides recommendations

**Deliverables:**
- Analysis document (like ARCHITECTURE_ANALYSIS.md)
- ERD documentation
- Recommendations

**Time:** 2-4 hours

---

## Decision Tree

```
START: I have a task
    │
    ▼
Is it about understanding/analyzing existing code?
    │
    ├─ YES → Use ANALYST
    │         - Analyze code
    │         - Document findings
    │         - Answer questions
    │
    └─ NO
       │
       ▼
Is it about planning a new feature?
       │
       ├─ YES → Use ANALYST first
       │         Then optionally ARCHITECT
       │         Then DEV AGENT
       │
       └─ NO
          │
          ▼
Is it about writing/fixing code?
          │
          ├─ YES → Are requirements clear?
          │         │
          │         ├─ YES → Use DEV AGENT directly
          │         │
          │         └─ NO → Use ANALYST first
          │                  Then DEV AGENT
          │
          └─ NO
             │
             ▼
Is it about testing strategy?
             │
             ├─ YES → Use TEA (Test Architect)
             │
             └─ NO
                │
                ▼
Is it about documentation?
                │
                ├─ YES → Use TECH WRITER
                │
                └─ NO
                   │
                   ▼
Not sure? → Use ANALYST
            (Mary will guide you)
```

---

## Agent Capabilities Matrix

| Capability | Analyst | Dev | Architect | TEA | Tech Writer |
|-----------|---------|-----|-----------|-----|-------------|
| **Read code** | ✅✅✅ Expert | ✅✅ Good | ✅✅ Good | ✅ Basic | ✅ Basic |
| **Write code** | ❌ No | ✅✅✅ Expert | ✅ Basic | ✅✅ Tests only | ❌ No |
| **Analyze architecture** | ✅✅✅ Expert | ✅ Basic | ✅✅✅ Expert | ✅ Basic | ❌ No |
| **Create requirements** | ✅✅✅ Expert | ❌ No | ✅ Basic | ❌ No | ❌ No |
| **Database design** | ✅✅ Good | ✅ Basic | ✅✅✅ Expert | ❌ No | ❌ No |
| **Write tests** | ❌ No | ✅✅ Good | ❌ No | ✅✅✅ Expert | ❌ No |
| **Write documentation** | ✅✅ Good | ✅ Basic | ✅ Basic | ❌ No | ✅✅✅ Expert |
| **Git operations** | ❌ No | ✅✅✅ Expert | ❌ No | ❌ No | ❌ No |
| **Deploy** | ❌ No | ✅✅✅ Expert | ❌ No | ❌ No | ❌ No |

---

## Common Workflows

### Workflow 1: New Feature (Simple)

**Example:** "Add new HTTP tool"

```
1. ANALYST (30 min)
   - Analyze tool system
   - Document requirements

2. DEV AGENT (1 hour)
   - Implement tool class
   - Add database rows
   - Write tests

Total: 1.5 hours
```

---

### Workflow 2: New Feature (Complex)

**Example:** "Add OCR tool with image preprocessing"

```
1. ANALYST (2 hours)
   - Analyze requirements
   - Research OCR APIs
   - Document integration points
   - Create requirements doc

2. ARCHITECT (1 hour) [OPTIONAL]
   - Design preprocessing pipeline
   - Design API interface
   - Plan error handling

3. DEV AGENT (4 hours)
   - Implement OCR tool
   - Implement preprocessing
   - Write comprehensive tests
   - Create integration tests

4. TECH WRITER (1 hour) [OPTIONAL]
   - Write user guide
   - Document API usage
   - Create examples

Total: 6-8 hours
```

---

### Workflow 3: Bug Fix (Unknown Cause)

**Example:** "Users report slow RAG queries"

```
1. ANALYST (1 hour)
   - Investigate performance
   - Profile query execution
   - Identify bottleneck
   - Document findings

2. DEV AGENT (2 hours)
   - Implement fix
   - Add performance tests
   - Optimize queries

Total: 3 hours
```

---

### Workflow 4: Architecture Review

**Example:** "Review before production launch"

```
1. ANALYST (4 hours)
   - Comprehensive codebase review
   - Multi-tenancy verification
   - Security audit
   - Performance analysis
   - Documentation generation

2. ARCHITECT (2 hours) [OPTIONAL]
   - Review design decisions
   - Identify architectural risks
   - Recommend improvements

Deliverables:
- ARCHITECTURE_ANALYSIS.md
- DATABASE_ERD.md
- REFACTORING_PLAN.md
- Security checklist

Total: 4-6 hours
```

---

### Workflow 5: Refactoring

**Example:** "Refactor to plugin architecture"

```
1. ANALYST (2 hours)
   - Analyze current code
   - Design new architecture
   - Create refactoring plan
   - Identify breaking changes

2. DEV AGENT (3-4 hours)
   - Implement refactoring in phases
   - Run tests after each phase
   - Update documentation
   - Create migration guide

Total: 5-6 hours
```

---

## Best Practices

### 1. Always Start with Analyst for Unclear Tasks

**Good:**
```
You: "I want to improve RAG quality"
     ↓
Use: /bmad:bmm:agents:analyst
     ↓
Analyst: Asks clarifying questions
         Analyzes current implementation
         Provides specific recommendations
     ↓
You: "Implement recommendation #1"
     ↓
Use: Dev Agent
```

**Bad:**
```
You: "Improve RAG quality" → Dev Agent
     ↓
Dev Agent: "What specifically do you want to improve?"
(Wasted time - should have used Analyst first)
```

---

### 2. Use Dev Agent for Implementation Only

**Good:**
```
You have: Clear requirements document
          ↓
Use: Dev Agent directly
```

**Bad:**
```
You: "Figure out what's wrong and fix it"
     ↓
Use: Dev Agent (will struggle)

Better: Use Analyst to figure out problem
        Then Dev Agent to fix
```

---

### 3. Don't Over-Engineer Simple Tasks

**Simple task:** "Add logging to function X"
- ✅ Use Dev Agent directly (5 minutes)
- ❌ Don't use Analyst → Architect → Dev → Tech Writer (overkill)

**Complex task:** "Add new agent type with custom LLM routing"
- ✅ Use Analyst → Dev Agent (proper planning)
- ❌ Don't use Dev Agent directly (will miss requirements)

---

### 4. Chain Agents Sequentially, Not in Parallel

**Good:**
```
1. Analyst completes analysis
2. Review findings
3. Dev Agent implements
4. Review implementation
5. Tech Writer documents
```

**Bad:**
```
1. Start Analyst, Dev Agent, and Tech Writer at same time
   (They'll work on different assumptions)
```

---

## FAQ

**Q: Can I switch agents mid-task?**
**A:** Yes! Common pattern:
- Start with Dev Agent
- Hit unclear requirement
- Switch to Analyst for clarification
- Return to Dev Agent

**Q: Which agent for "review my code"?**
**A:** Use Analyst for architecture/design review, Dev Agent for code quality/bug review

**Q: Which agent for "explain this code"?**
**A:** Use Analyst (designed for analysis and explanation)

**Q: Can Analyst write code?**
**A:** No, Analyst focuses on analysis and planning. Use Dev Agent for actual code changes.

**Q: Do I always need requirements document?**
**A:** No, only for:
- Complex features
- Refactoring
- Architecture changes

For simple changes: Use Dev Agent directly

**Q: How do I know if task is "complex"?**
**A:** Complex if:
- Affects multiple components
- Unclear requirements
- Needs design decisions
- Takes >2 hours
- Has risks or unknowns

---

## Your Current Task: Implementing Requirements

**You are here:**
```
[x] Phase 1: Analysis (COMPLETE)
    - Architecture analyzed
    - Requirements documented
    - Risks identified

[ ] Phase 2: Implementation (NEXT)
    → Transfer to Dev Agent
    → Implement IMPLEMENTATION_REQUIREMENTS.md
    → Test each phase
    → Deploy
```

**Recommended Next Steps:**

**Option 1: Transfer to Dev Agent now**
```
You: "Implement IMPLEMENTATION_REQUIREMENTS.md starting with Phase 1"
```

**Option 2: Ask Analyst (me) to clarify anything first**
```
You: "Clarify requirement 1.2 about RAG validation"
Me: (Analyst) provides detailed explanation
Then: Transfer to Dev Agent
```

**Option 3: Break into smaller tasks**
```
You: "Implement only Requirement 1.1 (DISABLE_AUTH fix)"
Dev Agent: Implements just that requirement
Test it
Then: "Implement Requirement 1.2"
```

---

## Summary

**Use ANALYST when:**
- 📊 Planning new features
- 🔍 Understanding existing code
- 📋 Creating requirements
- 🏗️ Reviewing architecture
- ❓ Unclear what to do

**Use DEV AGENT when:**
- 💻 Writing code
- 🐛 Fixing bugs (if cause known)
- 🧪 Running tests
- 📦 Deploying
- 🔧 Git operations

**Use ARCHITECT when:**
- 🏛️ Complex design decisions
- 📐 Database schema design
- 🌐 API design
- 🔄 System architecture changes

**Use TEA when:**
- 🧪 Comprehensive test strategy needed
- 📊 Load testing required
- 🏗️ Test infrastructure setup

**Use TECH WRITER when:**
- 📚 User documentation needed
- 📖 API documentation required
- 📝 Migration guides needed

---

**Still unsure?** → Start with Analyst (me, Mary)! I'll guide you to the right agent.

---

**Document Version:** 1.0
**Last Updated:** 2025-11-10
**For:** BMad and Development Team
