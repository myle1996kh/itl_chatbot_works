# 🐳 Hướng dẫn Docker cho ITL Chatbot

## 📋 Tổng quan

Dockerfile này sử dụng **Multi-stage build** gồm 3 stages:

```
Stage 1: Frontend Builder  →  Stage 2: Backend Builder  →  Stage 3: Runtime
   (Build React)                (Cài Python deps)           (Kết hợp cả 2)
```

---

## 🚀 Cách sử dụng

### **Option 1: Docker Compose (Khuyến nghị)**

Chạy toàn bộ stack (MongoDB + App) với 1 lệnh:

```bash
# Build và start tất cả services
docker-compose up -d

# Xem logs
docker-compose logs -f app

# Stop tất cả
docker-compose down

# Xóa cả volumes (database, uploads)
docker-compose down -v
```

**Truy cập ứng dụng:** http://localhost:8000

---

### **Option 2: Docker thủ công**

#### **Bước 1: Build Docker Image**

```bash
# Build image với tag 'itl-chatbot:latest'
docker build -t itl-chatbot:latest .

# Build với cache bị vô hiệu hóa (nếu gặp lỗi)
docker build --no-cache -t itl-chatbot:latest .
```

**Thời gian build:** ~5-10 phút (lần đầu)

#### **Bước 2: Chạy MongoDB**

```bash
docker run -d \
  --name itl-mongodb \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=admin123 \
  mongo:7.0
```

#### **Bước 3: Chạy Application**

```bash
docker run -d \
  --name itl-chatbot \
  -p 8000:8000 \
  -e MONGODB_URL=mongodb://admin:admin123@host.docker.internal:27017 \
  -e MONGODB_DB_NAME=itl_chatbot \
  -e SECRET_KEY=your-secret-key \
  -e OPENAI_API_KEY=sk-... \
  itl-chatbot:latest
```

**Hoặc dùng file `.env`:**

```bash
docker run -d \
  --name itl-chatbot \
  -p 8000:8000 \
  --env-file backend/.env \
  itl-chatbot:latest
```

---

## 🔍 Kiểm tra và Debug

### **Xem logs**

```bash
# Logs realtime
docker logs -f itl-chatbot

# 100 dòng cuối
docker logs --tail 100 itl-chatbot
```

### **Vào trong container**

```bash
docker exec -it itl-chatbot /bin/bash

# Kiểm tra Python packages
python -c "import fastapi; print(fastapi.__version__)"

# Kiểm tra frontend files
ls -la frontend/dist/
```

### **Health check**

```bash
# Kiểm tra health endpoint
curl http://localhost:8000/health

# Xem health status
docker inspect --format='{{.State.Health.Status}}' itl-chatbot
```

---

## 📦 Quản lý Images

```bash
# Liệt kê images
docker images

# Xóa image cũ
docker rmi itl-chatbot:latest

# Xóa dangling images (tiết kiệm dung lượng)
docker image prune -f

# Xóa tất cả unused images
docker image prune -a
```

---

## 🔄 Update Code

Khi có thay đổi code:

```bash
# 1. Stop container cũ
docker stop itl-chatbot
docker rm itl-chatbot

# 2. Rebuild image
docker build -t itl-chatbot:latest .

# 3. Start container mới
docker run -d --name itl-chatbot -p 8000:8000 --env-file backend/.env itl-chatbot:latest
```

**Hoặc với Docker Compose:**

```bash
docker-compose up -d --build
```

---

## 🌐 Deploy lên Production

### **1. Push lên Docker Hub**

```bash
# Login
docker login

# Tag image
docker tag itl-chatbot:latest your-username/itl-chatbot:v1.0.0

# Push
docker push your-username/itl-chatbot:v1.0.0
```

### **2. Trên server production**

```bash
# Pull image
docker pull your-username/itl-chatbot:v1.0.0

# Run với production config
docker run -d \
  --name itl-chatbot \
  -p 80:8000 \
  --restart unless-stopped \
  -e MONGODB_URL=mongodb://... \
  -e SECRET_KEY=... \
  -e OPENAI_API_KEY=... \
  your-username/itl-chatbot:v1.0.0
```

---

## 📊 Dockerfile Structure

### **Stage 1: Frontend Builder**

```dockerfile
FROM node:20-alpine
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build
```

**Output:** `/app/frontend/dist/` (static files)

---

### **Stage 2: Backend Builder**

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --system
```

**Output:** Python packages trong `/usr/local/lib/python3.11/site-packages`

---

### **Stage 3: Runtime**

```dockerfile
FROM python:3.11-slim
# Copy Python packages từ stage 2
COPY --from=backend-builder /usr/local/lib/python3.11/site-packages ...
# Copy frontend từ stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
# Copy backend code
COPY backend/src ./src
# Run
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## ⚙️ Environment Variables

Các biến môi trường cần thiết:

| Variable | Mô tả | Ví dụ |
|----------|-------|-------|
| `MONGODB_URL` | MongoDB connection string | `mongodb://admin:pass@localhost:27017` |
| `MONGODB_DB_NAME` | Tên database | `itl_chatbot` |
| `SECRET_KEY` | JWT secret key | `your-secret-key-here` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |
| `ENVIRONMENT` | Environment | `production` / `development` |

---

## 🐛 Troubleshooting

### **Lỗi: Cannot connect to MongoDB**

```bash
# Kiểm tra MongoDB đang chạy
docker ps | grep mongo

# Kiểm tra network
docker network inspect bridge
```

**Giải pháp:** Dùng `host.docker.internal` thay vì `localhost` trong `MONGODB_URL`

---

### **Lỗi: Frontend không load**

```bash
# Kiểm tra frontend files đã được copy
docker exec -it itl-chatbot ls -la frontend/dist/

# Rebuild từ đầu
docker build --no-cache -t itl-chatbot:latest .
```

---

### **Lỗi: Python package không tìm thấy**

```bash
# Kiểm tra packages đã cài
docker exec -it itl-chatbot pip list

# Rebuild backend stage
docker build --target backend-builder -t test .
```

---

## 📈 Tối ưu hóa

### **Giảm kích thước image**

- ✅ Dùng `alpine` cho Node.js
- ✅ Dùng `slim` cho Python
- ✅ Multi-stage build (chỉ copy kết quả cuối)
- ✅ `.dockerignore` để loại bỏ files không cần

### **Tăng tốc độ build**

- ✅ Copy `package.json` trước source code (tận dụng cache)
- ✅ Copy `pyproject.toml` trước source code
- ✅ Dùng UV thay vì pip (nhanh hơn 10-100x)

---

## 📝 Checklist trước khi deploy

- [ ] Đã test image locally
- [ ] Đã set `SECRET_KEY` mạnh
- [ ] Đã cấu hình MongoDB production
- [ ] Đã thêm API keys vào environment variables
- [ ] Đã test health check endpoint
- [ ] Đã setup backup cho MongoDB volumes
- [ ] Đã cấu hình reverse proxy (Nginx/Caddy) nếu cần HTTPS

---

## 🆘 Hỗ trợ

Nếu gặp vấn đề, kiểm tra:

1. **Logs:** `docker logs -f itl-chatbot`
2. **Health:** `curl http://localhost:8000/health`
3. **Container status:** `docker ps -a`
4. **Image size:** `docker images itl-chatbot`

---

**Built with ❤️ using Docker Multi-stage Build**
