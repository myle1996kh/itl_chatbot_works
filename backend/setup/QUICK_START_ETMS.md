# eTMS Quick Start Guide

Fast setup guide for eTMS system with Vietnamese language support and FCL procedures.

## 🚀 In 3 Steps

### Step 1: Copy PDF
```bash
cp "notebook_test_pgvector/eTMS USER GUIDE DOCUMENT.pdf" backend/setup/eTMS.pdf
```

### Step 2: Initialize Database
```bash
cd backend
python setup/init_database.py --full --config setup/config.yaml
```

### Step 3: Start Backend
```bash
python -m uvicorn src.main:app --reload
```

Done! ✅

---

## Test It

### 1. Access API Docs
http://localhost:8000/docs

### 2. Get Tenant ID
```bash
GET /api/admin/tenants
```

Response will show eTMS tenant ID (use in next steps)

### 3. Create Chat Session
```bash
POST /api/chat/sessions
{
  "tenant_id": "{etms_tenant_id}"
}
```

### 4. Send Vietnamese Query
```bash
POST /api/chat/sessions/{session_id}/messages
{
  "content": "Tạo đơn hàng FCL như thế nào?"
}
```

---

## Configuration Details

| Setting | Value |
|---------|-------|
| **Database** | `postgresql://postgres:123456@localhost:5433/chatbot_itl` |
| **LLM Provider** | OpenAI |
| **Model** | gpt-4o-mini |
| **API Key** | `sk-proj-...` (already configured) |
| **Tenant** | eTMS |
| **Language** | Vietnamese 🇻🇳 |
| **Knowledge Base** | eTMS User Guide PDF |
| **Temperature** | 0.0 (consistent responses) |
| **Max Tokens** | 128,000 (no truncation) |

---

## Key Features

✅ **Vietnamese Support**
- All prompts in Vietnamese
- FCL order procedures explained
- Professional terminology

✅ **Structured Responses**
1. Bước / Mục Đích
2. Quy Trình
3. Lưu Ý Quan Trọng
4. Ví Dụ Thực Tế
5. Tham Khảo Thêm

✅ **High Quality**
- Temperature 0.0 for consistency
- 128k token context window
- Direct OpenAI integration
- Knowledge base citations

---

## Troubleshooting

**PDF not found?**
```bash
# Make sure file exists
ls backend/setup/eTMS.pdf

# Copy if missing
cp "notebook_test_pgvector/eTMS USER GUIDE DOCUMENT.pdf" backend/setup/eTMS.pdf
```

**Database connection error?**
```bash
# Verify PostgreSQL is running on 5433
psql -h localhost -p 5433 -U postgres -d chatbot_itl -c "SELECT 1;"

# If fails, start PostgreSQL
docker-compose up -d postgres
```

**API not responding?**
```bash
# Check backend is running
curl http://localhost:8000/docs

# If fails, restart
python -m uvicorn src.main:app --reload
```

---

## What Gets Created

When you run `python setup/init_database.py --full`:

✅ **Database**
- 14 tables with schema
- PostgreSQL on localhost:5433

✅ **LLM Models**
- 4 OpenRouter models (GPT-4o, Claude, Gemini)
- 1 OpenAI model (GPT-4o-mini)

✅ **eTMS Tenant**
- Name: eTMS
- Domain: etms.agenthub.local
- LLM: OpenAI GPT-4o-mini
- Default Agent: AgentGuidance

✅ **AgentGuidance**
- Vietnamese prompts
- FCL-focused responses
- Knowledge base integration
- RAG tool enabled

✅ **Knowledge Base**
- eTMS PDF document ingested
- 1000 char chunks with 200 overlap
- Ready for semantic search

✅ **Tools & Agents**
- RAG tool for knowledge search
- 3 agents (Guidance, Analysis, Supervisor)
- All configured and ready

---

## Common Queries to Test

```
"Tạo đơn hàng FCL như thế nào?"
"Quy trình booking là gì?"
"Những bước để tạo booking FCL?"
"Làm sao để chuyển đổi booking?"
"Các hạn chế khi tạo đơn hàng là gì?"
```

---

## Config File Locations

| File | Purpose |
|------|---------|
| `setup/config.yaml` | Main configuration (edit here) |
| `setup/eTMS.pdf` | Knowledge base document |
| `backend/src/api/admin/tenants.py` | Tenant CRUD API |
| `backend/src/services/rag_service.py` | RAG implementation |

---

## More Info

For detailed information:
- `setup/README.md` - Complete guide
- `setup/ETMS_CONFIGURATION.md` - eTMS-specific config
- `setup/UPDATES_APPLIED.md` - All changes made
- `setup/IMPLEMENTATION_SUMMARY.md` - System overview

---

## Quick Commands

```bash
# Initialize everything
python setup/init_database.py --full --config setup/config.yaml

# Start backend
python -m uvicorn src.main:app --reload

# View logs
tail -f logs/app.log

# Check database
psql -h localhost -p 5433 -U postgres -d chatbot_itl

# List tenants
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/admin/tenants

# Test eTMS RAG
curl -X POST http://localhost:8000/api/chat/sessions \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": "{etms_tenant_id}"}'
```

---

## Support

Having issues? Check:
1. PDF exists at `backend/setup/eTMS.pdf`
2. PostgreSQL running on localhost:5433
3. OpenAI API key is valid
4. Python 3.9+ installed
5. All dependencies installed (`pip install -r requirements.txt`)

---

**Ready to go!** 🚀
Run: `python setup/init_database.py --full` and you're all set!

