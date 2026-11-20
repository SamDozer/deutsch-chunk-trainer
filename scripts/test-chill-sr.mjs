// Automated test for Spaced Repetition in Chill Mode
import { store } from '../src/js/store.js';

async function run() {
  console.log('--- Initializing Store ---');
  await store.init();

  const testId = 'A1-020';
  const chunk = store.chunk(testId);
  if (!chunk) throw new Error('Chunk A1-020 not found');

  console.log(`Testing chunk: ${testId}`);

  // Ensure clean slate
  const rec = store.record(testId);
  delete rec.srSchedule;
  delete rec.srOptOut;

  // 1. Initial state
  const infoInitial = store.getSrCardInfo(testId);
  console.log('Initial SR info:', infoInitial);
  if (infoInitial.enrolled) throw new Error('Should not be enrolled initially');

  // 2. Test enrollment
  const sch = store.enrollSrSchedule(testId);
  if (!sch || sch.currentStage !== 1) throw new Error('Enrollment failed to initialize stage 1');
  const infoAfterEnroll = store.getSrCardInfo(testId);
  console.log('After enroll info:', infoAfterEnroll);
  if (!infoAfterEnroll.enrolled || infoAfterEnroll.isDue) {
    throw new Error('Should be enrolled and not due immediately (due in 4 hours)');
  }
  console.log('✓ Manual enrollment verified');

  // 3. Test cancel / unenroll & resurrection prevention
  store.cancelSrSchedule(testId);
  const infoAfterCancel = store.getSrCardInfo(testId);
  if (infoAfterCancel.enrolled) throw new Error('Should not be enrolled after cancel');
  if (!rec.srOptOut) throw new Error('srOptOut flag must be true');

  // Simulate app restart / normalize
  rec.understand = { done: true, at: new Date().toISOString() };
  const normalized = store.normalizeRecord(rec);
  if (normalized.srSchedule !== null) {
    throw new Error('Resurrection bug detected! Canceled schedule was re-created during normalize');
  }
  console.log('✓ Descheduling & resurrection prevention verified');

  // 4. Test re-enrollment & due state simulation
  store.enrollSrSchedule(testId);
  // Set nextReviewAt to 1 hour ago
  rec.srSchedule.nextReviewAt = new Date(Date.now() - 3600000).toISOString();
  store.touch();

  const infoDue = store.getSrCardInfo(testId);
  console.log('Due simulated info:', infoDue);
  if (!infoDue.isDue) throw new Error('Simulated past date should make isDue true');
  console.log('✓ Due state detection verified');

  // 5. Test complete review in Chill Mode
  const reviewsCountBefore = (store.state.reviews || []).length;
  store.completeSrStage(testId, 'good');
  const infoAfterReview = store.getSrCardInfo(testId);
  console.log('After review info:', infoAfterReview);
  if (infoAfterReview.currentStage !== 2) {
    throw new Error('currentStage should advance to stage 2');
  }
  if (infoAfterReview.isDue) {
    throw new Error('Should no longer be due after review completion');
  }
  const reviewsCountAfter = (store.state.reviews || []).length;
  if (reviewsCountAfter !== reviewsCountBefore + 1) {
    throw new Error('Review was not appended to reviews log');
  }
  console.log('✓ Stage advancement & review logging verified');

  console.log('ALL CHILL MODE SPACED REPETITION LOGIC TESTS PASSED! 🎉');
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
