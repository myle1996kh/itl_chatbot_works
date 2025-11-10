# Hướng dẫn cập nhật Notebook với Document Processor

## Vấn đề hiện tại:

### ❌ Notebook hiện tại (code đơn giản):
- Chunk method: Character-based đơn giản
- Avg chunk size: **85 chars** (quá nhỏ!)
- Không có overlap
- Content bị phân mảnh

### ✅ Production code (`document_processor.py`):
- RecursiveCharacterTextSplitter
- Chunk size: 600, overlap: 200
- Separators: paragraph → line → sentence → word
- Chunks có context đầy đủ

## Cần thay đổi trong Notebook:

### **Part 1.3: Replace với Document Processor**

Thay vì code chunking đơn giản, import và sử dụng production code:

```python
# Cell mới: Import production code
import sys
sys.path.insert(0, '../backend/src')

from src.services.document_processor import DocumentProcessor
from langchain_core.documents import Document as LangChainDocument

print("✅ Imported production document processor")
```

```python
# Cell 1.3: Sử dụng Document Processor (PRODUCTION CODE)
print(f"Processing with DocumentProcessor (production code)...")
print(f"Method: RecursiveCharacterTextSplitter")
print()

# Initialize processor với production settings
processor = DocumentProcessor(
    chunk_size=CHUNK_SIZE,      # 600
    chunk_overlap=CHUNK_OVERLAP  # 200
)

print(f"Processor configuration:")
print(f"  - Chunk size: {processor.chunk_size}")
print(f"  - Chunk overlap: {processor.chunk_overlap}")
print(f"  - Separators: {processor.separators}")
print()

# Load DOCX với section tracking (giống production)
langchain_documents = processor.load_docx(DOCUMENT_PATH)

print(f"✅ Loaded {len(langchain_documents)} paragraphs with metadata")
print(f"   Each has: section_title, section_number, page, style")
print()

# Chunk documents (RecursiveCharacterTextSplitter)
chunked_docs = processor.chunk_documents(
    langchain_documents,
    add_chunk_metadata=True
)

print(f"✅ Created {len(chunked_docs)} chunks")
print(f"   Average chunk size: {sum(len(c.page_content) for c in chunked_docs) // len(chunked_docs)} characters")
print(f"   Min: {min(len(c.page_content) for c in chunked_docs)} chars")
print(f"   Max: {max(len(c.page_content) for c in chunked_docs)} chars")

# Convert to simple format for compatibility
chunks = [doc.page_content for doc in chunked_docs]
metadata_list = [doc.metadata for doc in chunked_docs]

print(f"\n✅ Ready for embedding generation")
```

### **Part 1.4: Enhanced preview with comparison**

```python
# Show statistics by section
section_counts = {}
for meta in metadata_list:
    section = meta.get('section_title', 'Unknown')
    section_counts[section] = section_counts.get(section, 0) + 1

print(f"📊 Top 10 sections by chunk count:")
for section, count in sorted(section_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
    print(f"   {count:4d} chunks - {section[:80]}")

# Show chunk size distribution
chunk_sizes = [len(c) for c in chunks]
print(f"\n📊 Chunk size distribution:")
print(f"   Min: {min(chunk_sizes)} chars")
print(f"   Max: {max(chunk_sizes)} chars")
print(f"   Avg: {sum(chunk_sizes) // len(chunk_sizes)} chars")
print(f"   Median: {sorted(chunk_sizes)[len(chunk_sizes)//2]} chars")

# Show sample chunks with FULL content
print(f"\n📝 Sample chunks (first 3 - FULL CONTENT):")
for i in range(min(3, len(chunks))):
    print(f"\n{'='*100}")
    print(f"CHUNK {i+1}/{len(chunks)}")
    print(f"{'='*100}")

    # Metadata
    print(f"📌 Metadata:")
    print(f"   Section: {metadata_list[i].get('section_title', 'Unknown')}")
    print(f"   Section number: {metadata_list[i].get('section_number', 'N/A')}")
    print(f"   Page: {metadata_list[i].get('page', 'Unknown')}")
    print(f"   Chunk index: {metadata_list[i].get('chunk_index', 'N/A')}")
    print(f"   Length: {len(chunks[i])} chars")

    # FULL CONTENT
    print(f"\n📄 FULL CONTENT (text → embedding → database):")
    print(f"-" * 100)
    print(chunks[i])  # FULL, NO TRUNCATION
    print(f"-" * 100)

    # Show overlap with next chunk (if exists)
    if i < len(chunks) - 1 and CHUNK_OVERLAP > 0:
        # Find overlap
        overlap_text = ""
        for j in range(min(CHUNK_OVERLAP, len(chunks[i]))):
            if chunks[i][-j:] == chunks[i+1][:j]:
                overlap_text = chunks[i][-j:]

        if overlap_text:
            print(f"\n🔗 Overlap with next chunk ({len(overlap_text)} chars):")
            print(f"   \"{overlap_text[:100]}...\"")
```

### **Part 2.4: Add verification after retrieval**

Sau khi retrieve chunks, thêm cell verify:

```python
# Verify retrieved content quality
print(f"\n📊 RETRIEVED CHUNKS ANALYSIS:")
print(f"="*100)

for i, chunk in enumerate(retrieved_chunks, 1):
    content = chunk['content']
    metadata = chunk['metadata']

    print(f"\nChunk {i}:")
    print(f"  Distance: {chunk['distance']:.4f}")
    print(f"  Length: {len(content)} chars")
    print(f"  Section: {metadata.get('section_title', 'Unknown')}")
    print(f"  Has section_number: {'section_number' in metadata}")
    print(f"  Has chunk_index: {'chunk_index' in metadata}")

    # Check if content is meaningful (not too short)
    if len(content) < 50:
        print(f"  ⚠️ WARNING: Content too short (<50 chars)")
    elif len(content) < 200:
        print(f"  ⚠️ WARNING: Content short (<200 chars)")
    else:
        print(f"  ✅ Content length OK")
```

## So sánh kết quả:

### Before (simple chunking):
```
Total chunks: 4736
Avg chunk size: 85 chars  ← QUÁ NHỎ
Min: 1, Max: 400
```

### After (document_processor):
```
Total chunks: ~3200 (ít hơn nhưng chất lượng cao hơn)
Avg chunk size: ~400 chars  ← TỐT
Min: 50, Max: 800
With overlap: chunks có context liên kết
```

## Testing checklist:

- [ ] Import document_processor thành công
- [ ] Chunks có avg size >= 300 chars
- [ ] Chunks có section_title và section_number
- [ ] Chunks có overlap (nếu CHUNK_OVERLAP > 0)
- [ ] Retrieved chunks có đủ context để LLM hiểu
- [ ] LLM trả lời đầy đủ các bước trong quy trình

## Next steps:

1. Update notebook với code trên
2. Set `CHUNK_SIZE=600`, `CHUNK_OVERLAP=200`
3. Set `DELETE_OLD_DATA=True`, `SAVE_TO_DATABASE=True`
4. Chạy notebook để ingest lại
5. Test retrieval và LLM response
6. So sánh với kết quả cũ
