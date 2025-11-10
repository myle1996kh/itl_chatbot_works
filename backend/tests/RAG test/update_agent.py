"""Update agent prompt and add tool."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import psycopg2
from psycopg2.extras import RealDictCursor

# Database connection
conn = psycopg2.connect(
    host="localhost",
    port=5432,
    database="chatbot_itl",
    user="postgres",
    password="123456"
)
conn.autocommit = False
cur = conn.cursor(cursor_factory=RealDictCursor)

AGENT_ID = '0569db87-0208-4798-972c-b323942171a0'
TOOL_ID = '9dfbd691-2221-4ed6-99f0-4eff03b22386'

# New prompt that FORCES RAG tool usage
NEW_PROMPT = """VAI TRÒ
Bạn là trợ lý AI chuyên hướng dẫn sử dụng hệ thống eTMS (Transport Management System). Nhiệm vụ của bạn là trả lời các câu hỏi về quy trình, tính năng và cách thực hiện các thao tác trong hệ thống.

⚠️ QUY TẮC BẮT BUỘC - PHẢI TUÂN THỦ:
1. Với MỌI câu hỏi từ người dùng: BẮT BUỘC phải gọi tool "query_knowledge_base" để tra cứu knowledge base TRƯỚC KHI trả lời
2. KHÔNG BAO GIỜ trả lời dựa trên kiến thức chung hoặc suy đoán
3. CHỈ sử dụng thông tin từ kết quả tool "query_knowledge_base" trả về
4. Nếu tool không trả về kết quả hoặc trả về ít thông tin: Nói rõ "Không tìm thấy đủ thông tin trong knowledge base về vấn đề này"
5. LUÔN LUÔN gọi tool với query phù hợp trước khi đưa ra câu trả lời

NGUYÊN TẮC TRẢ LỜI:

Cấu trúc rõ ràng: Tổ chức câu trả lời theo format có thứ bậc với đánh số và đầu mục
Trích dẫn nguồn: Luôn nêu rõ thông tin lấy từ section nào (ví dụ: "Theo Section 2.3.3 Track and Trace")
Đầy đủ và chi tiết: Cung cấp đầy đủ các bước trong quy trình, không bỏ sót
Ngôn ngữ chuyên nghiệp: Sử dụng tiếng Việt chuẩn, thuật ngữ chính xác

CẤU TRÚC PHẢN HỒI CHUẨN:
1. **Mục Đích/Tổng Quan**: Giải thích ngắn gọn về chức năng hoặc quy trình
2. **Các Bước Thực Hiện**: Liệt kê chi tiết từng bước theo thứ tự
   - Bước 1: ...
   - Bước 2: ...
   - Bước N: ...
3. **Lưu Ý Quan Trọng**: Các điểm cần chú ý, hạn chế, điều kiện
4. **Ví Dụ Thực Tế** (nếu có trong knowledge base): Ví dụ minh họa cụ thể
5. **Tham Khảo**: Các section liên quan để tìm hiểu thêm

CÁCH GỌI TOOL:
- Sử dụng query tiếng Việt ngắn gọn, súc tích
- Với câu hỏi về quy trình: có thể dùng --full-section để lấy toàn bộ section
- Ví dụ: query_knowledge_base(query="tạo bảng giá bán LCL", top_k=5)

Luôn sử dụng tiếng Việt. Chuyên nghiệp, rõ ràng, chi tiết và đầy đủ."""

try:
    print("=" * 80)
    print("UPDATING AGENT")
    print("=" * 80)

    # 1. Update prompt
    print(f"\n1. Updating prompt for agent {AGENT_ID}...")
    cur.execute("""
        UPDATE agent_configs
        SET prompt_template = %s,
            updated_at = NOW()
        WHERE agent_id = %s
    """, (NEW_PROMPT, AGENT_ID))

    print(f"   ✅ Prompt updated successfully")

    # 2. Check if tool is already assigned
    print(f"\n2. Checking if tool {TOOL_ID} is already assigned...")
    cur.execute("""
        SELECT * FROM agent_tools
        WHERE agent_id = %s AND tool_id = %s
    """, (AGENT_ID, TOOL_ID))
    existing = cur.fetchone()

    if existing:
        print(f"   ℹ️  Tool already assigned (priority: {existing['priority']})")
    else:
        # Get max priority
        cur.execute("""
            SELECT COALESCE(MAX(priority), 0) as max_priority
            FROM agent_tools
            WHERE agent_id = %s
        """, (AGENT_ID,))
        result = cur.fetchone()
        next_priority = result['max_priority'] + 1 if result else 1

        # Add tool
        cur.execute("""
            INSERT INTO agent_tools (agent_id, tool_id, priority, created_at)
            VALUES (%s, %s, %s, NOW())
        """, (AGENT_ID, TOOL_ID, next_priority))

        print(f"   ✅ Tool added successfully (priority: {next_priority})")

    # Commit transaction
    conn.commit()

    print("\n" + "=" * 80)
    print("VERIFICATION")
    print("=" * 80)

    # Verify changes
    cur.execute("""
        SELECT name,
               LEFT(prompt_template, 200) as prompt_preview
        FROM agent_configs
        WHERE agent_id = %s
    """, (AGENT_ID,))
    agent = cur.fetchone()

    print(f"\nAgent: {agent['name']}")
    print(f"Updated Prompt Preview:")
    print(f"  {agent['prompt_preview']}...")

    # Get tools
    cur.execute("""
        SELECT tc.name, tc.tool_id, at.priority
        FROM tool_configs tc
        JOIN agent_tools at ON tc.tool_id = at.tool_id
        WHERE at.agent_id = %s
        ORDER BY at.priority
    """, (AGENT_ID,))
    tools = cur.fetchall()

    print(f"\nAssigned Tools:")
    if tools:
        for tool in tools:
            print(f"  - [{tool['priority']}] {tool['name']} ({tool['tool_id']})")
    else:
        print("  (No tools)")

    print("\n" + "=" * 80)
    print("✅ UPDATE COMPLETED SUCCESSFULLY")
    print("=" * 80)

except Exception as e:
    conn.rollback()
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
finally:
    cur.close()
    conn.close()
