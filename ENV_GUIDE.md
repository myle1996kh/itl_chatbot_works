# 🔐 Hướng dẫn sử dụng Environment Variables với Docker

## 📋 Tổng quan

Docker **KHÔNG copy file `.env` vào image** vì lý do bảo mật. Thay vào đó, environment variables được **load khi RUN container**.

---

## ✅ Cách đúng: Load `.env` khi chạy container

### **Option 1: Docker Compose (Khuyến nghị)** ⭐

```yaml
# docker-compose.yml
services:
  app:
    env_file:
      - backend/.env    # ← Load từ file .env
    environment:
      # Override một số biến cho Docker network
      DATABASE_URL: postgresql://postgres:password@postgres:5432/chatbot_itl
```

**Chạy:**
```bash
docker-compose up -d
# → Tự động load backend/.env + override DATABASE_URL
```

---

### **Option 2: Docker Run với `--env-file`**

```bash
docker run -d \
  --name itl-chatbot \
  -p 8000:8000 \
  --env-file backend/.env \
  itl-chatbot:latest
```

---

### **Option 3: Docker Run với `-e` flags**

```bash
docker run -d \
  --name itl-chatbot \
  -p 8000:8000 \
  -e DATABASE_URL=postgresql://... \
  -e OPENAI_API_KEY=sk-... \
  -e SECRET_KEY=your-secret \
  itl-chatbot:latest
```

---

## 🔍 Cách hoạt động

### **Build time (Dockerfile):**
```dockerfile
# ❌ KHÔNG copy .env vào image
# COPY backend/.env ./.env  # ← Không làm thế này!

# ✅ Image không chứa secrets
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Kết quả:** Image sạch, không có secrets

---

### **Run time (docker-compose.yml):**
```yaml
services:
  app:
    env_file:
      - backend/.env    # ← Load khi RUN
    environment:
      DATABASE_URL: postgresql://postgres:password@postgres:5432/chatbot_itl
```

**Flow:**
```
1. Docker Compose đọc backend/.env
2. Load tất cả biến vào container
3. Override DATABASE_URL (vì trong Docker network dùng hostname "postgres")
4. Container start với env vars đầy đủ
```

---

## 📝 Setup cho project của bạn

### **1. Đảm bảo có file `.env`**

```bash
# Kiểm tra
ls backend/.env

# Nếu chưa có, copy từ example
cp backend/.env.example backend/.env
```

### **2. Cập nhật `.env` cho local development**

```bash
# backend/.env
DATABASE_URL=postgresql://postgres:password@localhost:5432/chatbot_itl
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=sk-your-key-here
SECRET_KEY=your-secret-key
ENVIRONMENT=development
```

### **3. Chạy với Docker Compose**

```bash
# Start tất cả services (PostgreSQL + Redis + App)
docker-compose up -d

# Xem logs
docker-compose logs -f app

# Kiểm tra env vars đã load
docker exec itl-chatbot env | grep DATABASE_URL
```

---

## 🔐 Tại sao KHÔNG copy `.env` vào image?

### **❌ Nguy hiểm:**

```dockerfile
# ❌ SAI - Không làm thế này!
COPY backend/.env ./.env
```

**Vấn đề:**
1. **Secrets bị hardcode** vào image
2. **Ai có image đều extract được secrets:**
   ```bash
   docker save itl-chatbot | tar -xO | grep "OPENAI_API_KEY"
   ```
3. **Push lên Docker Hub → secrets bị leak công khai**
4. **Không thể thay đổi config** mà không rebuild image

---

### **✅ An toàn:**

```yaml
# ✅ ĐÚNG - Load khi run
env_file:
  - backend/.env
```

**Lợi ích:**
1. ✅ Secrets **không** trong image
2. ✅ Mỗi môi trường dùng `.env` riêng (dev/staging/prod)
3. ✅ Thay đổi config không cần rebuild
4. ✅ Image có thể public an toàn

---

## 🌍 Môi trường khác nhau

### **Development (Local):**
```bash
# backend/.env
DATABASE_URL=postgresql://postgres:password@localhost:5432/chatbot_itl
REDIS_URL=redis://localhost:6379
ENVIRONMENT=development
```

### **Docker Compose:**
```yaml
# docker-compose.yml
env_file:
  - backend/.env
environment:
  # Override cho Docker network
  DATABASE_URL: postgresql://postgres:password@postgres:5432/chatbot_itl
  REDIS_URL: redis://redis:6379
```

### **Production (Server):**
```bash
# /opt/app/.env.production
DATABASE_URL=postgresql://user:pass@db.example.com:5432/chatbot_prod
REDIS_URL=redis://redis.example.com:6379
OPENAI_API_KEY=sk-prod-key
ENVIRONMENT=production
```

```bash
docker run -d \
  --env-file /opt/app/.env.production \
  itl-chatbot:latest
```

---

## 📊 Ưu tiên load env vars

Khi có nhiều nguồn, Docker ưu tiên theo thứ tự:

```
1. docker run -e KEY=value        (Cao nhất)
2. docker-compose.yml environment
3. docker-compose.yml env_file
4. Dockerfile ENV                 (Thấp nhất)
```

**Ví dụ:**
```yaml
env_file:
  - backend/.env              # DATABASE_URL=postgresql://localhost:5432/db
environment:
  DATABASE_URL: postgresql://postgres:5432/db  # ← Thằng này thắng!
```

---

## ✅ Checklist

### **Trước khi chạy Docker:**

- [ ] File `backend/.env` đã tồn tại
- [ ] Đã điền đầy đủ API keys, passwords
- [ ] `docker-compose.yml` có `env_file: - backend/.env`
- [ ] Override `DATABASE_URL` và `REDIS_URL` cho Docker network

### **Sau khi start:**

```bash
# Kiểm tra env vars đã load
docker exec itl-chatbot env | grep DATABASE_URL
docker exec itl-chatbot env | grep OPENAI_API_KEY

# Test kết nối database
docker exec itl-chatbot python -c "from src.config import settings; print(settings.DATABASE_URL)"
```

---

## 🚀 Quick Start

```bash
# 1. Copy .env.example
cp backend/.env.example backend/.env

# 2. Sửa backend/.env (thêm API keys, passwords)
nano backend/.env

# 3. Start với Docker Compose
docker-compose up -d

# 4. Xem logs
docker-compose logs -f app

# 5. Truy cập
open http://localhost:8000
```

---

## 📝 Tóm tắt

| Câu hỏi | Trả lời |
|---------|---------|
| **Copy `.env` vào image?** | ❌ **KHÔNG** - nguy hiểm! |
| **Load `.env` như thế nào?** | ✅ `env_file` trong docker-compose.yml |
| **Có thể dùng nhiều `.env`?** | ✅ Có - mỗi môi trường 1 file |
| **Override được không?** | ✅ Có - dùng `environment` trong docker-compose.yml |

**Best practice:** Load `.env` khi RUN, không build vào image! 🔐
