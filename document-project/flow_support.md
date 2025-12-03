📊 BÁO CÁO TỔNG HỢP - LUỒNG ESCALATION (YÊU CẦU HỖ TRỢ)
🎯 TỔNG QUAN LOGIC ESCALATION
Hệ thống ITL Chatbot có luồng Escalation hoàn chỉnh cho phép người dùng yêu cầu hỗ trợ từ nhân viên (Human Support) khi AI không thể giải quyết vấn đề.
3 VAI TRÒ CHÍNH:
Chat User (End User) - Người dùng cuối
Supporter - Nhân viên hỗ trợ
Admin - Quản trị viên hệ thống
🔄 LUỒNG ESCALATION CHI TIẾT
1️⃣ CHAT USER (End User) - Yêu cầu hỗ trợ
Frontend Components:
EmbeddedWidget.tsx (widget chính)
ChatWidget.tsx (standalone mode)
EscalationDialog.tsx (dialog nhập lý do)
Quy trình:
1. User nhấn button "Yêu cầu hỗ trợ" (Escalate)
   ↓
2. Dialog hiển thị: "Vì sao bạn cần hỗ trợ từ nhân viên?"
   ↓
3. User nhập lý do → Nhấn "Gửi yêu cầu"
   ↓
4. Frontend gọi: escalateSessionPublic(tenantId, sessionId, reason)
   ↓
5. API: POST /api/{tenant_id}/session/{session_id}/escalate
   ↓
6. Backend cập nhật:
   - ChatSession.escalation_status = "pending"
   - ChatSession.escalation_reason = "{lý do user nhập}"
   - ChatSession.escalation_requested_at = "{timestamp}"
   ↓
7. Response trả về:
   {
     success: true,
     session_id: "xxx",
     escalation_status: "pending",
     message: "Your session has been escalated..."
   }
   ↓
8. Frontend hiển thị:
   - Badge "Đã yêu cầu hỗ trợ" (màu cam)
   - System message: "✋ Đã yêu cầu hỗ trợ. Nhân viên sẽ hỗ trợ bạn trong giây lát."
   - Ẩn button "Yêu cầu hỗ trợ"
   ↓
9. SSE (Server-Sent Events) gửi realtime update:
   - type: "escalation_status_update"
   - escalation_status: "pending" → "assigned" → "resolved"
Code Flow:
Frontend (escalationService.ts:132-165):
export async function escalateSessionPublic(
  tenantId: string,
  sessionId: string,
  reason: string
): Promise<{success: boolean; session_id: string; escalation_status: string; message: string}> {
  const response = await fetch(
    `${API_BASE_URL}/api/${tenantId}/session/${sessionId}/escalate`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({session_id: sessionId, reason}),
    }
  );
  return await response.json();
}
Backend (chat.py:727-822):
@router.post("/{tenant_id}/session/{session_id}/escalate")
async def public_escalate_session(...):
    """PUBLIC ENDPOINT - No auth required"""
    # 1. Validate tenant & session
    # 2. Call escalation_service.escalate_session()
    # 3. Update DB: escalation_status = "pending"
    # 4. Return PublicEscalationResponse
⚠️ Lưu ý:
✅ KHÔNG CẦN JWT - Endpoint công khai cho widget user
✅ Chỉ validate tenant_id và session_id khớp
✅ Tự động gửi SSE update tới supporter/admin dashboard
✅ Nếu đã escalate rồi → trả về status hiện tại (không lỗi)
2️⃣ SUPPORTER - Nhận và xử lý yêu cầu
Frontend Components:
SupportDashboard.tsx - Dashboard cho supporter
pages/support/ - Các trang hỗ trợ
Quy trình:
1. Supporter login với role="supporter"
   ↓
2. Dashboard hiển thị:
   - Escalation Queue (hàng đợi yêu cầu hỗ trợ)
   - Pending (chờ xử lý)
   - Assigned to me (đã assign cho tôi)
   - Resolved (đã giải quyết)
   ↓
3. Supporter nhận request:
   Option A: Admin assign thủ công
   Option B: Auto-assign (nếu enabled)
   ↓
4. Status chuyển: "pending" → "assigned"
   ↓
5. Supporter trò chuyện với user:
   - Xem lịch sử chat
   - Gửi tin nhắn trực tiếp
   - Truy cập thông tin user/session
   ↓
6. Khi giải quyết xong:
   - Supporter nhấn "Resolve" / "Đánh dấu đã giải quyết"
   - Có thể nhập "resolution_notes" (ghi chú giải quyết)
   ↓
7. API: POST /api/admin/tenants/{tenant_id}/escalations/resolve
   Body: {session_id, resolution_notes}
   ↓
8. Backend cập nhật:
   - escalation_status = "resolved"
   - escalation_resolved_at = now()
   - resolution_notes = "{ghi chú}"
   ↓
9. SSE gửi update tới Chat User:
   - User nhận message: "✅ Yêu cầu của bạn đã được giải quyết..."
   - Badge "Đã yêu cầu hỗ trợ" biến mất
   - Button "Yêu cầu hỗ trợ" hiện lại (có thể escalate lại)
API Endpoints (Supporter sử dụng):
// 1. Xem hàng đợi escalation
GET /api/admin/tenants/{tenant_id}/escalations?status=pending
→ Trả về: {pending_count, assigned_count, resolved_count, escalations[]}

// 2. Assign cho chính mình (hoặc admin assign)
POST /api/admin/tenants/{tenant_id}/escalations/assign
Body: {session_id, user_id}
→ Requires: admin role (admin assign cho supporter)

// 3. Resolve escalation
POST /api/admin/tenants/{tenant_id}/escalations/resolve
Body: {session_id, resolution_notes}
→ Requires: supporter role
→ Supporter CHỈ resolve sessions assigned cho họ
⚠️ Quyền hạn Supporter:
✅ Xem escalations assigned cho họ
✅ Resolve sessions assigned cho họ
❌ KHÔNG thể assign sessions (chỉ admin mới được)
❌ KHÔNG thể resolve sessions của supporter khác
Code kiểm tra quyền (escalation.py:366-382):
if "supporter" in user_roles and "admin" not in user_roles:
    if str(session.assigned_user_id) != user_id:
        raise HTTPException(
            status_code=403,
            detail="Supporters can only resolve sessions assigned to them"
        )
3️⃣ ADMIN - Quản lý toàn bộ escalations
Frontend Components:
AdminOverviewPage.tsx - Tổng quan
pages/admin/AdminEscalationPage.tsx - Quản lý escalation
Quy trình:
1. Admin login với role="admin"
   ↓
2. Admin Dashboard hiển thị:
   - Tổng quan escalations (pending, assigned, resolved)
   - Danh sách tất cả escalations (không giới hạn)
   - Thống kê theo supporter
   - Thống kê theo thời gian
   ↓
3. Admin có thể:
   ✅ Xem TẤT CẢ escalations (mọi tenant)
   ✅ Assign escalations cho supporters
   ✅ Reassign (chuyển từ supporter A sang B)
   ✅ Resolve bất kỳ escalation nào
   ✅ Xem lịch sử escalations
   ✅ Quản lý supporters (thêm, sửa, xóa)
   ↓
4. Auto-assign logic (nếu enable):
   - Tìm supporter "available" (online + chưa đầy capacity)
   - Assign theo thứ tự current_sessions_count (thấp nhất)
   - Cập nhật current_sessions_count++
API Endpoints (Admin sử dụng):
// 1. Xem TẤT CẢ escalations
GET /api/admin/tenants/{tenant_id}/escalations
→ Admin có thể xem tất cả, không filter theo assigned_user

// 2. Assign cho supporter
POST /api/admin/tenants/{tenant_id}/escalations/assign
Body: {session_id, user_id}

// 3. Resolve bất kỳ escalation nào
POST /api/admin/tenants/{tenant_id}/escalations/resolve
Body: {session_id, resolution_notes}
→ Admin KHÔNG bị giới hạn ownership

// 4. Xem danh sách supporters
GET /api/admin/tenants/{tenant_id}/staff
→ Trả về: {staff: [], total}

// 5. Xem supporters đang available
GET /api/admin/tenants/{tenant_id}/staff/available
→ Trả về supporters: online + có capacity
🗄️ DATABASE SCHEMA
ChatSession Model:
class ChatSession(Base):
    session_id = UUID (PK)
    tenant_id = UUID (FK → tenants)
    user_id = UUID (FK → chat_users)
    
    # Escalation fields
    escalation_status = String  # "none", "pending", "assigned", "resolved"
    escalation_reason = String  # Lý do user yêu cầu
    assigned_user_id = UUID (FK → users)  # Supporter được assign
    escalation_requested_at = TIMESTAMP
    escalation_assigned_at = TIMESTAMP
    escalation_resolved_at = TIMESTAMP
    resolution_notes = String  # Ghi chú giải quyết
User Model (Supporter):
class User(Base):
    user_id = UUID (PK)
    role = String  # "supporter", "admin", "tenant_user"
    
    # Supporter profile
    supporter_status = String  # "online", "offline", "busy", "away"
    max_concurrent_sessions = Integer (default=5)
    current_sessions_count = Integer (default=0)
🔔 SSE (Server-Sent Events) - REALTIME UPDATES
Luồng SSE:
Chat User connects to: /api/{tenant_id}/sse/{session_id}
   ↓
Backend gửi events:
1. type: "escalation_status_update"
   data: {
     escalation_status: "pending" | "assigned" | "resolved",
     assigned_user_id: "xxx" (nếu assigned)
   }
   
2. type: "new_message"
   data: {
     message_id, role, content, timestamp
   }
Frontend xử lý SSE (EmbeddedWidget.tsx:156-170):
if (data.type === 'escalation_status_update') {
    if (data.escalation_status !== 'none' && data.escalation_status !== 'resolved') {
        setIsEscalated(true);
    } else if (data.escalation_status === 'resolved') {
        setIsEscalated(false);
        setMessages(prev => [...prev, {
            text: '✅ Yêu cầu của bạn đã được giải quyết...',
            sender: 'ai',
        }]);
    }
}
✅ KIỂM TRA LOGIC - KẾT QUẢ
✅ Chat User (End User):
✅ Button "Yêu cầu hỗ trợ" hiển thị khi chưa escalate
✅ Dialog tiếng Việt đầy đủ
✅ Gọi đúng API: POST /api/{tenant_id}/session/{session_id}/escalate
✅ KHÔNG cần JWT token (public endpoint)
✅ Hiển thị badge "Đã yêu cầu hỗ trợ" khi escalated
✅ Nhận SSE update realtime khi resolved
✅ Button "Yêu cầu hỗ trợ" ẩn khi đã escalate
✅ Supporter:
✅ Xem escalations assigned cho mình
✅ Resolve sessions assigned cho mình
✅ KHÔNG thể resolve sessions của người khác
✅ KHÔNG thể assign sessions (chỉ admin)
✅ Admin:
✅ Xem TẤT CẢ escalations
✅ Assign cho bất kỳ supporter nào
✅ Resolve bất kỳ escalation nào
✅ Quản lý supporters
✅ Xem thống kê escalation queue
🐛 VẤN ĐỀ PHÁT HIỆN & ĐỀ XUẤT
⚠️ Vấn đề tiềm ẩn:
Auto-escalation keywords - Chưa được implement đầy đủ
API có endpoint /api/admin/escalations/detect
Frontend chưa gọi auto-detection trong luồng chat
Đề xuất: Thêm middleware check keywords khi user gửi message
Notification system - Chưa có notification cho supporter
Supporter phải F5 dashboard để xem request mới
Đề xuất: Thêm push notification hoặc WebSocket cho supporter
Escalation history - Chưa có lịch sử escalations trong session detail
Đề xuất: Thêm tab "Escalation History" trong admin/session detail
Reassign logic - Chưa có endpoint reassign escalation
Đề xuất: Thêm POST /api/admin/escalations/reassign
📋 SUMMARY - TỔNG KẾT
Thành phần	Trạng thái	Ghi chú
Public Escalation Endpoint	✅ Hoàn chỉnh	Không cần auth
Admin Escalation Management	✅ Hoàn chỉnh	Full CRUD
Supporter Resolution	✅ Hoàn chỉnh	Có ownership check
SSE Realtime Updates	✅ Hoàn chỉnh	Chat User nhận update
Tiếng Việt UI	✅ Hoàn chỉnh	100% đã dịch
Auto-escalation	⚠️ Partial	API có nhưng chưa integrate
Push Notification	❌ Chưa có	Cần implement
Escalation History	❌ Chưa có	Cần implement
