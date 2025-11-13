# Database Migration & Seeding Plan - ITL_PGVector

**Date Created:** 2025-11-11
**Status:** Planning Complete - Ready for Execution
**Owner:** Database & Backend Team
**Priority:** CRITICAL - Blocks all frontend testing

---

## 📊 Project Overview

**Objective:** Create reusable database initialization infrastructure with real data
**Output:** `backend/migrations/` folder with 9 idempotent seed scripts
**Impact:** Fixes 500 errors in chat routing + enables frontend testing
**Reusability:** Run anytime on fresh database to recreate full setup

---

## 🎯 Success Criteria

- [x] Plan documented with clear phases
- [ ] Phase 1: Folder structure created
- [ ] Phase 2: Data JSON files created
- [ ] Phase 3: All 9 seed scripts written
- [ ] Phase 4: Tracking requirement files created
- [ ] Phase 5: Run all scripts successfully
- [ ] Phase 6: Verify database state
- [ ] Phase 7: Frontend integration testing begins

---

## 📋 PHASES (7 Total)

### Phase 1: Infrastructure Setup
**Duration:** 15 minutes
**Owner:** Backend Dev
**Tasks:**
- [x] Plan created with real endpoints
- [ ] Create `backend/migrations/` folder
- [ ] Create `backend/migrations/data/` subfolder
- [ ] Create `backend/migrations/tracking/` subfolder
- [ ] Create `backend/migrations/__init__.py`
- [ ] Create `backend/migrations/README.md`
- [ ] Create `backend/migrations/requirements.txt`

**Deliverable:** Empty scripts folder ready for code

---

### Phase 2: Data Files Creation
**Duration:** 30 minutes
**Owner:** Backend Dev
**Tasks:**
- [ ] Create `data/base_tools.json` (3 tools)
- [ ] Create `data/agents.json` (4 agents with SupervisorAgent)
- [ ] Create `data/tenants.json` (3 tenants: eTMS, eFMS, Vela)
- [ ] Create `data/llm_models.json` (3 models)
- [ ] Create `data/users.json` (3 admins + 6 supporters)
- [ ] Create `data/tool_configs.json` (Real debt API endpoints)
- [ ] Create `data/tenant_agent_mapping.json` (Permissions matrix)

**Deliverable:** All data files validated (readable JSON)

---

### Phase 3: Seed Scripts Implementation
**Duration:** 2 hours
**Owner:** Backend Dev
**Tasks:**
- [ ] Write `0_create_tables.py` (Run alembic)
- [ ] Write `1_seed_base_data.py` (base_tools, output_formats)
- [ ] Write `2_seed_llm_models.py` (3 LLM models)
- [ ] Write `3_seed_tenants.py` (eTMS, eFMS, Vela)
- [ ] Write `4_seed_agents.py` (4 agents)
- [ ] Write `5_seed_tool_configs.py` (Real endpoints + RAG)
- [ ] Write `6_seed_agent_tools.py` (Map agents→tools)
- [ ] Write `7_seed_llm_configs.py` (Tenant→LLM + API key encryption)
- [ ] Write `8_seed_users.py` (Admins + supporters with bcrypt)
- [ ] Write `9_seed_permissions.py` (Tenant agent/tool permissions)
- [ ] Write `run_all.py` (Master orchestrator)

**Deliverable:** All scripts idempotent & tested locally

---

### Phase 4: Tracking Requirements Creation
**Duration:** 1 hour
**Owner:** Backend Dev
**Tasks:**
- [ ] Create `tracking/REQUIREMENT_CHAT_ROUTING.md`
- [ ] Create `tracking/REQUIREMENT_CHAT_SESSIONS.md`
- [ ] Create `tracking/REQUIREMENT_KNOWLEDGE_BASE.md`
- [ ] Create `tracking/REQUIREMENT_ESCALATION.md`
- [ ] Create `tracking/MIGRATION_STATUS.yaml` (progress tracker)

**Deliverable:** Clear requirements for dev agents

---

### Phase 5: Run Migration Scripts
**Duration:** 5 minutes
**Owner:** Backend Dev
**Tasks:**
- [ ] Set DATABASE_URL in .env
- [ ] Run: `cd backend && python migrations/run_all.py`
- [ ] Verify: All 10 steps complete without errors
- [ ] Check: Database has no errors

**Expected Output:**
```
✅ Step 0: Tables created
✅ Step 1: Base tools seeded (3 tools)
✅ Step 2: LLM models seeded (3 models)
✅ Step 3: Tenants created (eTMS, eFMS, Vela)
✅ Step 4: Agents created (4 agents)
✅ Step 5: Tool configs seeded (5 tools with real endpoints)
✅ Step 6: Agent-tool mappings created
✅ Step 7: LLM configs set (with encrypted API keys)
✅ Step 8: Users created (3 admins + 6 supporters)
✅ Step 9: Permissions configured
✅ Database initialization complete!
```

**Deliverable:** Database ready with all seed data

---

### Phase 6: Database Verification
**Duration:** 10 minutes
**Owner:** Backend Dev + QA
**Tasks:**
- [ ] Verify 3 tenants exist (eTMS, eFMS, Vela)
- [ ] Verify 4 agents exist (with correct names)
- [ ] Verify 5 tool configs exist (with real endpoints)
- [ ] Verify 3 admins created
- [ ] Verify 6 supporters created
- [ ] Test: Query agent by name → returns agent_id
- [ ] Test: Query tenant permissions → correct agents enabled per tenant
- [ ] Test: API key encryption/decryption works

**Verification Script:**
```python
# Run this to verify
cd backend
python -c "
from src.config import get_db
from src.models import *

db = next(get_db())
print('✅ Tenants:', db.query(Tenant).count())
print('✅ Agents:', db.query(AgentConfig).count())
print('✅ Tools:', db.query(ToolConfig).count())
print('✅ Users:', db.query(User).count())
print('✅ Supporters:', db.query(Supporter).count())

# Test agent lookup
agent = db.query(AgentConfig).filter_by(name='DebtAgent').first()
print(f'✅ DebtAgent found: {agent.agent_id}')
"
```

**Deliverable:** Verification document signed off

---

### Phase 7: Dev Agent Handoff
**Duration:** 30 minutes
**Owner:** Manager
**Tasks:**
- [ ] Pass 4 requirement files to dev agents
- [ ] Explain tracking system (REQUIREMENT_*.md)
- [ ] Show database schema (agent names, endpoints, tenants)
- [ ] Assign tasks:
  - Dev Agent 1: Chat Routing (REQUIREMENT_CHAT_ROUTING.md)
  - Dev Agent 2: Chat Sessions (REQUIREMENT_CHAT_SESSIONS.md)
  - Dev Agent 3: Knowledge Base (REQUIREMENT_KNOWLEDGE_BASE.md)
  - Dev Agent 4: Escalation (REQUIREMENT_ESCALATION.md)
- [ ] Set deadline for each requirement

**Deliverable:** Dev agents have clear tasks with requirements

---

## 🏗️ Folder Structure (To Be Created)

```
backend/migrations/                          ← NEW
├── README.md                                 (How to use)
├── MIGRATION_PLAN.md                        (THIS FILE - Status tracker)
├── requirements.txt                         (Dependencies)
├── __init__.py
├── run_all.py                               (Master orchestrator)
│
├── 0_create_tables.py                       (Run alembic)
├── 1_seed_base_data.py                      (base_tools, output_formats)
├── 2_seed_llm_models.py                     (LLM models)
├── 3_seed_tenants.py                        (3 tenants)
├── 4_seed_agents.py                         (4 agents + SupervisorAgent)
├── 5_seed_tool_configs.py                   (Real debt API endpoints)
├── 6_seed_agent_tools.py                    (Agent→tool mappings)
├── 7_seed_llm_configs.py                    (Tenant→LLM + keys)
├── 8_seed_users.py                          (Admins + supporters)
├── 9_seed_permissions.py                    (Tenant permissions - UPDATED)
│
├── data/
│   ├── base_tools.json
│   ├── agents.json
│   ├── tenants.json
│   ├── llm_models.json
│   ├── users.json
│   ├── tool_configs.json                   (REAL endpoints!)
│   └── tenant_agent_mapping.json
│
└── tracking/
    ├── MIGRATION_STATUS.yaml                (Progress tracker)
    ├── REQUIREMENT_CHAT_ROUTING.md          (Dev task 1)
    ├── REQUIREMENT_CHAT_SESSIONS.md         (Dev task 2)
    ├── REQUIREMENT_KNOWLEDGE_BASE.md        (Dev task 3)
    └── REQUIREMENT_ESCALATION.md            (Dev task 4)
```

---

## 📈 Data Schema Summary

### 3 Tenants
| Name | Domain | LLM Model | Region |
|------|--------|-----------|--------|
| eTMS | e-transportation-management | gemini-2.5-flash (Google) | Primary |
| eFMS | e-fleet-management | gemini-2.0-flash-exp:free (OpenRouter) | Secondary |
| Vela | vela-support | gpt-4o-mini (OpenRouter) | Tertiary |

### 4 Agents (Global Names)
| Name | Purpose | eTMS | eFMS | Vela |
|------|---------|------|------|------|
| GuidelineAgent | RAG/Knowledge | ✅ | ✅ | ✅ |
| DebtAgent | Customer debt queries | ❌ | ✅ | ❌ |
| ShipmentAgent | Tracking/Status | ❌ | ✅ | ❌ |
| SupervisorAgent | Intent routing | ✅ | ✅ | ✅ |

### 5 Tool Configs (With Real Endpoints!)
```
1. search_knowledge_base (RAG)
   → Uses backend RAG service

2. get_customer_debt_by_mst (HTTP GET)
   → https://uat-accounting-api-efms.logtechub.com/api/v1/vi/AccountReceivable/GetReceivableByTaxCode/{tax_code}

3. get_salesman_debt (HTTP GET)
   → https://uat-accounting-api-efms.logtechub.com/api/v1/vi/AccountReceivable/GetReceivableBySalesman/{salesman}

4. track_shipment (HTTP GET - placeholder)
   → https://api.internal/shipment/{shipment_id}

5. update_shipment_status (HTTP POST - placeholder)
   → https://api.internal/shipment/{shipment_id}/status
```

### Users (9 Total)
**Admins (3):**
- admin@eTMS.local
- admin@eFMS.local
- admin@vela.local

**Supporters (6):**
- support_guideline@eTMS.local
- support_supervisor@eTMS.local
- support_debt@eFMS.local
- support_shipment@eFMS.local
- support_guideline@eFMS.local
- support_general@vela.local

---

## 🔧 Key Technical Details

### API Key Encryption
```python
# In seed script
from cryptography.fernet import Fernet

encrypted_key = Fernet(FERNET_KEY).encrypt(api_key.encode())
# Store encrypted_key in TenantLLMConfig.encrypted_api_key
```

### Agent Name as Bridge (Fixes 500 Error)
```python
# Frontend sends agent_name
POST /api/{tenant_id}/chat {
  "message": "...",
  "agent_name": "DebtAgent"  ← This is the bridge!
}

# Backend looks up by name
agent = db.query(AgentConfig).filter_by(name="DebtAgent").first()
# Gets agent_id → routes to agent → ✅ 200 OK
```

### Tenant Isolation on All Queries
```python
# Every query must include tenant_id
db.query(AgentConfig)\
  .join(TenantAgentPermission)\
  .filter(TenantAgentPermission.tenant_id == tenant_id)\
  .filter(TenantAgentPermission.enabled == True)
```

---

## 🚨 Critical Issues This Fixes

| Issue | Symptom | Root Cause | Fixed By |
|-------|---------|-----------|----------|
| Chat 500 Error | POST /chat fails | Agent not found | Phase 5: Seed agents with correct names |
| Chat Sessions Empty | No data in UI | No DB query | Phase 7: Dev implements GET endpoint |
| KB Stats Missing | Zero documents | No DB query | Phase 7: Dev implements GET endpoint |
| Escalation Broken | Can't assign | No supporter setup | Phase 7: Dev implements assignment |
| Wrong Tenant Data | Data mixing | No tenant filter | Phase 5: All queries filter tenant_id |

---

## 📞 Next Steps

### Immediate (This Meeting)
1. ✅ Approve phase breakdown (7 phases, ~4 hours total)
2. ✅ Confirm real API endpoints correct
3. ✅ Confirm tenants & agents setup
4. ⏳ **START PHASE 1 NOW** (Create folder structure)

### Phase-by-Phase Timeline
```
Phase 1: 15 min  ← Create folder structure NOW
Phase 2: 30 min  ← Create data JSON files
Phase 3: 2 hr    ← Write seed scripts
Phase 4: 1 hr    ← Write requirement files
Phase 5: 5 min   ← Run scripts
Phase 6: 10 min  ← Verify database
Phase 7: 30 min  ← Handoff to dev agents

TOTAL: ~4.5 hours to get dev agents unblocked
```

---

## 👥 Role Assignments

| Role | Phase | Task |
|------|-------|------|
| **Backend Dev (You)** | 1-6 | Create migrations infrastructure, run scripts, verify |
| **Dev Agent 1 (Chat Routing)** | 7+ | Implement chat routing fixes |
| **Dev Agent 2 (Chat Sessions)** | 7+ | Implement GET sessions endpoint |
| **Dev Agent 3 (Knowledge Base)** | 7+ | Implement GET knowledge stats endpoint |
| **Dev Agent 4 (Escalation)** | 7+ | Implement escalation with supporter assignment |

---

## ✅ Ready?

**Shall I proceed with Phase 1 right now?**
- Create `backend/migrations/` folder
- Create all script files (empty shells)
- Create README.md with instructions
- Create tracking/MIGRATION_STATUS.yaml

**YES → I start Phase 1 now** ⏭️

---

**Status:** READY FOR EXECUTION
**Last Updated:** 2025-11-11
**Next Checkpoint:** Phase 1 completion
