/**
 * Test Agent Routing Logic
 * 
 * Run this in browser console to verify the fix
 */

import { getAgentNameFromMessage, detectTopic } from './src/config/topic-agent-mapping';

// Test cases
const testCases = [
    { message: 'Hỏi công nợ', expected: 'DebtAgent', topic: 'DEBT' },
    { message: 'Công nợ của tôi', expected: 'DebtAgent', topic: 'DEBT' },
    { message: 'Thanh toán hóa đơn', expected: 'DebtAgent', topic: 'DEBT' },
    { message: 'Hỗ trợ tôi', expected: 'GuidelineAgent', topic: 'SUPPORT' },
    { message: 'Câu hỏi chung', expected: 'SupervisorAgent', topic: 'GENERAL' },
    { message: 'Thông tin chung', expected: 'SupervisorAgent', topic: 'GENERAL' },
    { message: 'Hello', expected: 'SupervisorAgent', topic: null }, // Fallback
];

console.log('🧪 Testing Agent Routing Logic\n');

let passed = 0;
let failed = 0;

testCases.forEach(({ message, expected, topic }) => {
    const detectedTopic = detectTopic(message);
    const agentName = getAgentNameFromMessage(message);

    const topicMatch = topic === null ? detectedTopic === null : detectedTopic === topic;
    const agentMatch = agentName === expected;

    if (topicMatch && agentMatch) {
        console.log(`✅ PASS: "${message}"`);
        console.log(`   Topic: ${detectedTopic || 'null'}, Agent: ${agentName}\n`);
        passed++;
    } else {
        console.log(`❌ FAIL: "${message}"`);
        console.log(`   Expected: Topic=${topic}, Agent=${expected}`);
        console.log(`   Got: Topic=${detectedTopic}, Agent=${agentName}\n`);
        failed++;
    }
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
