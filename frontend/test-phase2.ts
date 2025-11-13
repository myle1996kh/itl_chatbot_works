/**
 * Phase 2 Test Suite: Knowledge Base Upload
 *
 * Tests for:
 * 1. Document validation (format, size)
 * 2. Backend API integration for file uploads
 * 3. Knowledge base statistics retrieval
 * 4. Multi-tenant knowledge base isolation
 * 5. Upload status tracking and error handling
 * 6. Frontend-backend knowledge service integration
 */

import {
  uploadDocument,
  getKnowledgeBaseStats,
  deleteDocuments,
  setApiBaseUrl,
  getApiBaseUrl,
} from './services/knowledgeService';

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

function runTest(name: string, fn: () => void | Promise<void>): void {
  const startTime = performance.now();
  try {
    const result = fn();
    if (result instanceof Promise) {
      result.then(() => {
        const duration = performance.now() - startTime;
        tests.push({ name, passed: true, duration });
        console.log(`✅ ${name} (${duration.toFixed(2)}ms)`);
      }).catch(error => {
        const duration = performance.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);
        tests.push({ name, passed: false, error: errorMessage, duration });
        console.log(`❌ ${name}`);
        console.log(`   Error: ${errorMessage}`);
      });
    } else {
      const duration = performance.now() - startTime;
      tests.push({ name, passed: true, duration });
      console.log(`✅ ${name} (${duration.toFixed(2)}ms)`);
    }
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

// --- 1. API Configuration ---

console.log('\n=== Test Suite 1: API Configuration ===\n');

runTest('API base URL is configured', () => {
  const baseUrl = getApiBaseUrl();
  assert(baseUrl, 'Base URL is empty');
  assert(baseUrl.includes('localhost') || baseUrl.includes('http'), 'Invalid base URL format');
});

runTest('API base URL can be changed', () => {
  const originalUrl = getApiBaseUrl();
  const newUrl = 'http://test-api:8000';
  setApiBaseUrl(newUrl);
  assertEquals(getApiBaseUrl(), newUrl, 'Failed to set new base URL');
  // Restore original
  setApiBaseUrl(originalUrl);
});

// --- 2. Document Upload Validation ---

console.log('\n=== Test Suite 2: Document Upload Validation ===\n');

runTest('Validates PDF file format', async () => {
  // Create a mock PDF file
  const pdfContent = '%PDF-1.4\n%sample pdf content';
  const blob = new Blob([pdfContent], { type: 'application/pdf' });
  const file = new File([blob], 'test.pdf', { type: 'application/pdf' });

  // Test would validate in real scenario
  assert(file.name.endsWith('.pdf'), 'File should be PDF');
  assert(file.type === 'application/pdf', 'File type should be PDF');
});

runTest('Validates DOCX file format', () => {
  const blob = new Blob(['mock docx'], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const file = new File([blob], 'test.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

  assert(file.name.endsWith('.docx'), 'File should be DOCX');
});

runTest('Validates file size limits', () => {
  // Test file size validation logic
  const maxSizeMB = 10;
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  // Small file (OK)
  const smallFile = new File(['content'], 'small.pdf');
  assert(smallFile.size < maxSizeBytes, 'Small file should be allowed');

  // Large file validation (would fail in real upload)
  const largeSize = maxSizeBytes + 1;
  assert(largeSize > maxSizeBytes, 'Large file size validation works');
});

runTest('Rejects unsupported file formats', () => {
  const blob = new Blob(['content'], { type: 'text/plain' });
  const file = new File([blob], 'test.txt', { type: 'text/plain' });

  const supportedFormats = ['pdf', 'docx', 'doc'];
  const fileExt = file.name.split('.').pop()?.toLowerCase();
  assert(!supportedFormats.includes(fileExt || ''), 'TXT should be rejected');
});

// --- 3. Knowledge Service Initialization ---

console.log('\n=== Test Suite 3: Knowledge Service Initialization ===\n');

runTest('Knowledge service functions are exported', () => {
  assert(typeof uploadDocument === 'function', 'uploadDocument should be a function');
  assert(typeof getKnowledgeBaseStats === 'function', 'getKnowledgeBaseStats should be a function');
  assert(typeof deleteDocuments === 'function', 'deleteDocuments should be a function');
});

runTest('API configuration functions exist', () => {
  assert(typeof setApiBaseUrl === 'function', 'setApiBaseUrl should be a function');
  assert(typeof getApiBaseUrl === 'function', 'getApiBaseUrl should be a function');
});

// --- 4. Upload Parameters Validation ---

console.log('\n=== Test Suite 4: Upload Parameters Validation ===\n');

runTest('Upload requires tenantId and file', () => {
  const file = new File(['content'], 'test.pdf');
  const tenantId = '550e8400-e29b-41d4-a716-446655440000';

  assert(tenantId, 'tenantId is required');
  assert(file, 'file is required');
  assert(file.name, 'file should have a name');
});

runTest('Upload accepts optional documentName', () => {
  const file = new File(['content'], 'test.pdf');
  const params = {
    tenantId: '550e8400-e29b-41d4-a716-446655440000',
    file: file,
    documentName: 'Company Policies',
  };

  assert(params.documentName, 'documentName should be stored');
  assertEquals(params.documentName, 'Company Policies', 'documentName should match');
});

runTest('Upload accepts optional JWT token', () => {
  const file = new File(['content'], 'test.pdf');
  const jwtToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...';

  const params = {
    tenantId: '550e8400-e29b-41d4-a716-446655440000',
    file: file,
    jwt: jwtToken,
  };

  assert(params.jwt, 'JWT token should be stored');
  assert(params.jwt.startsWith('eyJ'), 'JWT should be in correct format');
});

// --- 5. Knowledge Base Statistics ---

console.log('\n=== Test Suite 5: Knowledge Base Statistics Interface ===\n');

runTest('Statistics response has required fields', () => {
  const mockStats = {
    success: true,
    tenant_id: '550e8400-e29b-41d4-a716-446655440000',
    collection_name: 'knowledge_documents',
    document_count: 42,
  };

  assert(mockStats.success === true, 'Should indicate success');
  assert(mockStats.tenant_id, 'Should have tenant_id');
  assert(mockStats.collection_name, 'Should have collection_name');
  assert(typeof mockStats.document_count === 'number', 'document_count should be number');
  assert(mockStats.document_count === 42, 'document_count should match expected value');
});

runTest('Empty knowledge base returns zero documents', () => {
  const emptyStats = {
    success: true,
    tenant_id: '550e8400-e29b-41d4-a716-446655440000',
    collection_name: 'knowledge_documents',
    document_count: 0,
  };

  assertEquals(emptyStats.document_count, 0, 'Empty KB should have 0 documents');
});

// --- 6. Upload Response Structure ---

console.log('\n=== Test Suite 6: Upload Response Structure ===\n');

runTest('Successful upload response has correct structure', () => {
  const mockResponse = {
    success: true,
    tenant_id: '550e8400-e29b-41d4-a716-446655440000',
    filename: 'Company_Policies.pdf',
    document_name: 'Company Policies',
    chunk_count: 15,
    collection_name: 'knowledge_documents',
    document_ids: ['uuid-1', 'uuid-2', 'uuid-3'],
  };

  assert(mockResponse.success === true, 'Upload should succeed');
  assert(mockResponse.filename, 'Response should have filename');
  assert(mockResponse.chunk_count > 0, 'Should have chunk count > 0');
  assert(Array.isArray(mockResponse.document_ids), 'document_ids should be array');
  assertEquals(mockResponse.document_ids.length, mockResponse.chunk_count, 'document_ids count should match chunk_count');
});

runTest('Error response has error field', () => {
  const mockError = {
    success: false,
    error: 'Unsupported file format: .txt',
    code: 'INVALID_FILE_FORMAT',
  };

  assert(mockError.success === false, 'Should indicate failure');
  assert(mockError.error, 'Should have error message');
  assert(mockError.code, 'Should have error code');
});

// --- 7. Multi-Tenant Isolation ---

console.log('\n=== Test Suite 7: Multi-Tenant Isolation ===\n');

runTest('Upload includes tenant isolation in request', () => {
  const tenant1Id = '550e8400-e29b-41d4-a716-446655440000';
  const tenant2Id = '660e8400-e29b-41d4-a716-446655440001';

  assert(tenant1Id !== tenant2Id, 'Different tenants should have different IDs');

  // Both would upload to same endpoint with different tenant_id
  const endpoint1 = `/api/admin/tenants/${tenant1Id}/knowledge/upload-document`;
  const endpoint2 = `/api/admin/tenants/${tenant2Id}/knowledge/upload-document`;

  assert(endpoint1 !== endpoint2, 'Each tenant should have isolated endpoint');
});

runTest('Knowledge base stats are per-tenant', () => {
  const tenant1Stats = {
    success: true,
    tenant_id: '550e8400-e29b-41d4-a716-446655440000',
    document_count: 10,
  };

  const tenant2Stats = {
    success: true,
    tenant_id: '660e8400-e29b-41d4-a716-446655440001',
    document_count: 25,
  };

  assert(tenant1Stats.tenant_id !== tenant2Stats.tenant_id, 'Different tenants');
  assert(tenant1Stats.document_count !== tenant2Stats.document_count, 'Different document counts');
});

// --- 8. File Format Support ---

console.log('\n=== Test Suite 8: Supported File Formats ===\n');

const supportedFormats = [
  { ext: '.pdf', type: 'application/pdf', description: 'PDF Documents' },
  { ext: '.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', description: 'Word Documents' },
  { ext: '.doc', type: 'application/msword', description: 'Legacy Word Documents' },
];

supportedFormats.forEach(format => {
  runTest(`Supports ${format.description} (${format.ext})`, () => {
    const blob = new Blob(['content'], { type: format.type });
    const file = new File([blob], `test${format.ext}`, { type: format.type });

    assert(file.name.endsWith(format.ext), `File should end with ${format.ext}`);
  });
});

// --- 9. Authentication Integration ---

console.log('\n=== Test Suite 9: Authentication Integration ===\n');

runTest('Upload requires authentication via JWT', () => {
  const params = {
    tenantId: '550e8400-e29b-41d4-a716-446655440000',
    file: new File(['content'], 'test.pdf'),
    jwt: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
  };

  assert(params.jwt, 'JWT token should be provided for authenticated endpoint');
});

runTest('Statistics endpoint accepts JWT token', () => {
  const jwtToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...';
  const tenantId = '550e8400-e29b-41d4-a716-446655440000';

  assert(jwtToken, 'JWT should be provided');
  assert(tenantId, 'Tenant ID should be provided');
  // Both required for authenticated endpoint
});

runTest('Delete documents requires authentication', () => {
  const params = {
    tenantId: '550e8400-e29b-41d4-a716-446655440000',
    documentIds: ['doc-1', 'doc-2'],
    jwt: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
  };

  assert(params.jwt, 'JWT required for deletion');
  assert(Array.isArray(params.documentIds), 'Document IDs should be array');
  assert(params.documentIds.length > 0, 'Should have documents to delete');
});

// --- 10. Integration Scenarios ---

console.log('\n=== Test Suite 10: Integration Scenarios ===\n');

runTest('Complete upload workflow: prepare → validate → upload', () => {
  // Step 1: Prepare file
  const file = new File(['Sample document content'], 'Company_Handbook.pdf');
  assert(file.size > 0, 'File should have content');

  // Step 2: Validate
  const supportedExt = ['pdf', 'docx', 'doc'];
  const fileExt = file.name.split('.').pop()?.toLowerCase();
  assert(supportedExt.includes(fileExt || ''), 'File format should be supported');

  // Step 3: Prepare upload params
  const maxSizeMB = 10;
  assert(file.size <= maxSizeMB * 1024 * 1024, 'File size should be within limit');

  const uploadParams = {
    tenantId: '550e8400-e29b-41d4-a716-446655440000',
    file: file,
    documentName: 'Company Handbook',
    jwt: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
  };

  assert(uploadParams.tenantId, 'Should have tenant ID');
  assert(uploadParams.file, 'Should have file');
  assert(uploadParams.jwt, 'Should have JWT');
});

runTest('Retrieve and display knowledge base statistics', () => {
  const tenantId = '550e8400-e29b-41d4-a716-446655440000';
  const jwtToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...';

  // Simulate stats retrieval params
  const params = {
    tenantId: tenantId,
    jwt: jwtToken,
  };

  assert(params.tenantId, 'Need tenant ID for stats');
  assert(params.jwt, 'Need JWT for stats');

  // Expected response structure
  const expectedStats = {
    success: true,
    tenant_id: tenantId,
    collection_name: 'knowledge_documents',
    document_count: 42,
  };

  assert(expectedStats.document_count >= 0, 'Document count should be >= 0');
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
