import { VideoProductionMode, VideoSceneProductionPlan } from './production-contract';
import { VideoProductionCandidate } from './production-candidate';
import { CharacterDNA } from './content-contract';
import { ProductAssetContext, ProductAssetReference } from './video-production-input';

// ============================================================================
// PHASE 3D-C1C-D: REAL SCENE COMPLETION CONTRACT
// Vendor-neutral, manual user confirmation contract for external video clips.
// Strictly isolated from copiedStates, prompt generation, and production gate.
// ============================================================================

export interface VideoSceneCompletionEntry {
  scene_number: 1 | 2 | 3;
  clip_created: boolean;
  marked_at: string | null;
}

export interface VideoSceneCompletionState {
  project_id: string;
  content_item_id: string;
  production_mode: VideoProductionMode;
  scene_plan_signature: string;
  production_input_signature: string;
  scenes: [
    VideoSceneCompletionEntry,
    VideoSceneCompletionEntry,
    VideoSceneCompletionEntry
  ];
  updated_at: string;
}

export interface VideoSceneCompletionValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Storage key helper for project-scoped scene completion persistence.
 */
export function getVideoSceneCompletionStorageKey(
  content_item_id: string,
  production_mode: VideoProductionMode
): string {
  return `studio_video_scene_completion_${content_item_id}_${production_mode}`;
}

export interface VideoProductionInputSignatureParams {
  production_mode: VideoProductionMode;
  character_dna?: CharacterDNA | null;
  product_asset_context?: ProductAssetContext | null;
}

/**
 * Pure synchronous deterministic 32-bit FNV-1a hash formatted as an 8-character hex string.
 * Used exclusively for generating compact change-detection signatures without persisting
 * raw image bytes or Base64 payloads into state / storage.
 */
export function hashDeterministicString(str: string): string {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Builds a deterministic pure signature from mode-specific production inputs.
 * Used exclusively to bind scene completion to external clip creation assets
 * (such as CharacterDNA for human_led or ProductAssetContext for product_demo).
 *
 * Fails closed (returns '') if required mode-specific input is missing or invalid.
 * Does NOT include timestamps or temporary binary state.
 * Raw image / Base64 data is hashed in-memory and NEVER persisted into returned signature.
 */
export function buildVideoProductionInputSignature(
  params: VideoProductionInputSignatureParams
): string {
  if (!params || typeof params !== 'object') return '';

  const { production_mode, character_dna, product_asset_context } = params;

  if (production_mode === 'human_led') {
    if (!character_dna || typeof character_dna !== 'object') return '';

    // Validate required fields
    if (
      typeof character_dna.character_id !== 'string' ||
      character_dna.character_id.trim().length === 0
    ) {
      return '';
    }
    if (
      typeof character_dna.project_id !== 'string' ||
      character_dna.project_id.trim().length === 0
    ) {
      return '';
    }

    if (!character_dna.prompt_assets || typeof character_dna.prompt_assets !== 'object') {
      return '';
    }
    if (
      typeof character_dna.prompt_assets.dna_summary_prompt !== 'string' ||
      typeof character_dna.prompt_assets.locked_visual_prompt !== 'string' ||
      typeof character_dna.prompt_assets.scene_reuse_prompt_template !== 'string'
    ) {
      return '';
    }

    if (!Array.isArray(character_dna.reference_images)) return '';
    for (const ref of character_dna.reference_images) {
      if (typeof ref !== 'string') return '';
    }

    if (!character_dna.identity || typeof character_dna.identity !== 'object') return '';
    if (!character_dna.style || typeof character_dna.style !== 'object') return '';
    if (!character_dna.behavior || typeof character_dna.behavior !== 'object') return '';
    if (!character_dna.consistency_rules || typeof character_dna.consistency_rules !== 'object') return '';

    // Deterministic serialization without timestamps
    const refImages = [...character_dna.reference_images].sort().join(',');

    const identityParts = [
      `name:${character_dna.identity.display_name || ''}`,
      `gender:${character_dna.identity.gender_presentation || ''}`,
      `age:${character_dna.identity.estimated_age_range || ''}`,
      `region:${character_dna.identity.ethnicity_or_region_hint || ''}`,
      `body:${character_dna.identity.body_type || ''}`,
      `face:${character_dna.identity.facial_features || ''}`,
      `hair:${character_dna.identity.hair_description || ''}`,
      `skin:${character_dna.identity.skin_tone || ''}`,
      `distinct:${character_dna.identity.distinctive_characteristics || ''}`,
    ].join('|');

    const accessories = Array.isArray(character_dna.style.accessories)
      ? [...character_dna.style.accessories].sort().join(',')
      : '';
    const styleParts = [
      `wardrobe:${character_dna.style.wardrobe_style || ''}`,
      `acc:${accessories}`,
      `makeup:${character_dna.style.makeup_style || ''}`,
      `vibe:${character_dna.style.visual_vibe || ''}`,
      `brandfit:${character_dna.style.brand_fit_reason || ''}`,
    ].join('|');

    const behaviorParts = [
      `tone:${character_dna.behavior.speaking_tone || ''}`,
      `expr:${character_dna.behavior.expression_style || ''}`,
      `pose:${character_dna.behavior.pose_tendency || ''}`,
      `gesture:${character_dna.behavior.gesture_style || ''}`,
      `persona:${character_dna.behavior.on_camera_persona || ''}`,
    ].join('|');

    const lockedTraits = Array.isArray(character_dna.consistency_rules.locked_traits)
      ? [...character_dna.consistency_rules.locked_traits].sort().join(',')
      : '';
    const avoidTraits = Array.isArray(character_dna.consistency_rules.avoid_traits)
      ? [...character_dna.consistency_rules.avoid_traits].sort().join(',')
      : '';
    const continuityNotes = Array.isArray(character_dna.consistency_rules.continuity_notes)
      ? [...character_dna.consistency_rules.continuity_notes].sort().join(',')
      : '';
    const consistencyParts = [
      `locked:${lockedTraits}`,
      `avoid:${avoidTraits}`,
      `notes:${continuityNotes}`,
    ].join('|');

    const promptParts = [
      `dna_summary:${character_dna.prompt_assets.dna_summary_prompt}`,
      `locked_vis:${character_dna.prompt_assets.locked_visual_prompt}`,
      `reuse_tpl:${character_dna.prompt_assets.scene_reuse_prompt_template}`,
    ].join('|');

    const addl = typeof character_dna.additional_instructions === 'string'
      ? character_dna.additional_instructions
      : '';
    const preview = typeof character_dna.preview_image === 'string'
      ? character_dna.preview_image
      : '';

    const inMemorySerialization = [
      'human_led',
      `char_id:${character_dna.character_id.trim()}`,
      `proj_id:${character_dna.project_id.trim()}`,
      `ref_img:${refImages}`,
      `preview:${preview}`,
      `addl:${addl}`,
      `identity:${identityParts}`,
      `style:${styleParts}`,
      `behavior:${behaviorParts}`,
      `consistency:${consistencyParts}`,
      `prompts:${promptParts}`,
    ].join('##');

    return `input_sig_human_led_${hashDeterministicString(inMemorySerialization)}`;
  }

  if (production_mode === 'product_demo') {
    if (!product_asset_context || typeof product_asset_context !== 'object') return '';

    const prodName = product_asset_context.product_name;
    if (typeof prodName !== 'string' || prodName.trim().length === 0) {
      return '';
    }

    const screenshots = product_asset_context.screenshots;
    if (!Array.isArray(screenshots) || screenshots.length === 0) {
      return '';
    }

    const validScreenshots: ProductAssetReference[] = [];
    for (const item of screenshots) {
      if (
        !item ||
        typeof item !== 'object' ||
        typeof item.id !== 'string' ||
        item.id.trim().length === 0 ||
        typeof item.name !== 'string' ||
        item.name.trim().length === 0 ||
        item.kind !== 'screenshot'
      ) {
        return '';
      }
      validScreenshots.push(item);
    }

    if (validScreenshots.length === 0) return '';

    // Deterministic sort of screenshots by id then name
    const sortedScreenshots = [...validScreenshots]
      .sort((a, b) => a.id.localeCompare(b.id) || a.name.localeCompare(b.name))
      .map((s) => `${s.id}::${s.name}::${s.kind}`)
      .join(',');

    const featureFocus = Array.isArray(product_asset_context.feature_focus)
      ? [...product_asset_context.feature_focus].sort().join(',')
      : '';

    const demoSteps = Array.isArray(product_asset_context.demo_steps)
      ? product_asset_context.demo_steps.join('->')
      : '';

    let logoPart = 'none';
    if (product_asset_context.logo_reference) {
      const logo = product_asset_context.logo_reference;
      if (
        typeof logo.id === 'string' &&
        logo.id.trim().length > 0 &&
        typeof logo.name === 'string' &&
        logo.name.trim().length > 0 &&
        logo.kind === 'logo'
      ) {
        logoPart = `${logo.id}::${logo.name}::${logo.kind}`;
      } else {
        return '';
      }
    }

    let screenRecPart = 'none';
    if (product_asset_context.screen_recording_reference) {
      const rec = product_asset_context.screen_recording_reference;
      if (
        typeof rec.id === 'string' &&
        rec.id.trim().length > 0 &&
        typeof rec.name === 'string' &&
        rec.name.trim().length > 0 &&
        rec.kind === 'screen_recording'
      ) {
        screenRecPart = `${rec.id}::${rec.name}::${rec.kind}`;
      } else {
        return '';
      }
    }

    const prodType = typeof product_asset_context.product_type === 'string'
      ? product_asset_context.product_type
      : '';

    const inMemorySerialization = [
      'product_demo',
      `prod_name:${prodName.trim()}`,
      `prod_type:${prodType.trim()}`,
      `screenshots:${sortedScreenshots}`,
      `features:${featureFocus}`,
      `steps:${demoSteps}`,
      `logo:${logoPart}`,
      `screen_rec:${screenRecPart}`,
    ].join('##');

    return `input_sig_product_demo_${hashDeterministicString(inMemorySerialization)}`;
  }

  if (production_mode === 'motion_explainer') {
    return 'input_sig_motion_explainer_v1';
  }

  return '';
}

/**
 * Builds a deterministic pure signature from canonical candidate scene plan.
 * Used exclusively to detect scene plan changes and invalidate stale completion.
 * Does NOT contain timestamps, random values, or copiedStates.
 */
export function buildVideoScenePlanSignature(
  candidate: VideoProductionCandidate | null | undefined
): string {
  if (!candidate || typeof candidate !== 'object') return '';
  if (candidate.candidate_type !== 'video') return '';

  const details = candidate.production_details;
  if (!details || typeof details !== 'object') return '';

  const mode = details.production_mode;
  const validModes: VideoProductionMode[] = ['human_led', 'product_demo', 'motion_explainer'];
  if (!mode || !validModes.includes(mode)) return '';

  const scenes = details.scenes;
  if (!Array.isArray(scenes) || scenes.length !== 3) return '';

  const validSceneTypes = [
    'talking_head',
    'product_screen',
    'graphic_motion',
    'b_roll',
    'end_card',
  ];

  const normalizedSceneStrings: string[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene: VideoSceneProductionPlan = scenes[i];
    if (!scene || typeof scene !== 'object') return '';

    const expectedNum = (i + 1) as 1 | 2 | 3;
    if (scene.scene_number !== expectedNum) return '';

    if (!validSceneTypes.includes(scene.scene_type)) return '';

    if (
      typeof scene.duration_seconds !== 'number' ||
      !Number.isFinite(scene.duration_seconds) ||
      scene.duration_seconds <= 0
    ) {
      return '';
    }

    if (typeof scene.purpose !== 'string' || scene.purpose.trim().length === 0) return '';
    if (typeof scene.visual_direction !== 'string' || scene.visual_direction.trim().length === 0) return '';
    if (typeof scene.action !== 'string' || scene.action.trim().length === 0) return '';
    if (typeof scene.camera !== 'string' || scene.camera.trim().length === 0) return '';

    if (typeof scene.voiceover !== 'string') return '';
    if (typeof scene.on_screen_text !== 'string') return '';

    if (!Array.isArray(scene.required_assets)) return '';
    for (const asset of scene.required_assets) {
      if (typeof asset !== 'string' || asset.trim().length === 0) return '';
    }

    const requiredAssets = [...scene.required_assets].sort().join(',');

    normalizedSceneStrings.push(
      [
        `num:${scene.scene_number}`,
        `dur:${scene.duration_seconds}`,
        `type:${scene.scene_type}`,
        `purpose:${scene.purpose}`,
        `visual:${scene.visual_direction}`,
        `act:${scene.action}`,
        `cam:${scene.camera}`,
        `vo:${scene.voiceover}`,
        `text:${scene.on_screen_text}`,
        `assets:${requiredAssets}`,
      ].join('|')
    );
  }

  return `sig_${mode}_${normalizedSceneStrings.join('##')}`;
}

/**
 * Creates a fresh empty completion state for 3 canonical scenes.
 */
export function createEmptyVideoSceneCompletionState(params: {
  project_id: string;
  content_item_id: string;
  production_mode: VideoProductionMode;
  scene_plan_signature: string;
  production_input_signature: string;
}): VideoSceneCompletionState {
  if (
    typeof params.production_input_signature !== 'string' ||
    params.production_input_signature.trim().length === 0
  ) {
    throw new Error('createEmptyVideoSceneCompletionState requires a non-empty production_input_signature');
  }

  return {
    project_id: params.project_id,
    content_item_id: params.content_item_id,
    production_mode: params.production_mode,
    scene_plan_signature: params.scene_plan_signature,
    production_input_signature: params.production_input_signature,
    scenes: [
      { scene_number: 1, clip_created: false, marked_at: null },
      { scene_number: 2, clip_created: false, marked_at: null },
      { scene_number: 3, clip_created: false, marked_at: null },
    ],
    updated_at: new Date().toISOString(),
  };
}

/**
 * Validates persisted VideoSceneCompletionState against expected project, item, mode, scene signature, and production input signature.
 * Fails closed on any corruption, missing scenes, duplicate scene numbers, or signature mismatch.
 */
export function validateVideoSceneCompletionState(
  state: unknown,
  expected: {
    project_id: string;
    content_item_id: string;
    production_mode: VideoProductionMode;
    scene_plan_signature: string;
    production_input_signature: string;
  }
): VideoSceneCompletionValidationResult {
  if (!state || typeof state !== 'object') {
    return { isValid: false, error: 'Completion state is null or non-object' };
  }

  const typed = state as Partial<VideoSceneCompletionState>;

  if (typeof typed.updated_at !== 'string' || typed.updated_at.trim().length === 0) {
    return {
      isValid: false,
      error: 'updated_at must be a non-empty string',
    };
  }

  if (typed.project_id !== expected.project_id) {
    return {
      isValid: false,
      error: `Project ID mismatch: expected "${expected.project_id}", found "${typed.project_id}"`,
    };
  }

  if (typed.content_item_id !== expected.content_item_id) {
    return {
      isValid: false,
      error: `Content Item ID mismatch: expected "${expected.content_item_id}", found "${typed.content_item_id}"`,
    };
  }

  const validModes: VideoProductionMode[] = ['human_led', 'product_demo', 'motion_explainer'];
  if (!typed.production_mode || !validModes.includes(typed.production_mode)) {
    return {
      isValid: false,
      error: `Invalid production_mode in completion state: "${typed.production_mode}"`,
    };
  }

  if (typed.production_mode !== expected.production_mode) {
    return {
      isValid: false,
      error: `Mode mismatch: expected "${expected.production_mode}", found "${typed.production_mode}"`,
    };
  }

  if (!typed.scene_plan_signature || typed.scene_plan_signature !== expected.scene_plan_signature) {
    return {
      isValid: false,
      error: `Scene plan signature mismatch or missing: expected "${expected.scene_plan_signature}", found "${typed.scene_plan_signature}"`,
    };
  }

  if (
    typeof typed.production_input_signature !== 'string' ||
    typed.production_input_signature.trim().length === 0
  ) {
    return {
      isValid: false,
      error: 'production_input_signature missing or empty in completion state',
    };
  }

  if (typed.production_input_signature !== expected.production_input_signature) {
    return {
      isValid: false,
      error: `Production input signature mismatch: expected "${expected.production_input_signature}", found "${typed.production_input_signature}"`,
    };
  }

  if (!Array.isArray(typed.scenes) || typed.scenes.length !== 3) {
    return {
      isValid: false,
      error: `Scenes array must contain exactly 3 entries, found ${Array.isArray(typed.scenes) ? typed.scenes.length : 0}`,
    };
  }

  const seenSceneNumbers = new Set<number>();
  for (let i = 0; i < typed.scenes.length; i++) {
    const scene = typed.scenes[i];
    if (!scene || typeof scene !== 'object') {
      return { isValid: false, error: `Scene entry at index ${i} is invalid` };
    }

    const expectedNum = (i + 1) as 1 | 2 | 3;
    if (scene.scene_number !== expectedNum) {
      return {
        isValid: false,
        error: `Scene entry at index ${i} has scene_number ${scene.scene_number}, expected ${expectedNum}`,
      };
    }

    if (seenSceneNumbers.has(scene.scene_number)) {
      return {
        isValid: false,
        error: `Duplicate scene_number ${scene.scene_number} detected`,
      };
    }
    seenSceneNumbers.add(scene.scene_number);

    if (typeof scene.clip_created !== 'boolean') {
      return {
        isValid: false,
        error: `Scene ${scene.scene_number} clip_created must be boolean`,
      };
    }

    if (scene.clip_created === true) {
      if (typeof scene.marked_at !== 'string' || scene.marked_at.trim().length === 0) {
        return {
          isValid: false,
          error: `Scene ${scene.scene_number} is marked created but marked_at is not a non-empty string`,
        };
      }
    } else {
      if (scene.marked_at !== null) {
        return {
          isValid: false,
          error: `Scene ${scene.scene_number} clip_created is false so marked_at MUST be strictly null`,
        };
      }
    }
  }

  return { isValid: true };
}

/**
 * Pure helper to set clip_created on a specific scene number.
 */
export function setVideoSceneClipCreated(
  state: VideoSceneCompletionState,
  sceneNumber: 1 | 2 | 3,
  clipCreated: boolean,
  timestamp?: string
): VideoSceneCompletionState {
  const updatedScenes = state.scenes.map((s) => {
    if (s.scene_number === sceneNumber) {
      return {
        ...s,
        clip_created: clipCreated,
        marked_at: clipCreated ? (timestamp || new Date().toISOString()) : null,
      };
    }
    return s;
  }) as [VideoSceneCompletionEntry, VideoSceneCompletionEntry, VideoSceneCompletionEntry];

  return {
    ...state,
    scenes: updatedScenes,
    updated_at: timestamp || new Date().toISOString(),
  };
}

/**
 * Returns number of completed scenes (0 to 3).
 */
export function getCompletedVideoSceneCount(
  state: VideoSceneCompletionState | null | undefined
): number {
  if (!state || !Array.isArray(state.scenes)) return 0;
  return state.scenes.filter((s) => s && s.clip_created === true).length;
}

/**
 * Returns true only if all 3 canonical scenes have clip_created === true.
 */
export function areAllVideoScenesCreated(
  state: VideoSceneCompletionState | null | undefined
): boolean {
  if (!state || !Array.isArray(state.scenes) || state.scenes.length !== 3) {
    return false;
  }
  return state.scenes.every((s) => s && s.clip_created === true);
}
