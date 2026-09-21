import {
  ImageProductionCandidate,
  CarouselProductionCandidate,
  VideoProductionCandidate,
  VideoProductionMode,
  VideoSceneProductionPlan,
  validateProductionCandidate,
} from './production-candidate';
import { CharacterDNA } from './content-contract';
import { ProductAssetContext } from './video-production-input';
import { injectCharacterToPrompt } from './character-prompt';

// ==========================================
// TRANSLATION RESULT CONTRACTS
// ==========================================

export interface ImageTranslatedPromptBundle {
  asset_type: 'image';
  candidate_id: string;
  execution_prompt: string;
}

export interface CarouselTranslatedSlidePrompt {
  slide_number: number;
  execution_prompt: string;
}

export interface CarouselTranslatedPromptBundle {
  asset_type: 'carousel';
  candidate_id: string;
  master_prompt: string;
  slides: CarouselTranslatedSlidePrompt[];
}

export interface VideoTranslatedScenePrompt {
  scene_number: 1 | 2 | 3;
  start_frame_prompt: string;
  motion_prompt: string;
  voiceover: string;
  on_screen_text: string;
}

export interface VideoTranslatedPromptBundle {
  asset_type: 'video';
  candidate_id: string;
  production_mode: VideoProductionMode;
  scenes: [
    VideoTranslatedScenePrompt,
    VideoTranslatedScenePrompt,
    VideoTranslatedScenePrompt
  ];
}

export type TranslatedProductionPromptBundle =
  | ImageTranslatedPromptBundle
  | CarouselTranslatedPromptBundle
  | VideoTranslatedPromptBundle;

export type PromptTranslationResult =
  | {
      ok: true;
      bundle: TranslatedProductionPromptBundle;
    }
  | {
      ok: false;
      error: string;
    };

// ==========================================
// IMAGE TRANSLATOR
// ==========================================

export interface TranslateImagePromptInput {
  candidate: ImageProductionCandidate;
  characterDNA?: CharacterDNA | null;
}

export function translateImageProductionPrompt(
  input: TranslateImagePromptInput
): PromptTranslationResult {
  if (!input || typeof input !== 'object' || !input.candidate) {
    return { ok: false, error: 'Candidate missing for image prompt translation (FAIL CLOSED).' };
  }

  const { candidate, characterDNA } = input;

  const validation = validateProductionCandidate(candidate);
  if (!validation.isValid) {
    return { ok: false, error: `Invalid image production candidate: ${validation.error} (FAIL CLOSED).` };
  }

  if (candidate.candidate_type !== 'image') {
    return { ok: false, error: 'Candidate candidate_type must be "image" (FAIL CLOSED).' };
  }

  if (typeof candidate.final_prompt !== 'string' || !candidate.final_prompt.trim()) {
    return { ok: false, error: 'Candidate final_prompt must be non-empty string (FAIL CLOSED).' };
  }

  const basePrompt = candidate.final_prompt;
  const execution_prompt = characterDNA
    ? injectCharacterToPrompt(basePrompt, characterDNA, 'image')
    : basePrompt;

  return {
    ok: true,
    bundle: {
      asset_type: 'image',
      candidate_id: candidate.candidate_id,
      execution_prompt,
    },
  };
}

// ==========================================
// CAROUSEL TRANSLATOR
// ==========================================

export type CarouselVisualFormat = 'photography' | 'infographic' | 'hybrid';

export interface CarouselPromptSlideMetadata {
  slide_number: number;
  visual_format: CarouselVisualFormat;
}

export interface TranslateCarouselPromptInput {
  candidate: CarouselProductionCandidate;
  slides: CarouselPromptSlideMetadata[];
  characterDNA?: CharacterDNA | null;
}

export function translateCarouselProductionPrompts(
  input: TranslateCarouselPromptInput
): PromptTranslationResult {
  if (!input || typeof input !== 'object' || !input.candidate) {
    return { ok: false, error: 'Candidate missing for carousel prompt translation (FAIL CLOSED).' };
  }

  const { candidate, slides: slideMeta, characterDNA } = input;

  const validation = validateProductionCandidate(candidate);
  if (!validation.isValid) {
    return { ok: false, error: `Invalid carousel production candidate: ${validation.error} (FAIL CLOSED).` };
  }

  if (candidate.candidate_type !== 'carousel') {
    return { ok: false, error: 'Candidate candidate_type must be "carousel" (FAIL CLOSED).' };
  }

  const expectedSlideCount = candidate.production_details?.slide_count;
  if (
    typeof expectedSlideCount !== 'number' ||
    !Number.isInteger(expectedSlideCount) ||
    expectedSlideCount < 2
  ) {
    return { ok: false, error: 'Invalid candidate slide_count (FAIL CLOSED).' };
  }

  if (
    !candidate.final_prompts ||
    !Array.isArray(candidate.final_prompts.slides) ||
    candidate.final_prompts.slides.length !== expectedSlideCount
  ) {
    return { ok: false, error: 'Candidate final_prompts.slides length mismatch (FAIL CLOSED).' };
  }

  if (
    typeof candidate.final_prompts.master_prompt !== 'string' ||
    !candidate.final_prompts.master_prompt.trim()
  ) {
    return { ok: false, error: 'Candidate master_prompt must be non-empty (FAIL CLOSED).' };
  }

  if (!Array.isArray(slideMeta) || slideMeta.length !== expectedSlideCount) {
    return { ok: false, error: 'Slide metadata length does not match candidate slide_count (FAIL CLOSED).' };
  }

  const VALID_FORMATS = new Set<CarouselVisualFormat>(['photography', 'infographic', 'hybrid']);
  const seenNumbers = new Set<number>();

  for (let i = 0; i < slideMeta.length; i++) {
    const meta = slideMeta[i];
    if (!meta || typeof meta !== 'object') {
      return { ok: false, error: `Slide metadata at index ${i} is invalid (FAIL CLOSED).` };
    }
    const expectedNum = i + 1;
    if (meta.slide_number !== expectedNum) {
      return { ok: false, error: `Slide metadata sequence mismatch: expected ${expectedNum}, got ${meta.slide_number} (FAIL CLOSED).` };
    }
    if (seenNumbers.has(meta.slide_number)) {
      return { ok: false, error: `Duplicate slide_number ${meta.slide_number} in metadata (FAIL CLOSED).` };
    }
    seenNumbers.add(meta.slide_number);

    if (!meta.visual_format || !VALID_FORMATS.has(meta.visual_format)) {
      return { ok: false, error: `Invalid visual_format "${meta.visual_format}" for slide ${meta.slide_number} (FAIL CLOSED).` };
    }
  }

  const translatedSlides: CarouselTranslatedSlidePrompt[] = [];

  for (let i = 0; i < candidate.final_prompts.slides.length; i++) {
    const candSlide = candidate.final_prompts.slides[i];
    const meta = slideMeta[i];

    if (!candSlide || typeof candSlide.prompt !== 'string' || !candSlide.prompt.trim()) {
      return { ok: false, error: `Candidate slide ${i + 1} prompt is empty (FAIL CLOSED).` };
    }

    const basePrompt = candSlide.prompt;
    const execution_prompt = characterDNA
      ? injectCharacterToPrompt(basePrompt, characterDNA, meta.visual_format)
      : basePrompt;

    translatedSlides.push({
      slide_number: meta.slide_number,
      execution_prompt,
    });
  }

  return {
    ok: true,
    bundle: {
      asset_type: 'carousel',
      candidate_id: candidate.candidate_id,
      master_prompt: candidate.final_prompts.master_prompt,
      slides: translatedSlides,
    },
  };
}

// ==========================================
// VIDEO TRANSLATOR
// ==========================================

export interface TranslateVideoPromptInput {
  candidate: VideoProductionCandidate;
  characterDNA?: CharacterDNA | null;
  productAssetContext?: ProductAssetContext | null;
}

export interface SingleVideoSceneTranslationParams {
  scene: VideoSceneProductionPlan;
  productionMode: VideoProductionMode;
  characterDNA?: CharacterDNA | null;
  productAssetContext?: ProductAssetContext | null;
}

export interface SingleVideoSceneTranslationResult {
  isValid: boolean;
  instructions?: {
    imagePrompt: string;
    motionPrompt: string;
    voiceover: string;
    onScreenText: string;
  };
  error?: string;
}

/**
 * Pure single-scene translation logic shared by Video Translator and legacy helper wrapper.
 */
export function translateSingleVideoScenePrompt(
  params: SingleVideoSceneTranslationParams
): SingleVideoSceneTranslationResult {
  const { scene, productionMode, characterDNA, productAssetContext } = params;

  if (!scene || typeof scene !== 'object') {
    return {
      isValid: false,
      error: 'Scene canonical wajib tersedia (FAIL CLOSED).',
    };
  }

  const voiceover = scene.voiceover || '—';
  const onScreenText = scene.on_screen_text || '—';

  let imagePrompt = '';
  let motionPrompt = '';

  if (productionMode === 'human_led') {
    const characterSubject =
      characterDNA?.prompt_assets?.dna_summary_prompt ||
      characterDNA?.prompt_assets?.locked_visual_prompt;

    if (!characterSubject || typeof characterSubject !== 'string' || !characterSubject.trim()) {
      return {
        isValid: false,
        error: 'CharacterDNA dengan prompt_assets wajib tersedia untuk mode human_led (FAIL CLOSED).',
      };
    }

    imagePrompt = `Start Frame Image Prompt (Format 9:16 Vertical):
Subject: ${characterSubject.trim()}
Visual Direction: ${scene.visual_direction || '—'}
Action: ${scene.action || '—'}
Camera: ${scene.camera || '—'}
On-Screen Text: ${scene.on_screen_text || '—'}
Negative Constraints: no blurry text, no distorted anatomy, no visual artifacts`;

    motionPrompt = `Video Motion Prompt (Google FX Studio / Veo):
Camera: ${scene.camera || '—'}
Action: ${scene.action || '—'}
Voiceover Cue: "${voiceover}"
On-Screen Text Cue: "${onScreenText}"
Duration: ${scene.duration_seconds}s
Format: 9:16 vertical video
Negative Constraints: no abrupt cuts, no jittery camera, no distorted motion artifacts`;
  } else if (productionMode === 'product_demo') {
    if (!productAssetContext || typeof productAssetContext !== 'object') {
      return {
        isValid: false,
        error: 'ProductAssetContext wajib tersedia untuk mode product_demo (FAIL CLOSED).',
      };
    }

    const prodName = productAssetContext.product_name;
    if (!prodName || typeof prodName !== 'string' || !prodName.trim()) {
      return {
        isValid: false,
        error: 'product_name wajib tersedia pada ProductAssetContext untuk mode product_demo (FAIL CLOSED).',
      };
    }

    const validScreenshots = Array.isArray(productAssetContext.screenshots)
      ? productAssetContext.screenshots.filter(
          (s) =>
            s &&
            s.kind === 'screenshot' &&
            typeof s.id === 'string' &&
            s.id.trim().length > 0 &&
            typeof s.name === 'string' &&
            s.name.trim().length > 0
        )
      : [];

    if (validScreenshots.length === 0) {
      return {
        isValid: false,
        error: 'Minimal 1 screenshot valid wajib tersedia pada ProductAssetContext untuk mode product_demo (FAIL CLOSED).',
      };
    }

    const screenshotListText = validScreenshots
      .map((s, idx) => `[Screenshot ${idx + 1}: ${s.name}]`)
      .join(', ');

    imagePrompt = `Start Frame Image Prompt (Format 9:16 Vertical):
Product: ${prodName.trim()}
Screenshots: ${screenshotListText}
Visual Direction: ${scene.visual_direction || '—'}
Action: ${scene.action || '—'}
Camera: ${scene.camera || '—'}
On-Screen Text: ${scene.on_screen_text || '—'}
Negative Constraints: no blurry text, no distorted UI, no broken layout geometry`;

    motionPrompt = `Video Motion Prompt (Google FX Studio / Veo):
Camera: ${scene.camera || '—'}
Action: ${scene.action || '—'}
Voiceover Cue: "${voiceover}"
On-Screen Text Cue: "${onScreenText}"
Duration: ${scene.duration_seconds}s
Format: 9:16 vertical video
Negative Constraints: no glitchy transitions, no blurry screen elements, no erratic motion`;
  } else if (productionMode === 'motion_explainer') {
    imagePrompt = `Start Frame Image Prompt (Format 9:16 Vertical):
Visual Direction: ${scene.visual_direction || '—'}
Camera: ${scene.camera || '—'}
On-Screen Text: ${scene.on_screen_text || '—'}
Negative Constraints: no photorealistic person, no messy sketch, no blurry text`;

    motionPrompt = `Video Motion Prompt (Google FX Studio / Veo):
Camera: ${scene.camera || '—'}
Action: ${scene.action || '—'}
Visual Direction: ${scene.visual_direction || '—'}
Voiceover Cue: "${voiceover}"
On-Screen Text Cue: "${onScreenText}"
Duration: ${scene.duration_seconds}s
Format: 9:16 vertical video
Negative Constraints: no abrupt cuts, no jittery animation, no unreadable typography`;
  } else {
    return {
      isValid: false,
      error: `Mode produksi video "${productionMode}" tidak dikenal (FAIL CLOSED).`,
    };
  }

  return {
    isValid: true,
    instructions: {
      imagePrompt,
      motionPrompt,
      voiceover,
      onScreenText,
    },
  };
}

export function translateVideoProductionPrompts(
  input: TranslateVideoPromptInput
): PromptTranslationResult {
  if (!input || typeof input !== 'object' || !input.candidate) {
    return { ok: false, error: 'Candidate missing for video prompt translation (FAIL CLOSED).' };
  }

  const { candidate, characterDNA, productAssetContext } = input;

  const validation = validateProductionCandidate(candidate);
  if (!validation.isValid) {
    return { ok: false, error: `Invalid video production candidate: ${validation.error} (FAIL CLOSED).` };
  }

  if (candidate.candidate_type !== 'video') {
    return { ok: false, error: 'Candidate candidate_type must be "video" (FAIL CLOSED).' };
  }

  const mode = candidate.production_details?.production_mode;
  if (mode !== 'human_led' && mode !== 'product_demo' && mode !== 'motion_explainer') {
    return { ok: false, error: `Unknown or invalid production_mode "${mode}" (FAIL CLOSED).` };
  }

  const scenes = candidate.production_details?.scenes;
  if (!Array.isArray(scenes) || scenes.length !== 3) {
    return { ok: false, error: 'Video candidate must have exactly 3 scenes (FAIL CLOSED).' };
  }

  // Check scene index sequence
  for (let i = 0; i < 3; i++) {
    const s = scenes[i];
    if (!s || s.scene_number !== (i + 1)) {
      return { ok: false, error: `Video scene sequence mismatch at index ${i} (FAIL CLOSED).` };
    }
  }

  const translatedScenes: VideoTranslatedScenePrompt[] = [];

  for (let i = 0; i < 3; i++) {
    const scene = scenes[i];
    const sceneRes = translateSingleVideoScenePrompt({
      scene,
      productionMode: mode,
      characterDNA,
      productAssetContext,
    });

    if (!sceneRes.isValid || !sceneRes.instructions) {
      return {
        ok: false,
        error: sceneRes.error || `Scene ${i + 1} translation failed (FAIL CLOSED).`,
      };
    }

    translatedScenes.push({
      scene_number: (i + 1) as 1 | 2 | 3,
      start_frame_prompt: sceneRes.instructions.imagePrompt,
      motion_prompt: sceneRes.instructions.motionPrompt,
      voiceover: sceneRes.instructions.voiceover,
      on_screen_text: sceneRes.instructions.onScreenText,
    });
  }

  return {
    ok: true,
    bundle: {
      asset_type: 'video',
      candidate_id: candidate.candidate_id,
      production_mode: mode,
      scenes: [
        translatedScenes[0],
        translatedScenes[1],
        translatedScenes[2],
      ],
    },
  };
}
