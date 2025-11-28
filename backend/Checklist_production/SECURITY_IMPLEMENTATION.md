# Security Implementation Guide

This guide walks you through implementing all security recommendations from the audit report.

## Quick Start

Run these scripts in order:

```bash
# 1. Verify authentication configuration
python verify_auth_config.py

# 2. Create database security indexes
python create_security_indexes.py

# 3. Scan dependencies for vulnerabilities
python scan_dependencies.py
```

---

## Step 1: Verify Authentication Configuration

### What it checks:
- ✅ `DISABLE_AUTH=false` (authentication enabled)
- ✅ `JWT_PUBLIC_KEY` is configured
- ✅ `ENVIRONMENT=production`
- ✅ `LOG_LEVEL` is WARNING or ERROR
- ✅ `FERNET_KEY` is set correctly
- ✅ `DATABASE_URL` doesn't have default passwords
- ✅ `CORS_ORIGINS` is restricted

### Run:
```bash
python verify_auth_config.py
```

### Expected output:
```
✅ DISABLE_AUTH: false
✅ JWT_PUBLIC_KEY: Configured
✅ ENVIRONMENT: production
✅ LOG_LEVEL: WARNING
✅ FERNET_KEY: kN8j3xP5mR7qT9wV2yB4nL6oC1eH3fA8gD0iK5sU9jM=
✅ DATABASE_URL: Configured
✅ CORS_ORIGINS: Restricted

✅ ALL CHECKS PASSED
```

### If it fails:
1. Open `.env` file
2. Update the failing settings
3. Run the script again

---

## Step 2: Create Database Security Indexes

### What it does:
Creates indexes for:
- **Tenant isolation** - Fast filtering by `tenant_id`
- **Source filtering** - Filter by ingestion method (`OCR method`, `ProtonX method`)
- **Document queries** - Search by document name
- **RAG tools** - Tenant-specific tool queries
- **LLM configs** - Tenant-specific LLM settings

### Run:
```bash
python create_security_indexes.py
```

### Expected output:
```
Creating idx_embedding_tenant...
  Purpose: Tenant isolation index for fast filtering
  ✅ Created successfully

Creating idx_embedding_source...
  Purpose: Source detail index for filtering by ingestion method
  ✅ Created successfully

...

✅ ALL INDEXES CREATED SUCCESSFULLY
```

### If it fails:
- Verify `DATABASE_URL` is correct
- Check database is running
- Ensure user has `CREATE INDEX` permissions

---

## Step 3: Scan Dependencies for Vulnerabilities

### What it does:
- Installs `pip-audit` if not present
- Scans all Python dependencies
- Reports known security vulnerabilities

### Run:
```bash
python scan_dependencies.py
```

### Expected output (if secure):
```
✅ pip-audit is installed
Running security scan...

No known vulnerabilities found

✅ NO VULNERABILITIES FOUND
```

### If vulnerabilities found:
1. Review the vulnerability details
2. Update affected packages:
   ```bash
   pip install --upgrade <package_name>
   ```
3. Test the application
4. Run scan again

---

## Manual Verification Steps

### 1. Test Authentication

Test that authentication is working:

```bash
# Should return 401 Unauthorized
curl -X POST http://localhost:8000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}'

# Should work with valid token
curl -X POST http://localhost:8000/api/v1/chat \
  -H "Authorization: Bearer <valid_jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}'
```

### 2. Verify Tenant Isolation

Test that tenants can only access their own data:

```python
# In Python console
from src.database.connection import get_db_session
from sqlalchemy import text

with get_db_session() as db:
    # Query with tenant filter
    result = db.execute(text("""
        SELECT COUNT(*) 
        FROM langchain_pg_embedding 
        WHERE cmetadata->>'tenant_id' = '3105b788-b5ff-4d56-88a9-532af4ab4ded'
    """))
    print(f"Chunks for tenant: {result.scalar()}")
```

### 3. Check Index Performance

Verify indexes are being used:

```sql
-- Run in PostgreSQL
EXPLAIN ANALYZE
SELECT * FROM langchain_pg_embedding 
WHERE cmetadata->>'tenant_id' = '3105b788-b5ff-4d56-88a9-532af4ab4ded'
LIMIT 10;

-- Should show "Index Scan using idx_embedding_tenant"
```

---

## Production Deployment Checklist

After running all scripts, verify:

- [ ] ✅ All authentication checks passed
- [ ] ✅ Database indexes created
- [ ] ✅ No dependency vulnerabilities
- [ ] ✅ Authentication tested manually
- [ ] ✅ Tenant isolation verified
- [ ] ✅ Index performance confirmed
- [ ] ✅ `.env` file has production values
- [ ] ✅ `DISABLE_AUTH=false`
- [ ] ✅ `ENVIRONMENT=production`
- [ ] ✅ `LOG_LEVEL=WARNING` or `ERROR`

---

## Troubleshooting

### Authentication script fails
- Check `.env` file exists
- Verify all required variables are set
- Ensure no typos in variable names

### Database script fails
- Verify database is running
- Check `DATABASE_URL` is correct
- Ensure database user has permissions
- Try connecting with `psql` manually

### Dependency scan fails
- Update pip: `pip install --upgrade pip`
- Install pip-audit manually: `pip install pip-audit`
- Check internet connection

---

## Next Steps

After completing all steps:

1. Update `Checklist_production/PRE_PRODUCTION_CHECKLIST.md`
2. Mark security items as complete
3. Run full application tests
4. Deploy to staging first
5. Monitor for issues
6. Deploy to production

---

## Support

If you encounter issues:
1. Check the error messages carefully
2. Review the Security Audit Report
3. Verify environment configuration
4. Test in development first
