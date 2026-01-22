/**
 * Unit Tests for Momentum Calculator
 *
 * Run with: node --experimental-vm-modules server/tests/momentumCalculator.test.js
 */

import {
  calculateMomentum,
  getIntelligentClassification,
  generateClassificationReason,
  getIntentLevel,
  getIntentMultiplier,
  getTimeWeight,
  getScoreTier,
  MOMENTUM_THRESHOLDS,
  SURGE_THRESHOLD
} from '../utils/momentumCalculator.js';

// Simple test framework
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}`);
    failed++;
  }
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message} Expected ${expected}, got ${actual}`);
  }
}

function assertTrue(condition, message = '') {
  if (!condition) {
    throw new Error(message || 'Expected true, got false');
  }
}

// Helper to create activity at specific time
function createActivity(type, hoursAgo) {
  const timestamp = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
  return {
    activity_type: type,
    activity_timestamp: timestamp.toISOString()
  };
}

console.log('\n=== Momentum Calculator Tests ===\n');

// Test: getIntentLevel
console.log('--- Intent Level Tests ---');

test('getIntentLevel: pricing_page should be high intent', () => {
  assertEqual(getIntentLevel('pricing_page'), 'high');
});

test('getIntentLevel: demo_request should be high intent', () => {
  assertEqual(getIntentLevel('demo_request'), 'high');
});

test('getIntentLevel: product_page should be medium intent', () => {
  assertEqual(getIntentLevel('product_page'), 'medium');
});

test('getIntentLevel: case_study should be medium intent', () => {
  assertEqual(getIntentLevel('case_study'), 'medium');
});

test('getIntentLevel: page_view should be low intent', () => {
  assertEqual(getIntentLevel('page_view'), 'low');
});

test('getIntentLevel: unknown type should be low intent', () => {
  assertEqual(getIntentLevel('random_type'), 'low');
});

// Test: getIntentMultiplier
console.log('\n--- Intent Multiplier Tests ---');

test('getIntentMultiplier: high intent should return 3', () => {
  assertEqual(getIntentMultiplier('pricing_page'), 3);
});

test('getIntentMultiplier: medium intent should return 2', () => {
  assertEqual(getIntentMultiplier('product_page'), 2);
});

test('getIntentMultiplier: low intent should return 1', () => {
  assertEqual(getIntentMultiplier('page_view'), 1);
});

// Test: getTimeWeight
console.log('\n--- Time Weight Tests ---');

test('getTimeWeight: 0 hours ago should be 1.0', () => {
  assertEqual(getTimeWeight(0), 1.0);
});

test('getTimeWeight: 12 hours ago should be 1.0', () => {
  assertEqual(getTimeWeight(12), 1.0);
});

test('getTimeWeight: 48 hours ago should be 0.7', () => {
  assertEqual(getTimeWeight(48), 0.7);
});

test('getTimeWeight: 100 hours ago should be 0.4', () => {
  assertEqual(getTimeWeight(100), 0.4);
});

test('getTimeWeight: 200 hours ago should be 0.2', () => {
  assertEqual(getTimeWeight(200), 0.2);
});

test('getTimeWeight: 400 hours ago should be 0.05', () => {
  assertEqual(getTimeWeight(400), 0.05);
});

// Test: getScoreTier
console.log('\n--- Score Tier Tests ---');

test('getScoreTier: score 80 should be high', () => {
  assertEqual(getScoreTier(80), 'high');
});

test('getScoreTier: score 60 should be high', () => {
  assertEqual(getScoreTier(60), 'high');
});

test('getScoreTier: score 50 should be medium', () => {
  assertEqual(getScoreTier(50), 'medium');
});

test('getScoreTier: score 40 should be medium', () => {
  assertEqual(getScoreTier(40), 'medium');
});

test('getScoreTier: score 30 should be low', () => {
  assertEqual(getScoreTier(30), 'low');
});

test('getScoreTier: score 0 should be low', () => {
  assertEqual(getScoreTier(0), 'low');
});

// Test: calculateMomentum
console.log('\n--- Momentum Calculation Tests ---');

test('calculateMomentum: no activities should return 0 momentum', () => {
  const result = calculateMomentum([]);
  assertEqual(result.score, 0);
  assertEqual(result.level, 'none');
  assertEqual(result.actionsLast24h, 0);
});

test('calculateMomentum: single recent activity should return some momentum', () => {
  const activities = [createActivity('page_view', 1)];
  const result = calculateMomentum(activities);
  assertTrue(result.score > 0, 'Momentum score should be > 0');
  assertEqual(result.actionsLast24h, 1);
});

test('calculateMomentum: high-intent activity should have higher momentum', () => {
  const lowIntent = calculateMomentum([createActivity('page_view', 1)]);
  const highIntent = calculateMomentum([createActivity('pricing_page', 1)]);
  assertTrue(highIntent.score > lowIntent.score, 'High intent should have higher momentum');
});

test('calculateMomentum: recent activity should have higher momentum than old', () => {
  const recent = calculateMomentum([createActivity('page_view', 1)]);
  const old = calculateMomentum([createActivity('page_view', 100)]);
  assertTrue(recent.score > old.score, 'Recent activity should have higher momentum');
});

test('calculateMomentum: surge detection with 3+ actions in 1 hour', () => {
  const activities = [
    createActivity('page_view', 0.2),
    createActivity('pricing_page', 0.3),
    createActivity('demo_request', 0.5)
  ];
  const result = calculateMomentum(activities);
  assertTrue(result.surgeDetected, 'Surge should be detected');
  assertEqual(result.level, 'high');
});

test('calculateMomentum: counts activities in time windows correctly', () => {
  const activities = [
    createActivity('page_view', 5),    // Within 24h
    createActivity('page_view', 30),   // Within 72h
    createActivity('page_view', 50),   // Within 72h
    createActivity('page_view', 100),  // Within 7d
  ];
  const result = calculateMomentum(activities);
  assertEqual(result.actionsLast24h, 1);
  assertEqual(result.actionsLast72h, 3);
  assertEqual(result.actionsLast7d, 4);
});

test('calculateMomentum: tracks last high intent action', () => {
  const activities = [
    createActivity('page_view', 1),
    createActivity('pricing_page', 5),
    createActivity('page_view', 10)
  ];
  const result = calculateMomentum(activities);
  assertTrue(result.lastHighIntentAction !== null, 'Should track last high intent action');
});

// Test: getIntelligentClassification
console.log('\n--- Intelligent Classification Tests ---');

test('Classification: high score + high momentum = hot', () => {
  assertEqual(getIntelligentClassification(80, 'high'), 'hot');
});

test('Classification: high score + medium momentum = warm', () => {
  assertEqual(getIntelligentClassification(80, 'medium'), 'warm');
});

test('Classification: high score + no momentum = cold', () => {
  assertEqual(getIntelligentClassification(80, 'none'), 'cold');
});

test('Classification: medium score + high momentum = hot', () => {
  assertEqual(getIntelligentClassification(50, 'high'), 'hot');
});

test('Classification: medium score + medium momentum = warm', () => {
  assertEqual(getIntelligentClassification(50, 'medium'), 'warm');
});

test('Classification: medium score + no momentum = qualified', () => {
  assertEqual(getIntelligentClassification(50, 'none'), 'qualified');
});

test('Classification: low score + high momentum = warm', () => {
  assertEqual(getIntelligentClassification(20, 'high'), 'warm');
});

test('Classification: low score + medium momentum = qualified', () => {
  assertEqual(getIntelligentClassification(20, 'medium'), 'qualified');
});

test('Classification: low score + no momentum = cold', () => {
  assertEqual(getIntelligentClassification(20, 'none'), 'cold');
});

test('Classification: accepts momentum object', () => {
  const momentum = { level: 'high', score: 80 };
  assertEqual(getIntelligentClassification(50, momentum), 'hot');
});

// Test: generateClassificationReason
console.log('\n--- Classification Reason Tests ---');

test('Reason: surge detected should mention surge', () => {
  const reason = generateClassificationReason({
    score: 50,
    momentum: { level: 'high', surgeDetected: true, actionsLast24h: 5 },
    classification: 'hot'
  });
  assertTrue(reason.toLowerCase().includes('surge'), 'Should mention surge');
});

test('Reason: high momentum should mention active', () => {
  const reason = generateClassificationReason({
    score: 50,
    momentum: { level: 'high', surgeDetected: false, actionsLast24h: 3 },
    classification: 'hot'
  });
  assertTrue(reason.toLowerCase().includes('active') || reason.toLowerCase().includes('intent'),
    'Should mention active or intent');
});

test('Reason: no momentum with high score should mention re-engage', () => {
  const reason = generateClassificationReason({
    score: 80,
    momentum: { level: 'none', actionsLast7d: 0 },
    classification: 'cold'
  });
  assertTrue(reason.toLowerCase().includes('no recent activity') || reason.toLowerCase().includes('re-engage'),
    'Should mention no activity or re-engage');
});

// Summary
console.log('\n=== Test Summary ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total: ${passed + failed}`);

if (failed > 0) {
  console.log('\n❌ Some tests failed!');
  process.exit(1);
} else {
  console.log('\n✅ All tests passed!');
  process.exit(0);
}
