"""
Update ProtonX service to correctly parse SDK response
"""
import json

# Read the notebook
with open('notebook_protonx_test.ipynb', 'r', encoding='utf-8') as f:
    notebook = json.load(f)

# Find and update the ProtonX service class
for i, cell in enumerate(notebook['cells']):
    if cell['cell_type'] == 'code' and 'source' in cell:
        source_text = ''.join(cell['source'])
        
        if 'class ProtonXEmbeddingService:' in source_text and 'def embed_text' in source_text:
            # Replace with corrected version
            cell['source'] = [
                "from protonx import ProtonX\n",
                "\n",
                "class ProtonXEmbeddingService:\n",
                "    \"\"\"Embedding service using ProtonX SDK for Vietnamese text.\"\"\"\n",
                "    \n",
                "    def __init__(self, api_key: str = None):\n",
                "        \"\"\"Initialize ProtonX client.\"\"\"\n",
                "        if api_key:\n",
                "            os.environ['PROTONX_API_KEY'] = api_key\n",
                "        \n",
                "        self.client = ProtonX()\n",
                "        self.dimension = None\n",
                "        \n",
                "    def embed_text(self, text: str) -> List[float]:\n",
                "        \"\"\"Generate embedding for single text.\"\"\"\n",
                "        try:\n",
                "            result = self.client.embeddings.create(text)\n",
                "            \n",
                "            # ProtonX SDK returns: {'data': [{'index': 0, 'embedding': [...]}], 'usage': {...}}\n",
                "            if isinstance(result, dict) and 'data' in result:\n",
                "                embedding = result['data'][0]['embedding']\n",
                "            else:\n",
                "                raise ValueError(f\"Unexpected ProtonX response format: {type(result)}\")\n",
                "            \n",
                "            # Set dimension on first call\n",
                "            if self.dimension is None:\n",
                "                self.dimension = len(embedding)\n",
                "            \n",
                "            return embedding\n",
                "            \n",
                "        except Exception as e:\n",
                "            print(f\"❌ ProtonX SDK Error: {e}\")\n",
                "            raise\n",
                "    \n",
                "    def embed_texts(self, texts: List[str], batch_size: int = 32) -> List[List[float]]:\n",
                "        \"\"\"Generate embeddings for multiple texts.\"\"\"\n",
                "        embeddings = []\n",
                "        for text in texts:\n",
                "            embedding = self.embed_text(text)\n",
                "            embeddings.append(embedding)\n",
                "        return embeddings\n",
                "    \n",
                "    def embed_documents(self, texts: List[str]) -> List[List[float]]:\n",
                "        \"\"\"LangChain compatibility.\"\"\"\n",
                "        return self.embed_texts(texts)\n",
                "    \n",
                "    def embed_query(self, text: str) -> List[float]:\n",
                "        \"\"\"LangChain compatibility.\"\"\"\n",
                "        return self.embed_text(text)\n",
                "    \n",
                "    def get_dimension(self) -> int:\n",
                "        \"\"\"Get embedding dimension.\"\"\"\n",
                "        if self.dimension is None:\n",
                "            self.embed_text(\"test\")\n",
                "        return self.dimension\n",
                "\n",
                "# Initialize and test\n",
                "print(\"Initializing ProtonX Embedding Service (using SDK)...\")\n",
                "protonx_service = ProtonXEmbeddingService(api_key=PROTONX_API_KEY)\n",
                "\n",
                "try:\n",
                "    test_embedding = protonx_service.embed_text(\"Xin chào Việt Nam\")\n",
                "    print(f\"✅ ProtonX SDK Ready\")\n",
                "    print(f\"   Dimension: {len(test_embedding)}\")\n",
                "    print(f\"   Sample values: {test_embedding[:5]}\")\n",
                "except Exception as e:\n",
                "    print(f\"⚠️  ProtonX SDK test failed: {e}\")\n",
                "    print(\"   Falling back to local embeddings...\")\n",
                "    from src.services.embedding_service import get_embedding_service\n",
                "    protonx_service = get_embedding_service()"
            ]
            print(f"✅ Updated ProtonX service with correct response parsing")
            break

# Write back
with open('notebook_protonx_test.ipynb', 'w', encoding='utf-8') as f:
    json.dump(notebook, f, indent=4, ensure_ascii=False)

print("✅ Notebook updated with correct ProtonX SDK response parsing")
print("   Response format: result['data'][0]['embedding']")
