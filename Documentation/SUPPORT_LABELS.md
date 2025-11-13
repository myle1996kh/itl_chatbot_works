# Support Labels & Task Categorization

**Purpose**: Track which types of issues/tasks require human (supporter) intervention
**Updated**: 2025-11-13

---

## Support Label Categories

Use these labels when creating messages/escalations/tasks to track support patterns.

### 1. **[ERROR]** - Product Bugs/Errors
Messages from supporters when something breaks or doesn't work as expected.

**Examples**:
- Endpoint returning 500 error
- Message not saving to database
- Authorization failing unexpectedly
- Session data inconsistent

**Query to find high-error tasks**:
```sql
SELECT COUNT(*), escalation_reason
FROM sessions
WHERE escalation_reason LIKE '%[ERROR]%'
GROUP BY escalation_reason
ORDER BY COUNT(*) DESC;
```

---

### 2. **[UNCLEAR]** - Ambiguous Requirements
When the requirement, documentation, or API specification is unclear/confusing.

**Examples**:
- API docs don't match actual behavior
- Spec contradicts previous design
- Edge cases not documented
- Requirements ambiguous

**Tracking**: High volume = fix documentation

---

### 3. **[SLOW]** - Performance Issues
When a task/endpoint is too slow or bottleneck.

**Examples**:
- GET sessions endpoint slow with many results
- Database query taking >2 seconds
- Message creation delayed
- Session lookup inefficient

**Tracking**: High volume = optimize queries

---

### 4. **[AUTH]** - Authorization/Permission Issues
When access control or permission checks fail.

**Examples**:
- Supporter can see sessions they're not assigned to
- User cannot access own session
- Role validation failing
- Tenant isolation broken

**Tracking**: High volume = review authorization logic

---

### 5. **[DATA]** - Data Consistency/Integrity Issues
When data is corrupted, missing, or inconsistent.

**Examples**:
- Message role is NULL when should be 'supporter'
- sender_user_id not set correctly
- session.assigned_user_id mismatched
- message_count incorrect

**Tracking**: High volume = add data validation

---

### 6. **[SCHEMA]** - Database Schema Issues
When database structure needs adjustment.

**Examples**:
- Missing index on frequently queried column
- Foreign key constraint missing
- Data type mismatch
- Migration failed

**Tracking**: High volume = schema redesign needed

---

### 7. **[GUIDELINE]** - Policy/Best Practice Violations
When code doesn't follow established patterns or guidelines.

**Examples**:
- Not using error handling pattern from chat.py
- Logging not structured (should use structlog)
- Type hints missing
- Missing docstrings

**Tracking**: High volume = update style guide or add linting

---

### 8. **[FEATURE]** - Feature Request/Enhancement
When user needs new functionality.

**Examples**:
- Want to filter sessions by date
- Need pagination for sessions
- Want to search message content
- Need typing indicators

**Tracking**: High volume = add to next phase

---

### 9. **[INTEGRATION]** - Third-party/External System Issues
When issue involves external services.

**Examples**:
- JWT validation failing
- Database connection timeout
- Redis cache inconsistent
- LLM API timeout

**Tracking**: High volume = check external service stability

---

### 10. **[TESTING]** - Test Coverage/Quality Issues
When test suite incomplete or failing.

**Examples**:
- Edge case not tested
- Mock data incorrect
- Test coverage <80%
- Integration test flaky

**Tracking**: High volume = improve test infrastructure

---

## How to Use Labels

### When Creating a Session/Message
```python
# In escalation_reason or metadata
escalation_reason = "[ERROR] Message not saving to database"
escalation_reason = "[SLOW] GET sessions endpoint timeout with 1000+ results"
escalation_reason = "[UNCLEAR] Should supporter see resolved sessions?"
escalation_reason = "[AUTH] Supporter can view sessions not assigned"
```

### In Code Comments
```python
def get_supporter_sessions(...):
    """
    Get sessions for supporter.

    [SLOW] TODO: Optimize query with proper indexing
    [GUIDELINE] TODO: Add structlog logging like chat.py
    """
```

### In Error Messages
```python
raise HTTPException(
    status_code=400,
    detail="[ERROR] Session not found - check database integrity"
)
```

### In Commit Messages
```bash
git commit -m "feat: Add supporter chat endpoints

[SCHEMA] Add index on sessions(assigned_user_id, escalation_status)
[GUIDELINE] Use structlog for all logging
[TESTING] Add 15 new unit tests for authorization
"
```

---

## Tracking Support Volume

### Daily Report Query
```sql
-- Find most common support labels
SELECT
  SUBSTRING(escalation_reason, 1, 10) as label,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (escalation_assigned_at - escalation_requested_at))) as avg_response_sec
FROM sessions
WHERE escalation_reason LIKE '[%'
  AND escalation_requested_at > NOW() - INTERVAL '24 hours'
GROUP BY label
ORDER BY count DESC;
```

### Weekly Trends
```sql
-- Track support volume by category over time
SELECT
  DATE(escalation_requested_at) as date,
  SUBSTRING(escalation_reason, 1, 10) as label,
  COUNT(*) as count
FROM sessions
WHERE escalation_reason LIKE '[%'
  AND escalation_requested_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(escalation_requested_at), label
ORDER BY date DESC, count DESC;
```

---

## Action Items by Label

### [ERROR] - High Volume?
- [ ] Review error logs
- [ ] Add more error handling
- [ ] Improve error messages
- [ ] Add error monitoring/alerting

### [UNCLEAR] - High Volume?
- [ ] Update API documentation
- [ ] Add code examples
- [ ] Create detailed spec
- [ ] Add inline comments

### [SLOW] - High Volume?
- [ ] Profile slow queries
- [ ] Add database indices
- [ ] Optimize data structures
- [ ] Cache frequently accessed data

### [AUTH] - High Volume?
- [ ] Audit authorization logic
- [ ] Add security tests
- [ ] Review access control rules
- [ ] Check tenant isolation

### [DATA] - High Volume?
- [ ] Add data validation
- [ ] Implement data integrity checks
- [ ] Create data cleanup script
- [ ] Add monitoring for data anomalies

### [SCHEMA] - High Volume?
- [ ] Review schema design
- [ ] Add missing indices
- [ ] Denormalize if needed
- [ ] Optimize queries

### [GUIDELINE] - High Volume?
- [ ] Update style guide
- [ ] Add pre-commit hooks (black, ruff, mypy)
- [ ] Auto-format code
- [ ] Code review focus

### [FEATURE] - High Volume?
- [ ] Evaluate ROI
- [ ] Add to product roadmap
- [ ] Plan implementation
- [ ] Prioritize by impact

### [INTEGRATION] - High Volume?
- [ ] Check external service status
- [ ] Add retry logic
- [ ] Implement circuit breaker
- [ ] Monitor external APIs

### [TESTING] - High Volume?
- [ ] Improve test infrastructure
- [ ] Add mock data generators
- [ ] Increase test coverage
- [ ] Add E2E tests

---

## Example: Tracking Supporter Chat Implementation

As you implement the 2 endpoints, label issues like:

```
Task: Implement GET /api/tenants/{tenant_id}/supporters/{supporter_id}/sessions

Issues Found:
- [GUIDELINE] Need to add structlog logging like chat.py does
- [SCHEMA] Add index on sessions(assigned_user_id, escalation_status) for performance
- [TESTING] Need unit tests for authorization logic
- [UNCLEAR] Spec doesn't say if pagination default should be 20 or 50 items

Notes:
- [SLOW] Query with 1000+ sessions takes 2 seconds, optimize later
- [FEATURE] Supporters asking for filter by date range (Phase 2)
```

This helps track:
- Which tasks have code quality issues (GUIDELINE)
- Which need optimization (SLOW, SCHEMA)
- Which need better docs (UNCLEAR)
- Which need more tests (TESTING)
- Which are legitimate enhancements (FEATURE)

---

## Reporting Dashboard (Future)

Once you use labels consistently, you can build reports:

```
Support Volume Report - Last 7 Days

[ERROR]      15 issues  - Highest priority
[SLOW]       12 issues  - Performance bottlenecks
[AUTH]       8 issues   - Security concerns
[TESTING]    6 issues   - Coverage gaps
[GUIDELINE]  5 issues   - Code quality
[UNCLEAR]    4 issues   - Documentation gaps
[SCHEMA]     3 issues   - Database optimization
[FEATURE]    2 issues   - Enhancements
[DATA]       1 issue    - Data integrity
[INTEGRATION] 0 issues  - External systems OK

Top Supporters Handling Issues:
- John: 18 issues (avg 45 min resolution)
- Sarah: 12 issues (avg 35 min resolution)
- Mike: 8 issues (avg 60 min resolution)
```

---

## Integration with Escalation System

### In Session Metadata
```python
escalation_reason = "Chat timeout when loading conversation"
session_metadata = {
    "support_label": "[SLOW]",
    "component": "chat_endpoint",
    "environment": "production",
    "affected_users": 3,
}
```

### In Message Thread
```sql
-- Find all issues labeled [SLOW] in last 24 hours
SELECT
  s.session_id,
  s.escalation_reason,
  COUNT(m.message_id) as conversation_length,
  MAX(m.timestamp) as last_update
FROM sessions s
LEFT JOIN messages m ON s.session_id = m.session_id
WHERE s.escalation_reason LIKE '%[SLOW]%'
  AND s.escalation_requested_at > NOW() - INTERVAL '24 hours'
GROUP BY s.session_id, s.escalation_reason
ORDER BY conversation_length DESC;
```

---

## Best Practices

1. **Be Specific**: `[ERROR] Message not saving` better than just `[ERROR]`
2. **One Label Per Issue**: Use first/most important label only
3. **Use Consistently**: All team members use same labels
4. **Review Weekly**: Analyze support label trends
5. **Act On Patterns**: High volume = action item

---

## Summary

Use labels to:
- ✅ **Track** what types of issues come up most
- ✅ **Identify** bottlenecks (SLOW, ERROR, SCHEMA)
- ✅ **Find** quality issues (GUIDELINE, TESTING)
- ✅ **Detect** gaps (UNCLEAR, FEATURE)
- ✅ **Monitor** critical issues (AUTH, DATA)
- ✅ **Report** to leadership with data

**Result**: Better prioritization, faster fixes, smarter development!
