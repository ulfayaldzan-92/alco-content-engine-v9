import type { ProductionCandidate } from './production-candidate';
import type { ProductionAssetInput } from './production-engine';
import type {
  TranslatedProductionPromptBundle,
  ImageTranslatedPromptBundle,
  CarouselTranslatedPromptBundle,
  VideoTranslatedPromptBundle,
} from './prompt-translation';
import { validateProductionCandidate } from './production-candidate';

export type BindTranslatedBundleResult =
  | {
      ok: true;
      assetInput: ProductionAssetInput;
    }
  | {
      ok: false;
      error: string;
    };

/**
 * Pure binding boundary for Phase 4B-A.
 * Validates strict alignment between canonical ProductionCandidate and TranslatedProductionPromptBundle,
 * then constructs authoritative ProductionAssetInput with translated execution authority.
 *
 * IMMUTABLE & FAIL-CLOSED:
 * - Does not mutate candidate or translatedPromptBundle.
 * - Does not invent, summarize, retranslate, or repair prompts.
 * - Does not select another candidate or fallback on mismatch.
 */
export function bindTranslatedPromptBundleToAssetInput(
  candidate: ProductionCandidate,
  bundle: TranslatedProductionPromptBundle
): BindTranslatedBundleResult {
  if (!candidate || typeof candidate !== 'object') {
    return { ok: false, error: 'Candidate must be a valid non-null object.' };
  }

  if (!bundle || typeof bundle !== 'object') {
    return { ok: false, error: 'Translated prompt bundle must be a valid non-null object.' };
  }

  // 1. Candidate validation
  const candValidation = validateProductionCandidate(candidate);
  if (!candValidation.isValid) {
    return {
      ok: false,
      error: `Invalid production candidate: ${candValidation.error}`,
    };
  }

  // 2. Common Alignment Check: asset_type
  if (bundle.asset_type !== candidate.candidate_type) {
    return {
      ok: false,
      error: `Asset type mismatch: bundle asset_type "${bundle.asset_type}" does not match candidate candidate_type "${candidate.candidate_type}".`,
    };
  }

  // 3. Common Alignment Check: candidate_id
  if (bundle.candidate_id !== candidate.candidate_id) {
    return {
      ok: false,
      error: `Candidate ID mismatch: bundle candidate_id "${bundle.candidate_id}" does not match selected candidate "${candidate.candidate_id}".`,
    };
  }

  // 4. Asset-specific binding
  if (candidate.candidate_type === 'image' && bundle.asset_type === 'image') {
    const imgBundle = bundle as ImageTranslatedPromptBundle;
    if (typeof imgBundle.execution_prompt !== 'string' || !imgBundle.execution_prompt.trim()) {
      return {
        ok: false,
        error: 'Image translated bundle execution_prompt must be a non-empty string.',
      };
    }

    const assetInput: ProductionAssetInput = {
      asset_type: 'image',
      image: candidate.production_details,
      final_prompt: imgBundle.execution_prompt,
    };

    return { ok: true, assetInput };
  }

  if (candidate.candidate_type === 'carousel' && bundle.asset_type === 'carousel') {
    const carBundle = bundle as CarouselTranslatedPromptBundle;
    const expectedSlideCount = candidate.production_details.slide_count;

    if (
      typeof expectedSlideCount !== 'number' ||
      !Number.isInteger(expectedSlideCount) ||
      expectedSlideCount <= 0
    ) {
      return {
        ok: false,
        error: 'Carousel candidate slide_count must be a positive integer.',
      };
    }

    if (!Array.isArray(carBundle.slides) || carBundle.slides.length !== expectedSlideCount) {
      return {
        ok: false,
        error: `Carousel translated slide count (${Array.isArray(carBundle.slides) ? carBundle.slides.length : 0}) does not match candidate slide_count (${expectedSlideCount}).`,
      };
    }

    if (typeof carBundle.master_prompt !== 'string' || !carBundle.master_prompt.trim()) {
      return {
        ok: false,
        error: 'Carousel translated bundle master_prompt must be a non-empty string.',
      };
    }

    const slides: { slide_number: number; prompt: string }[] = [];
    for (let i = 0; i < carBundle.slides.length; i++) {
      const slide = carBundle.slides[i];
      if (!slide || typeof slide !== 'object') {
        return {
          ok: false,
          error: `Carousel translated slides[${i}] must be a non-null object.`,
        };
      }

      const expectedSlideNumber = i + 1;
      if (slide.slide_number !== expectedSlideNumber) {
        return {
          ok: false,
          error: `Carousel translated slide sequence mismatch at index ${i}. Expected slide_number ${expectedSlideNumber}, got ${slide.slide_number}.`,
        };
      }

      if (typeof slide.execution_prompt !== 'string' || !slide.execution_prompt.trim()) {
        return {
          ok: false,
          error: `Carousel translated slide ${slide.slide_number} execution_prompt must be a non-empty string.`,
        };
      }

      slides.push({
        slide_number: slide.slide_number,
        prompt: slide.execution_prompt,
      });
    }

    const assetInput: ProductionAssetInput = {
      asset_type: 'carousel',
      carousel: candidate.production_details,
      final_prompts: {
        master_prompt: carBundle.master_prompt,
        slides,
      },
    };

    return { ok: true, assetInput };
  }

  if (candidate.candidate_type === 'video' && bundle.asset_type === 'video') {
    const vidBundle = bundle as VideoTranslatedPromptBundle;

    // Production mode alignment check
    if (vidBundle.production_mode !== candidate.production_details.production_mode) {
      return {
        ok: false,
        error: `Video production_mode mismatch: bundle mode "${vidBundle.production_mode}" does not match candidate mode "${candidate.production_details.production_mode}".`,
      };
    }

    // Require exactly 3 scenes
    if (!Array.isArray(vidBundle.scenes) || vidBundle.scenes.length !== 3) {
      return {
        ok: false,
        error: `Video translated bundle scenes count (${Array.isArray(vidBundle.scenes) ? vidBundle.scenes.length : 0}) must be exactly 3.`,
      };
    }

    // Require exact sequence 1, 2, 3 and non-empty prompts
    for (let i = 0; i < 3; i++) {
      const scene = vidBundle.scenes[i];
      if (!scene || typeof scene !== 'object') {
        return {
          ok: false,
          error: `Video translated bundle scenes[${i}] must be a non-null object.`,
        };
      }

      const expectedSceneNum = (i + 1) as 1 | 2 | 3;
      if (scene.scene_number !== expectedSceneNum) {
        return {
          ok: false,
          error: `Video translated scene sequence mismatch at index ${i}. Expected scene_number ${expectedSceneNum}, got ${scene.scene_number}.`,
        };
      }

      if (typeof scene.start_frame_prompt !== 'string' || !scene.start_frame_prompt.trim()) {
        return {
          ok: false,
          error: `Video translated scene ${scene.scene_number} start_frame_prompt must be a non-empty string.`,
        };
      }

      if (typeof scene.motion_prompt !== 'string' || !scene.motion_prompt.trim()) {
        return {
          ok: false,
          error: `Video translated scene ${scene.scene_number} motion_prompt must be a non-empty string.`,
        };
      }

      if (typeof scene.voiceover !== 'string') {
        return {
          ok: false,
          error: `Video translated scene ${scene.scene_number} voiceover must be a string.`,
        };
      }

      if (typeof scene.on_screen_text !== 'string') {
        return {
          ok: false,
          error: `Video translated scene ${scene.scene_number} on_screen_text must be a string.`,
        };
      }
    }

    const assetInput: ProductionAssetInput = {
      asset_type: 'video',
      video: candidate.production_details,
      // Retained strictly for legacy/source compatibility
      final_prompt: candidate.final_prompt,
      // Canonical execution prompt authority for Phase 4B
      execution_prompts: {
        candidate_id: vidBundle.candidate_id,
        production_mode: vidBundle.production_mode,
        scenes: [
          {
            scene_number: vidBundle.scenes[0].scene_number,
            start_frame_prompt: vidBundle.scenes[0].start_frame_prompt,
            motion_prompt: vidBundle.scenes[0].motion_prompt,
            voiceover: vidBundle.scenes[0].voiceover,
            on_screen_text: vidBundle.scenes[0].on_screen_text,
          },
          {
            scene_number: vidBundle.scenes[1].scene_number,
            start_frame_prompt: vidBundle.scenes[1].start_frame_prompt,
            motion_prompt: vidBundle.scenes[1].motion_prompt,
            voiceover: vidBundle.scenes[1].voiceover,
            on_screen_text: vidBundle.scenes[1].on_screen_text,
          },
          {
            scene_number: vidBundle.scenes[2].scene_number,
            start_frame_prompt: vidBundle.scenes[2].start_frame_prompt,
            motion_prompt: vidBundle.scenes[2].motion_prompt,
            voiceover: vidBundle.scenes[2].voiceover,
            on_screen_text: vidBundle.scenes[2].on_screen_text,
          },
        ],
      },
    };

    return { ok: true, assetInput };
  }

  return {
    ok: false,
    error: `Unsupported asset_type/candidate_type combination: ${candidate.candidate_type} / ${bundle.asset_type}`,
  };
}
