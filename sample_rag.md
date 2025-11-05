import psycopg2
from psycopg2.extras import execute_batch
from docx import Document
from sentence_transformers import SentenceTransformer
import numpy as np
 
# =============================
# 1️⃣ KẾT NỐI POSTGRESQL
# =============================
conn = psycopg2.connect(
    host="localhost",
    port="5432",
    dbname="chatbot",
    user="postgres",
    password="sa"
)
cur = conn.cursor()
 
# Kích hoạt pgvector nếu chưa có
cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
 
# Tạo bảng có thêm metadata
cur.execute("""
CREATE TABLE IF NOT EXISTS doc_chunks (
    id SERIAL PRIMARY KEY,
    content TEXT,
    embedding vector(384),
    page_number INT,
    section_title TEXT
);
""")
conn.commit()
 
# =============================
# 2️⃣ XỬ LÝ FILE .DOCX LỚN
# =============================
def load_docx(path):
    doc = Document(path)
    paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
    return paragraphs
 
def chunk_text(text, size=400):
    """Chia văn bản thành các đoạn nhỏ (chunk) theo số từ."""
    words = text.split()
    return [" ".join(words[i:i+size]) for i in range(0, len(words), size)]
 
# Load nội dung file Word
doc = Document("eTMS.docx")
paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
print(f"👉 Tổng {len(paragraphs)} đoạn gốc từ file eTMS.docx")
 
# =============================
# 3️⃣ LẤY HEADING (SECTION TITLE)
# =============================
headings = []
for para in doc.paragraphs:
    if para.style.name.startswith("Heading"):
        headings.append(para.text.strip())
 
# =============================
# 4️⃣ CHIA THÀNH CÁC CHUNK
# =============================
chunks = []
meta_info = []  # để lưu (page_number, section_title)
for i, paragraph in enumerate(paragraphs):
    sub_chunks = chunk_text(paragraph)
    for chunk in sub_chunks:
        page_number = i // 10 + 1  # Giả định 10 đoạn ~ 1 trang
        # Xác định section gần nhất
        section_title = next((h for h in reversed(headings) if h in paragraph), "Không rõ")
        chunks.append(chunk)
        meta_info.append((page_number, section_title))
 
print(f"👉 Tổng {len(chunks)} đoạn nhỏ được tạo.")
 
# =============================
# 5️⃣ TẠO EMBEDDING VÀ LƯU THEO BATCH
# =============================
embedder = SentenceTransformer("all-MiniLM-L6-v2")
 
batch_size = 64
for i in range(0, len(chunks), batch_size):
    batch = chunks[i:i+batch_size]
    batch_meta = meta_info[i:i+batch_size]
    embeddings = embedder.encode(batch)
    
    data = []
    for j in range(len(batch)):
        content = batch[j]
        emb = embeddings[j].tolist()
        page_number, section_title = batch_meta[j]
        data.append((content, emb, page_number, section_title))
    
    execute_batch(
        cur,
        "INSERT INTO doc_chunks (content, embedding, page_number, section_title) VALUES (%s, %s, %s, %s)",
        data
    )
    conn.commit()
    print(f"✅ Đã lưu batch {i // batch_size + 1}/{len(chunks)//batch_size + 1}")
 
conn.close()
print("🎯 Hoàn tất lưu vector + metadata vào PostgreSQL!")