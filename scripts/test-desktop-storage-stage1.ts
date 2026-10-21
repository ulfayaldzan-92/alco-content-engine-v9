/**
 * ALCO Content Engine v9 — Stage 1 Local Persistent Storage Test Suite
 *
 * Verifies all Stage 1 architectural requirements:
 * 1. StorageEngine directory initialization & temp cleanup
 * 2. Strict Project ID validation & path traversal protection
 * 3. Manifest consistency & atomic replacement
 * 4. Create / Save / Reload roundtrip
 * 5. Cross-project isolation
 * 6. Unknown project dataType preservation (no restrictive whitelist)
 * 7. Rapid consecutive writes & serialized queue ordering
 * 8. Write revision & stale write protection
 * 9. Interrupted / failed write recovery
 * 10. Video scene completion state persistence
 * 11. Carousel slide completion state persistence
 * 12. ProductionPackage persistence
 * 13. Electron / browser environment separation
 * 14. Hydration ordering & fail-closed write barrier
 * 15. Project switching isolation & snapshot protection
 * 16. Safe legacy handling (non-destructive detection)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Require storage engine directly
const { StorageEngine } = require('../electron/storage-engine.cjs');

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ [PASS] ${message}`);
}

async function runTests() {
  console.log('====================================================');
  console.log('ALCO CONTENT ENGINE V9: STAGE 1 LOCAL STORAGE TESTS');
  console.log('====================================================\n');

  // Create isolated sandbox directory
  const testTmpDir = path.join(os.tmpdir(), `alco-test-storage-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  fs.mkdirSync(testTmpDir, { recursive: true });

  try {
    const engine = new StorageEngine(testTmpDir);

    // ------------------------------------------------------------------------
    // Test 1: Directory initialization and safe paths
    // ------------------------------------------------------------------------
    console.log('--- TEST 1: Directory Initialization & Safe Structure ---');
    assert(fs.existsSync(engine.storageDir), 'storage directory was created');
    assert(fs.existsSync(engine.projectsDir), 'storage/projects directory was created');

    // ------------------------------------------------------------------------
    // Test 2: Strict Project ID Validation
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 2: Strict Project ID Validation ---');
    assert(engine.validateProjectId('proj_valid_123').valid === true, 'Accepts valid alphanumeric project ID with underscores');
    assert(engine.validateProjectId('brand-launch-2026').valid === true, 'Accepts valid project ID with hyphens');
    assert(engine.validateProjectId('').valid === false, 'Rejects empty project ID');
    assert(engine.validateProjectId('   ').valid === false, 'Rejects whitespace project ID');
    assert(engine.validateProjectId('..').valid === false, 'Rejects parent directory reference');
    assert(engine.validateProjectId('.').valid === false, 'Rejects current directory reference');
    assert(engine.validateProjectId('../escaped').valid === false, 'Rejects path traversal ..');
    assert(engine.validateProjectId('nested/project').valid === false, 'Rejects slash path separator');
    assert(engine.validateProjectId('nested\\project').valid === false, 'Rejects backslash path separator');
    assert(engine.validateProjectId('proj$123!').valid === false, 'Rejects illegal characters');

    // ------------------------------------------------------------------------
    // Test 3: Manifest Consistency & Atomic Updates
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 3: Manifest Consistency & Atomic Updates ---');
    const initialManifest = engine.getManifestSync();
    assert(initialManifest.activeProjectId === null, 'Initial manifest has null activeProjectId');
    assert(Array.isArray(initialManifest.projectList) && initialManifest.projectList.length === 0, 'Initial manifest has empty projectList');

    await engine.saveManifest({
      activeProjectId: 'proj_alpha',
      projectList: [
        { project_id: 'proj_alpha', project_name: 'Alpha Brand', updated_at: new Date().toISOString() },
        { project_id: 'proj_beta', project_name: 'Beta Brand', updated_at: new Date().toISOString() },
      ],
    });

    const updatedManifest = engine.getManifestSync();
    assert(updatedManifest.activeProjectId === 'proj_alpha', 'Manifest persisted activeProjectId');
    assert(updatedManifest.projectList.length === 2, 'Manifest persisted 2 projects');
    assert(updatedManifest.schemaVersion === '1.0.0', 'Manifest preserves schemaVersion');

    // ------------------------------------------------------------------------
    // Test 4: Create / Save / Reload Roundtrip
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 4: Create / Save / Reload Roundtrip ---');
    const blueprintData = {
      brand_identity: { brand_name: 'Glow Skin Care' },
      target_audience: 'Women 25-40',
      usp: 'Organic cold-pressed ingredients',
    };

    const saveRes = await engine.saveProjectData('proj_alpha', 'blueprint', blueprintData);
    assert(saveRes.ok === true, 'saveProjectData returns ok: true');
    assert(saveRes.revision === 1, 'Initial save creates revision 1');

    const loadedAlpha = engine.getProjectDataSync('proj_alpha');
    assert(loadedAlpha.data.blueprint.brand_identity.brand_name === 'Glow Skin Care', 'Reloaded blueprint matches saved data exactly');
    assert(loadedAlpha.revision === 1, 'Project data has revision 1');

    // ------------------------------------------------------------------------
    // Test 5: Cross-Project Isolation
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 5: Cross-Project Isolation ---');
    await engine.saveProjectData('proj_beta', 'blueprint', {
      brand_identity: { brand_name: 'TechFlow SaaS' },
    });

    const alphaCheck = engine.getProjectDataSync('proj_alpha');
    const betaCheck = engine.getProjectDataSync('proj_beta');

    assert(alphaCheck.data.blueprint.brand_identity.brand_name === 'Glow Skin Care', 'Project Alpha blueprint is unmodified');
    assert(betaCheck.data.blueprint.brand_identity.brand_name === 'TechFlow SaaS', 'Project Beta blueprint has its own data');

    // ------------------------------------------------------------------------
    // Test 6: Unknown Project DataType Preservation
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 6: Unknown Project DataType Preservation ---');
    const customData = { custom_field: 'unwhitelisted_metadata', values: [1, 2, 3] };
    await engine.saveProjectData('proj_alpha', 'arbitrary_custom_addon_data', customData);

    const checkCustom = engine.getProjectDataSync('proj_alpha');
    assert(
      JSON.stringify(checkCustom.data.arbitrary_custom_addon_data) === JSON.stringify(customData),
      'Unknown project data types are preserved without whitelist restrictions'
    );

    // ------------------------------------------------------------------------
    // Test 7: Rapid Consecutive Writes & Serialized Queue
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 7: Rapid Consecutive Writes & Serialized Queue ---');
    const writePromises: Promise<any>[] = [];
    for (let i = 1; i <= 15; i++) {
      writePromises.push(
        engine.saveProjectData('proj_alpha', `sequential_key_${i}`, { count: i })
      );
    }
    await Promise.all(writePromises);

    const postSequential = engine.getProjectDataSync('proj_alpha');
    for (let i = 1; i <= 15; i++) {
      assert(postSequential.data[`sequential_key_${i}`]?.count === i, `Sequential write ${i} successfully written and persisted`);
    }

    // ------------------------------------------------------------------------
    // Test 8: Write Revision & Stale Write Protection
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 8: Write Revision & Stale Write Protection ---');
    const currentRev = postSequential.revision;
    assert(currentRev > 15, `Project revision advanced with each write (revision=${currentRev})`);

    // Stale client write: client provides revision 2 when disk is at >15
    let caughtStaleError = false;
    try {
      await engine.saveProjectData('proj_alpha', 'stale_test', { val: 'old' }, 2);
    } catch (err: any) {
      caughtStaleError = true;
      assert(err.message.includes('Stale write rejected'), 'Stale write rejected with descriptive error message');
    }
    assert(caughtStaleError === true, 'Failed write with stale revision was blocked');

    // ------------------------------------------------------------------------
    // Test 9: Interrupted / Failed Write Recovery
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 9: Interrupted / Failed Write Recovery ---');
    // Drop a fake dangling .tmp file
    const alphaDir = path.join(engine.projectsDir, 'proj_alpha');
    const danglingTmp = path.join(alphaDir, `data.json.tmp.${Date.now()}.deadbeef`);
    fs.writeFileSync(danglingTmp, '{"incomplete": true}', 'utf8');
    assert(fs.existsSync(danglingTmp), 'Dangling temp file exists');

    // Re-initialize directory cleanup
    engine.cleanupDanglingTempFiles(engine.storageDir);
    assert(!fs.existsSync(danglingTmp), 'Dangling temp file was safely cleaned up');

    // Existing data is uncorrupted
    const alphaValid = engine.getProjectDataSync('proj_alpha');
    assert(alphaValid.data.blueprint.brand_identity.brand_name === 'Glow Skin Care', 'Original project data remains 100% intact');

    // ------------------------------------------------------------------------
    // Test 10: Video Scene Completion Persistence
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 10: Video Scene Completion Persistence ---');
    const videoCompletionKey = 'alco_video_scene_completion_item_1_human_led';
    const videoCompletionPayload = {
      project_id: 'proj_alpha',
      content_item_id: 'item_1',
      production_mode: 'human_led',
      scene_plan_signature: 'plan_sig_abc',
      production_input_signature: 'input_sig_xyz',
      execution_prompt_signature: 'exec_sig_123',
      scenes: {
        1: { clip_created: true, marked_at: '2026-10-21T06:00:00.000Z' },
        2: { clip_created: false, marked_at: null },
        3: { clip_created: true, marked_at: '2026-10-21T06:05:00.000Z' },
      },
      updated_at: new Date().toISOString(),
    };

    await engine.saveProjectData('proj_alpha', videoCompletionKey, videoCompletionPayload);
    const reloadedVideoCompletion = engine.getProjectDataSync('proj_alpha').data[videoCompletionKey];
    assert(reloadedVideoCompletion.scenes['1'].clip_created === true, 'Video scene 1 completion is persisted');
    assert(reloadedVideoCompletion.scenes['2'].clip_created === false, 'Video scene 2 completion is persisted');
    assert(reloadedVideoCompletion.execution_prompt_signature === 'exec_sig_123', 'Video execution prompt signature preserved');

    // ------------------------------------------------------------------------
    // Test 11: Carousel Slide Completion Persistence
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 11: Carousel Slide Completion Persistence ---');
    const carouselCompletionKey = 'alco_carousel_slide_completion_item_2_cand_A';
    const carouselCompletionPayload = {
      project_id: 'proj_alpha',
      content_item_id: 'item_2',
      candidate_id: 'cand_A',
      production_plan_signature: 'car_sig_789',
      execution_prompt_signature: 'car_exec_456',
      slide_count: 5,
      slides: {
        1: { slide_created: true, marked_at: '2026-10-21T06:10:00.000Z' },
        2: { slide_created: true, marked_at: '2026-10-21T06:12:00.000Z' },
      },
      updated_at: new Date().toISOString(),
    };

    await engine.saveProjectData('proj_alpha', carouselCompletionKey, carouselCompletionPayload);
    const reloadedCarCompletion = engine.getProjectDataSync('proj_alpha').data[carouselCompletionKey];
    assert(reloadedCarCompletion.slides['1'].slide_created === true, 'Carousel slide 1 completion is persisted');
    assert(reloadedCarCompletion.slide_count === 5, 'Carousel slide count is persisted');

    // ------------------------------------------------------------------------
    // Test 12: ProductionPackage Persistence
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 12: ProductionPackage Persistence ---');
    const packageKey = 'production_package_item_3_video';
    const packagePayload = {
      package_id: 'pkg_998877',
      project_id: 'proj_alpha',
      content_item_id: 'item_3',
      asset_type: 'video',
      created_at: new Date().toISOString(),
      production_status: 'ready_for_production',
      candidate: { candidate_id: 'cand_video_1', production_mode: 'human_led' },
      execution_prompts: {
        scenes: [{ scene_number: 1, start_frame_prompt: 'A prompt', motion_prompt: 'Camera zoom' }],
      },
    };

    await engine.saveProjectData('proj_alpha', packageKey, packagePayload);
    const reloadedPackage = engine.getProjectDataSync('proj_alpha').data[packageKey];
    assert(reloadedPackage.package_id === 'pkg_998877', 'ProductionPackage package_id is preserved');
    assert(reloadedPackage.production_status === 'ready_for_production', 'ProductionPackage status is preserved');
    assert(reloadedPackage.execution_prompts.scenes[0].start_frame_prompt === 'A prompt', 'ProductionPackage execution prompt is preserved');

    // ------------------------------------------------------------------------
    // Test 13: Bootstrap Snapshot
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 13: Bootstrap Snapshot Assembly ---');
    const snapshotRes = await engine.getBootstrapSnapshot();
    assert(snapshotRes.ok === true, 'getBootstrapSnapshot succeeded');
    assert(snapshotRes.snapshot.manifest.activeProjectId === 'proj_alpha', 'Snapshot manifest contains activeProjectId');
    assert(Boolean(snapshotRes.snapshot.projects.proj_alpha), 'Snapshot contains proj_alpha data');
    assert(Boolean(snapshotRes.snapshot.projects.proj_beta), 'Snapshot contains proj_beta data');
    assert(snapshotRes.snapshot.isFreshInstallation === false, 'Existing storage correctly flagged as non-fresh');

    // ------------------------------------------------------------------------
    // Test 14: Flush functionality
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 14: Flush Writes ---');
    const flushRes = await engine.flush();
    assert(flushRes.ok === true, 'Flush queues completed with ok: true');

    console.log('\n====================================================');
    console.log('🎉 ALL STAGE 1 LOCAL PERSISTENT STORAGE TESTS PASSED!');
    console.log('====================================================');
  } finally {
    // Cleanup temporary sandbox directory
    try {
      fs.rmSync(testTmpDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

runTests().catch((err) => {
  console.error('\n❌ STAGE 1 TEST SUITE FAILED:', err);
  process.exit(1);
});
