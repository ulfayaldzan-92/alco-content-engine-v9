import type {
  TranslatedProductionPromptBundle,
  ImageTranslatedPromptBundle,
  CarouselTranslatedPromptBundle,
  VideoTranslatedPromptBundle,
} from './prompt-translation';

// ============================================================================
// PHASE 4C-A: CROSS-FORMAT EXECUTION PROMPT AUTHORITY CONTRACT
// Deterministic execution-authority fingerprint identity for Image, Carousel,
// and Video based strictly on TranslatedProductionPromptBundle.
//
// IMMUTABLE & PURE:
// - Zero timestamps, random generators, or UUIDs.
// - Deterministic 32-bit FNV-1a hash formatted as 8-character lowercase hex.
// - Strict fail-closed validation for all formats.
// ============================================================================

export const EXECUTION_PROMPT_CONTRACT_VERSION = 'execution_prompt_v1';

export interface ExecutionPromptAuthority {
  asset_type: 'image' | 'carousel' | 'video';
  candidate_id: string;
  contract_version: string;
  execution_signature: string;
}

export type ExecutionPromptAuthorityResult =
  | {
      ok: true;
      authority: ExecutionPromptAuthority;
    }
  | {
      ok: false;
      error: string;
    };

/**
 * Pure synchronous deterministic 32-bit FNV-1a hash formatted as an 8-character hex string.
 * Operates purely on strings without external/browser-only/crypto dependencies.
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
 * Validates the syntax/format of an execution signature for a given asset type.
 */
export function isValidExecutionSignatureFormat(
  asset_type: 'image' | 'carousel' | 'video',
  signature: string
): boolean {
  if (typeof signature !== 'string') return false;
  if (asset_type === 'image') {
    return /^exec_sig_image_[0-9a-f]{8}$/.test(signature);
  }
  if (asset_type === 'carousel') {
    return /^exec_sig_carousel_[0-9a-f]{8}$/.test(signature);
  }
  if (asset_type === 'video') {
    return /^exec_sig_video_[0-9a-f]{8}$/.test(signature);
  }
  return false;
}

/**
 * Builds a deterministic ExecutionPromptAuthority fingerprint from a validated TranslatedProductionPromptBundle.
 *
 * FAIL CLOSED:
 * - Empty candidate_id fails.
 * - Missing or empty execution prompts fail.
 * - Sequence irregularities (out of order, duplicates, invalid counts) fail.
 * - Unsupported modes or formats fail.
 */
export function buildExecutionPromptAuthority(
  bundle: TranslatedProductionPromptBundle
): ExecutionPromptAuthorityResult {
  if (!bundle || typeof bundle !== 'object') {
    return {
      ok: false,
      error: 'TranslatedProductionPromptBundle must be a non-null object.',
    };
  }

  if (typeof bundle.candidate_id !== 'string' || !bundle.candidate_id.trim()) {
    return {
      ok: false,
      error: 'TranslatedProductionPromptBundle candidate_id must be a non-empty string.',
    };
  }

  const candidateId = bundle.candidate_id.trim();

  // 1. Image Format Authority
  if (bundle.asset_type === 'image') {
    const imgBundle = bundle as ImageTranslatedPromptBundle;
    if (typeof imgBundle.execution_prompt !== 'string' || !imgBundle.execution_prompt.trim()) {
      return {
        ok: false,
        error: 'Image translated bundle execution_prompt must be a non-empty string.',
      };
    }

    const payload = `${EXECUTION_PROMPT_CONTRACT_VERSION}|image|${candidateId}|${imgBundle.execution_prompt}`;
    const hash = hashDeterministicString(payload);
    const execution_signature = `exec_sig_image_${hash}`;

    return {
      ok: true,
      authority: {
        asset_type: 'image',
        candidate_id: candidateId,
        contract_version: EXECUTION_PROMPT_CONTRACT_VERSION,
        execution_signature,
      },
    };
  }

  // 2. Carousel Format Authority
  if (bundle.asset_type === 'carousel') {
    const carBundle = bundle as CarouselTranslatedPromptBundle;
    if (typeof carBundle.master_prompt !== 'string' || !carBundle.master_prompt.trim()) {
      return {
        ok: false,
        error: 'Carousel translated bundle master_prompt must be a non-empty string.',
      };
    }

    if (!Array.isArray(carBundle.slides) || carBundle.slides.length === 0) {
      return {
        ok: false,
        error: 'Carousel translated bundle slides must be a non-empty array.',
      };
    }

    const slidePayloads: string[] = [];
    for (let i = 0; i < carBundle.slides.length; i++) {
      const slide = carBundle.slides[i];
      if (!slide || typeof slide !== 'object') {
        return {
          ok: false,
          error: `Carousel translated slide at index ${i} must be a non-null object.`,
        };
      }

      const expectedSlideNumber = i + 1;
      if (slide.slide_number !== expectedSlideNumber) {
        return {
          ok: false,
          error: `Carousel slide sequence mismatch at index ${i}. Expected slide_number ${expectedSlideNumber}, got ${slide.slide_number}.`,
        };
      }

      if (typeof slide.execution_prompt !== 'string' || !slide.execution_prompt.trim()) {
        return {
          ok: false,
          error: `Carousel slide ${slide.slide_number} execution_prompt must be a non-empty string.`,
        };
      }

      slidePayloads.push(`${slide.slide_number}:${slide.execution_prompt}`);
    }

    const payload = `${EXECUTION_PROMPT_CONTRACT_VERSION}|carousel|${candidateId}|${carBundle.master_prompt}|${carBundle.slides.length}|${slidePayloads.join('|')}`;
    const hash = hashDeterministicString(payload);
    const execution_signature = `exec_sig_carousel_${hash}`;

    return {
      ok: true,
      authority: {
        asset_type: 'carousel',
        candidate_id: candidateId,
        contract_version: EXECUTION_PROMPT_CONTRACT_VERSION,
        execution_signature,
      },
    };
  }

  // 3. Video Format Authority
  if (bundle.asset_type === 'video') {
    const vidBundle = bundle as VideoTranslatedPromptBundle;
    const validModes = ['human_led', 'product_demo', 'motion_explainer'];
    if (!validModes.includes(vidBundle.production_mode)) {
      return {
        ok: false,
        error: `Invalid video production_mode "${vidBundle.production_mode}". Must be human_led, product_demo, or motion_explainer.`,
      };
    }

    if (!Array.isArray(vidBundle.scenes) || vidBundle.scenes.length !== 3) {
      return {
        ok: false,
        error: `Video translated bundle scenes count (${Array.isArray(vidBundle.scenes) ? vidBundle.scenes.length : 0}) must be exactly 3.`,
      };
    }

    const scenePayloads: string[] = [];
    for (let i = 0; i < 3; i++) {
      const scene = vidBundle.scenes[i];
      if (!scene || typeof scene !== 'object') {
        return {
          ok: false,
          error: `Video translated scene at index ${i} must be a non-null object.`,
        };
      }

      const expectedSceneNumber = (i + 1) as 1 | 2 | 3;
      if (scene.scene_number !== expectedSceneNumber) {
        return {
          ok: false,
          error: `Video scene sequence mismatch at index ${i}. Expected scene_number ${expectedSceneNumber}, got ${scene.scene_number}.`,
        };
      }

      if (typeof scene.start_frame_prompt !== 'string' || !scene.start_frame_prompt.trim()) {
        return {
          ok: false,
          error: `Video scene ${scene.scene_number} start_frame_prompt must be a non-empty string.`,
        };
      }

      if (typeof scene.motion_prompt !== 'string' || !scene.motion_prompt.trim()) {
        return {
          ok: false,
          error: `Video scene ${scene.scene_number} motion_prompt must be a non-empty string.`,
        };
      }

      if (typeof scene.voiceover !== 'string') {
        return {
          ok: false,
          error: `Video scene ${scene.scene_number} voiceover must be a string.`,
        };
      }

      if (typeof scene.on_screen_text !== 'string') {
        return {
          ok: false,
          error: `Video scene ${scene.scene_number} on_screen_text must be a string.`,
        };
      }

      scenePayloads.push(
        `${scene.scene_number}:${scene.start_frame_prompt}:${scene.motion_prompt}:${scene.voiceover}:${scene.on_screen_text}`
      );
    }

    const payload = `${EXECUTION_PROMPT_CONTRACT_VERSION}|video|${candidateId}|${vidBundle.production_mode}|${scenePayloads.join('|')}`;
    const hash = hashDeterministicString(payload);
    const execution_signature = `exec_sig_video_${hash}`;

    return {
      ok: true,
      authority: {
        asset_type: 'video',
        candidate_id: candidateId,
        contract_version: EXECUTION_PROMPT_CONTRACT_VERSION,
        execution_signature,
      },
    };
  }

  return {
    ok: false,
    error: `Unsupported asset_type: "${(bundle as any)?.asset_type}".`,
  };
}
