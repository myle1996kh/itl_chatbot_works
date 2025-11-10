# PgVector Installation Guide for Existing Database

This guide helps you enable pgvector on your existing PostgreSQL database.

---

## Quick Check: Do You Have PgVector?

Connect to your database and run:

```sql
-- Check if pgvector is installed
SELECT * FROM pg_available_extensions WHERE name = 'vector';

-- If it shows a row, pgvector is installed
-- If empty, you need to install it
```

---

## Option 1: Use Docker PostgreSQL (EASIEST - Recommended!)

**Best for**: Development, Testing, Quick Setup

Instead of fighting with your existing PostgreSQL, just use Docker:

```bash
cd backend

# Start PostgreSQL with pgvector pre-installed
docker-compose up -d

# That's it! pgvector is ready
```

**Pros**:
- ✅ pgvector pre-installed
- ✅ Works on Windows/Mac/Linux
- ✅ Isolated from your system
- ✅ Easy to reset/recreate

**Cons**:
- Uses Docker (requires Docker Desktop on Windows)

---

## Option 2: Install PgVector on Your Existing PostgreSQL

### For Windows

#### Method A: Pre-built Binary (Easiest on Windows)

1. **Check your PostgreSQL version**:
   ```cmd
   psql --version
   # Example: psql (PostgreSQL) 15.3
   ```

2. **Download pgvector binary for Windows**:
   - Visit: https://github.com/pgvector/pgvector/releases
   - Download the appropriate version for your PostgreSQL version
   - Example: `pgvector-0.5.1-pg15-windows-amd64.zip`

3. **Extract and install**:
   ```cmd
   # Extract the zip file
   # You'll get: vector.dll, vector.control, vector--*.sql

   # Copy files to PostgreSQL directory:
   # (Adjust path based on your PostgreSQL installation)

   copy vector.dll "C:\Program Files\PostgreSQL\15\lib\"
   copy vector.control "C:\Program Files\PostgreSQL\15\share\extension\"
   copy vector--*.sql "C:\Program Files\PostgreSQL\15\share\extension\"
   ```

4. **Restart PostgreSQL service**:
   ```cmd
   # Open Services (services.msc)
   # Find "postgresql-x64-15" (or your version)
   # Right-click → Restart

   # Or via command line (as Administrator):
   net stop postgresql-x64-15
   net start postgresql-x64-15
   ```

5. **Verify installation**:
   ```sql
   -- Connect to your database
   psql -U postgres -d chatbot_db

   -- Check if extension is available
   SELECT * FROM pg_available_extensions WHERE name = 'vector';

   -- Enable it
   CREATE EXTENSION IF NOT EXISTS vector;

   -- Test it
   SELECT '1,2,3'::vector;
   ```

#### Method B: Build from Source (Advanced - Requires Visual Studio)

```cmd
# Install Visual Studio with C++ tools
# Install PostgreSQL with development headers

git clone https://github.com/pgvector/pgvector.git
cd pgvector

# Follow build instructions for Windows in the README
```

### For Linux (Ubuntu/Debian)

```bash
# Method 1: Install from package (PostgreSQL 12+)
sudo apt-get update
sudo apt-get install -y postgresql-15-pgvector

# Method 2: Build from source
sudo apt-get install -y build-essential postgresql-server-dev-15 git
git clone https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install

# Restart PostgreSQL
sudo systemctl restart postgresql

# Enable extension
sudo -u postgres psql -d chatbot_db -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### For macOS

```bash
# Method 1: Homebrew (if using Homebrew PostgreSQL)
brew install pgvector

# Method 2: Build from source
brew install postgresql@15
git clone https://github.com/pgvector/pgvector.git
cd pgvector
make
make install

# Restart PostgreSQL
brew services restart postgresql@15

# Enable extension
psql -d chatbot_db -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

---

## Option 3: Run Without PgVector (Limited RAG)

If you **cannot install pgvector**, you can still run the system with limited RAG functionality:

### Use the Optional Migration

I've created a version that works without pgvector:

```bash
# Backup the original migration
cd backend/alembic/versions
mv 20251103_002_add_pgvector_knowledge_base.py 20251103_002_add_pgvector_knowledge_base.py.bak

# Rename the optional version
mv 20251103_002_add_pgvector_knowledge_base_optional.py 20251103_002_add_pgvector_knowledge_base.py

# Run migrations
cd ../..
alembic upgrade head
```

**What happens**:
- ✅ Creates knowledge_documents table
- ✅ Stores embeddings as regular arrays
- ⚠️ Slower similarity search (no vector indexes)
- ⚠️ Uses more memory for queries

---

## Troubleshooting

### Error: "extension 'vector' is not available"

**Problem**: pgvector not installed on PostgreSQL server

**Solution**: Follow installation steps above for your OS

### Error: "Permission denied"

**Problem**: Need superuser privileges

**Solution**:
```sql
-- Connect as superuser
psql -U postgres -d chatbot_db

-- Grant privileges to your user
GRANT ALL ON DATABASE chatbot_db TO your_user;

-- Enable extension
CREATE EXTENSION IF NOT EXISTS vector;
```

### Error: "could not find vector.control"

**Problem**: Extension files not in correct directory

**Solution**: Verify files are in:
- **Windows**: `C:\Program Files\PostgreSQL\15\share\extension\`
- **Linux**: `/usr/share/postgresql/15/extension/`
- **Mac**: `/usr/local/share/postgresql@15/extension/`

### PostgreSQL Service Won't Start After Installing

**Problem**: Binary incompatibility

**Solution**:
1. Remove the installed files
2. Restart PostgreSQL
3. Try a different pgvector version matching your PostgreSQL version

---

## Recommended Approach for Your Situation

Based on your scenario (existing empty database, no pgvector yet):

### Best Option: Use Docker
```bash
# 1. Use docker-compose for PostgreSQL + Redis
docker-compose up -d

# 2. Update .env to point to Docker database
DATABASE_URL=postgresql://agenthub:secret@localhost:5432/agenthub

# 3. Run migrations
alembic upgrade head

# 4. Seed data
python migrations/seed_etms_tenant.py
python migrations/seed_etms_rag_data.py
```

### Alternative: Install on Existing Database
```bash
# 1. Install pgvector (see instructions above for your OS)

# 2. Enable extension
psql -U postgres -d your_database -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 3. Configure .env
DATABASE_URL=postgresql://postgres:password@localhost:5432/your_database

# 4. Run migrations
alembic upgrade head

# 5. Seed data
python migrations/seed_etms_tenant.py
python migrations/seed_etms_rag_data.py
```

---

## Verification

After installation, verify everything works:

```sql
-- 1. Check extension is enabled
\dx vector

-- 2. Test vector operations
SELECT '[1,2,3]'::vector;

-- 3. Test similarity
SELECT '[1,2,3]'::vector <-> '[1,2,4]'::vector AS distance;

-- 4. Check table exists after migration
\dt knowledge_documents
```

---

## Need Help?

If you're still having issues, let me know:
1. Your operating system (Windows/Linux/Mac)
2. PostgreSQL version (`psql --version`)
3. The exact error message you're getting

I'll help you troubleshoot! 🚀
