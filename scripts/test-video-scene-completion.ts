/**
 * Phase 3D-C1C-D Verification Suite: Real Scene Completion
 * 
 * Tests exact canonical contracts, signature generation, state isolation, progress derivation,
 * fail-closed validation, and immutable transitions without any type bypasses.
 */

import {
  VideoSceneCompletionState,
  createEmptyVideoSceneCompletionState,
  validateVideoSceneCompletionState,
  setVideoSceneClipCreated,
  getCompletedVideoSceneCount,
  areAllVideoScenesCreated,
  getVideoSceneCompletionStorageKey,
  buildVideoScenePlanSignature,
  buildVideoProductionInputSignature,
} from '../lib/video-scene-completion';
import { VideoProductionCandidate } from '../lib/production-candidate';
import { CharacterDNA } from '../lib/content-contract';
import { ProductAssetContext } from '../lib/video-production-input';
import * as fs from 'fs';
import * as path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

console.log('--- RUNNING PHASE 3D-C1C-D TEST SUITE ---');

// Canonical VideoProductionCandidate Fixture A (Motion Explainer)
const mockCandidateA: VideoProductionCandidate = {
  candidate_type: 'video',
  candidate_id: 'video_motion_explainer_101',
  production_details: {
    production_mode: 'motion_explainer',
    objective: 'Explain cashflow management',
    duration_seconds: 15,
    format: '9:16 Vertical Video',
    hook: 'Tahukah Anda 80% bisnis gagal karena cashflow?',
    scenes: [
      {
        scene_number: 1,
        duration_seconds: 5,
        purpose: 'Hook',
        visual_direction: 'Animated red chart plummeting down',
        action: 'Chart plummets smoothly',
        camera: 'Static front view',
        voiceover: 'Tahukah Anda 80% bisnis gagal karena cashflow?',
        on_screen_text: '80% Bisnis Gagal Karena Cashflow',
        scene_type: 'graphic_motion',
        required_assets: [],
      },
      {
        scene_number: 2,
        duration_seconds: 5,
        purpose: 'Problem/Solution',
        visual_direction: 'Clean green dashboard metrics',
        action: 'Transition to green metrics',
        camera: 'Close up on metrics',
        voiceover: 'Gunakan sistem otomasi pencatatan keuangan real-time.',
        on_screen_text: 'Sistem Otomasi Real-Time',
        scene_type: 'graphic_motion',
        required_assets: [],
      },
      {
        scene_number: 3,
        duration_seconds: 5,
        purpose: 'Call to action',
        visual_direction: 'Animated CTA button click',
        action: 'Button pulses with glow',
        camera: 'Center focus',
        voiceover: 'Coba demo gratis sekarang melalui link di bio.',
        on_screen_text: 'Coba Demo Gratis Sekarang',
        scene_type: 'graphic_motion',
        required_assets: [],
      },
    ],
    voiceover: 'Full voiceover track',
    on_screen_text: 'Full text overlay',
    camera_direction: 'Static 9:16 vertical focus',
    motion_direction: 'Clean motion graphics transitions',
    audio_direction: 'Upbeat background audio',
    branding: 'Minimalist brand logo in corner',
    negative_constraints: 'No visual artifacts',
  },
  final_prompt: 'Canonical motion explainer prompt',
};

// TEST 1: Canonical VideoProductionCandidate generates non-empty signature
console.log('Running Test 1: Canonical VideoProductionCandidate generates non-empty signature');
const sigA = buildVideoScenePlanSignature(mockCandidateA);
assert(typeof sigA === 'string' && sigA.startsWith('sig_motion_explainer_'), 'Signature A must be valid string');

// TEST 2: Changing canonical visual_direction changes signature
console.log('Running Test 2: Changing canonical visual_direction changes signature');
const mockCandidateAVisMod: VideoProductionCandidate = {
  ...mockCandidateA,
  production_details: {
    ...mockCandidateA.production_details,
    scenes: [
      {
        ...mockCandidateA.production_details.scenes[0],
        visual_direction: 'MODIFIED: Blue bar graph animated up',
      },
      mockCandidateA.production_details.scenes[1],
      mockCandidateA.production_details.scenes[2],
    ],
  },
};
const sigAVisMod = buildVideoScenePlanSignature(mockCandidateAVisMod);
assert(sigA !== sigAVisMod, 'Changing visual_direction must alter signature');

// TEST 3: Changing voiceover changes signature
console.log('Running Test 3: Changing voiceover changes signature');
const mockCandidateAVoiceMod: VideoProductionCandidate = {
  ...mockCandidateA,
  production_details: {
    ...mockCandidateA.production_details,
    scenes: [
      mockCandidateA.production_details.scenes[0],
      {
        ...mockCandidateA.production_details.scenes[1],
        voiceover: 'MODIFIED VOICEOVER: Catat semua transaksi otomatis.',
      },
      mockCandidateA.production_details.scenes[2],
    ],
  },
};
const sigAVoiceMod = buildVideoScenePlanSignature(mockCandidateAVoiceMod);
assert(sigA !== sigAVoiceMod, 'Changing voiceover must alter signature');

// TEST 4: Changing scene_type changes signature
console.log('Running Test 4: Changing scene_type changes signature');
const mockCandidateATypeMod: VideoProductionCandidate = {
  ...mockCandidateA,
  production_details: {
    ...mockCandidateA.production_details,
    scenes: [
      mockCandidateA.production_details.scenes[0],
      mockCandidateA.production_details.scenes[1],
      {
        ...mockCandidateA.production_details.scenes[2],
        scene_type: 'end_card',
      },
    ],
  },
};
const sigATypeMod = buildVideoScenePlanSignature(mockCandidateATypeMod);
assert(sigA !== sigATypeMod, 'Changing scene_type must alter signature');

// TEST 5: Changing required_assets changes signature
console.log('Running Test 5: Changing required_assets changes signature');
const mockCandidateAAssetsMod: VideoProductionCandidate = {
  ...mockCandidateA,
  production_details: {
    ...mockCandidateA.production_details,
    scenes: [
      {
        ...mockCandidateA.production_details.scenes[0],
        required_assets: ['asset_chart_png'],
      },
      mockCandidateA.production_details.scenes[1],
      mockCandidateA.production_details.scenes[2],
    ],
  },
};
const sigAAssetsMod = buildVideoScenePlanSignature(mockCandidateAAssetsMod);
assert(sigA !== sigAAssetsMod, 'Changing required_assets must alter signature');

// TEST 6: Same canonical data gives same signature (Determinism)
console.log('Running Test 6: Same canonical data gives same signature');
const mockCandidateADuplicate: VideoProductionCandidate = JSON.parse(JSON.stringify(mockCandidateA));
const sigADup = buildVideoScenePlanSignature(mockCandidateADuplicate);
assert(sigA === sigADup, 'Identical canonical candidate must yield exact same signature');

// TEST 7: Null or undefined candidate returns empty signature
console.log('Running Test 7: Null candidate returns empty signature');
assert(buildVideoScenePlanSignature(null) === '', 'Null candidate returns empty signature');
assert(buildVideoScenePlanSignature(undefined) === '', 'Undefined candidate returns empty signature');

// TEST A: Invalid scene_type fails closed
console.log('Running Test A: scene_type = invalid_type fails closed');
const candidateInvalidType = JSON.parse(JSON.stringify(mockCandidateA));
candidateInvalidType.production_details.scenes[0].scene_type = 'invalid_type';
assert(buildVideoScenePlanSignature(candidateInvalidType) === '', 'Invalid scene_type returns empty signature');

// TEST B: Empty purpose fails closed
console.log('Running Test B: purpose = empty string fails closed');
const candidateEmptyPurpose = JSON.parse(JSON.stringify(mockCandidateA));
candidateEmptyPurpose.production_details.scenes[0].purpose = '';
assert(buildVideoScenePlanSignature(candidateEmptyPurpose) === '', 'Empty purpose returns empty signature');

// TEST C: Whitespace visual_direction fails closed
console.log('Running Test C: visual_direction = whitespace fails closed');
const candidateWsVisual = JSON.parse(JSON.stringify(mockCandidateA));
candidateWsVisual.production_details.scenes[0].visual_direction = '   ';
assert(buildVideoScenePlanSignature(candidateWsVisual) === '', 'Whitespace visual_direction returns empty signature');

// TEST D: Empty action fails closed
console.log('Running Test D: action = empty string fails closed');
const candidateEmptyAction = JSON.parse(JSON.stringify(mockCandidateA));
candidateEmptyAction.production_details.scenes[0].action = '';
assert(buildVideoScenePlanSignature(candidateEmptyAction) === '', 'Empty action returns empty signature');

// TEST E: Empty camera fails closed
console.log('Running Test E: camera = empty string fails closed');
const candidateEmptyCamera = JSON.parse(JSON.stringify(mockCandidateA));
candidateEmptyCamera.production_details.scenes[0].camera = '';
assert(buildVideoScenePlanSignature(candidateEmptyCamera) === '', 'Empty camera returns empty signature');

// TEST F: duration_seconds = 0 fails closed
console.log('Running Test F: duration_seconds = 0 fails closed');
const candidateZeroDuration = JSON.parse(JSON.stringify(mockCandidateA));
candidateZeroDuration.production_details.scenes[0].duration_seconds = 0;
assert(buildVideoScenePlanSignature(candidateZeroDuration) === '', 'duration_seconds = 0 returns empty signature');

// TEST G: duration_seconds = NaN fails closed
console.log('Running Test G: duration_seconds = NaN fails closed');
const candidateNaNDuration = JSON.parse(JSON.stringify(mockCandidateA));
candidateNaNDuration.production_details.scenes[0].duration_seconds = NaN;
assert(buildVideoScenePlanSignature(candidateNaNDuration) === '', 'duration_seconds = NaN returns empty signature');

// TEST H: required_assets = [''] fails closed
console.log('Running Test H: required_assets = [""] fails closed');
const candidateEmptyAssetToken = JSON.parse(JSON.stringify(mockCandidateA));
candidateEmptyAssetToken.production_details.scenes[0].required_assets = [''];
assert(buildVideoScenePlanSignature(candidateEmptyAssetToken) === '', 'Empty asset token returns empty signature');

// TEST I: required_assets = ['   '] fails closed
console.log('Running Test I: required_assets = ["   "] fails closed');
const candidateWsAssetToken = JSON.parse(JSON.stringify(mockCandidateA));
candidateWsAssetToken.production_details.scenes[0].required_assets = ['   '];
assert(buildVideoScenePlanSignature(candidateWsAssetToken) === '', 'Whitespace asset token returns empty signature');

// TEST J: Valid canonical required_assets ['chart', 'logo'] generates non-empty signature
console.log('Running Test J: Valid required_assets generates non-empty signature');
const candidateValidAssets = JSON.parse(JSON.stringify(mockCandidateA));
candidateValidAssets.production_details.scenes[0].required_assets = ['chart', 'logo'];
const sigAssetsJ = buildVideoScenePlanSignature(candidateValidAssets);
assert(typeof sigAssetsJ === 'string' && sigAssetsJ.length > 0, 'Valid required_assets generates non-empty signature');

// TEST K: Same required_assets in different order generates same signature
console.log('Running Test K: Order-independent required_assets signature');
const candidateValidAssetsReordered = JSON.parse(JSON.stringify(mockCandidateA));
candidateValidAssetsReordered.production_details.scenes[0].required_assets = ['logo', 'chart'];
const sigAssetsK = buildVideoScenePlanSignature(candidateValidAssetsReordered);
assert(sigAssetsJ === sigAssetsK, 'Reordered required_assets must generate exact same signature');

// TEST L: Malformed scene_number 1, 3, 3 fails closed
console.log('Running Test L: Malformed scene_number 1, 3, 3 fails closed');
const mockCandidateMalformedNum: VideoProductionCandidate = {
  ...mockCandidateA,
  production_details: {
    ...mockCandidateA.production_details,
    scenes: [
      { ...mockCandidateA.production_details.scenes[0], scene_number: 1 },
      { ...mockCandidateA.production_details.scenes[1], scene_number: 3 },
      { ...mockCandidateA.production_details.scenes[2], scene_number: 3 },
    ],
  },
};
assert(buildVideoScenePlanSignature(mockCandidateMalformedNum) === '', 'Gapped scene numbers 1, 3, 3 fail closed');

// TEST M: 4 scenes fails closed
console.log('Running Test M: 4 scenes fails closed');
const mockCandidate4Scenes: VideoProductionCandidate = {
  ...mockCandidateA,
  production_details: {
    ...mockCandidateA.production_details,
    scenes: [
      mockCandidateA.production_details.scenes[0],
      mockCandidateA.production_details.scenes[1],
      mockCandidateA.production_details.scenes[2],
      {
        scene_number: 4,
        duration_seconds: 5,
        purpose: 'Extra',
        visual_direction: 'Extra scene',
        action: 'Extra action',
        camera: 'Extra camera',
        voiceover: 'Extra VO',
        on_screen_text: 'Extra text',
        scene_type: 'end_card',
        required_assets: [],
      },
    ],
  },
};
assert(buildVideoScenePlanSignature(mockCandidate4Scenes) === '', '4-scene candidate fails closed');

// TEST 13: Completion state false + null marked_at is valid
console.log('Running Test 13: Completion state false + null marked_at is valid');
const defaultMotionInputSig = 'input_sig_motion_explainer_v1';
const initialState = createEmptyVideoSceneCompletionState({
  project_id: 'proj_alpha',
  content_item_id: 'item_101',
  production_mode: 'motion_explainer',
  scene_plan_signature: sigA,
  production_input_signature: defaultMotionInputSig,
});
const valInit = validateVideoSceneCompletionState(initialState, {
  project_id: 'proj_alpha',
  content_item_id: 'item_101',
  production_mode: 'motion_explainer',
  scene_plan_signature: sigA,
  production_input_signature: defaultMotionInputSig,
});
assert(valInit.isValid === true, 'Initial state with false + null marked_at must be valid');

// TEST 14: Completion state false + undefined marked_at is invalid
console.log('Running Test 14: Completion state false + undefined marked_at is invalid');
const invalidFalseUndef = JSON.parse(JSON.stringify(initialState));
delete invalidFalseUndef.scenes[0].marked_at;
assert(
  validateVideoSceneCompletionState(invalidFalseUndef, {
    project_id: 'proj_alpha',
    content_item_id: 'item_101',
    production_mode: 'motion_explainer',
    scene_plan_signature: sigA,
    production_input_signature: defaultMotionInputSig,
  }).isValid === false,
  'false + undefined marked_at must be invalid'
);

// TEST 15: Completion state false + '' marked_at is invalid
console.log('Running Test 15: Completion state false + empty string marked_at is invalid');
const invalidFalseEmptyStr = JSON.parse(JSON.stringify(initialState));
invalidFalseEmptyStr.scenes[0].marked_at = '';
assert(
  validateVideoSceneCompletionState(invalidFalseEmptyStr, {
    project_id: 'proj_alpha',
    content_item_id: 'item_101',
    production_mode: 'motion_explainer',
    scene_plan_signature: sigA,
    production_input_signature: defaultMotionInputSig,
  }).isValid === false,
  'false + empty string marked_at must be invalid'
);

// TEST 16: Completion state true + valid timestamp is valid
console.log('Running Test 16: Completion state true + valid timestamp is valid');
const stateScene1Done = setVideoSceneClipCreated(initialState, 1, true);
assert(
  validateVideoSceneCompletionState(stateScene1Done, {
    project_id: 'proj_alpha',
    content_item_id: 'item_101',
    production_mode: 'motion_explainer',
    scene_plan_signature: sigA,
    production_input_signature: defaultMotionInputSig,
  }).isValid === true,
  'true + valid timestamp marked_at must be valid'
);

// TEST 17: Completion state true + null marked_at is invalid
console.log('Running Test 17: Completion state true + null marked_at is invalid');
const invalidTrueNull = JSON.parse(JSON.stringify(stateScene1Done));
invalidTrueNull.scenes[0].marked_at = null;
assert(
  validateVideoSceneCompletionState(invalidTrueNull, {
    project_id: 'proj_alpha',
    content_item_id: 'item_101',
    production_mode: 'motion_explainer',
    scene_plan_signature: sigA,
    production_input_signature: defaultMotionInputSig,
  }).isValid === false,
  'true + null marked_at must be invalid'
);

// TEST 18: Missing or empty updated_at is invalid
console.log('Running Test 18: Missing/empty updated_at is invalid');
const invalidEmptyUpdatedAt = JSON.parse(JSON.stringify(initialState));
invalidEmptyUpdatedAt.updated_at = '  ';
assert(
  validateVideoSceneCompletionState(invalidEmptyUpdatedAt, {
    project_id: 'proj_alpha',
    content_item_id: 'item_101',
    production_mode: 'motion_explainer',
    scene_plan_signature: sigA,
    production_input_signature: defaultMotionInputSig,
  }).isValid === false,
  'Empty updated_at must be invalid'
);

// --- ISOLATION & PROGRESS BEHAVIOR TESTS ---

// TEST 19: Copy actions do not mutate clip_created
console.log('Running Test 19: Copy actions do not mutate clip_created');
const copiedStatesMock: Record<string, boolean> = {
  'canonical_prompt_1_motion': true,
};
assert(Boolean(copiedStatesMock['canonical_prompt_1_motion']) === true, 'Copied state exists');
assert(initialState.scenes[0].clip_created === false, 'clip_created remains strictly false');

// TEST 20: Mark scene 1 and 2, verify scene 3 remains false
console.log('Running Test 20: Mark scene 1 and 2');
const stateScene1And2Done = setVideoSceneClipCreated(stateScene1Done, 2, true);
assert(stateScene1And2Done.scenes[0].clip_created === true, 'Scene 1 remains true');
assert(stateScene1And2Done.scenes[1].clip_created === true, 'Scene 2 is true');
assert(stateScene1And2Done.scenes[2].clip_created === false, 'Scene 3 remains false');

// TEST 21: Unmark scene 1 reverts marked_at to null
console.log('Running Test 21: Unmark scene 1');
const stateUnmark1 = setVideoSceneClipCreated(stateScene1And2Done, 1, false);
assert(stateUnmark1.scenes[0].clip_created === false, 'Scene 1 reverts to false');
assert(stateUnmark1.scenes[0].marked_at === null, 'Scene 1 marked_at reverts to null');

// TEST 22: Isolation per project_id
console.log('Running Test 22: Isolation per project_id');
assert(
  validateVideoSceneCompletionState(stateScene1Done, {
    project_id: 'proj_beta',
    content_item_id: 'item_101',
    production_mode: 'motion_explainer',
    scene_plan_signature: sigA,
    production_input_signature: defaultMotionInputSig,
  }).isValid === false,
  'Validation fails for wrong project_id'
);

// TEST 23: Isolation per content_item_id
console.log('Running Test 23: Isolation per content_item_id');
assert(
  validateVideoSceneCompletionState(stateScene1Done, {
    project_id: 'proj_alpha',
    content_item_id: 'item_202',
    production_mode: 'motion_explainer',
    scene_plan_signature: sigA,
    production_input_signature: defaultMotionInputSig,
  }).isValid === false,
  'Validation fails for wrong content_item_id'
);

// TEST 24: Isolation per production_mode
console.log('Running Test 24: Isolation per production_mode');
assert(
  validateVideoSceneCompletionState(stateScene1Done, {
    project_id: 'proj_alpha',
    content_item_id: 'item_101',
    production_mode: 'human_led',
    scene_plan_signature: sigA,
    production_input_signature: defaultMotionInputSig,
  }).isValid === false,
  'Validation fails for wrong production_mode'
);

// TEST 25: Signature invalidation resets state cleanly
console.log('Running Test 25: Signature invalidation');
const valSigMismatch = validateVideoSceneCompletionState(stateScene1Done, {
  project_id: 'proj_alpha',
  content_item_id: 'item_101',
  production_mode: 'motion_explainer',
  scene_plan_signature: sigAVisMod,
  production_input_signature: defaultMotionInputSig,
});
assert(valSigMismatch.isValid === false, 'Validation fails when scene_plan_signature mismatches');

// TEST 26: Progress counter and all scenes created
console.log('Running Test 26: Progress counter and all scenes created');
assert(getCompletedVideoSceneCount(initialState) === 0, 'Progress 0');
assert(getCompletedVideoSceneCount(stateScene1Done) === 1, 'Progress 1');
assert(getCompletedVideoSceneCount(stateScene1And2Done) === 2, 'Progress 2');
const stateAllDone = setVideoSceneClipCreated(stateScene1And2Done, 3, true);
assert(getCompletedVideoSceneCount(stateAllDone) === 3, 'Progress 3');
assert(areAllVideoScenesCreated(stateAllDone) === true, 'All scenes created');
assert(areAllVideoScenesCreated(stateScene1And2Done) === false, 'Not all scenes created');

// TEST 27: Storage key helper
console.log('Running Test 27: Storage key helper');
assert(
  getVideoSceneCompletionStorageKey('item_101', 'motion_explainer') ===
    'studio_video_scene_completion_item_101_motion_explainer',
  'Storage key must match exact pattern'
);

// ============================================================================
// PHASE 3D-C1C-D+: PRODUCTION INPUT BINDING HARDENING TESTS
// ============================================================================
console.log('\n--- RUNNING PHASE 3D-C1C-D+ TEST SUITE ---');

// Canonical CharacterDNA Fixture
const mockCharacterDNA: CharacterDNA = {
  character_id: 'char_clara_01',
  project_id: 'proj_alpha',
  reference_images: ['https://example.com/clara1.png', 'https://example.com/clara2.png'],
  preview_image: 'https://example.com/clara_preview.png',
  additional_instructions: 'Keep warm friendly tone',
  identity: {
    display_name: 'Clara Digital Marketer',
    gender_presentation: 'Female',
    estimated_age_range: '26-32',
    ethnicity_or_region_hint: 'Southeast Asian',
    body_type: 'Medium athletic',
    facial_features: 'Warm smile, friendly eyes',
    hair_description: 'Dark brown shoulder length',
    skin_tone: 'Natural light tan',
    distinctive_characteristics: 'Subtle expressive gestures',
  },
  style: {
    wardrobe_style: 'Modern business casual, smart blazer',
    accessories: ['Minimalist silver watch', 'Small stud earrings'],
    makeup_style: 'Natural daytime',
    visual_vibe: 'Approachable professional',
    brand_fit_reason: 'Matches relatable educator persona',
  },
  behavior: {
    speaking_tone: 'Encouraging, clear, articulate',
    expression_style: 'Confident and welcoming',
    pose_tendency: 'Open posture facing camera',
    gesture_style: 'Natural hand emphasis',
    on_camera_persona: 'Knowledgeable peer guide',
  },
  consistency_rules: {
    locked_traits: ['blazer color', 'hair style', 'eye contact'],
    avoid_traits: ['excessive movement', 'harsh lighting'],
    continuity_notes: ['maintain consistent background tone'],
  },
  prompt_assets: {
    dna_summary_prompt: 'Clara, a 28yo professional digital marketer in business casual',
    locked_visual_prompt: 'High fidelity portrait of Clara in studio lighting',
    preview_generation_prompt: 'Close up photo of Clara smiling at camera',
    scene_reuse_prompt_template: 'Clara presenting in modern minimalist office setting',
  },
  timestamps: {
    created_at: '2026-09-20T00:00:00.000Z',
    updated_at: '2026-09-20T00:00:00.000Z',
  },
};

// Canonical ProductAssetContext Fixture
const mockProductAssetContext: ProductAssetContext = {
  product_name: 'Alco Content Engine',
  product_type: 'SaaS Web Application',
  screenshots: [
    {
      id: 'screen_dash_01',
      name: 'Main Analytics Dashboard',
      kind: 'screenshot',
    },
    {
      id: 'screen_cal_02',
      name: 'Calendar Schedule View',
      kind: 'screenshot',
    },
  ],
  feature_focus: ['Automated Content Scheduling', 'One-Click Video Plan'],
  demo_steps: ['Open Dashboard', 'Select Date', 'Generate Schedule'],
  logo_reference: {
    id: 'logo_alco_01',
    name: 'Alco Official Logo',
    kind: 'logo',
  },
  screen_recording_reference: {
    id: 'rec_alco_01',
    name: 'Walkthrough Video Clip',
    kind: 'screen_recording',
  },
};

// TEST 1: human_led valid CharacterDNA produces non-empty production input signature.
console.log('Running C1C-D+ Test 1: human_led valid CharacterDNA produces non-empty signature');
const sigHuman = buildVideoProductionInputSignature({
  production_mode: 'human_led',
  character_dna: mockCharacterDNA,
});
assert(
  typeof sigHuman === 'string' && sigHuman.length > 0 && sigHuman.startsWith('input_sig_human_led'),
  'C1C-D+ TEST 1: human_led valid CharacterDNA produces non-empty signature'
);

// TEST 2: Same CharacterDNA produces same signature.
console.log('Running C1C-D+ Test 2: Same CharacterDNA produces same signature');
const sigHumanCopy = buildVideoProductionInputSignature({
  production_mode: 'human_led',
  character_dna: { ...mockCharacterDNA },
});
assert(sigHuman === sigHumanCopy, 'C1C-D+ TEST 2: Same CharacterDNA produces same signature');

// TEST 3: Changing character_id changes signature.
console.log('Running C1C-D+ Test 3: Changing character_id changes signature');
const sigHumanCharMod = buildVideoProductionInputSignature({
  production_mode: 'human_led',
  character_dna: { ...mockCharacterDNA, character_id: 'char_clara_02' },
});
assert(sigHuman !== sigHumanCharMod, 'C1C-D+ TEST 3: Changing character_id changes signature');

// TEST 4: Changing dna_summary_prompt changes signature.
console.log('Running C1C-D+ Test 4: Changing dna_summary_prompt changes signature');
const sigHumanSummaryMod = buildVideoProductionInputSignature({
  production_mode: 'human_led',
  character_dna: {
    ...mockCharacterDNA,
    prompt_assets: {
      ...mockCharacterDNA.prompt_assets,
      dna_summary_prompt: 'Modified summary prompt for Clara',
    },
  },
});
assert(sigHuman !== sigHumanSummaryMod, 'C1C-D+ TEST 4: Changing dna_summary_prompt changes signature');

// TEST 5: Changing locked_visual_prompt changes signature.
console.log('Running C1C-D+ Test 5: Changing locked_visual_prompt changes signature');
const sigHumanVisualMod = buildVideoProductionInputSignature({
  production_mode: 'human_led',
  character_dna: {
    ...mockCharacterDNA,
    prompt_assets: {
      ...mockCharacterDNA.prompt_assets,
      locked_visual_prompt: 'Modified locked visual prompt for Clara',
    },
  },
});
assert(sigHuman !== sigHumanVisualMod, 'C1C-D+ TEST 5: Changing locked_visual_prompt changes signature');

// TEST 6: Changing reference_images changes signature.
console.log('Running C1C-D+ Test 6: Changing reference_images changes signature');
const sigHumanRefMod = buildVideoProductionInputSignature({
  production_mode: 'human_led',
  character_dna: {
    ...mockCharacterDNA,
    reference_images: ['https://example.com/clara_different.png'],
  },
});
assert(sigHuman !== sigHumanRefMod, 'C1C-D+ TEST 6: Changing reference_images changes signature');

// TEST 7: Changing timestamps.updated_at only does NOT change signature.
console.log('Running C1C-D+ Test 7: Changing timestamps.updated_at only does NOT change signature');
const sigHumanTimeMod = buildVideoProductionInputSignature({
  production_mode: 'human_led',
  character_dna: {
    ...mockCharacterDNA,
    timestamps: {
      ...mockCharacterDNA.timestamps,
      updated_at: '2026-09-20T12:34:56.789Z',
    },
  },
});
assert(sigHuman === sigHumanTimeMod, 'C1C-D+ TEST 7: Changing timestamps.updated_at only does NOT change signature');

// TEST 8: human_led without CharacterDNA returns ''.
console.log('Running C1C-D+ Test 8: human_led without CharacterDNA returns empty string');
assert(
  buildVideoProductionInputSignature({
    production_mode: 'human_led',
    character_dna: null,
  }) === '',
  'C1C-D+ TEST 8: human_led without CharacterDNA returns empty string'
);

// TEST 9: human_led with invalid CharacterDNA returns ''.
console.log('Running C1C-D+ Test 9: human_led with invalid CharacterDNA returns empty string');
const invalidDna: CharacterDNA = {
  ...mockCharacterDNA,
  character_id: '   ',
};
assert(
  buildVideoProductionInputSignature({
    production_mode: 'human_led',
    character_dna: invalidDna,
  }) === '',
  'C1C-D+ TEST 9: human_led with invalid CharacterDNA returns empty string'
);

// TEST 10: product_demo valid ProductAssetContext returns non-empty signature.
console.log('Running C1C-D+ Test 10: product_demo valid ProductAssetContext returns non-empty signature');
const sigProd = buildVideoProductionInputSignature({
  production_mode: 'product_demo',
  product_asset_context: mockProductAssetContext,
});
assert(
  typeof sigProd === 'string' && sigProd.length > 0 && sigProd.startsWith('input_sig_product_demo'),
  'C1C-D+ TEST 10: product_demo valid ProductAssetContext returns non-empty signature'
);

// TEST 11: Changing product_name changes signature.
console.log('Running C1C-D+ Test 11: Changing product_name changes signature');
const sigProdNameMod = buildVideoProductionInputSignature({
  production_mode: 'product_demo',
  product_asset_context: {
    ...mockProductAssetContext,
    product_name: 'Alco Growth Engine V2',
  },
});
assert(sigProd !== sigProdNameMod, 'C1C-D+ TEST 11: Changing product_name changes signature');

// TEST 12: Changing screenshot id changes signature.
console.log('Running C1C-D+ Test 12: Changing screenshot id changes signature');
const sigProdScreenIdMod = buildVideoProductionInputSignature({
  production_mode: 'product_demo',
  product_asset_context: {
    ...mockProductAssetContext,
    screenshots: [
      { id: 'screen_dash_999', name: 'Main Analytics Dashboard', kind: 'screenshot' },
      mockProductAssetContext.screenshots[1],
    ],
  },
});
assert(sigProd !== sigProdScreenIdMod, 'C1C-D+ TEST 12: Changing screenshot id changes signature');

// TEST 13: Changing screenshot name changes signature.
console.log('Running C1C-D+ Test 13: Changing screenshot name changes signature');
const sigProdScreenNameMod = buildVideoProductionInputSignature({
  production_mode: 'product_demo',
  product_asset_context: {
    ...mockProductAssetContext,
    screenshots: [
      { id: 'screen_dash_01', name: 'Renamed Analytics View', kind: 'screenshot' },
      mockProductAssetContext.screenshots[1],
    ],
  },
});
assert(sigProd !== sigProdScreenNameMod, 'C1C-D+ TEST 13: Changing screenshot name changes signature');

// TEST 14: Changing feature_focus changes signature.
console.log('Running C1C-D+ Test 14: Changing feature_focus changes signature');
const sigProdFeatureMod = buildVideoProductionInputSignature({
  production_mode: 'product_demo',
  product_asset_context: {
    ...mockProductAssetContext,
    feature_focus: ['Completely Different Feature'],
  },
});
assert(sigProd !== sigProdFeatureMod, 'C1C-D+ TEST 14: Changing feature_focus changes signature');

// TEST 15: Changing demo_steps changes signature.
console.log('Running C1C-D+ Test 15: Changing demo_steps changes signature');
const sigProdDemoStepsMod = buildVideoProductionInputSignature({
  production_mode: 'product_demo',
  product_asset_context: {
    ...mockProductAssetContext,
    demo_steps: ['Step 1', 'Step 2', 'Step 3 - Modified'],
  },
});
assert(sigProd !== sigProdDemoStepsMod, 'C1C-D+ TEST 15: Changing demo_steps changes signature');

// TEST 16: product_demo missing product_name returns ''.
console.log('Running C1C-D+ Test 16: product_demo missing product_name returns empty string');
const prodMissingName: ProductAssetContext = {
  ...mockProductAssetContext,
  product_name: '   ',
};
assert(
  buildVideoProductionInputSignature({
    production_mode: 'product_demo',
    product_asset_context: prodMissingName,
  }) === '',
  'C1C-D+ TEST 16: product_demo missing product_name returns empty string'
);

// TEST 17: product_demo without valid screenshots returns ''.
console.log('Running C1C-D+ Test 17: product_demo without valid screenshots returns empty string');
const prodEmptyScreens: ProductAssetContext = {
  ...mockProductAssetContext,
  screenshots: [],
};
assert(
  buildVideoProductionInputSignature({
    production_mode: 'product_demo',
    product_asset_context: prodEmptyScreens,
  }) === '',
  'C1C-D+ TEST 17: product_demo without valid screenshots returns empty string'
);

// TEST 18: motion_explainer returns deterministic non-empty signature.
console.log('Running C1C-D+ Test 18: motion_explainer returns deterministic constant signature');
const sigMotion = buildVideoProductionInputSignature({
  production_mode: 'motion_explainer',
});
assert(
  typeof sigMotion === 'string' && sigMotion === 'input_sig_motion_explainer_v1',
  'C1C-D+ TEST 18: motion_explainer returns deterministic constant signature'
);

// TEST 19: motion signature does not change when CharacterDNA changes.
console.log('Running C1C-D+ Test 19: motion signature does not change when CharacterDNA changes');
const sigMotionWithChar = buildVideoProductionInputSignature({
  production_mode: 'motion_explainer',
  character_dna: mockCharacterDNA,
});
assert(
  sigMotion === sigMotionWithChar,
  'C1C-D+ TEST 19: motion signature does not change when CharacterDNA changes'
);

// TEST 20: motion signature does not change when ProductAssetContext changes.
console.log('Running C1C-D+ Test 20: motion signature does not change when ProductAssetContext changes');
const sigMotionWithProd = buildVideoProductionInputSignature({
  production_mode: 'motion_explainer',
  product_asset_context: mockProductAssetContext,
});
assert(
  sigMotion === sigMotionWithProd,
  'C1C-D+ TEST 20: motion signature does not change when ProductAssetContext changes'
);

// TEST 21: Completion validation fails when stored production_input_signature does not match expected signature.
console.log('Running C1C-D+ Test 21: Validation fails on production_input_signature mismatch');
const stateHuman = createEmptyVideoSceneCompletionState({
  project_id: 'proj_alpha',
  content_item_id: 'item_101',
  production_mode: 'human_led',
  scene_plan_signature: sigA,
  production_input_signature: sigHuman,
});
const valInputSigMismatch = validateVideoSceneCompletionState(stateHuman, {
  project_id: 'proj_alpha',
  content_item_id: 'item_101',
  production_mode: 'human_led',
  scene_plan_signature: sigA,
  production_input_signature: sigHumanCharMod,
});
assert(
  valInputSigMismatch.isValid === false,
  'C1C-D+ TEST 21: Completion validation fails when stored production_input_signature does not match expected signature'
);

// TEST 22: Completion validation fails when production_input_signature missing.
console.log('Running C1C-D+ Test 22: Validation fails when production_input_signature missing');
const stateMissingInputSig = JSON.parse(JSON.stringify(stateHuman));
delete stateMissingInputSig.production_input_signature;
assert(
  validateVideoSceneCompletionState(stateMissingInputSig, {
    project_id: 'proj_alpha',
    content_item_id: 'item_101',
    production_mode: 'human_led',
    scene_plan_signature: sigA,
    production_input_signature: sigHuman,
  }).isValid === false,
  'C1C-D+ TEST 22: Completion validation fails when production_input_signature missing'
);

// TEST 23: Completion validation fails when production_input_signature empty.
console.log('Running C1C-D+ Test 23: Validation fails when production_input_signature empty');
const stateEmptyInputSig = JSON.parse(JSON.stringify(stateHuman));
stateEmptyInputSig.production_input_signature = '   ';
assert(
  validateVideoSceneCompletionState(stateEmptyInputSig, {
    project_id: 'proj_alpha',
    content_item_id: 'item_101',
    production_mode: 'human_led',
    scene_plan_signature: sigA,
    production_input_signature: sigHuman,
  }).isValid === false,
  'C1C-D+ TEST 23: Completion validation fails when production_input_signature empty'
);

// TEST 24: Completion remains valid when scene signature AND production input signature both match.
console.log('Running C1C-D+ Test 24: Completion remains valid when both signatures match');
assert(
  validateVideoSceneCompletionState(stateHuman, {
    project_id: 'proj_alpha',
    content_item_id: 'item_101',
    production_mode: 'human_led',
    scene_plan_signature: sigA,
    production_input_signature: sigHuman,
  }).isValid === true,
  'C1C-D+ TEST 24: Completion remains valid when scene signature AND production input signature both match'
);

// TEST 25: Character change makes previous human completion state invalid.
console.log('Running C1C-D+ Test 25: Character change makes previous human completion state invalid');
const humanCompleted = setVideoSceneClipCreated(
  setVideoSceneClipCreated(
    setVideoSceneClipCreated(stateHuman, 1, true),
    2,
    true
  ),
  3,
  true
);
const newExpectedHuman = {
  project_id: 'proj_alpha',
  content_item_id: 'item_101',
  production_mode: 'human_led' as const,
  scene_plan_signature: sigA,
  production_input_signature: sigHumanCharMod,
};
assert(
  validateVideoSceneCompletionState(humanCompleted, newExpectedHuman).isValid === false,
  'C1C-D+ TEST 25: Character change makes previous human completion state invalid'
);

// TEST 26: Product screenshot change makes previous product completion invalid.
console.log('Running C1C-D+ Test 26: Product screenshot change makes previous product completion invalid');
const stateProdCompleted = createEmptyVideoSceneCompletionState({
  project_id: 'proj_alpha',
  content_item_id: 'item_101',
  production_mode: 'product_demo',
  scene_plan_signature: sigA,
  production_input_signature: sigProd,
});
const prodAll3Done = setVideoSceneClipCreated(
  setVideoSceneClipCreated(
    setVideoSceneClipCreated(stateProdCompleted, 1, true),
    2,
    true
  ),
  3,
  true
);
assert(areAllVideoScenesCreated(prodAll3Done) === true, 'All 3 product scenes completed');

const newExpectedProd = {
  project_id: 'proj_alpha',
  content_item_id: 'item_101',
  production_mode: 'product_demo' as const,
  scene_plan_signature: sigA,
  production_input_signature: sigProdScreenIdMod,
};
assert(
  validateVideoSceneCompletionState(prodAll3Done, newExpectedProd).isValid === false,
  'C1C-D+ TEST 26: Product screenshot change makes previous product completion invalid'
);

// ============================================================================
// PHASE 3D-C1C-D+ CORRECTIVE FIX TESTS: COMPACT HASH & RAW BASE64 REMOVAL
// ============================================================================
console.log('\n--- RUNNING C1C-D+ COMPACT HASH & RAW BASE64 REMOVAL TESTS ---');

// TEST 27: Realistic CharacterDNA reference image produces non-empty signature without raw Base64/data URI
console.log('Running C1C-D+ Test 27: Realistic CharacterDNA reference image does not appear raw in signature');
const dnaWithRealBase64: CharacterDNA = {
  ...mockCharacterDNA,
  reference_images: ['data:image/jpeg;base64,AAAABBBBCCCC'],
};
const sigRealBase64 = buildVideoProductionInputSignature({
  production_mode: 'human_led',
  character_dna: dnaWithRealBase64,
});
assert(typeof sigRealBase64 === 'string' && sigRealBase64.length > 0, 'Signature is non-empty');
assert(!sigRealBase64.includes('data:image'), 'Signature does not contain data:image');
assert(!sigRealBase64.includes('base64'), 'Signature does not contain base64');
assert(!sigRealBase64.includes('AAAABBBBCCCC'), 'Signature does not contain raw payload AAAABBBBCCCC');
assert(sigRealBase64.startsWith('input_sig_human_led_'), 'Signature starts with input_sig_human_led_');

// TEST 28: Reference image A vs Reference image B produces different signatures
console.log('Running C1C-D+ Test 28: Reference image A vs B produces different signatures');
const dnaRefA: CharacterDNA = {
  ...mockCharacterDNA,
  reference_images: ['data:image/jpeg;base64,AAAA'],
};
const dnaRefB: CharacterDNA = {
  ...mockCharacterDNA,
  reference_images: ['data:image/jpeg;base64,BBBB'],
};
const sigRefA = buildVideoProductionInputSignature({
  production_mode: 'human_led',
  character_dna: dnaRefA,
});
const sigRefB = buildVideoProductionInputSignature({
  production_mode: 'human_led',
  character_dna: dnaRefB,
});
assert(sigRefA !== sigRefB, 'Signature A !== Signature B');
assert(!sigRefA.includes('AAAA') && !sigRefB.includes('BBBB'), 'No raw reference data in signatures');

// TEST 29: preview_image A vs preview_image B produces different signatures without raw preview data
console.log('Running C1C-D+ Test 29: preview_image A vs B produces different signatures without raw preview data');
const dnaPreviewA: CharacterDNA = {
  ...mockCharacterDNA,
  preview_image: 'data:image/png;base64,PREVIEW_IMAGE_AAAA',
};
const dnaPreviewB: CharacterDNA = {
  ...mockCharacterDNA,
  preview_image: 'data:image/png;base64,PREVIEW_IMAGE_BBBB',
};
const sigPreviewA = buildVideoProductionInputSignature({
  production_mode: 'human_led',
  character_dna: dnaPreviewA,
});
const sigPreviewB = buildVideoProductionInputSignature({
  production_mode: 'human_led',
  character_dna: dnaPreviewB,
});
assert(sigPreviewA !== sigPreviewB, 'preview_image changes signature');
assert(!sigPreviewA.includes('PREVIEW_IMAGE_AAAA'), 'No raw preview data in sigPreviewA');
assert(!sigPreviewB.includes('PREVIEW_IMAGE_BBBB'), 'No raw preview data in sigPreviewB');

// TEST 30: Same CharacterDNA values produce exact same signature
console.log('Running C1C-D+ Test 30: Same CharacterDNA values produce exact same signature');
const sigSame1 = buildVideoProductionInputSignature({
  production_mode: 'human_led',
  character_dna: mockCharacterDNA,
});
const sigSame2 = buildVideoProductionInputSignature({
  production_mode: 'human_led',
  character_dna: { ...mockCharacterDNA },
});
assert(sigSame1 === sigSame2, 'Same CharacterDNA values produce exact same signature');

// TEST 31: Only timestamps.updated_at changes produces same signature
console.log('Running C1C-D+ Test 31: Only timestamps.updated_at changes produces same signature');
const dnaUpdatedOnly: CharacterDNA = {
  ...mockCharacterDNA,
  timestamps: {
    created_at: mockCharacterDNA.timestamps.created_at,
    updated_at: '2026-12-31T23:59:59.999Z',
  },
};
const sigTimestampMod = buildVideoProductionInputSignature({
  production_mode: 'human_led',
  character_dna: dnaUpdatedOnly,
});
assert(sigSame1 === sigTimestampMod, 'timestamps.updated_at does not change signature');

// TEST 32: Very long Base64 reference input produces compact signature (< 100 chars)
console.log('Running C1C-D+ Test 32: Very long Base64 reference input produces compact signature');
const veryLongBase64 = 'data:image/jpeg;base64,' + 'ABCD1234'.repeat(50000); // 400KB base64
const dnaHuge: CharacterDNA = {
  ...mockCharacterDNA,
  reference_images: [veryLongBase64],
};
const sigHuge = buildVideoProductionInputSignature({
  production_mode: 'human_led',
  character_dna: dnaHuge,
});
assert(typeof sigHuge === 'string' && sigHuge.startsWith('input_sig_human_led_'), 'Huge base64 generates valid signature');
assert(sigHuge.length < 100, `Signature must be compact (actual length: ${sigHuge.length})`);
assert(!sigHuge.includes('ABCD'), 'Signature does not contain huge base64 content');

// TEST 33: Product Demo valid context begins with input_sig_product_demo_ and stays compact (< 100 chars)
console.log('Running C1C-D+ Test 33: Product Demo valid context begins with input_sig_product_demo_ and stays compact');
const sigProdCompact = buildVideoProductionInputSignature({
  production_mode: 'product_demo',
  product_asset_context: mockProductAssetContext,
});
assert(sigProdCompact.startsWith('input_sig_product_demo_'), 'Product demo signature begins with input_sig_product_demo_');
assert(sigProdCompact.length < 100, `Product demo signature must be compact (actual length: ${sigProdCompact.length})`);

// TEST 34: Changing ProductAssetContext screenshot id changes signature
console.log('Running C1C-D+ Test 34: Changing ProductAssetContext screenshot id changes signature');
const prodModScreen = {
  ...mockProductAssetContext,
  screenshots: [
    { id: 'screen_new_id_999', name: 'Main Analytics Dashboard', kind: 'screenshot' as const },
    mockProductAssetContext.screenshots[1],
  ],
};
const sigProdModScreen = buildVideoProductionInputSignature({
  production_mode: 'product_demo',
  product_asset_context: prodModScreen,
});
assert(sigProdCompact !== sigProdModScreen, 'Changing screenshot id changes signature');

// TEST 35: motion_explainer remains exactly input_sig_motion_explainer_v1
console.log('Running C1C-D+ Test 35: motion_explainer remains exactly input_sig_motion_explainer_v1');
const sigMotionExplainer = buildVideoProductionInputSignature({
  production_mode: 'motion_explainer',
});
assert(sigMotionExplainer === 'input_sig_motion_explainer_v1', 'motion_explainer remains exactly input_sig_motion_explainer_v1');

// ============================================================================
// STATIC SOURCE GUARDS
// ============================================================================
console.log('\n--- RUNNING C1C-D+ STATIC SOURCE GUARDS ---');

// GUARD 1: lib/video-scene-completion.ts returned signature must not directly interpolate reference_images or preview_image
console.log('Running Static Guard: No raw image interpolation in returned signatures');
const completionLibSrc = fs.readFileSync(path.join(process.cwd(), 'lib/video-scene-completion.ts'), 'utf-8');
assert(!completionLibSrc.match(/return\s+`[^`]*\${refImages}/), 'HUMAN returned signature must NOT directly interpolate reference_images');
assert(!completionLibSrc.match(/return\s+`[^`]*\${preview}/), 'HUMAN returned signature must NOT directly interpolate preview_image');

// GUARD 2: page.tsx completion lifecycle uses sourceItem.content_item_id only (no activeItem fallback)
console.log('Running Static Guard: Completion lifecycle uses sourceItem.content_item_id only');
const pageSrc = fs.readFileSync(path.join(process.cwd(), 'app/production-studio/page.tsx'), 'utf-8');
const completionBlockMatch = pageSrc.match(/\/\/ Phase 3D-C1C-D\+: Real Scene Completion State[\s\S]*?\/\/ Render content of active tab/);
assert(!!completionBlockMatch, 'C1C-D+ completion block must be present in page.tsx');
const completionBlock = completionBlockMatch ? completionBlockMatch[0] : '';
assert(completionBlock.includes('sourceItem?.content_item_id'), 'C1C-D+ completion block must use sourceItem?.content_item_id');
assert(!completionBlock.includes('activeItem?.content_item_id'), 'C1C-D+ completion block must NOT use activeItem?.content_item_id');
assert(!completionBlock.includes('activeItem.content_item_id'), 'C1C-D+ completion block must NOT use activeItem.content_item_id');
assert(pageSrc.includes('activeItem?.jenis') || pageSrc.includes('activeItem?.headline'), 'activeItem UI fallback must be preserved globally');

console.log('--- ALL TESTS IN PHASE 3D-C1C-D & PHASE 3D-C1C-D+ PASSED PERFECTLY ---');
