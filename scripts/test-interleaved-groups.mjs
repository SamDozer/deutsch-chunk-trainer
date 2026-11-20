// Automated verification test suite for Diverse / Interleaved Groups
import assert from 'node:assert/strict';
import { store } from '../src/js/store.js';

async function runTests() {
  console.log('=== Step 1: Initializing ChunkTrainer Store ===');
  await store.init();

  assert.equal(store.levels.length, 5, 'Must have exactly 5 CEFR levels (A1-C1)');
  assert.equal(store.byId.size, 1500, 'Must have exactly 1500 total chunks across all levels');

  const EXPECTED_LEVEL_CONFIG = {
    A1: { total: 200, groups: 25, capstoneSize: 8 },
    A2: { total: 250, groups: 31, capstoneSize: 10 },
    B1: { total: 300, groups: 37, capstoneSize: 12 },
    B2: { total: 400, groups: 50, capstoneSize: 8 },
    C1: { total: 350, groups: 43, capstoneSize: 14 },
  };

  console.log('\n=== Step 2: Testing Level Groups, Modulo-8 Capstones & Counts ===');
  for (const [levelId, expected] of Object.entries(EXPECTED_LEVEL_CONFIG)) {
    const level = store.level(levelId);
    assert.ok(level, `Level ${levelId} must exist`);
    assert.equal(level.chunks.length, expected.total, `Level ${levelId} must have ${expected.total} chunks`);

    const groups = store.getGroups(levelId);
    console.log(`Level ${levelId}: ${groups.length} groups (expected ${expected.groups}), chunks: ${level.chunks.length}`);
    assert.equal(groups.length, expected.groups, `Level ${levelId} must have exactly ${expected.groups} groups`);

    // Verify each standard group has 8 sentences, and final group has capstoneSize
    for (let i = 0; i < groups.length; i++) {
      const grp = groups[i];
      const isCapstone = i === groups.length - 1;
      const expectedSize = isCapstone ? expected.capstoneSize : 8;

      assert.equal(grp.chunks.length, expectedSize, `Group ${grp.id} must have ${expectedSize} chunks (got ${grp.chunks.length})`);
      assert.equal(grp.title, `المجموعة ${i + 1}`, `Group title must be "المجموعة ${i + 1}"`);
      assert.ok(grp.uniqueTemplatesCount >= Math.min(expectedSize, 6), `Group ${grp.id} must have high template diversity (got ${grp.uniqueTemplatesCount})`);
    }
  }

  console.log('\n=== Step 3: Testing Zero Consecutive Template Collisions ===');
  for (const level of store.levels) {
    let collisions = 0;
    for (let i = 1; i < level.chunks.length; i++) {
      const prev = level.chunks[i - 1];
      const curr = level.chunks[i];
      const prevKey = (prev.template || prev.family || prev.de.split(/\s+/).slice(0, 2).join(' ')).trim().toLowerCase();
      const currKey = (curr.template || curr.family || curr.de.split(/\s+/).slice(0, 2).join(' ')).trim().toLowerCase();
      if (prevKey === currKey) {
        collisions++;
        console.error(`Collision in ${level.id} at index ${i}: "${prev.id}" and "${curr.id}" share pattern "${currKey}"`);
      }
    }
    console.log(`Level ${level.id} consecutive pattern collisions: ${collisions}`);
    assert.equal(collisions, 0, `Level ${level.id} must have ZERO consecutive template collisions`);
  }

  console.log('\n=== Step 4: Testing Group Position & In-Group Navigation ===');
  const sampleLevel = store.level('A1');
  const group1 = store.getGroups('A1')[0];
  const firstChunk = group1.chunks[0];
  const middleChunk = group1.chunks[3];
  const lastChunk = group1.chunks[group1.chunks.length - 1];

  const posFirst = store.getGroupPosition(firstChunk.id);
  assert.equal(posFirst.position, 1, 'First chunk must be at position 1');
  assert.equal(posFirst.prevChunk, null, 'First chunk must have no prevChunk');
  assert.ok(posFirst.nextChunk, 'First chunk must have nextChunk');
  assert.equal(posFirst.nextChunk.id, group1.chunks[1].id, 'nextChunk must match 2nd sentence in group');

  const posMid = store.getGroupPosition(middleChunk.id);
  assert.equal(posMid.position, 4, 'Middle chunk must be at position 4');
  assert.ok(posMid.prevChunk, 'Middle chunk must have prevChunk');
  assert.ok(posMid.nextChunk, 'Middle chunk must have nextChunk');

  const posLast = store.getGroupPosition(lastChunk.id);
  assert.equal(posLast.position, group1.chunks.length, 'Last chunk position must equal group total');
  assert.equal(posLast.nextChunk, null, 'Last chunk must have no nextChunk (triggering group finale)');

  console.log('\n=== Step 5: Testing SRS, Progress & Mastery Tracking Preservation ===');
  const testId = 'A1-001';
  store.setUnderstand(testId, { func: 'طلب' });
  store.setSpeakPass(testId, 'slow', true);
  store.setSpeakPass(testId, 'natural', true);
  store.setSpeakPass(testId, 'blind', true);
  store.addProduction(testId, 10);
  store.setRecall(testId, 5, 5);
  store.record(testId).test.sprint.count = 5;
  store.record(testId).test.speaking.seconds = 30;

  const flags = store.stageFlags(testId);
  assert.ok(flags[0], 'Understand flag must be true');
  assert.ok(flags[1], 'Speak flag must be true');
  assert.ok(flags[2], 'Produce flag must be true');
  assert.ok(flags[3], 'Test recall flag must be true');

  // Verify group progress metrics
  const targetGroup = store.getGroupForChunk(testId);
  assert.ok(targetGroup, 'Target group must exist');
  assert.ok(targetGroup.learningCount >= 1, 'Group learningCount must update dynamically');

  console.log('\n=== Step 6: Testing Step 5 Group Finale & Variations ===');
  const gid = targetGroup.id;
  assert.equal(store.isGroupVariationDone(gid), false, 'Group variations initially not done');
  
  store.addGroupVariation(gid, 'words', 'Ich möchte einen Tee bitte.');
  store.addGroupVariation(gid, 'tense', 'Ich wollte einen Kaffee.');
  store.addGroupVariation(gid, 'subject', 'Wir möchten einen Kaffee.');
  store.addGroupVariation(gid, 'situation', 'Im Restaurant: Ich möchte einen Tisch.');
  store.addGroupVariation(gid, 'words', 'Ich möchte eine Cola.');

  assert.equal(store.getGroupVariations(gid).length, 5, 'Must have recorded 5 variations');
  assert.equal(store.isGroupVariationDone(gid), true, 'Group variation must now be done');

  console.log('\n>>> ALL INTERLEAVED GROUP VERIFICATION TESTS PASSED SUCCESSFULLY! <<<');
}

runTests().catch((err) => {
  console.error('\n❌ Test failed with error:', err);
  process.exit(1);
});
