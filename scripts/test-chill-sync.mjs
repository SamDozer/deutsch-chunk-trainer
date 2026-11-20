// Automated verification script for Chill Mode store synchronization and routing
import { store } from '../src/js/store.js';
import { isChillDone } from '../src/js/screens/chill.js';

async function runTest() {
  console.log('--- Initializing Store ---');
  await store.init();
  console.log(`Store initialized with ${store.levels.length} levels, total chunks: ${store.byId.size}`);

  // Test chunk A1-001
  const testId = 'A1-001';
  const chunk = store.chunk(testId);
  if (!chunk) throw new Error(`Chunk ${testId} not found`);

  console.log(`Testing chunk: ${chunk.id} — ${chunk.de}`);
  const recInitial = store.record(testId);
  const initialChillDone = isChillDone(testId);
  console.log(`Initial chill done state: ${initialChillDone}`);

  // 1. Test Step 1 read check
  store.toggleUnderstandCheck(testId, 'read');
  const recAfterRead = store.peek(testId);
  if (!recAfterRead.understand.checks?.read) {
    throw new Error('Step 1 read check failed to persist in store');
  }
  console.log('✓ Step 1 read check verified');

  // 2. Test Step 2 speak passes
  store.setSpeakPass(testId, 'slow', true);
  store.setSpeakPass(testId, 'natural', true);
  store.setSpeakPass(testId, 'blind', true);
  const recAfterSpeak = store.peek(testId);
  if (!recAfterSpeak.speak?.passes?.slow || !recAfterSpeak.speak?.passes?.natural || !recAfterSpeak.speak?.passes?.blind) {
    throw new Error('Step 2 speak passes failed to persist');
  }
  const flags = store.stageFlags(testId);
  if (!flags[1]) {
    throw new Error('Step 2 (speak) stage flag was not automatically marked completed!');
  }
  console.log('✓ Step 2 pronunciation passes & stageFlag[1] completion verified');

  // 3. Test Step 4 recall pass
  store.setRecall(testId, 5, 5);
  const recAfterRecall = store.peek(testId);
  if (!recAfterRecall.test?.recall?.passed || recAfterRecall.test?.recall?.score !== 5) {
    throw new Error('Step 4 recall failed to persist or pass');
  }
  console.log('✓ Step 4 quick recall (5/5) verified');

  // 4. Verify isChillDone
  const chillDoneNow = isChillDone(testId);
  if (!chillDoneNow) {
    throw new Error('isChillDone should return true after completing all 5 chill exercises!');
  }
  console.log('✓ isChillDone verified as true');

  // 5. Verify status transition
  const currentStatus = store.status(testId);
  console.log(`Chunk status is now: ${currentStatus} (completedCount: ${store.completedCount(testId)})`);
  if (currentStatus !== 'learning' && currentStatus !== 'mastered') {
    throw new Error(`Unexpected status: ${currentStatus}`);
  }

  // 6. Verify level stats reflect the change
  const a1Stats = store.levelStats('A1');
  console.log(`A1 level stats: total=${a1Stats.total}, learning=${a1Stats.learning}, mastered=${a1Stats.mastered}`);
  if (a1Stats.learning < 1 && a1Stats.mastered < 1) {
    throw new Error('Level stats did not reflect the updated chunk');
  }
  console.log('✓ Level stats reflection verified');

  console.log('ALL CHILL MODE VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉');
}

runTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
