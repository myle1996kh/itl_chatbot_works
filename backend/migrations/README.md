# Database Migration & Seeding System

**Project:** ITL_PGVector - Multi-Tenant Chatbot Framework
**Created:** 2025-11-11
**Status:** 🟡 PLANNING PHASE COMPLETE - Ready for Phase 1 execution
**Owner:** Backend Team

---

## 📋 Quick Summary

This folder contains **reusable database initialization scripts** that:

1. ✅ Create all database tables (via Alembic)
2. ✅ Seed configuration data (base_tools, LLM models, output formats)
3. ✅ Create 3 tenants (eTMS, eFMS, Vela)
4. ✅ Create 4 agents with real names
5. ✅ Configure tools with REAL API endpoints
6. ✅ Seed users (admins + supporters)
7. ✅ Set permissions (tenant isolation)
8. ✅ Encrypt API keys automatically
9. ✅ Generate tracking files for dev teams

**Can be run anytime on fresh database to recreate entire setup.**

---

## 🚀 How to Use

### Quick Start (After Phase 3 Complete)

```bash
# 1. Ensure database is fresh
# (or restore from backup)

# 2. Run all migration scripts
cd backend
python migrations/run_all.py

# 3. Verify database state
python -c "
from src.config import get_db
from src.models import *
db = next(get_db())
print('Tenants:', db.query(Tenant).count())
print('Agents:', db.query(AgentConfig).count())
print('Tools:', db.query(ToolConfig).count())
print('Users:', db.query(User).count())
"

# 4. Start backend server
uvicorn src.main:app --reload
```

---

## 📁 Folder Structure

```
migrations/
├── README.md                    (This file)
├── MIGRATION_PLAN.md           (Full plan with 7 phases)
├── MIGRATION_STATUS.yaml       (Progress tracker - UPDATE AS YOU GO)
├── requirements.txt
├── __init__.py
│
├── run_all.py                  (Master orchestrator - run this!)
│
├── Scripts (Run in order):
├── 0_create_tables.py          (Step 1: Run alembic migrations)
├── 1_seed_base_data.py         (Step 2: base_tools, output_formats)
├── 2_seed_llm_models.py        (Step 3: 3 LLM models)
├── 3_seed_tenants.py           (Step 4: 3 tenants)
├── 4_seed_agents.py            (Step 5: 4 agents)
├── 5_seed_tool_configs.py      (Step 6: Tools with REAL endpoints)
├── 6_seed_agent_tools.py       (Step 7: Agent→tool mappings)
├── 7_seed_llm_configs.py       (Step 8: Tenant→LLM + API keys)
├── 8_seed_users.py             (Step 9: Users with bcrypt)
├── 9_seed_permissions.py       (Step 10: Tenant permissions)
│
├── data/                       (JSON data files)
│   ├── base_tools.json
│   ├── agents.json
│   ├── tenants.json
│   ├── llm_models.json
│   ├── users.json
│   ├── tool_configs.json       (REAL API endpoints!)
│   └── tenant_agent_mapping.json
│
└── tracking/                   (Requirements for dev agents)
    ├── REQUIREMENT_CHAT_ROUTING.md     (Dev Agent 1 task)
    ├── REQUIREMENT_CHAT_SESSIONS.md    (Dev Agent 2 task)
    ├── REQUIREMENT_KNOWLEDGE_BASE.md   (Dev Agent 3 task)
    ├── REQUIREMENT_ESCALATION.md       (Dev Agent 4 task)
    └── REQUIREMENT_*.md files
```

---

## 📊 7-Phase Implementation Plan

| Phase | Name | Duration | Status | Owner |
|-------|------|----------|--------|-------|
| 1 | Infrastructure Setup | 15 min | ⏳ Pending | Backend Dev |
| 2 | Data Files Creation | 30 min | ⏳ Pending | Backend Dev |
| 3 | Seed Scripts | 2 hours | ⏳ Pending | Backend Dev |
| 4 | Tracking Files | 1 hour | ⏳ Pending | Backend Dev |
| 5 | Run Scripts | 5 min | ⏳ Pending | Backend Dev |
| 6 | Database Verification | 10 min | ⏳ Pending | QA |
| 7 | Dev Agent Handoff | 30 min | ⏳ Pending | Manager |
| **TOTAL** | | **~4.5 hours** | | |

**See MIGRATION_PLAN.md for detailed breakdown of each phase.**

---

## 🎯 What This Fixes

| Issue | Status | Fixed By |
|-------|--------|----------|
| ❌ POST /chat 500 error | Phase 5 | Agents seeded with correct names |
| ❌ Chat Sessions empty | Phase 7 | Dev Agent implements GET endpoint |
| ❌ Knowledge Base empty | Phase 7 | Dev Agent implements GET endpoint |
| ❌ Escalation broken | Phase 7 | Dev Agent implements assignment |
| ❌ Wrong tenant data | Phase 5 | All queries filter by tenant_id |

---

## 🔑 Key Data

### Tenants (3)
| Name | Domain | LLM | Region |
|------|--------|-----|--------|
| eTMS | e-transportation-management | gemini-2.5-flash (Google) | Primary |
| eFMS | e-fleet-management | gemini-2.0-flash-exp (OpenRouter) | Secondary |
| Vela | vela-support | gpt-4o-mini (OpenRouter) | Tertiary |

### Agents (4)
| Name | Purpose | eTMS | eFMS | Vela |
|------|---------|------|------|------|
| GuidelineAgent | RAG/Knowledge | ✅ | ✅ | ✅ |
| DebtAgent | Debt queries | ❌ | ✅ | ❌ |
| ShipmentAgent | Tracking | ❌ | ✅ | ❌ |
| SupervisorAgent | Routing | ✅ | ✅ | ✅ |

### Users (9)
- 3 Admins: admin@{tenant}.local
- 6 Supporters: support_*@{tenant}.local
- All passwords: `123456` (hashed with bcrypt)

### Tools (5 + RAG)
1. `get_customer_debt_by_mst` (Real endpoint)
2. `get_salesman_debt` (Real endpoint)
3. `track_shipment` (Placeholder)
4. `update_shipment_status` (Placeholder)
5. `search_knowledge_base` (RAG tool)

---

## 🔐 API Keys

**Google API Key (eTMS):**
```
AIzaSyDhsD6edS4hdMq641a1Wx9aGYUHMYZfDuc
```

**OpenRouter API Key (eFMS, Vela):**
```
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
```

**Encrypted in database** via Fernet encryption (see `7_seed_llm_configs.py`)

---

## 🚨 Critical Points

### 1. Agent Names Are The Bridge
```python
# Frontend sends agent_name
POST /api/{tenant_id}/chat {
  "message": "...",
  "agent_name": "DebtAgent"  ← THIS IS THE KEY!
}

# Backend looks up by name
agent = db.query(AgentConfig).filter_by(name="DebtAgent").first()
# Gets agent_id → routes → ✅ works!
```

### 2. Tenant Isolation On All Queries
```python
# Every query must include tenant_id filter
agents = db.query(AgentConfig)\
  .join(TenantAgentPermission)\
  .filter(TenantAgentPermission.tenant_id == tenant_id)\
  .all()
```

### 3. Idempotent Scripts
All scripts are **safe to run multiple times** - they:
- Check if data already exists
- Skip if found, create if missing
- Never error on re-runs

### 4. API Key Encryption
```python
# Keys encrypted before insert
from cryptography.fernet import Fernet

encrypted = Fernet(FERNET_KEY).encrypt(api_key.encode())
# Stored as encrypted_api_key in TenantLLMConfig
```

---

## 📈 Progress Tracking

### How to Track Progress

1. **Read:** `MIGRATION_PLAN.md` (full plan with all phases)
2. **Update:** `MIGRATION_STATUS.yaml` (checklist as you go)
3. **Track:** `tracking/REQUIREMENT_*.md` (dev agent tasks)

### Update Status File
```yaml
# After Phase 1 completes
phases:
  phase_1:
    status: "completed"  # was: "pending"
    end_date: "2025-11-11 14:30"

# Update summary
summary:
  completed_phases: 1
  pending_phases: 6
  completion_percent: 14
```

---

## 🔧 Troubleshooting

### Script Fails to Run

**Problem:** `python migrations/run_all.py` errors

**Solutions:**
1. Check `DATABASE_URL` is set: `echo $DATABASE_URL`
2. Ensure database exists: `psql -l | grep agenthub`
3. Check Alembic status: `alembic current`
4. Run scripts individually: `python migrations/0_create_tables.py`

### Agent Not Found Error

**Problem:** `POST /chat` returns 400 "Agent not found"

**Solution:** Verify agents seeded:
```python
from src.config import get_db
from src.models import AgentConfig
db = next(get_db())
for agent in db.query(AgentConfig).all():
    print(agent.name)
```

Should show:
- GuidelineAgent
- DebtAgent
- ShipmentAgent
- SupervisorAgent

### API Key Decryption Failing

**Problem:** `LLM requests fail with "Invalid API key"`

**Solution:** Verify Fernet key:
```python
# Check FERNET_KEY in .env
echo $FERNET_KEY
# Should be valid base64 string starting with "gAAAAAA..."
```

---

## 📚 References

- **MIGRATION_PLAN.md** - Full 7-phase plan
- **MIGRATION_STATUS.yaml** - Progress checklist
- **REQUIREMENT_CHAT_ROUTING.md** - Example dev task
- **data/*.json** - All seed data
- **src/config.py** - Database configuration

---

## 🚀 Next Steps

### Phase 1: START NOW ⏭️

```bash
# 1. Create folder structure
mkdir -p backend/migrations/data
mkdir -p backend/migrations/tracking

# 2. Move this README
cp backend/migrations/README.md

# 3. Create empty script files
touch backend/migrations/{0..9}_*.py
touch backend/migrations/run_all.py

# 4. Go to Phase 2
# (Create data JSON files)
```

---

## 📋 Checklist Before Running

- [ ] DATABASE_URL set in .env
- [ ] PostgreSQL running: `docker-compose up -d postgres`
- [ ] pgvector extension installed: `CREATE EXTENSION vector;`
- [ ] Alembic migrations up to date: `alembic current`
- [ ] FERNET_KEY set in .env
- [ ] API keys available (Google, OpenRouter)
- [ ] All 7 phases completed
- [ ] MIGRATION_STATUS.yaml says "ready"

---

## ✅ Done Checklist (When Complete)

- [ ] Phase 1: Folder structure created
- [ ] Phase 2: Data files created
- [ ] Phase 3: All 9 scripts written
- [ ] Phase 4: Requirement files created
- [ ] Phase 5: `python migrations/run_all.py` succeeds
- [ ] Phase 6: Database verified (3 tenants, 4 agents, 9 users)
- [ ] Phase 7: Dev agents assigned to tasks
- [ ] 🎉 Frontend integration testing can begin!

---

## 📞 Questions?

**If something is unclear:**
1. Check MIGRATION_PLAN.md for details
2. Look at example REQUIREMENT_CHAT_ROUTING.md
3. Review specific script (0_create_tables.py, etc.)
4. Ask team lead for clarification

---

**Status:** 🟡 Phase 0 Complete (Planning) - Ready for Phase 1
**Last Updated:** 2025-11-11
**Next Milestone:** Phase 1 folder structure creation
