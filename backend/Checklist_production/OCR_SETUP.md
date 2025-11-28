# OCR-Based Document Ingestion - Installation Guide

## Overview

This guide covers the setup for the new OCR-based document ingestion pipeline using:
- **PaddleOCR**: For text extraction from complex documents
- **ProtonX**: Vietnamese-optimized embeddings API
- **PostgreSQL + pgvector**: Same database as existing system

## Prerequisites

- Python 3.11+
- PostgreSQL 15+ with pgvector extension
- (Optional) CUDA-enabled GPU for faster OCR processing

## Installation Steps

### 1. Install Python Dependencies

```bash
cd backend

# Install OCR dependencies
pip install paddleocr paddlepaddle
pip install pdf2image pillow opencv-python

# For GPU support (optional)
# pip install paddlepaddle-gpu

# Install additional utilities
pip install requests
```

### 2. Install System Dependencies

#### Windows:
```powershell
# Install Poppler for PDF processing
# Download from: https://github.com/oschwartz10612/poppler-windows/releases
# Add to PATH
```

#### Linux:
```bash
sudo apt-get install poppler-utils
```

#### macOS:
```bash
brew install poppler
```

### 3. Configure ProtonX API

Add to your `.env` file:

```bash
# ProtonX Embeddings API
PROTONX_API_KEY=your_api_key_here
PROTONX_API_URL=https://api.protonx.co/v1/embeddings
```

Your API Key:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Im15bGUxOTk2a2hAZ21haWwuY29tIiwiaWF0IjoxNzYyMjMwODM1LCJleHAiOjE3NjQ4MjI4MzV9.wrWOCUGEC_4tWFWlehvkQPzCVPB6NvscfvX_q0SzaKU
```

### 4. Verify Installation

Run the notebook:

```bash
jupyter notebook notebook_ocr_ingest.ipynb
```

Or use VS Code with Jupyter extension.

## Usage

### Basic Usage

1. Open `notebook_ocr_ingest.ipynb`
2. Update configuration in Step 2:
   - `DOCUMENT_PATH`: Path to your document
   - `TENANT_ID`: Your tenant ID
   - `PROTONX_API_KEY`: Your ProtonX API key

3. Run all cells sequentially

### Supported File Types

- **PDF**: Full OCR support
- **DOCX**: Text extraction (OCR requires conversion)
- **Images**: PNG, JPG, JPEG, TIFF, BMP

### Key Features

- **Tenant Isolation**: All chunks tagged with `tenant_id`
- **OCR Tracking**: Marked with `source_detail: 'OCR method'`
- **Full RAG Pipeline**: Ingest → Retrieve → Generate
- **Comparison**: Compare OCR vs. standard extraction

## PaddleOCR MCP Server (Optional)

For advanced integration with Claude Desktop:

### Installation

```bash
pip install paddleocr-mcp
```

### Configuration

Add to Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "paddleocr": {
      "command": "paddleocr_mcp",
      "args": ["--verbose"],
      "env": {
        "PADDLEOCR_LANG": "vi"
      }
    }
  }
}
```

### Usage

Once configured, Claude Desktop can directly process images and documents using PaddleOCR.

See: https://www.paddleocr.ai/latest/en/version3.x/deployment/mcp_server.html

## Troubleshooting

### Issue: ProtonX API Error

**Solution**: 
- Verify API key is correct
- Check API endpoint URL
- Ensure API key hasn't expired
- Fallback to local embeddings if needed

### Issue: PaddleOCR Model Download Fails

**Solution**:
```bash
# Manually download models
python -c "from paddleocr import PaddleOCR; ocr = PaddleOCR(lang='vi')"
```

### Issue: PDF Conversion Error

**Solution**:
- Install Poppler (see system dependencies)
- Verify Poppler is in PATH
- Try with lower DPI: `convert_from_path(file_path, dpi=150)`

### Issue: Out of Memory

**Solution**:
- Process documents in smaller batches
- Reduce batch_size in embedding generation
- Use GPU if available
- Close other applications

## Performance Tips

1. **Use GPU**: Set `USE_GPU=True` for 5-10x speedup
2. **Batch Processing**: Process multiple documents in parallel
3. **Cache Models**: Models are cached after first load
4. **Optimize DPI**: Use 200-300 DPI for balance of quality/speed
5. **Filter Low Confidence**: Adjust OCR confidence threshold

## Next Steps

After testing the notebook:

1. **Refactor to Codebase**:
   - Create `src/services/ocr_processor.py`
   - Create `src/services/protonx_embeddings.py`
   - Add configuration options to `.env`

2. **Add to API**:
   - Create `/api/v1/documents/ingest-ocr` endpoint
   - Add OCR option to existing ingest endpoint
   - Update admin UI

3. **Production Deployment**:
   - Add error handling and retry logic
   - Implement monitoring and logging
   - Set up rate limiting for ProtonX API
   - Add cost tracking for API usage

## Resources

- **PaddleOCR Documentation**: https://github.com/PaddlePaddle/PaddleOCR
- **ProtonX Platform**: https://protonx.co/embeddings_models.html
- **MCP Server Guide**: https://www.paddleocr.ai/latest/en/version3.x/deployment/mcp_server.html
- **Notebook**: `backend/notebook_ocr_ingest.ipynb`
