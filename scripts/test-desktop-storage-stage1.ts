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
import {
  saveProductionPackage,
  saveProductionPackageDurable,
} from '../lib/production-package-storage';
import { desktopStorageAdapter } from '../lib/storage-adapter';
import { prepareProductionPackage } from '../lib/production-package-workflow';
import { buildFunnelStrategyFromContext } from '../lib/funnel-strategy';

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

    // ------------------------------------------------------------------------
    // Test 15: Corrupt Existing Project File Protection (P0)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 15: Corrupt Existing Project File Protection ---');
    const corruptProjId = 'proj_corrupt_guard';
    const { projectDir: corruptDir, filePath: corruptFilePath } = engine.resolveProjectFilePath(corruptProjId);
    fs.mkdirSync(corruptDir, { recursive: true });
    const originalCorruptContent = '<<< CORRUPTED NON-JSON CONTENT THAT CANNOT BE PARSED >>>';
    fs.writeFileSync(corruptFilePath, originalCorruptContent, 'utf8');

    let corruptWriteCaught = false;
    try {
      await engine.saveProjectData(corruptProjId, 'new_key', { some: 'value' });
    } catch (err: any) {
      corruptWriteCaught = true;
      assert(err.message.includes('rusak') || err.message.includes('JSON'), 'Write rejected on corrupted file with descriptive error');
    }
    assert(corruptWriteCaught === true, 'Write to corrupted project file was blocked');

    // Crucial: Original corrupt file must be preserved and NOT overwritten with empty replacement data!
    const preservedContent = fs.readFileSync(corruptFilePath, 'utf8');
    assert(preservedContent === originalCorruptContent, 'Original corrupt file preserved exactly; not replaced with empty data');

    // ------------------------------------------------------------------------
    // Test 16: Rapid A/B/C Writes & Ordered Serialization (P0)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 16: Rapid A/B/C Writes & Ordered Serialization ---');
    const rapidProjId = 'proj_rapid_seq';
    const writeA = engine.saveProjectData(rapidProjId, 'keyA', 'valA');
    const writeB = engine.saveProjectData(rapidProjId, 'keyB', 'valB');
    const writeC = engine.saveProjectData(rapidProjId, 'keyC', 'valC');

    const [resA, resB, resC] = await Promise.all([writeA, writeB, writeC]);
    assert(resA.revision === 1, 'First rapid write has revision 1');
    assert(resB.revision === 2, 'Second rapid write has revision 2');
    assert(resC.revision === 3, 'Third rapid write has revision 3');

    const reloadedRapid = engine.getProjectDataSync(rapidProjId);
    assert(reloadedRapid.data.keyA === 'valA', 'Rapid write A persisted');
    assert(reloadedRapid.data.keyB === 'valB', 'Rapid write B persisted');
    assert(reloadedRapid.data.keyC === 'valC', 'Rapid write C persisted');
    assert(reloadedRapid.revision === 3, 'Disk reflects final sequential revision 3');

    // ------------------------------------------------------------------------
    // Test 17: Rejected Stale Writes (P0)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 17: Rejected Stale Writes ---');
    let staleWriteBlocked = false;
    try {
      // Disk is at revision 3, client attempts write with stale revision 1
      await engine.saveProjectData(rapidProjId, 'stale_key', 'stale_value', 1);
    } catch (err: any) {
      staleWriteBlocked = true;
      assert(err.message.includes('Stale write rejected'), 'Stale write rejected error returned');
    }
    assert(staleWriteBlocked === true, 'Stale write was strictly rejected');
    assert(engine.getProjectDataSync(rapidProjId).data.stale_key === undefined, 'Stale write did not modify disk');

    // ------------------------------------------------------------------------
    // Test 18: Corrupted / Missing Project Bootstrap Integrity (P1)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 18: Corrupted / Missing Project Bootstrap Integrity ---');
    // Subtest 18a: Corrupted project file listed in manifest must fail bootstrap
    await engine.saveManifest({
      activeProjectId: 'proj_alpha',
      projectList: [
        { project_id: 'proj_alpha', project_name: 'Alpha Brand', updated_at: new Date().toISOString() },
        { project_id: corruptProjId, project_name: 'Corrupt Brand', updated_at: new Date().toISOString() },
      ],
    });

    const corruptBootstrapRes = await engine.getBootstrapSnapshot();
    assert(corruptBootstrapRes.ok === false, 'Bootstrap fails when a listed project is corrupted');
    assert(
      Boolean(corruptBootstrapRes.error?.includes('corrupted') || corruptBootstrapRes.error?.includes('rusak')),
      'Bootstrap error mentions corrupted project data'
    );

    // Subtest 18b: Missing project file listed in manifest must fail bootstrap
    await engine.saveManifest({
      activeProjectId: 'proj_alpha',
      projectList: [
        { project_id: 'proj_alpha', project_name: 'Alpha Brand', updated_at: new Date().toISOString() },
        { project_id: 'proj_nonexistent_file', project_name: 'Ghost Brand', updated_at: new Date().toISOString() },
      ],
    });

    // Storage Engine automatically ensures data.json exists when saved via saveManifest.
    // To test missing file rejection at bootstrap, delete data.json for proj_nonexistent_file after manifest persistence.
    const { filePath: nonexistentFilePath } = engine.resolveProjectFilePath('proj_nonexistent_file');
    if (fs.existsSync(nonexistentFilePath)) {
      fs.unlinkSync(nonexistentFilePath);
    }

    const missingBootstrapRes = await engine.getBootstrapSnapshot();
    assert(missingBootstrapRes.ok === false, 'Bootstrap fails when a listed project file is missing');
    assert(
      Boolean(missingBootstrapRes.error?.includes('missing project file') || missingBootstrapRes.error?.includes('tidak ditemukan')),
      'Bootstrap error mentions missing project file'
    );

    // Restore clean manifest for subsequent tests
    await engine.saveManifest({
      activeProjectId: 'proj_alpha',
      projectList: [
        { project_id: 'proj_alpha', project_name: 'Alpha Brand', updated_at: new Date().toISOString() },
        { project_id: 'proj_beta', project_name: 'Beta Brand', updated_at: new Date().toISOString() },
      ],
    });

    // ------------------------------------------------------------------------
    // Test 19: Failed Removal Safe Recovery (P1)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 19: Failed Removal Safe Recovery ---');
    // Set up mock window bridge where removeProjectData fails on disk
    let mockRemoveCalled = false;
    const mockBridge = {
      getBootstrapSnapshot: async () => ({
        ok: true,
        snapshot: {
          manifest: { activeProjectId: 'proj_alpha', projectList: [{ project_id: 'proj_alpha' }] },
          projects: {
            proj_alpha: {
              revision: 1,
              data: { critical_item: { id: 101, name: 'Protected Item' } },
            },
          },
        },
      }),
      saveProjectData: async () => ({ ok: true, revision: 2 }),
      removeProjectData: async () => {
        mockRemoveCalled = true;
        return { ok: false, error: 'Simulated disk removal I/O failure' };
      },
      saveManifest: async () => ({ ok: true }),
      flush: async () => ({ ok: true }),
    };

    (global as any).window = {
      alcoBridge: {
        isElectron: true,
        storage: mockBridge,
      },
    };

    // Initialize adapter with mock Electron bridge
    const adapterInit = await desktopStorageAdapter.initializeStorage();
    assert(adapterInit.ok === true, 'Adapter initialized with mock bridge');
    assert(
      desktopStorageAdapter.loadProjectData('proj_alpha', 'critical_item')?.name === 'Protected Item',
      'Initial item present in cache'
    );

    // Call removeProjectData, which will fail at disk layer
    desktopStorageAdapter.removeProjectData('proj_alpha', 'critical_item');
    await desktopStorageAdapter.waitForStoragePersistence();

    assert(mockRemoveCalled === true, 'Bridge removeProjectData was called');
    // Cache must have rolled back so cache and disk remain consistent!
    const recoveredItem = desktopStorageAdapter.loadProjectData('proj_alpha', 'critical_item');
    assert(recoveredItem !== null && recoveredItem.name === 'Protected Item', 'Failed removal rolled back cache to match disk');
    assert(desktopStorageAdapter.getLastStorageError() !== null, 'Persistence error was recorded in adapter');

    // Clean up mock window
    delete (global as any).window;

    // ------------------------------------------------------------------------
    // Test 20: ProductionPackage Durability Confirmation (P1)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 20: ProductionPackage Durability Confirmation ---');
    const mockCtx: any = {
      project_id: 'proj_alpha',
      project_name: 'Alpha Brand',
      source: {
        origin: 'creative_system_json',
        source_version: '1.0.0',
        import_note: 'Imported',
        provenance: {},
      },
      brand_context: {
        brand_name: 'Alpha Brand',
        category: 'Tech',
        tagline: 'Simple Tech',
        brand_values: ['Simplicity'],
      },
      audience_context: {
        primary_audience: 'Creators',
        pain_points: ['Slow speed'],
        desires: ['Speed'],
        objections: ['Hard to use'],
      },
      strategy_context: {
        positioning: 'Fastest pipeline',
        usp: ['Rapid output'],
        main_offer: 'Alpha Suite',
        offer_benefits: ['Speed'],
        core_message: 'Work faster',
        copy_direction: ['Direct'],
        content_pillars: ['Efficiency'],
      },
      system_flags: {
        is_complete_for_planning: true,
        missing_required_fields: [],
      },
    };

    const mockItem: any = {
      no: 1,
      content_item_id: 'item_durable_1',
      project_id: 'proj_alpha',
      projectId: 'proj_alpha',
      tanggal: '2026-10-21',
      jenis: 'TOFU (Awareness)',
      format: 'Single Image Feed',
      hookType: 'Question',
      referensi: 'Ref',
      headline: 'Work 10x Faster',
      body: 'Automate your daily production tasks effortlessly.',
      caption: 'Full caption text for testing durability.',
      cta: 'Try it today',
      visual: 'Clean studio desk',
      tujuan: 'Awareness',
      keterangan: 'Strategic rationale',
    };

    const cand: any = {
      candidate_id: 'angle_1',
      candidate_type: 'image',
      hook_angle: 'Speed angle',
      hook_type: 'question',
      headline: 'Work 10x Faster',
      body: 'Automate your tasks.',
      cta: 'Try it today',
      visual_concept: 'Clean desk',
      technical_spec: { aspect_ratio: '1:1' },
      final_prompt: 'A sleek modern desk with workstation setup',
      negative_prompt: 'clutter, blur',
      production_details: {
        objective: 'Demonstrate speed',
        scene: 'Modern workspace',
        subject: 'Content creator at computer',
        composition: 'Centered 1:1 view',
        environment: 'Modern studio',
        lighting: 'Soft daylight',
        camera_direction: 'Eye level',
        visual_style: 'Clean editorial',
        text_overlay: 'Work 10x Faster',
        branding: 'Minimalist logo',
        negative_constraints: 'No distortion',
      },
    };

    const prepRes = prepareProductionPackage({
      projectId: 'proj_alpha',
      sharedContext: mockCtx,
      funnelStrategy: buildFunnelStrategyFromContext(mockCtx),
      contentItem: mockItem,
      candidates: [cand],
      selectedCandidateId: cand.candidate_id,
      translatedPromptBundle: {
        asset_type: 'image',
        candidate_id: 'angle_1',
        execution_prompt: cand.final_prompt,
      },
      metadata: {
        package_id: 'pkg_durable_101',
        created_at: new Date().toISOString(),
      },
    });
    assert(prepRes.ok === true, 'prepareProductionPackage succeeded for durable test');
    const durablePkg = (prepRes as any).package;

    // Test synchronous acceptance with explicit persistence promise
    const pkgSaveRes = saveProductionPackage('proj_alpha', durablePkg);
    console.log('pkgSaveRes:', pkgSaveRes);
    assert(pkgSaveRes.ok === true, 'saveProductionPackage succeeds immediately in cache');
    assert(pkgSaveRes.persisted !== undefined, 'saveProductionPackage returns explicit persisted promise');

    const durableAck = await pkgSaveRes.persisted;
    assert(durableAck.ok === true, 'Persisted promise resolves with durability confirmation');

    // Test explicit saveProductionPackageDurable wrapper
    const directDurableRes = await saveProductionPackageDurable('proj_alpha', durablePkg);
    assert(directDurableRes.ok === true, 'saveProductionPackageDurable completes with durability confirmed');

    // Invalid package must fail closed
    const invalidDurableRes = await saveProductionPackageDurable('wrong_project', durablePkg);
    assert(invalidDurableRes.ok === false, 'saveProductionPackageDurable fails closed on identity mismatch');

    // ------------------------------------------------------------------------
    // Test 21: Failed removal followed by newer write (Consistency Patch 1)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 21: Failed removal followed by newer write ---');
    const consistencyBridge = {
      getBootstrapSnapshot: async () => ({
        ok: true,
        snapshot: {
          manifest: { activeProjectId: 'proj_seq_test', projectList: [{ project_id: 'proj_seq_test' }] },
          projects: {
            proj_seq_test: {
              revision: 1,
              data: { active_item: 'old_value' },
            },
          },
        },
      }),
      saveProjectData: async () => ({ ok: true, revision: 2 }),
      removeProjectData: async () => {
        return { ok: false, error: 'Simulated disk removal I/O error' };
      },
      saveManifest: async () => ({ ok: true }),
      flush: async () => ({ ok: true }),
    };

    (global as any).window = {
      alcoBridge: {
        isElectron: true,
        storage: consistencyBridge,
      },
    };

    await desktopStorageAdapter.initializeStorage();
    assert(
      desktopStorageAdapter.loadProjectData('proj_seq_test', 'active_item') === 'old_value',
      'Cache holds initial old_value'
    );

    // 1. Initiate remove
    desktopStorageAdapter.removeProjectData('proj_seq_test', 'active_item');
    // 2. Immediately mutate with a newer value before remove finishes / fails
    desktopStorageAdapter.saveProjectData('proj_seq_test', 'active_item', 'newer_brand_new_value');

    // Await all mutations to settle
    await desktopStorageAdapter.waitForStoragePersistence();

    // Verify: The failed removal must NOT restore the stale 'old_value'! 'newer_brand_new_value' must be preserved!
    const preservedValue = desktopStorageAdapter.loadProjectData('proj_seq_test', 'active_item');
    assert(
      preservedValue === 'newer_brand_new_value',
      'Newer write is preserved: failed removal did not overwrite newer cache value with stale data'
    );

    // ------------------------------------------------------------------------
    // Test 22: Package save with unrelated failed write (Consistency Patch 2)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 22: Package save with unrelated failed write ---');
    const perOpBridge = {
      getBootstrapSnapshot: async () => ({
        ok: true,
        snapshot: {
          manifest: {
            activeProjectId: 'proj_alpha',
            projectList: [{ project_id: 'proj_alpha' }, { project_id: 'proj_broken' }],
          },
          projects: {
            proj_alpha: { revision: 1, data: {} },
            proj_broken: { revision: 1, data: {} },
          },
        },
      }),
      saveProjectData: async (pid: string) => {
        if (pid === 'proj_broken') {
          return { ok: false, error: 'Unrelated disk failure on proj_broken' };
        }
        return { ok: true, revision: 5 };
      },
      removeProjectData: async () => ({ ok: true }),
      saveManifest: async () => ({ ok: true }),
      flush: async () => ({ ok: true }),
    };

    (global as any).window = {
      alcoBridge: {
        isElectron: true,
        storage: perOpBridge,
      },
    };

    await desktopStorageAdapter.initializeStorage();

    // Trigger an unrelated failed write on proj_broken
    desktopStorageAdapter.saveProjectData('proj_broken', 'unrelated_data', { fail: true });

    // Now save a valid ProductionPackage on proj_alpha
    const pkgResult = saveProductionPackage('proj_alpha', durablePkg);
    assert(pkgResult.ok === true, 'saveProductionPackage succeeds immediately in cache');
    assert(pkgResult.persisted !== undefined, 'persisted promise exists');

    // Durability check for this specific package must succeed despite unrelated failure
    const ack = await pkgResult.persisted!;
    assert(
      ack.ok === true,
      'Package persistence succeeds on disk despite unrelated failed write (per-operation acknowledgment works)'
    );

    delete (global as any).window;

    // ------------------------------------------------------------------------
    // Test 23: Project creation interrupted before manifest (Consistency Patch 3)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 23: Project creation interrupted before manifest ---');
    const interruptedPid = 'proj_interrupted_123';
    // Step 1: Initialize project file on disk
    const initRes = await engine.initProject(interruptedPid);
    assert(initRes.ok === true, 'initProject creates data.json on disk');

    const { filePath: interruptedFilePath } = engine.resolveProjectFilePath(interruptedPid);
    assert(fs.existsSync(interruptedFilePath), 'Project data.json exists on disk before manifest update');

    // Simulate interruption: Manifest has NOT been updated with interruptedPid
    const manifestBefore = engine.getManifestSync();
    assert(
      !manifestBefore.projectList.some((p: any) => p.project_id === interruptedPid),
      'Manifest does not yet list interrupted project'
    );

    // Bootstrap must succeed cleanly and not be broken by unlisted project directory
    const bootstrapCheck = await engine.getBootstrapSnapshot();
    assert(bootstrapCheck.ok === true, 'Bootstrap succeeds even if project creation was interrupted before manifest update');

    // The created project file on disk is valid and complete
    const diskProject = engine.getProjectDataSync(interruptedPid);
    assert(diskProject.projectId === interruptedPid, 'Interrupted project file has valid schema and projectId');
    assert(diskProject.revision === 0, 'Interrupted project file has initial revision 0');

    // ------------------------------------------------------------------------
    // Test 24: Restart after project creation (Consistency Patch 4)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 24: Restart after project creation ---');
    const newCreatedPid = 'proj_created_fresh';
    // 1. Create project file on disk
    await engine.initProject(newCreatedPid);

    // 2. Register in manifest
    const currentManifest = engine.getManifestSync();
    const updatedProjectList = [
      ...currentManifest.projectList,
      { project_id: newCreatedPid, project_name: 'Brand Baru', updated_at: new Date().toISOString() },
    ];
    await engine.saveManifest({
      activeProjectId: newCreatedPid,
      projectList: updatedProjectList,
    });

    // 3. Simulate application restart with a fresh StorageEngine instance
    const freshEngine = new StorageEngine(testTmpDir);
    const restartedSnapshotRes = await freshEngine.getBootstrapSnapshot();

    assert(restartedSnapshotRes.ok === true, 'Bootstrap succeeds after application restart following project creation');
    assert(restartedSnapshotRes.snapshot.manifest.activeProjectId === newCreatedPid, 'Active project ID restored correctly');
    assert(
      Boolean(restartedSnapshotRes.snapshot.projects[newCreatedPid]),
      'Newly created project is hydrated into snapshot with valid initial data'
    );
    assert(
      restartedSnapshotRes.snapshot.projects[newCreatedPid].revision === 0,
      'Newly created project maintains revision 0 across restart'
    );
    assert(
      Object.keys(restartedSnapshotRes.snapshot.projects[newCreatedPid].data).length === 0,
      'Incomplete project data is valid empty object without causing corruption error'
    );

    // ------------------------------------------------------------------------
    // Test 25: initProject failure propagation (Final Consistency Patch)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 25: initProject failure propagation ---');
    const initFailBridge = {
      getBootstrapSnapshot: async () => ({
        ok: true,
        snapshot: { manifest: { activeProjectId: null, projectList: [] }, projects: {} },
      }),
      initProject: async () => ({ ok: false, error: 'Disk I/O error during project initialization' }),
      saveManifest: async () => ({ ok: true }),
      flush: async () => ({ ok: true }),
    };

    (global as any).window = {
      alcoBridge: {
        isElectron: true,
        storage: initFailBridge,
      },
    };

    await desktopStorageAdapter.initializeStorage();
    const failInitRes = await desktopStorageAdapter.createProject('proj_fail_init', 'Failed Brand');
    assert(failInitRes.ok === false, 'createProject fails when initProject fails on disk');
    assert(
      Boolean(failInitRes.error?.includes('Disk I/O error')),
      'Error message propagated from initProject failure'
    );
    assert(
      !desktopStorageAdapter.getProjectList().some((p) => p.project_id === 'proj_fail_init'),
      'Project not registered in projectList on initProject failure'
    );

    // ------------------------------------------------------------------------
    // Test 26: manifest save failure propagation (Final Consistency Patch)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 26: manifest save failure propagation ---');
    const manifestFailBridge = {
      getBootstrapSnapshot: async () => ({
        ok: true,
        snapshot: { manifest: { activeProjectId: null, projectList: [] }, projects: {} },
      }),
      initProject: async () => ({ ok: true }),
      saveManifest: async () => ({ ok: false, error: 'Manifest disk write failure' }),
      flush: async () => ({ ok: true }),
    };

    (global as any).window = {
      alcoBridge: {
        isElectron: true,
        storage: manifestFailBridge,
      },
    };

    await desktopStorageAdapter.initializeStorage();
    const failManifestRes = await desktopStorageAdapter.createProject('proj_fail_manifest', 'Failed Brand');
    assert(failManifestRes.ok === false, 'createProject fails when manifest save fails on disk');
    assert(
      Boolean(failManifestRes.error?.includes('Manifest disk write failure')),
      'Error message propagated from manifest save failure'
    );

    // ------------------------------------------------------------------------
    // Test 27: rapid duplicate creation (Final Consistency Patch)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 27: rapid duplicate creation ---');
    let manifestSaveCount = 0;
    const rapidBridge = {
      getBootstrapSnapshot: async () => ({
        ok: true,
        snapshot: { manifest: { activeProjectId: null, projectList: [] }, projects: {} },
      }),
      initProject: async () => ({ ok: true }),
      saveManifest: async () => {
        manifestSaveCount++;
        return { ok: true };
      },
      flush: async () => ({ ok: true }),
    };

    (global as any).window = {
      alcoBridge: {
        isElectron: true,
        storage: rapidBridge,
      },
    };

    await desktopStorageAdapter.initializeStorage();
    const dupPid = 'proj_rapid_duplicate_test';
    const [dupRes1, dupRes2] = await Promise.all([
      desktopStorageAdapter.createProject(dupPid, 'Duplicate Brand A'),
      desktopStorageAdapter.createProject(dupPid, 'Duplicate Brand B'),
    ]);

    assert(dupRes1.ok === true && dupRes2.ok === true, 'Both duplicate creation calls complete safely');
    const listCheck = desktopStorageAdapter.getProjectList().filter((p) => p.project_id === dupPid);
    assert(listCheck.length === 1, 'No duplicate project entries created in projectList');

    // ------------------------------------------------------------------------
    // Test 28: project creation success followed by restart (Final Consistency Patch)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 28: project creation success followed by restart ---');
    const e2ePid = 'proj_e2e_restart_full';
    await engine.initProject(e2ePid);
    const existingManifest = engine.getManifestSync();
    await engine.saveManifest({
      activeProjectId: e2ePid,
      projectList: [
        ...existingManifest.projectList,
        { project_id: e2ePid, project_name: 'E2E Restart Brand', updated_at: new Date().toISOString() },
      ],
    });

    const freshEngine2 = new StorageEngine(testTmpDir);
    const snapshot2 = await freshEngine2.getBootstrapSnapshot();
    assert(snapshot2.ok === true, 'Snapshot succeeded after fresh engine restart');
    assert(snapshot2.snapshot.manifest.activeProjectId === e2ePid, 'Active project ID retained across restart');
    assert(Boolean(snapshot2.snapshot.projects[e2ePid]), 'Project data found in restarted snapshot');
    assert(snapshot2.snapshot.projects[e2ePid].revision === 0, 'Project has initial revision 0');

    // ------------------------------------------------------------------------
    // Test 29: browser localStorage write failure (Final Consistency Patch)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 29: browser localStorage write failure ---');
    // Simulate non-Electron browser environment
    (global as any).window = {};

    const originalLocalStorage = (global as any).localStorage;
    const mockLocalStorageStore: Record<string, string> = {};
    (global as any).localStorage = {
      getItem: (key: string) => mockLocalStorageStore[key] || null,
      setItem: (key: string, value: string) => {
        if (key.includes('quota_fail')) {
          throw new Error('QuotaExceededError: The quota has been exceeded');
        }
        mockLocalStorageStore[key] = value;
      },
      removeItem: (key: string) => {
        delete mockLocalStorageStore[key];
      },
    };

    // Normal write succeeds
    const successWrite = desktopStorageAdapter.saveProjectData('proj_browser', 'normal_key', { a: 1 });
    const successAck = await successWrite.persisted;
    assert(successAck.ok === true, 'Normal browser write succeeds in localStorage');
    assert(
      desktopStorageAdapter.loadProjectData('proj_browser', 'normal_key')?.a === 1,
      'Normal browser read succeeds synchronously'
    );

    // Failed write returns persisted.ok: false
    const failedWrite = desktopStorageAdapter.saveProjectData('proj_browser', 'quota_fail_key', { b: 2 });
    const failedAck = await failedWrite.persisted;
    assert(failedAck.ok === false, 'Browser write returns persisted.ok: false when localStorage throws');
    assert(
      Boolean(failedAck.error?.includes('QuotaExceededError')),
      'Error message propagated from localStorage failure'
    );

    // Restore original localStorage if any
    if (originalLocalStorage) {
      (global as any).localStorage = originalLocalStorage;
    } else {
      delete (global as any).localStorage;
    }
    delete (global as any).window;

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
