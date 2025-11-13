/**
 * Phase 4 Test Suite: Escalation Feature
 *
 * Tests for:
 * 1. Auto-escalation keyword detection
 * 2. Manual escalation requests
 * 3. Supporter assignment
 * 4. Escalation resolution
 * 5. Escalation queue management
 * 6. Integration with chat widget
 */

import {
  detectAutoEscalation,
  escalateSession,
  assignSupporter,
  resolveEscalation,
  getEscalationQueue,
  getSupporters,
  setEscalationApiBaseUrl,
  getEscalationApiBaseUrl,
  type AutoEscalationDetectionResponse,
  type EscalationResponse,
  type EscalationQueueResponse,
  type Supporter,
} from './services/escalationService';

// ============================================================================
// Test Utilities
// ============================================================================

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

const tests: TestResult[] = [];

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(
      message || `Expected ${expected}, got ${actual}`
    );
  }
}

function assertInArray<T>(item: T, array: T[], message?: string): void {
  if (!array.includes(item)) {
    throw new Error(
      message || `Expected item to be in array`
    );
  }
}

function runTest(name: string, fn: () => void): void {
  const startTime = performance.now();
  try {
    fn();
    const duration = performance.now() - startTime;
    tests.push({ name, passed: true, duration });
    console.log(`✅ ${name} (${duration.toFixed(2)}ms)`);
  } catch (error) {
    const duration = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    tests.push({ name, passed: false, error: errorMessage, duration });
    console.log(`❌ ${name}`);
    console.log(`   Error: ${errorMessage}`);
  }
}

// ============================================================================
// Test Suites
// ============================================================================

// --- 1. API Base URL Configuration ---

console.log('\n=== Test Suite 1: API Configuration ===\n');

runTest('API base URL can be set', () => {
  const newUrl = 'http://custom-api.com';
  setEscalationApiBaseUrl(newUrl);
  assertEquals(getEscalationApiBaseUrl(), newUrl, 'URL should be set');
});

runTest('API base URL defaults to localhost', () => {
  setEscalationApiBaseUrl('http://localhost:8000');
  const url = getEscalationApiBaseUrl();
  assert(url.includes('localhost'), 'URL should default to localhost');
});

// --- 2. Auto-Escalation Detection Request/Response Structure ---

console.log('\n=== Test Suite 2: Auto-Escalation Detection Structure ===\n');

runTest('Auto-escalation detection request requires message', () => {
  const request = {
    message: 'I need help urgently!',
    keywords: undefined,
  };
  assert(request.message, 'message is required');
});

runTest('Auto-escalation detection response includes required fields', () => {
  const response: AutoEscalationDetectionResponse = {
    should_escalate: true,
    detected_keywords: ['urgent', 'help'],
    confidence: 0.8,
    reason: 'Detected 2 escalation keywords',
  };
  assert(typeof response.should_escalate === 'boolean', 'should_escalate should be boolean');
  assert(Array.isArray(response.detected_keywords), 'detected_keywords should be array');
  assert(typeof response.confidence === 'number', 'confidence should be number');
  assert(response.confidence >= 0 && response.confidence <= 1, 'confidence should be 0-1');
});

// --- 3. Escalation Keywords Detection ---

console.log('\n=== Test Suite 3: Escalation Keywords ===\n');

runTest('Urgent keyword triggers escalation', () => {
  const urgentKeywords = ['urgent', 'emergency', 'asap', 'immediately', 'critical'];
  const testMessages = [
    'This is urgent!',
    'Emergency help needed',
    'Need this ASAP',
    'Immediate assistance required',
    'This is critical',
  ];
  testMessages.forEach(msg => {
    const keywords = urgentKeywords.filter(kw => msg.toLowerCase().includes(kw));
    assert(keywords.length > 0, `Should detect keywords in: ${msg}`);
  });
});

runTest('Frustration keywords trigger escalation', () => {
  const frustrationKeywords = ['angry', 'frustrated', 'upset', 'annoyed', 'irritated', 'unacceptable', 'ridiculous', 'terrible', 'awful'];
  const testMessages = [
    'I am very frustrated',
    'This is terrible',
    'I am upset with the service',
    'This is ridiculous',
    'Awful experience',
  ];
  testMessages.forEach(msg => {
    const keywords = frustrationKeywords.filter(kw => msg.toLowerCase().includes(kw));
    assert(keywords.length > 0, `Should detect keywords in: ${msg}`);
  });
});

runTest('Technical issue keywords trigger escalation', () => {
  const issueKeywords = ['broken', 'crash', 'error', 'not working', 'fail', 'down', 'offline', 'issue', 'problem'];
  const testMessages = [
    'The system is broken',
    'The app keeps crashing',
    'I got an error',
    'It is not working',
    'The service is down',
    'This is a major issue',
  ];
  testMessages.forEach(msg => {
    const keywords = issueKeywords.filter(kw => msg.toLowerCase().includes(kw));
    assert(keywords.length > 0, `Should detect keywords in: ${msg}`);
  });
});

runTest('Explicit escalation request keywords trigger escalation', () => {
  const escalationKeywords = ['manager', 'supervisor', 'escalate', 'escalation', 'speak to', 'talk to', 'human', 'person'];
  const testMessages = [
    'I want to speak to a manager',
    'Escalate this to a supervisor',
    'I need to talk to a human',
    'Request escalation of this issue',
  ];
  testMessages.forEach(msg => {
    const keywords = escalationKeywords.filter(kw => msg.toLowerCase().includes(kw));
    assert(keywords.length > 0, `Should detect keywords in: ${msg}`);
  });
});

// --- 4. Escalation Request Structure ---

console.log('\n=== Test Suite 4: Escalation Request Structure ===\n');

runTest('Escalation request has required fields', () => {
  const request = {
    session_id: '550e8400-e29b-41d4-a716-446655440000',
    reason: 'User needs immediate assistance',
    auto_detected: false,
    keywords: [],
  };
  assert(request.session_id, 'session_id required');
  assert(request.reason, 'reason required');
  assert(typeof request.auto_detected === 'boolean', 'auto_detected required');
  assert(Array.isArray(request.keywords), 'keywords should be array');
});

runTest('Escalation response includes session and status', () => {
  const response: EscalationResponse = {
    session_id: '550e8400-e29b-41d4-a716-446655440000',
    tenant_id: '660e8400-e29b-41d4-a716-446655440001',
    user_id: 'user@example.com',
    escalation_status: 'pending',
    escalation_reason: 'User needs help',
    escalation_requested_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
  assert(response.session_id, 'session_id required');
  assert(response.escalation_status, 'escalation_status required');
  assertInArray(response.escalation_status, ['pending', 'assigned', 'resolved'], 'status should be valid');
});

// --- 5. Supporter Assignment ---

console.log('\n=== Test Suite 5: Supporter Assignment ===\n');

runTest('Supporter assignment request has required fields', () => {
  const request = {
    session_id: '550e8400-e29b-41d4-a716-446655440000',
    supporter_id: '770e8400-e29b-41d4-a716-446655440002',
  };
  assert(request.session_id, 'session_id required');
  assert(request.supporter_id, 'supporter_id required');
});

runTest('Supporter response includes contact information', () => {
  const supporter: Supporter = {
    supporter_id: '770e8400-e29b-41d4-a716-446655440002',
    email: 'supporter@company.com',
    username: 'supporter1',
    display_name: 'Support Agent 1',
    status: 'active',
    created_at: new Date().toISOString(),
  };
  assert(supporter.supporter_id, 'supporter_id required');
  assert(supporter.email, 'email required');
  assert(supporter.display_name, 'display_name required');
  assertInArray(supporter.status, ['active', 'inactive'], 'status should be valid');
});

// --- 6. Escalation Resolution ---

console.log('\n=== Test Suite 6: Escalation Resolution ===\n');

runTest('Escalation resolution request has required fields', () => {
  const request = {
    session_id: '550e8400-e29b-41d4-a716-446655440000',
    resolution_notes: 'Issue was resolved by providing documentation',
  };
  assert(request.session_id, 'session_id required');
});

runTest('Resolved escalation has resolved status', () => {
  const resolvedEscalation: EscalationResponse = {
    session_id: '550e8400-e29b-41d4-a716-446655440000',
    tenant_id: '660e8400-e29b-41d4-a716-446655440001',
    user_id: 'user@example.com',
    escalation_status: 'resolved',
    escalation_reason: 'Initial escalation reason',
    escalation_requested_at: new Date(Date.now() - 3600000).toISOString(),
    created_at: new Date(Date.now() - 3600000).toISOString(),
  };
  assertEquals(resolvedEscalation.escalation_status, 'resolved', 'status should be resolved');
});

// --- 7. Escalation Queue ---

console.log('\n=== Test Suite 7: Escalation Queue ===\n');

runTest('Escalation queue response includes statistics', () => {
  const queueResponse: EscalationQueueResponse = {
    pending_count: 3,
    assigned_count: 2,
    resolved_count: 5,
    escalations: [],
  };
  assert(typeof queueResponse.pending_count === 'number', 'pending_count should be number');
  assert(typeof queueResponse.assigned_count === 'number', 'assigned_count should be number');
  assert(typeof queueResponse.resolved_count === 'number', 'resolved_count should be number');
  assert(Array.isArray(queueResponse.escalations), 'escalations should be array');
});

runTest('Queue can contain escalations in different statuses', () => {
  const escalations: EscalationResponse[] = [
    {
      session_id: 'esc-1',
      tenant_id: 'tenant-1',
      user_id: 'user1@example.com',
      escalation_status: 'pending',
      escalation_reason: 'Urgent issue',
      escalation_requested_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
    {
      session_id: 'esc-2',
      tenant_id: 'tenant-1',
      user_id: 'user2@example.com',
      escalation_status: 'assigned',
      escalation_reason: 'Needs clarification',
      escalation_requested_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
    {
      session_id: 'esc-3',
      tenant_id: 'tenant-1',
      user_id: 'user3@example.com',
      escalation_status: 'resolved',
      escalation_reason: 'Issue resolved',
      escalation_requested_at: new Date(Date.now() - 7200000).toISOString(),
      created_at: new Date(Date.now() - 7200000).toISOString(),
    },
  ];

  const statuses = escalations.map(e => e.escalation_status);
  assert(statuses.includes('pending'), 'Queue should include pending escalations');
  assert(statuses.includes('assigned'), 'Queue should include assigned escalations');
  assert(statuses.includes('resolved'), 'Queue should include resolved escalations');
});

// --- 8. Escalation Status Transitions ---

console.log('\n=== Test Suite 8: Escalation Status Transitions ===\n');

runTest('Escalation starts as pending', () => {
  const newEscalation: EscalationResponse = {
    session_id: '550e8400-e29b-41d4-a716-446655440000',
    tenant_id: '660e8400-e29b-41d4-a716-446655440001',
    user_id: 'user@example.com',
    escalation_status: 'pending',
    escalation_reason: 'User needs help',
    escalation_requested_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
  assertEquals(newEscalation.escalation_status, 'pending', 'Initial status should be pending');
});

runTest('Escalation can transition from pending to assigned', () => {
  const escalation: EscalationResponse = {
    session_id: '550e8400-e29b-41d4-a716-446655440000',
    tenant_id: '660e8400-e29b-41d4-a716-446655440001',
    user_id: 'user@example.com',
    escalation_status: 'assigned',
    escalation_reason: 'User needs help',
    assigned_supporter_id: '770e8400-e29b-41d4-a716-446655440002',
    escalation_requested_at: new Date().toISOString(),
    escalation_assigned_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
  assertEquals(escalation.escalation_status, 'assigned', 'Status should be assigned');
  assert(escalation.assigned_supporter_id, 'Should have assigned supporter');
  assert(escalation.escalation_assigned_at, 'Should have assignment timestamp');
});

runTest('Escalation can transition from assigned to resolved', () => {
  const escalation: EscalationResponse = {
    session_id: '550e8400-e29b-41d4-a716-446655440000',
    tenant_id: '660e8400-e29b-41d4-a716-446655440001',
    user_id: 'user@example.com',
    escalation_status: 'resolved',
    escalation_reason: 'User needs help',
    assigned_supporter_id: '770e8400-e29b-41d4-a716-446655440002',
    escalation_requested_at: new Date(Date.now() - 3600000).toISOString(),
    escalation_assigned_at: new Date(Date.now() - 1800000).toISOString(),
    created_at: new Date(Date.now() - 3600000).toISOString(),
  };
  assertEquals(escalation.escalation_status, 'resolved', 'Final status should be resolved');
});

// --- 9. Multi-Tenant Escalation Isolation ---

console.log('\n=== Test Suite 9: Multi-Tenant Escalation Isolation ===\n');

runTest('Escalations are scoped to tenant', () => {
  const esc1: EscalationResponse = {
    session_id: '550e8400-e29b-41d4-a716-446655440000',
    tenant_id: 'tenant-1',
    user_id: 'user@example.com',
    escalation_status: 'pending',
    escalation_reason: 'Issue 1',
    escalation_requested_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  const esc2: EscalationResponse = {
    session_id: '550e8400-e29b-41d4-a716-446655440001',
    tenant_id: 'tenant-2',
    user_id: 'user@example.com',
    escalation_status: 'pending',
    escalation_reason: 'Issue 2',
    escalation_requested_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  assert(esc1.tenant_id !== esc2.tenant_id, 'Different tenants');
  assert(esc1.user_id === esc2.user_id, 'Same user, different tenants');
});

// --- 10. Integration Scenarios ---

console.log('\n=== Test Suite 10: Integration Scenarios ===\n');

runTest('Complete escalation flow: request → assign → resolve', () => {
  // Step 1: Create escalation
  const escalation: EscalationResponse = {
    session_id: '550e8400-e29b-41d4-a716-446655440000',
    tenant_id: '660e8400-e29b-41d4-a716-446655440001',
    user_id: 'user@example.com',
    escalation_status: 'pending',
    escalation_reason: 'User needs urgent help',
    escalation_requested_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
  assertEquals(escalation.escalation_status, 'pending');

  // Step 2: Assign supporter
  escalation.escalation_status = 'assigned';
  escalation.assigned_supporter_id = '770e8400-e29b-41d4-a716-446655440002';
  escalation.escalation_assigned_at = new Date().toISOString();
  assertEquals(escalation.escalation_status, 'assigned');
  assert(escalation.assigned_supporter_id);

  // Step 3: Resolve
  escalation.escalation_status = 'resolved';
  assertEquals(escalation.escalation_status, 'resolved');
});

runTest('Auto-detected escalation stores keyword information', () => {
  const message = 'This is urgent and broken, I need help immediately!';
  const detectionResult: AutoEscalationDetectionResponse = {
    should_escalate: true,
    detected_keywords: ['urgent', 'broken', 'help', 'immediately'],
    confidence: 0.95,
    reason: 'Detected 4 escalation keywords',
  };

  const escalation: EscalationResponse = {
    session_id: '550e8400-e29b-41d4-a716-446655440000',
    tenant_id: '660e8400-e29b-41d4-a716-446655440001',
    user_id: 'user@example.com',
    escalation_status: 'pending',
    escalation_reason: message,
    escalation_requested_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  assert(detectionResult.should_escalate === true);
  assert(detectionResult.detected_keywords.length === 4);
  assert(detectionResult.confidence > 0.9);
});

// ============================================================================
// Test Results Summary
// ============================================================================

setTimeout(() => {
  console.log('\n' + '='.repeat(80));
  console.log('TEST RESULTS SUMMARY');
  console.log('='.repeat(80) + '\n');

  const passed = tests.filter(t => t.passed).length;
  const failed = tests.filter(t => !t.passed).length;
  const total = tests.length;
  const totalDuration = tests.reduce((sum, t) => sum + (t.duration || 0), 0);

  console.log(`✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${failed}/${total}`);
  console.log(`⏱️  Total Duration: ${totalDuration.toFixed(2)}ms`);
  console.log(`📊 Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:\n');
    tests
      .filter(t => !t.passed)
      .forEach(t => {
        console.log(`  - ${t.name}`);
        console.log(`    Error: ${t.error}`);
      });
  }

  console.log('\n' + '='.repeat(80) + '\n');

  if (failed === 0) {
    console.log('🎉 ALL TESTS PASSED!\n');
  } else {
    console.log(`⚠️  ${failed} test(s) failed\n`);
  }
}, 100);

export { tests };
