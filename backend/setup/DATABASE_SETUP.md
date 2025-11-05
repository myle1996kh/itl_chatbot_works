# Database Setup Guide

Complete guide for setting up PostgreSQL and pgvector for ITL_PGVector.

## Prerequisites

- PostgreSQL 14+ installed
- pgvector installed at OS level
- Python 3.9+
- psycopg2 package

---

## Step 1: Install PostgreSQL

### Windows (using PostgreSQL installer)

1. Download from: https://www.postgresql.org/download/windows/
2. Run installer, remember the password
3. Default port: 5432
4. Default user: postgres

### Windows (using Chocolatey)

```bash
choco install postgresql
```

### Windows (using WSL2)

```bash
# In WSL terminal
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo service postgresql start
```

### macOS (using Homebrew)

```bash
brew install postgresql
brew services start postgresql
```

### Linux (Ubuntu/Debian)

```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo service postgresql start
```

---

## Step 2: Install pgvector Extension

### Windows (WSL2)

```bash
# In WSL terminal
sudo apt-get install postgresql-14-pgvector
```

### Windows (Native - using package)

```bash
# Download and install from:
# https://github.com/pgvector/pgvector/releases

# Or if you have build tools:
cd pgvector
make
make install
```

### macOS (using Homebrew)

```bash
brew install pgvector
```

### Linux (Ubuntu/Debian)

```bash
# From source
sudo apt-get install build-essential postgresql-server-dev-14
git clone --depth 1 https://github.com/pgvector/pgvector.git
cd pgvector
make
make install
```

---

## Step 3: Verify Installation

### Check PostgreSQL

```bash
psql --version
# Output: psql (PostgreSQL) 14.x or higher
```

### Check PostgreSQL is Running

```bash
# Windows (WSL2)
sudo service postgresql status

# macOS
brew services list | grep postgresql

# Linux
sudo systemctl status postgresql
```

### Connect to PostgreSQL

```bash
psql -h localhost -U postgres

# You should see: postgres=#
# Type \q to exit
```

---

## Step 4: Update Configuration

Edit `backend/setup/config.yaml`:

```yaml
database:
  url: "postgresql://postgres:123456@localhost:5432/chatbot_itl"
  pool_size: 20
  max_overflow: 10
```

**Replace with your credentials:**
- `postgres` - PostgreSQL username
- `123456` - PostgreSQL password
- `localhost` - PostgreSQL host
- `5432` - PostgreSQL port
- `chatbot_itl` - Database name

---

## Step 5: Run pgvector Setup Script

```bash
cd backend

# Install psycopg2 if not already installed
pip install psycopg2-binary

# Run setup script
python setup/setup_pgvector.py --config setup/config.yaml
```

**Output should show:**
```
✅ Database created
✅ pgvector extension installed
✅ Vector type available
✅ pgvector setup completed successfully!
```

---

## Step 6: Verify pgvector Installation

### Connect to Database

```bash
psql -h localhost -U postgres -d chatbot_itl

# You should see: chatbot_itl=#
```

### Check pgvector Extension

```sql
-- List extensions
\dx

-- Should show: vector | 0.5.x | public | type for vector embedding

-- Check vector type
SELECT typname FROM pg_type WHERE typname = 'vector';

-- Should return: vector
```

---

## Step 7: Run Database Migrations

```bash
cd backend

# Create initial schema
alembic upgrade head

# Output should show:
# INFO  [alembic.runtime.migration] Context impl PostgresqlImpl with target metadata
# INFO  [alembic.runtime.migration] Will assume transactional DDL is supported
# INFO  [alembic.runtime.migration] Upgrading database
# INFO  [alembic.runtime.migration] Running upgrade  -> 20251103_001, Complete schema and seed
# INFO  [alembic.runtime.migration] Running upgrade 20251103_001 -> 20251103_002, Add pgvector knowledge base
```

---

## Complete Setup Workflow

```bash
# 1. Install pgvector (OS level)
# See "Step 2" above for your OS

# 2. Update config.yaml with your database credentials
# Edit: backend/setup/config.yaml

# 3. Run pgvector setup script
cd backend
python setup/setup_pgvector.py

# 4. Run database migrations
alembic upgrade head

# 5. Seed base data
python setup/seed_base_data.py

# 6. Create eTMS tenant
python setup/seed_demo_tenant.py

# 7. Ingest PDFs
python setup/ingest_demo_pdfs.py

# 8. Start backend
python -m uvicorn src.main:app --reload
```

---

## Configuration Reference

### Database URL Format

```
postgresql://username:password@host:port/database
```

**Examples:**

```yaml
# Local development (Windows)
url: "postgresql://postgres:password123@localhost:5432/chatbot_itl"

# Local development (Docker)
url: "postgresql://postgres:postgres@db:5432/chatbot_itl"

# Production (AWS RDS)
url: "postgresql://admin:securepass@mydb.xxxxx.us-east-1.rds.amazonaws.com:5432/chatbot_itl"

# Production (Azure Database)
url: "postgresql://admin@myserver:password@myserver.postgres.database.azure.com:5432/chatbot_itl"
```

### Connection Pool Settings

```yaml
database:
  url: "postgresql://postgres:123456@localhost:5432/chatbot_itl"
  pool_size: 20        # Number of connections to keep
  max_overflow: 10     # Additional connections allowed
```

**Recommendations:**
- Development: `pool_size: 5, max_overflow: 5`
- Production: `pool_size: 20, max_overflow: 10`
- High traffic: `pool_size: 50, max_overflow: 20`

---

## Troubleshooting

### PostgreSQL Connection Failed

```
Error: could not connect to server: Connection refused
```

**Solutions:**
1. Check PostgreSQL is running: `sudo systemctl status postgresql`
2. Start PostgreSQL: `sudo systemctl start postgresql`
3. Verify credentials in config.yaml
4. Check host and port are correct

### pgvector Extension Not Found

```
Error: extension "vector" does not exist
```

**Solutions:**
1. Install pgvector at OS level (see Step 2)
2. Verify installation: `which pgvector`
3. Check PostgreSQL version: `SELECT version();`
4. Restart PostgreSQL after installation

### Database Does Not Exist

```
Error: database "chatbot_itl" does not exist
```

**Solutions:**
1. Run setup script: `python setup/setup_pgvector.py`
2. Or create manually:
   ```bash
   createdb -h localhost -U postgres chatbot_itl
   ```

### Port Already in Use

```
Error: Address already in use
```

**Solutions:**
1. Find process on port 5432: `lsof -i :5432`
2. Stop PostgreSQL: `sudo systemctl stop postgresql`
3. Or use different port in config.yaml

### Permission Denied

```
Error: permission denied for schema public
```

**Solutions:**
1. Grant permissions:
   ```sql
   GRANT ALL PRIVILEGES ON DATABASE chatbot_itl TO postgres;
   ```

---

## Verify Complete Setup

```bash
# Check database exists
psql -h localhost -U postgres -l | grep chatbot_itl

# Check pgvector is installed
psql -h localhost -U postgres -d chatbot_itl -c "SELECT * FROM pg_extension;"

# Check tables created by migrations
psql -h localhost -U postgres -d chatbot_itl -c "\dt"

# Should show: 14 tables
```

---

## Docker Setup (Alternative)

If using Docker, PostgreSQL with pgvector is pre-configured:

```bash
cd backend

# Start PostgreSQL and Redis
docker-compose up -d

# Then run:
python setup/setup_pgvector.py
alembic upgrade head
```

**docker-compose.yml should have:**
```yaml
postgres:
  image: pgvector/pgvector:pg14
  environment:
    POSTGRES_DB: chatbot_itl
    POSTGRES_PASSWORD: 123456
  ports:
    - "5432:5432"
```

---

## Environment Variables

Instead of editing config.yaml, you can use environment variables:

```bash
export DATABASE_URL="postgresql://postgres:123456@localhost:5432/chatbot_itl"
export OPENROUTER_API_KEY="your-key"

python setup/init_database.py --full
```

---

## Performance Tuning

### Enable pgvector Indexes

After first ingestion, verify index creation:

```sql
-- Check indexes
SELECT indexname FROM pg_indexes
WHERE tablename = 'langchain_pg_embedding';

-- Should show HNSW index for vector column
```

### Optimize Queries

```sql
-- Check query performance
EXPLAIN ANALYZE
SELECT * FROM langchain_pg_embedding
ORDER BY embedding <-> '[0.1, 0.2, ..., 0.384]'
LIMIT 5;
```

---

## Next Steps

Once database is set up:

1. ✅ Database initialized with pgvector
2. ⬜ Seed base data: `python setup/seed_base_data.py`
3. ⬜ Create eTMS tenant: `python setup/seed_demo_tenant.py`
4. ⬜ Ingest PDFs: `python setup/ingest_demo_pdfs.py`
5. ⬜ Start backend: `python -m uvicorn src.main:app --reload`

---

## Support

For issues:
- PostgreSQL docs: https://www.postgresql.org/docs/
- pgvector docs: https://github.com/pgvector/pgvector
- Check logs: `docker-compose logs postgres`
- Verify connection: `psql -h localhost -U postgres -d chatbot_itl -c "SELECT 1;"`

