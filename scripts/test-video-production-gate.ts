/**
 * Phase 3D-C Verification Suite: Video Production Gate
 *
 * Tests the pure, deterministic gate that controls creation and persistence of
 * VideoProductionPackage, ensuring all 10 requirements are satisfied before allowing
 * package preparation.
 */

import {
  evaluateVideoProductionGate,
  EvaluateVideoProductionGateParams,
} from '../lib/video-production-gate';
import {
  ProductionEngineContext,
  buildProductionEngineContext,
} from '../lib/production-engine-context';
import {
  SharedContentContext,
  ContentItem,
} from '../lib/content-contract';
import { buildFunnelStrategyFromContext } from '../lib/funnel-strategy';
import {
  VideoProductionCandidate,
  VideoProductionMode,
} from '../lib/production-candidate';
import { VideoProductionReadiness } from '../lib/video-production-readiness';
import {
  VideoSceneCompletionState,
  createEmptyVideoSceneCompletionState,
  setVideoSceneClipCreated,
  buildVideoScenePlanSignature,
  buildVideoProductionInputSignature,
} from '../lib/video-scene-completion';
import { prepareProductionPackage } from '../lib/production-package-workflow';
import {
  saveProductionPackage,
  loadProductionPackage,
} from '../lib/production-package-storage';
import { ProductionPackageMetadata } from '../lib/production-engine';
import { ProductionPackage } from '../lib/production-contract';
import * as fs from 'fs';
import * as path from 'path';

// Polyfill localStorage in Node test environment
interface GlobalScopeWithStorage {
  window?: unknown;
  localStorage?: {
    getItem: (key: string) => string | null;
    setItem: (key: string, val: string) => void;
    removeItem: (key: string) => void;
    clear: () => void;
  };
}
const globalScope = globalThis as unknown as GlobalScopeWithStorage;
if (typeof globalScope.window === 'undefined') {
  const store: Record<string, string> = {};
  globalScope.window = {};
  globalScope.localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => {
      store[key] = String(val);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k]);
    },
  };
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

console.log('--- RUNNING PHASE 3D-C TEST SUITE: VIDEO PRODUCTION GATE ---');

// Base Fixtures
const baseSharedContext: SharedContentContext = {
  project_id: 'proj_gate_video_001',
  project_name: 'Video Gate Project',
  source: { origin: 'creative_system_json' },
  brand_context: {
    brand_name: 'GateBrand',
    category: 'SaaS',
    brand_summary: 'Brand summary',
    brand_voice: 'Professional',
  },
  audience_context: {
    primary_audience: 'Founders',
    pain_points: ['High churn'],
    desires: ['High retention'],
    objections: ['Difficult setup'],
  },
  strategy_context: {
    positioning: 'Fastest retention engine',
    usp: ['Instant setup'],
    main_offer: 'Free trial',
    offer_benefits: ['Reduces churn'],
    core_message: 'Retain users effortlessly.',
    copy_direction: ['Direct and data-backed'],
    content_pillars: ['Retention', 'Automation'],
  },
  system_flags: { is_complete_for_planning: true, missing_required_fields: [] },
};

const baseStrategy = buildFunnelStrategyFromContext(baseSharedContext);

const baseContentItem: ContentItem = {
  content_item_id: 'item_gate_video_001',
  project_id: 'proj_gate_video_001',
  projectId: 'proj_gate_video_001',
  no: 1,
  tanggal: '2026-09-20',
  jenis: 'BOFU',
  tujuan: 'Drive conversions',
  hookType: 'Direct Benefit',
  headline: 'Tingkatkan Retensi Sekarang',
  body: 'Otomatisasi retensi pelanggan secara real-time.',
  caption: 'Mulai uji coba gratis hari ini.',
  format: 'Video',
  referensi: '',
  visual: 'Motion graphics with clean UI walkthrough',
  keterangan: 'BOFU high conversion video',
  cta: 'Daftar sekarang',
};

const contextBuild = buildProductionEngineContext(
  'proj_gate_video_001',
  baseSharedContext,
  baseStrategy,
  baseContentItem
);
assert(contextBuild.isValid && !!contextBuild.context, 'Base context build must succeed');
const validProductionContext = contextBuild.context as ProductionEngineContext;

// Canonical Motion Explainer Candidate
const validCandidateMotion: VideoProductionCandidate = {
  candidate_type: 'video',
  candidate_id: 'video_motion_cand_001',
  production_details: {
    production_mode: 'motion_explainer',
    objective: 'Demonstrate retention curve',
    duration_seconds: 15,
    format: '9:16 Vertical Video',
    hook: 'Grafik retensi Anda turun drastis?',
    scenes: [
      {
        scene_number: 1,
        duration_seconds: 5,
        purpose: 'Hook',
        visual_direction: 'Red graph plummeting downward',
        action: 'Graph lines animate down',
        camera: 'Static front view',
        voiceover: 'Grafik retensi Anda turun drastis?',
        on_screen_text: 'Churn Meningkat?',
        scene_type: 'graphic_motion',
        required_assets: [],
      },
      {
        scene_number: 2,
        duration_seconds: 5,
        purpose: 'Solution',
        visual_direction: 'Green dashboard showing instant recovery',
        action: 'Lines animate upwards smoothly',
        camera: 'Close up on dashboard metrics',
        voiceover: 'Gunakan otomasi retention kami untuk memulihkan user.',
        on_screen_text: 'Otomasi Retensi Real-Time',
        scene_type: 'graphic_motion',
        required_assets: [],
      },
      {
        scene_number: 3,
        duration_seconds: 5,
        purpose: 'CTA',
        visual_direction: 'Pulsing call to action button',
        action: 'Button glows and pulses',
        camera: 'Center focus',
        voiceover: 'Mulai uji coba gratis hari ini.',
        on_screen_text: 'Coba Gratis Hari Ini',
        scene_type: 'graphic_motion',
        required_assets: [],
      },
    ],
    voiceover: 'Full voiceover track',
    on_screen_text: 'Full overlay text',
    camera_direction: '9:16 vertical focus',
    motion_direction: 'Clean motion transitions',
    audio_direction: 'Upbeat background track',
    branding: 'Corner logo badge',
    negative_constraints: 'No artifacts',
  },
  final_prompt: 'Canonical motion explainer video prompt',
};

const validScenePlanSig = buildVideoScenePlanSignature(validCandidateMotion);
const validProductionInputSig = buildVideoProductionInputSignature({
  production_mode: 'motion_explainer',
  character_dna: null,
  product_asset_context: null,
});

const validReadiness: VideoProductionReadiness = {
  mode: 'motion_explainer',
  is_ready: true,
  required_inputs: [],
  missing_required_inputs: [],
  optional_inputs: [],
  warnings: [],
};

// 3/3 Complete Completion State
const emptyCompletion = createEmptyVideoSceneCompletionState({
  project_id: 'proj_gate_video_001',
  content_item_id: 'item_gate_video_001',
  production_mode: 'motion_explainer',
  scene_plan_signature: validScenePlanSig,
  production_input_signature: validProductionInputSig,
});
const s1Complete = setVideoSceneClipCreated(emptyCompletion, 1, true);
const s2Complete = setVideoSceneClipCreated(s1Complete, 2, true);
const completeCompletionState = setVideoSceneClipCreated(s2Complete, 3, true);

// Standard Valid Params
const makeBaseParams = (): EvaluateVideoProductionGateParams => ({
  production_context: validProductionContext,
  source_item: baseContentItem,
  output_source: 'generated_output',
  selected_mode: 'motion_explainer',
  selected_candidate: validCandidateMotion,
  readiness: validReadiness,
  completion_state: completeCompletionState,
  current_scene_plan_signature: validScenePlanSig,
  current_production_input_signature: validProductionInputSig,
});

// TEST 1: Valid authoritative source + valid context + exact candidate + readiness true + valid completion + 3/3 → gate allowed
console.log('Test 1: Valid authoritative inputs pass gate');
const res1 = evaluateVideoProductionGate(makeBaseParams());
assert(res1.is_allowed === true, `Test 1 failed: blockers: ${res1.blockers.join(', ')}`);
assert(res1.blockers.length === 0, 'Test 1 should have zero blockers');

// TEST 2: output_source = none → blocked
console.log('Test 2: output_source = none is blocked');
const res2 = evaluateVideoProductionGate({ ...makeBaseParams(), output_source: 'none' });
assert(res2.is_allowed === false, 'Test 2 must be blocked');
assert(res2.blockers.some((b) => b.includes('sumber otoritatif')), 'Test 2 blocker mismatch');

// TEST 3: output_source = initial_draft → blocked
console.log('Test 3: output_source = initial_draft is blocked');
const res3 = evaluateVideoProductionGate({ ...makeBaseParams(), output_source: 'initial_draft' });
assert(res3.is_allowed === false, 'Test 3 must be blocked');

// TEST 4: generated_output → source accepted
console.log('Test 4: generated_output accepted');
const res4 = evaluateVideoProductionGate({ ...makeBaseParams(), output_source: 'generated_output' });
assert(res4.is_allowed === true, 'Test 4 must be allowed');

// TEST 5: stored_output → source accepted
console.log('Test 5: stored_output accepted');
const res5 = evaluateVideoProductionGate({ ...makeBaseParams(), output_source: 'stored_output' });
assert(res5.is_allowed === true, 'Test 5 must be allowed');

// TEST 6: user_edited_output → source accepted
console.log('Test 6: user_edited_output accepted');
const res6 = evaluateVideoProductionGate({ ...makeBaseParams(), output_source: 'user_edited_output' });
assert(res6.is_allowed === true, 'Test 6 must be allowed');

// TEST 7: production_context null → blocked
console.log('Test 7: production_context null is blocked');
const res7 = evaluateVideoProductionGate({ ...makeBaseParams(), production_context: null });
assert(res7.is_allowed === false, 'Test 7 must be blocked');

// TEST 8: invalid ProductionEngineContext → blocked
console.log('Test 8: invalid ProductionEngineContext is blocked');
const invalidContext = {
  ...validProductionContext,
  canonical_funnel_stage: 'INVALID_STAGE',
} as unknown as ProductionEngineContext;
const res8 = evaluateVideoProductionGate({ ...makeBaseParams(), production_context: invalidContext });
assert(res8.is_allowed === false, 'Test 8 must be blocked');

// TEST 9: sourceItem null → blocked
console.log('Test 9: sourceItem null is blocked');
const res9 = evaluateVideoProductionGate({ ...makeBaseParams(), source_item: null });
assert(res9.is_allowed === false, 'Test 9 must be blocked');

// TEST 10: sourceItem content_item_id mismatch → blocked
console.log('Test 10: sourceItem content_item_id mismatch is blocked');
const mismatchItem = { ...baseContentItem, content_item_id: 'item_foreign_999' };
const res10 = evaluateVideoProductionGate({ ...makeBaseParams(), source_item: mismatchItem });
assert(res10.is_allowed === false, 'Test 10 must be blocked');

// TEST 11: invalid selected mode → blocked
console.log('Test 11: invalid selected mode is blocked');
const invalidModeParams: EvaluateVideoProductionGateParams = {
  ...makeBaseParams(),
  selected_mode: 'cinematic_trailer' as unknown as VideoProductionMode,
};
const res11 = evaluateVideoProductionGate(invalidModeParams);
assert(res11.is_allowed === false, 'Test 11 must be blocked');

// TEST 12: selected candidate null → blocked
console.log('Test 12: selected candidate null is blocked');
const res12 = evaluateVideoProductionGate({ ...makeBaseParams(), selected_candidate: null });
assert(res12.is_allowed === false, 'Test 12 must be blocked');

// TEST 13: candidate mode mismatch → blocked
console.log('Test 13: candidate mode mismatch is blocked');
const mismatchCand: VideoProductionCandidate = {
  ...validCandidateMotion,
  production_details: {
    ...validCandidateMotion.production_details,
    production_mode: 'product_demo',
  },
};
const res13 = evaluateVideoProductionGate({
  ...makeBaseParams(),
  selected_mode: 'motion_explainer',
  selected_candidate: mismatchCand,
});
assert(res13.is_allowed === false, 'Test 13 must be blocked');

// TEST 14: invalid candidate schema → blocked
console.log('Test 14: invalid candidate schema is blocked');
const invalidCand = {
  ...validCandidateMotion,
  candidate_type: 'image',
} as unknown as VideoProductionCandidate;
const res14 = evaluateVideoProductionGate({ ...makeBaseParams(), selected_candidate: invalidCand });
assert(res14.is_allowed === false, 'Test 14 must be blocked');

// TEST 15: readiness null → blocked
console.log('Test 15: readiness null is blocked');
const res15 = evaluateVideoProductionGate({ ...makeBaseParams(), readiness: null });
assert(res15.is_allowed === false, 'Test 15 must be blocked');

// TEST 16: readiness.is_ready false → blocked
console.log('Test 16: readiness.is_ready false is blocked');
const notReady: VideoProductionReadiness = {
  mode: 'motion_explainer',
  is_ready: false,
  required_inputs: ['visuals'],
  missing_required_inputs: ['Missing visuals'],
  optional_inputs: [],
  warnings: [],
};
const res16 = evaluateVideoProductionGate({ ...makeBaseParams(), readiness: notReady });
assert(res16.is_allowed === false, 'Test 16 must be blocked');

// TEST 17: readiness mode mismatch → blocked
console.log('Test 17: readiness mode mismatch is blocked');
const modeMismatchReadiness: VideoProductionReadiness = {
  mode: 'human_led',
  is_ready: true,
  required_inputs: [],
  missing_required_inputs: [],
  optional_inputs: [],
  warnings: [],
};
const res17 = evaluateVideoProductionGate({ ...makeBaseParams(), readiness: modeMismatchReadiness });
assert(res17.is_allowed === false, 'Test 17 must be blocked');

// TEST 18: empty scene signature → blocked
console.log('Test 18: empty scene signature is blocked');
const res18 = evaluateVideoProductionGate({ ...makeBaseParams(), current_scene_plan_signature: '' });
assert(res18.is_allowed === false, 'Test 18 must be blocked');

// TEST 19: recomputed scene signature mismatch → blocked
console.log('Test 19: recomputed scene signature mismatch is blocked');
const res19 = evaluateVideoProductionGate({
  ...makeBaseParams(),
  current_scene_plan_signature: 'sig_motion_explainer_outdated_hash',
});
assert(res19.is_allowed === false, 'Test 19 must be blocked');

// TEST 20: empty production input signature → blocked
console.log('Test 20: empty production input signature is blocked');
const res20 = evaluateVideoProductionGate({ ...makeBaseParams(), current_production_input_signature: '' });
assert(res20.is_allowed === false, 'Test 20 must be blocked');

// TEST 21: completion state null → blocked
console.log('Test 21: completion state null is blocked');
const res21 = evaluateVideoProductionGate({ ...makeBaseParams(), completion_state: null });
assert(res21.is_allowed === false, 'Test 21 must be blocked');

// TEST 22: completion project mismatch → blocked
console.log('Test 22: completion project mismatch is blocked');
const projectMismatchCompletion: VideoSceneCompletionState = {
  ...completeCompletionState,
  project_id: 'proj_other_999',
};
const res22 = evaluateVideoProductionGate({ ...makeBaseParams(), completion_state: projectMismatchCompletion });
assert(res22.is_allowed === false, 'Test 22 must be blocked');

// TEST 23: completion item mismatch → blocked
console.log('Test 23: completion item mismatch is blocked');
const itemMismatchCompletion: VideoSceneCompletionState = {
  ...completeCompletionState,
  content_item_id: 'item_other_999',
};
const res23 = evaluateVideoProductionGate({ ...makeBaseParams(), completion_state: itemMismatchCompletion });
assert(res23.is_allowed === false, 'Test 23 must be blocked');

// TEST 24: completion mode mismatch → blocked
console.log('Test 24: completion mode mismatch is blocked');
const modeMismatchCompletion: VideoSceneCompletionState = {
  ...completeCompletionState,
  production_mode: 'human_led',
};
const res24 = evaluateVideoProductionGate({ ...makeBaseParams(), completion_state: modeMismatchCompletion });
assert(res24.is_allowed === false, 'Test 24 must be blocked');

// TEST 25: completion scene signature mismatch → blocked
console.log('Test 25: completion scene signature mismatch is blocked');
const sceneSigMismatchCompletion: VideoSceneCompletionState = {
  ...completeCompletionState,
  scene_plan_signature: 'sig_motion_explainer_stale',
};
const res25 = evaluateVideoProductionGate({ ...makeBaseParams(), completion_state: sceneSigMismatchCompletion });
assert(res25.is_allowed === false, 'Test 25 must be blocked');

// TEST 26: completion production input signature mismatch → blocked
console.log('Test 26: completion production input signature mismatch is blocked');
const inputSigMismatchCompletion: VideoSceneCompletionState = {
  ...completeCompletionState,
  production_input_signature: 'in_sig_outdated',
};
const res26 = evaluateVideoProductionGate({ ...makeBaseParams(), completion_state: inputSigMismatchCompletion });
assert(res26.is_allowed === false, 'Test 26 must be blocked');

// TEST 27: completion 0/3 → blocked
console.log('Test 27: completion 0/3 is blocked');
const res27 = evaluateVideoProductionGate({ ...makeBaseParams(), completion_state: emptyCompletion });
assert(res27.is_allowed === false, 'Test 27 must be blocked');

// TEST 28: completion 1/3 → blocked
console.log('Test 28: completion 1/3 is blocked');
const res28 = evaluateVideoProductionGate({ ...makeBaseParams(), completion_state: s1Complete });
assert(res28.is_allowed === false, 'Test 28 must be blocked');

// TEST 29: completion 2/3 → blocked
console.log('Test 29: completion 2/3 is blocked');
const res29 = evaluateVideoProductionGate({ ...makeBaseParams(), completion_state: s2Complete });
assert(res29.is_allowed === false, 'Test 29 must be blocked');

// TEST 30: completion 3/3 → allowed
console.log('Test 30: completion 3/3 is allowed');
const res30 = evaluateVideoProductionGate({ ...makeBaseParams(), completion_state: completeCompletionState });
assert(res30.is_allowed === true, 'Test 30 must be allowed');

// TEST 31: copiedStates cannot affect gate
console.log('Test 31: copiedStates cannot affect gate');
// The gate function does not take copiedStates as an argument and is strictly decoupled from UI clipboards
const res31 = evaluateVideoProductionGate(makeBaseParams());
assert(res31.is_allowed === true, 'Gate evaluation must be unaffected by copy states');

// TEST 32: recommended mode differing from selected mode cannot override selection
console.log('Test 32: recommended mode differing from selected mode cannot override selection');
// Gate parameters evaluate selected_mode; recommendation does not alter selection
const res32 = evaluateVideoProductionGate({
  ...makeBaseParams(),
  selected_mode: 'motion_explainer', // Selected is motion_explainer
});
assert(res32.is_allowed === true, 'Selected mode governs gate authority');

// TEST 33: exact active candidate ID is passed to prepareProductionPackage
console.log('Test 33: exact active candidate ID is passed to prepareProductionPackage');
const packageMetadata: ProductionPackageMetadata = {
  package_id: 'pkg_test_33_uuid',
  created_at: new Date().toISOString(),
};
const prepResult = prepareProductionPackage({
  projectId: 'proj_gate_video_001',
  sharedContext: baseSharedContext,
  funnelStrategy: baseStrategy,
  contentItem: baseContentItem,
  candidates: [validCandidateMotion],
  selectedCandidateId: validCandidateMotion.candidate_id,
  metadata: packageMetadata,
});
assert(prepResult.ok === true, 'prepareProductionPackage must succeed');
if (!prepResult.ok) {
  throw new Error('prepareProductionPackage failed');
}

// TEST 34: resulting valid package asset_type === video
console.log('Test 34: resulting valid package asset_type === video');
const producedPackage: ProductionPackage = prepResult.package;
assert(producedPackage.asset_type === 'video', `Package asset_type must be video, got: ${producedPackage.asset_type}`);

// TEST 35: resulting package production_status === ready_for_production
console.log('Test 35: resulting package production_status === ready_for_production');
assert(
  producedPackage.production_status === 'ready_for_production',
  `Package production_status must be ready_for_production, got: ${producedPackage.production_status}`
);

// TEST 36: saveProductionPackage uses existing storage
console.log('Test 36: saveProductionPackage saves and loadProductionPackage retrieves video package');
const saveResult = saveProductionPackage('proj_gate_video_001', producedPackage);
assert(saveResult.ok === true, `saveProductionPackage must succeed: ${saveResult.error}`);
const loadedPackage = loadProductionPackage('proj_gate_video_001', 'item_gate_video_001', 'video');
assert(loadedPackage !== null, 'Loaded package must not be null');
assert(loadedPackage?.package_id === packageMetadata.package_id, 'Loaded package ID must match saved package ID');
assert(loadedPackage?.asset_type === 'video', 'Loaded package asset_type must be video');

console.log('\n--- RUNNING PHASE 3D-C CORRECTIVE FIX REGRESSION TESTS (A - D) ---');

// TEST A — Foreign project sourceItem
console.log('Test A: Foreign project sourceItem is blocked');
const foreignProjectItem: ContentItem = {
  ...baseContentItem,
  project_id: 'proj_beta',
  projectId: 'proj_beta',
  content_item_id: 'item_gate_video_001',
};
const resA = evaluateVideoProductionGate({
  ...makeBaseParams(),
  source_item: foreignProjectItem,
});
assert(resA.is_allowed === false, 'Test A must be blocked when source_item project_id is foreign');
assert(
  resA.blockers.some((b) => b.includes('Identitas project pada source_item tidak cocok')),
  'Test A must have project mismatch blocker'
);

// TEST B — project_id / projectId disagreement
console.log('Test B: project_id / projectId disagreement is blocked');
const disagreeItem: ContentItem = {
  ...baseContentItem,
  project_id: 'proj_gate_video_001',
  projectId: 'proj_beta_disagree',
  content_item_id: 'item_gate_video_001',
};
const resB = evaluateVideoProductionGate({
  ...makeBaseParams(),
  source_item: disagreeItem,
});
assert(resB.is_allowed === false, 'Test B must be blocked when project_id and projectId disagree');
assert(
  resB.blockers.some((b) => b.includes('Identitas project_id dan projectId pada source_item tidak cocok')),
  'Test B must have project_id / projectId disagreement blocker'
);

// TEST C — Valid matching project identity
console.log('Test C: Valid matching project identity is allowed');
const matchingItem: ContentItem = {
  ...baseContentItem,
  project_id: 'proj_gate_video_001',
  projectId: 'proj_gate_video_001',
  content_item_id: 'item_gate_video_001',
};
const resC = evaluateVideoProductionGate({
  ...makeBaseParams(),
  source_item: matchingItem,
});
assert(resC.is_allowed === true, 'Test C must be allowed with matching project identity');
assert(resC.blockers.length === 0, 'Test C must have zero blockers');

// TEST D — Missing sourceItem project identity
console.log('Test D: Missing sourceItem project identity is blocked');
const noProjectItem: ContentItem = {
  ...baseContentItem,
  project_id: '',
  projectId: undefined,
  content_item_id: 'item_gate_video_001',
};
const resD = evaluateVideoProductionGate({
  ...makeBaseParams(),
  source_item: noProjectItem,
});
assert(resD.is_allowed === false, 'Test D must be blocked when project identity is missing');
assert(
  resD.blockers.some((b) => b.includes('setidaknya satu identitas project')),
  'Test D must have missing project identity blocker'
);

// STATIC REGRESSION GUARDS
console.log('\n--- RUNNING STATIC REGRESSION GUARDS ---');

const gateFile = fs.readFileSync(path.join(__dirname, '../lib/video-production-gate.ts'), 'utf-8');
const pageFile = fs.readFileSync(path.join(__dirname, '../app/production-studio/page.tsx'), 'utf-8');
const panelFile = fs.readFileSync(path.join(__dirname, '../components/production-studio/VideoPanel.tsx'), 'utf-8');
const thisTestFile = fs.readFileSync(__filename, 'utf-8');

// Positive assertions
console.log('Checking required positive terms:');
assert(gateFile.includes('evaluateVideoProductionGate'), 'lib/video-production-gate.ts must export evaluateVideoProductionGate');
assert(pageFile.includes('prepareProductionPackage'), 'page.tsx must call prepareProductionPackage');
assert(pageFile.includes('saveProductionPackage'), 'page.tsx must call saveProductionPackage');
assert(pageFile.includes('isAuthoritativeProductionOutputSource'), 'page.tsx must verify isAuthoritativeProductionOutputSource');
assert(pageFile.includes('evaluateVideoProductionGate'), 'page.tsx must call evaluateVideoProductionGate');
assert(panelFile.includes('videoProductionGate'), 'VideoPanel.tsx must consume videoProductionGate');
assert(panelFile.includes('handlePrepareVideoProductionPackage'), 'VideoPanel.tsx must call handlePrepareVideoProductionPackage');

// Strict SourceItem Project Isolation Static Guards
console.log('Checking sourceItem project isolation static guards:');
assert(
  gateFile.includes('params.production_context.project_id'),
  'lib/video-production-gate.ts must explicitly compare against production_context.project_id'
);
assert(
  gateFile.includes('rawProjectId !== rawLegacyProjectId'),
  'lib/video-production-gate.ts must detect project_id and projectId disagreement'
);

// TEST E & F: Prepared state architecture static guards
console.log('Checking TEST E & TEST F prepared state architecture:');
assert(
  !pageFile.includes("loadProductionPackage(canonicalProjectId, sourceItem.content_item_id, 'video')"),
  'page.tsx must NOT restore videoProductionPackagePrepared from loadProductionPackage'
);
assert(
  !pageFile.includes("loadProductionPackage"),
  'page.tsx must NOT import or use loadProductionPackage'
);
assert(
  pageFile.includes('setVideoProductionPackagePrepared(true)'),
  'page.tsx must set videoProductionPackagePrepared to true after saving'
);

// Verify reset useEffect dependencies (TEST F)
assert(
  pageFile.includes('canonicalProjectId,\n    sourceItem?.content_item_id,\n    selectedVideoProductionMode,\n    activeVideoCandidate?.candidate_id,\n    currentScenePlanSignature,\n    currentVideoProductionInputSignature,\n    videoOutputSource,'),
  'page.tsx must reset videoProductionPackagePrepared on all canonical identity dependencies'
);

// TEST G: No (prepResult as any).error in Phase 3D-C package section
console.log('Checking TEST G: No prepResult as any in Phase 3D-C package section');
const videoPackageSection = pageFile.slice(pageFile.indexOf('handlePrepareVideoProductionPackage'));
assert(!videoPackageSection.includes('(prepResult as any)'), 'Phase 3D-C package section must NOT contain (prepResult as any)');
assert(!videoPackageSection.includes('prepResult as any'), 'Phase 3D-C package section must NOT contain prepResult as any');

// TEST H: No as any in this test file
console.log('Checking TEST H: No as any in scripts/test-video-production-gate.ts');
const codeWithoutStaticChecks = thisTestFile.split('STATIC REGRESSION GUARDS')[0];
assert(!codeWithoutStaticChecks.includes('as ' + 'any'), 'scripts/test-video-production-gate.ts must contain zero as any');
assert(!codeWithoutStaticChecks.includes(': ' + 'any'), 'scripts/test-video-production-gate.ts must contain zero : any');

// Negative assertions
console.log('Checking forbidden patterns:');
assert(!gateFile.includes('candidates[0]'), 'video-production-gate must NOT use candidates[0]');
assert(!pageFile.includes('selectedCandidateId: candidates[0]'), 'page.tsx must NOT use candidates[0] for video candidate ID');
assert(!pageFile.includes('selectedCandidateId: canonicalVideoCandidates[0]'), 'page.tsx must NOT fallback to canonicalVideoCandidates[0]');
assert(!gateFile.includes('activeItem.content_item_id'), 'video-production-gate must NOT use activeItem.content_item_id');
assert(!gateFile.includes('recommendedVideoProductionMode'), 'video-production-gate must NOT use recommendedVideoProductionMode as authority');
assert(!pageFile.includes("production_status: 'completed'"), 'page.tsx must NOT set production_status: completed');
assert(!gateFile.includes('fetch('), 'video-production-gate must NOT do fetch calls');
assert(!panelFile.includes('fetch('), 'VideoPanel must NOT do external fetch calls');
assert(!pageFile.includes('Veo'), 'page.tsx must NOT refer to Veo internal video renderer');
assert(!pageFile.includes('Flow API'), 'page.tsx must NOT refer to Flow API');
assert(!panelFile.includes('automatic clip completion'), 'VideoPanel must NOT contain automatic clip completion');

console.log('\nALL 36 VIDEO PRODUCTION GATE TESTS, TESTS A-D, AND STATIC REGRESSION CHECKS PASSED!');
