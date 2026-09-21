import {
  ImageProductionDetails,
  CarouselProductionDetails,
  CarouselSlideProductionPlan,
  CarouselFinalPrompts,
  VideoProductionDetails,
  VideoSceneProductionPlan,
  VideoProductionMode,
} from './production-contract';

export type {
  ImageProductionDetails,
  CarouselProductionDetails,
  CarouselSlideProductionPlan,
  CarouselFinalPrompts,
  VideoProductionDetails,
  VideoSceneProductionPlan,
  VideoProductionMode,
};
import { FunnelStage } from './content-contract';

// ============================================================================
// CANONICAL PRODUCTION CANDIDATES (PHASE 3C-A)
// Vendor-neutral, structured production candidates before package creation
// ============================================================================

export interface ImageProductionCandidate {
  candidate_type: 'image';
  candidate_id: string;
  production_details: ImageProductionDetails;
  final_prompt: string;
}

export interface CarouselProductionCandidate {
  candidate_type: 'carousel';
  candidate_id: string;
  production_details: CarouselProductionDetails;
  final_prompts: CarouselFinalPrompts;
}

export interface VideoProductionCandidate {
  candidate_type: 'video';
  candidate_id: string;
  production_details: VideoProductionDetails;
  final_prompt: string;
}

export type ProductionCandidate =
  | ImageProductionCandidate
  | CarouselProductionCandidate
  | VideoProductionCandidate;

export interface ProductionCandidateValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Maps canonical video production mode deterministically to semantic candidate ID.
 */
export function getVideoCandidateId(
  mode: VideoProductionMode
): string {
  switch (mode) {
    case 'human_led':
      return 'video_human_led';
    case 'product_demo':
      return 'video_product_demo';
    case 'motion_explainer':
      return 'video_motion_explainer';
  }
}

// Forbidden fields that belong strictly to ProductionPackage authority layer (Phase 3B)
const FORBIDDEN_AUTHORITY_FIELDS = [
  'project_id',
  'content_item_id',
  'calendar_item_id',
  'strategy_snapshot',
  'content_snapshot',
  'brand_visual_snapshot',
  'production_status',
  'package_id',
  'created_at',
];

/**
 * Validates a candidate against the canonical schema.
 * Rejects any candidate containing package authority fields or malformed data.
 */
export function validateProductionCandidate(
  candidate: unknown
): ProductionCandidateValidationResult {
  if (!candidate || typeof candidate !== 'object') {
    return { isValid: false, error: 'Candidate must be a non-null object' };
  }

  const obj = candidate as Record<string, any>;

  // Check forbidden authority fields
  for (const field of FORBIDDEN_AUTHORITY_FIELDS) {
    if (field in obj && obj[field] !== undefined) {
      return {
        isValid: false,
        error: `Candidate must not contain authoritative package field: ${field}`,
      };
    }
  }

  const candidateType = obj.candidate_type;
  if (!candidateType || !['image', 'carousel', 'video'].includes(candidateType)) {
    return {
      isValid: false,
      error: `Invalid candidate_type: ${candidateType}. Must be 'image', 'carousel', or 'video'`,
    };
  }

  const candidateId = obj.candidate_id;
  if (typeof candidateId !== 'string' || candidateId.trim().length === 0) {
    return { isValid: false, error: 'candidate_id must be a non-empty string' };
  }

  const details = obj.production_details;
  if (!details || typeof details !== 'object') {
    return { isValid: false, error: 'production_details must be a non-null object' };
  }

  // IMAGE CANDIDATE VALIDATION
  if (candidateType === 'image') {
    const finalPrompt = obj.final_prompt;
    if (typeof finalPrompt !== 'string' || finalPrompt.trim().length === 0) {
      return { isValid: false, error: 'final_prompt must be a non-empty string for image candidate' };
    }

    const nonEmptyImageFields: Array<keyof ImageProductionDetails> = [
      'objective',
      'scene',
      'subject',
      'composition',
      'environment',
      'lighting',
      'camera_direction',
      'visual_style',
      'negative_constraints',
    ];

    for (const field of nonEmptyImageFields) {
      const val = details[field];
      if (typeof val !== 'string' || val.trim().length === 0) {
        return {
          isValid: false,
          error: `Missing or empty required image production detail: ${field}`,
        };
      }
    }

    const allowedEmptyImageFields: Array<keyof ImageProductionDetails> = [
      'text_overlay',
      'branding',
    ];

    for (const field of allowedEmptyImageFields) {
      if (typeof details[field] !== 'string') {
        return {
          isValid: false,
          error: `image.${field} must be a string in ImageProductionCandidate`,
        };
      }
    }

    return { isValid: true };
  }

  // CAROUSEL CANDIDATE VALIDATION
  if (candidateType === 'carousel') {
    const nonEmptyCarouselFields: Array<keyof CarouselProductionDetails> = [
      'objective',
      'cover_direction',
      'visual_continuity',
      'negative_constraints',
    ];

    for (const field of nonEmptyCarouselFields) {
      const val = details[field];
      if (typeof val !== 'string' || val.trim().length === 0) {
        return {
          isValid: false,
          error: `Missing or empty required carousel production detail: ${field}`,
        };
      }
    }

    if (typeof details.branding !== 'string') {
      return {
        isValid: false,
        error: 'carousel.branding must be a string in CarouselProductionCandidate',
      };
    }

    const slideCount = details.slide_count;
    if (typeof slideCount !== 'number' || !Number.isInteger(slideCount) || slideCount <= 0) {
      return { isValid: false, error: 'slide_count must be a positive integer' };
    }

    const slides = details.slides;
    if (!Array.isArray(slides) || slides.length !== slideCount) {
      return {
        isValid: false,
        error: `Carousel slides count (${Array.isArray(slides) ? slides.length : 0}) does not match slide_count (${slideCount})`,
      };
    }

    const validSlideRoles = new Set([
      'hook',
      'problem',
      'reframe',
      'solution',
      'how_it_works',
      'framework',
      'proof',
      'value',
      'cta',
      'learn',
      'content',
      'bridge',
      'case_study',
      'comparison',
      'action',
      'checklist',
      'takeaway',
      'quote',
      'cover',
    ]);

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      if (!slide || typeof slide !== 'object') {
        return { isValid: false, error: `Invalid slide object at index ${i}` };
      }
      if (slide.slide_number !== i + 1) {
        return {
          isValid: false,
          error: `Slide at index ${i} has invalid slide_number ${slide.slide_number}, expected ${i + 1}`,
        };
      }
      if (typeof slide.role !== 'string' || !validSlideRoles.has(slide.role.toLowerCase().trim())) {
        return { isValid: false, error: `Slide ${i + 1} has invalid role: ${slide.role}` };
      }
      const requiredSlideFields: Array<keyof CarouselSlideProductionPlan> = [
        'role',
        'headline',
        'body',
        'visual_direction',
        'layout_direction',
      ];
      for (const field of requiredSlideFields) {
        const val = slide[field];
        if (typeof val !== 'string' || val.trim().length === 0) {
          return { isValid: false, error: `Slide ${i + 1} missing or empty ${field}` };
        }
      }
    }

    const finalPrompts = obj.final_prompts;
    if (!finalPrompts || typeof finalPrompts !== 'object') {
      return { isValid: false, error: 'final_prompts must be a non-null object for carousel candidate' };
    }
    if (typeof finalPrompts.master_prompt !== 'string' || finalPrompts.master_prompt.trim().length === 0) {
      return { isValid: false, error: 'final_prompts.master_prompt must be a non-empty string' };
    }
    if (!Array.isArray(finalPrompts.slides) || finalPrompts.slides.length !== slideCount) {
      return {
        isValid: false,
        error: `final_prompts.slides count (${Array.isArray(finalPrompts.slides) ? finalPrompts.slides.length : 0}) does not match slide_count (${slideCount})`,
      };
    }

    for (let i = 0; i < finalPrompts.slides.length; i++) {
      const sp = finalPrompts.slides[i];
      if (!sp || typeof sp !== 'object') {
        return { isValid: false, error: `Invalid slide prompt at index ${i}` };
      }
      if (sp.slide_number !== i + 1) {
        return {
          isValid: false,
          error: `final_prompts.slides at index ${i} has invalid slide_number ${sp.slide_number}, expected ${i + 1}`,
        };
      }
      if (typeof sp.prompt !== 'string' || sp.prompt.trim().length === 0) {
        return { isValid: false, error: `final_prompts.slides at slide ${i + 1} has empty prompt` };
      }
    }

    return { isValid: true };
  }

  // VIDEO CANDIDATE VALIDATION
  if (candidateType === 'video') {
    const validModes: VideoProductionMode[] = ['human_led', 'product_demo', 'motion_explainer'];
    const mode = details.production_mode;
    if (!mode || !validModes.includes(mode)) {
      return {
        isValid: false,
        error: `Invalid production_mode: ${mode}. Must be 'human_led', 'product_demo', or 'motion_explainer'`,
      };
    }

    const finalPrompt = obj.final_prompt;
    if (typeof finalPrompt !== 'string' || finalPrompt.trim().length === 0) {
      return { isValid: false, error: 'final_prompt must be a non-empty string for video candidate' };
    }

    const duration = details.duration_seconds;
    if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) {
      return { isValid: false, error: 'duration_seconds must be a positive finite number' };
    }

    const scenes = details.scenes;
    if (!Array.isArray(scenes) || scenes.length !== 3) {
      return { isValid: false, error: `scenes count (${Array.isArray(scenes) ? scenes.length : 0}) must be exactly 3` };
    }

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      if (!scene || typeof scene !== 'object') {
        return { isValid: false, error: `Invalid scene object at index ${i}` };
      }
      if (scene.scene_number !== i + 1) {
        return {
          isValid: false,
          error: `Scene at index ${i} has invalid scene_number ${scene.scene_number}, expected ${i + 1}`,
        };
      }
      if (typeof scene.duration_seconds !== 'number' || !Number.isFinite(scene.duration_seconds) || scene.duration_seconds <= 0) {
        return { isValid: false, error: `Scene ${i + 1} has invalid duration_seconds` };
      }

      const validSceneTypes = ['talking_head', 'product_screen', 'graphic_motion', 'b_roll', 'end_card'];
      if (!validSceneTypes.includes(scene.scene_type)) {
        return {
          isValid: false,
          error: `Scene ${i + 1} has invalid scene_type "${scene.scene_type}". Must be talking_head, product_screen, graphic_motion, b_roll, or end_card.`,
        };
      }

      if (!Array.isArray(scene.required_assets)) {
        return {
          isValid: false,
          error: `Scene ${i + 1} required_assets must be a valid array of strings.`,
        };
      }

      for (const asset of scene.required_assets) {
        if (typeof asset !== 'string' || asset.trim().length === 0) {
          return {
            isValid: false,
            error: `Scene ${i + 1} required_assets contains empty or whitespace-only asset token.`,
          };
        }
      }

      const nonEmptySceneFields: Array<keyof VideoSceneProductionPlan> = [
        'purpose',
        'visual_direction',
        'action',
        'camera',
      ];
      for (const field of nonEmptySceneFields) {
        const val = scene[field];
        if (typeof val !== 'string' || val.trim().length === 0) {
          return { isValid: false, error: `Scene ${i + 1} missing or empty ${field}` };
        }
      }
      const allowedEmptySceneFields: Array<keyof VideoSceneProductionPlan> = [
        'voiceover',
        'on_screen_text',
      ];
      for (const field of allowedEmptySceneFields) {
        if (typeof scene[field] !== 'string') {
          return { isValid: false, error: `Scene ${i + 1} ${field} must be a string` };
        }
      }
    }

    const nonEmptyStringFields: Array<keyof VideoProductionDetails> = [
      'objective',
      'format',
      'hook',
      'camera_direction',
      'motion_direction',
      'audio_direction',
      'negative_constraints',
    ];

    for (const field of nonEmptyStringFields) {
      const val = details[field];
      if (typeof val !== 'string' || val.trim().length === 0) {
        return {
          isValid: false,
          error: `Missing or empty required video production detail: ${field}`,
        };
      }
    }

    const allowedEmptyStringFields: Array<keyof VideoProductionDetails> = [
      'voiceover',
      'on_screen_text',
      'branding',
    ];

    for (const field of allowedEmptyStringFields) {
      if (typeof details[field] !== 'string') {
        return {
          isValid: false,
          error: `video.${field} must be a string in VideoProductionCandidate`,
        };
      }
    }

    // Mode consistency check
    const sceneTypes = (details.scenes as Array<{ scene_type?: string }>).map((s) => s.scene_type);
    if (mode === 'human_led' && !sceneTypes.includes('talking_head')) {
      return {
        isValid: false,
        error: 'VideoProductionCandidate with production_mode "human_led" must contain at least one scene with scene_type "talking_head".',
      };
    }
    if (mode === 'product_demo' && !sceneTypes.includes('product_screen')) {
      return {
        isValid: false,
        error: 'VideoProductionCandidate with production_mode "product_demo" must contain at least one scene with scene_type "product_screen".',
      };
    }
    if (mode === 'motion_explainer' && !sceneTypes.includes('graphic_motion')) {
      return {
        isValid: false,
        error: 'VideoProductionCandidate with production_mode "motion_explainer" must contain at least one scene with scene_type "graphic_motion".',
      };
    }

    return { isValid: true };
  }

  return { isValid: false, error: 'Unknown candidate type' };
}

/**
 * Builds an ImageProductionCandidate from clean structured values.
 */
export function buildImageProductionCandidate(params: {
  candidate_id: string;
  visualObjective: string;
  scene: string;
  subject: string;
  composition: string;
  environment: string;
  lighting: string;
  camera: string;
  visualStyle: string;
  textOverlay: string;
  branding?: string;
  negativeConstraints?: string;
  finalPrompt: string;
}): ImageProductionCandidate {
  return {
    candidate_type: 'image',
    candidate_id: params.candidate_id,
    production_details: {
      objective: params.visualObjective,
      scene: params.scene,
      subject: params.subject,
      composition: params.composition,
      environment: params.environment,
      lighting: params.lighting,
      camera_direction: params.camera,
      visual_style: params.visualStyle,
      text_overlay: params.textOverlay,
      branding: params.branding ?? '',
      negative_constraints:
        typeof params.negativeConstraints === 'string'
          ? params.negativeConstraints
          : '',
    },
    final_prompt: params.finalPrompt,
  };
}

/**
 * Builds a CarouselProductionCandidate from clean structured values.
 */
export function buildCarouselProductionCandidate(params: {
  candidate_id: string;
  objective: string;
  slide_count: number;
  cover_direction: string;
  slides: CarouselSlideProductionPlan[];
  visual_continuity: string;
  branding?: string;
  negative_constraints?: string;
  final_prompts: CarouselFinalPrompts;
}): CarouselProductionCandidate {
  return {
    candidate_type: 'carousel',
    candidate_id: params.candidate_id,
    production_details: {
      objective: params.objective,
      slide_count: params.slide_count,
      cover_direction: params.cover_direction,
      slides: params.slides,
      visual_continuity: params.visual_continuity,
      branding: params.branding ?? '',
      negative_constraints: params.negative_constraints ?? '',
    },
    final_prompts: params.final_prompts,
  };
}

/**
 * Helper to build vendor-neutral structured scene plan for videos.
 */
export function buildCanonicalVideoScenePlan(
  funnelStage: FunnelStage,
  productionMode: VideoProductionMode,
  script?: {
    hook?: string;
    masalah?: string;
    solusi?: string;
    proof?: string;
    cta?: string;
  }
): VideoSceneProductionPlan[] {
  const validModes: VideoProductionMode[] = ['human_led', 'product_demo', 'motion_explainer'];
  if (!productionMode || !validModes.includes(productionMode)) {
    throw new Error(`Invalid video productionMode: ${productionMode}. Must be 'human_led', 'product_demo', or 'motion_explainer'.`);
  }

  const stage = funnelStage;
  const hookText = script?.hook || '';
  const valueText = script?.solusi || script?.masalah || '';
  const actionText = script?.cta || '';

  if (productionMode === 'product_demo') {
    if (stage === 'BOFU') {
      return [
        {
          scene_number: 1,
          duration_seconds: 5,
          purpose: 'Proof Hook',
          visual_direction: script?.proof
            ? `Visual interface produk menampilkan bukti performa: ${script.proof}`
            : 'Visual antarmuka produk yang menonjolkan nilai solusi utama.',
          action: 'Animasi visual produk yang membuktikan efektivitas solusi.',
          camera: 'Slow pan ke visual antarmuka produk.',
          voiceover: hookText,
          on_screen_text: hookText,
          scene_type: 'product_screen',
          required_assets: ['product_screenshot'],
        },
        {
          scene_number: 2,
          duration_seconds: 7,
          purpose: 'Offer Demo',
          visual_direction: 'Demonstrasi fitur dan keunggulan produk yang relevan dengan pesan konten.',
          action: 'Visual menyorot fitur, penawaran, atau elemen produk yang relevan dengan pesan konten.',
          camera: 'Screen capture jernih.',
          voiceover: valueText,
          on_screen_text: valueText,
          scene_type: 'product_screen',
          required_assets: ['product_screenshot'],
        },
        {
          scene_number: 3,
          duration_seconds: 6,
          purpose: 'Decision CTA',
          visual_direction: 'Tampilan produk atau interface yang mendukung CTA dari ContentItem.',
          action: 'End card menampilkan CTA authoritative dari konten.',
          camera: 'Static vertical frame.',
          voiceover: actionText,
          on_screen_text: actionText,
          scene_type: 'end_card',
          required_assets: ['logo_reference'],
        },
      ];
    }
    if (stage === 'MOFU') {
      return [
        {
          scene_number: 1,
          duration_seconds: 5,
          purpose: 'Specific Problem Hook',
          visual_direction: 'Menunjukkan perbandingan masalah dan konteks di layar produk.',
          action: 'Sorotan visual pada area kendala audiens yang diatasi produk.',
          camera: 'Zoom in dinamis ke area fokus masalah.',
          voiceover: hookText,
          on_screen_text: hookText,
          scene_type: 'product_screen',
          required_assets: ['product_screenshot'],
        },
        {
          scene_number: 2,
          duration_seconds: 7,
          purpose: 'Workflow Walkthrough',
          visual_direction: 'Langkah demi langkah demonstrasi alur fitur utama.',
          action: 'Visual demonstrasi alur kerja produk dalam memecahkan masalah.',
          camera: 'Screen tracking mulus dengan efek sorotan.',
          voiceover: valueText,
          on_screen_text: valueText,
          scene_type: 'product_screen',
          required_assets: ['product_screenshot'],
        },
        {
          scene_number: 3,
          duration_seconds: 6,
          purpose: 'Medium CTA',
          visual_direction: 'Tampilan interface produk dengan ajakan eksplorasi.',
          action: 'End card menampilkan arahan aksi dan logo resmi.',
          camera: 'Static layout vertikal.',
          voiceover: actionText,
          on_screen_text: actionText,
          scene_type: 'end_card',
          required_assets: ['logo_reference'],
        },
      ];
    }
    // TOFU Product Demo
    return [
      {
        scene_number: 1,
        duration_seconds: 5,
        purpose: 'Curiosity Hook',
        visual_direction: 'Cuplikan penggunaan produk secara cepat menarik minat.',
        action: 'Menampilkan interaksi pertama dengan visual produk yang estetik.',
        camera: 'Panning shot produk dari sudut menarik.',
        voiceover: hookText,
        on_screen_text: hookText,
        scene_type: 'b_roll',
        required_assets: ['product_screenshot'],
      },
      {
        scene_number: 2,
        duration_seconds: 7,
        purpose: 'Product Awareness',
        visual_direction: 'Tampilan antarmuka produk yang bersih dan modern.',
        action: 'Fokus visual ke bagian fitur utama yang memecahkan masalah.',
        camera: 'Screencast jernih dengan tracking halus.',
        voiceover: valueText,
        on_screen_text: valueText,
        scene_type: 'product_screen',
        required_assets: ['product_screenshot'],
      },
      {
        scene_number: 3,
        duration_seconds: 6,
        purpose: 'Soft CTA',
        visual_direction: 'Kartu penutup minimalis dengan identitas visual produk.',
        action: 'Animasi visual penutup dan petunjuk eksplorasi konten.',
        camera: 'Static vertical layout.',
        voiceover: actionText,
        on_screen_text: actionText,
        scene_type: 'end_card',
        required_assets: ['logo_reference'],
      },
    ];
  }

  if (productionMode === 'motion_explainer') {
    if (stage === 'BOFU') {
      return [
        {
          scene_number: 1,
          duration_seconds: 5,
          purpose: 'Proof Hook',
          visual_direction: script?.proof
            ? `Grafik motion menampilkan ringkasan data: ${script.proof}`
            : 'Tipografi bergerak dan visual motion yang menampilkan poin kunci konten.',
          action: 'Animasi elemen grafis dinamis mempertegas pesan utama.',
          camera: 'Zoom in dinamis pada elemen grafis kunci.',
          voiceover: hookText,
          on_screen_text: hookText,
          scene_type: 'graphic_motion',
          required_assets: ['motion_graphic'],
        },
        {
          scene_number: 2,
          duration_seconds: 7,
          purpose: 'Process Showcase',
          visual_direction: 'Visualisasi alur proses dan diferensiasi solusi.',
          action: 'Animasi diagram atau elemen grafis bergerak menampilkan keunggulan solusi.',
          camera: 'Isometric view motion.',
          voiceover: valueText,
          on_screen_text: valueText,
          scene_type: 'graphic_motion',
          required_assets: ['brand_visual'],
        },
        {
          scene_number: 3,
          duration_seconds: 6,
          purpose: 'Decision CTA',
          visual_direction: 'Slide penutup motion dengan instruksi tindak lanjut yang jelas.',
          action: 'End card menampilkan teks langkah tindak lanjut dan CTA konten.',
          camera: 'Static center frame.',
          voiceover: actionText,
          on_screen_text: actionText,
          scene_type: 'end_card',
          required_assets: ['end_card_graphic'],
        },
      ];
    }
    if (stage === 'MOFU') {
      return [
        {
          scene_number: 1,
          duration_seconds: 5,
          purpose: 'Insight Hook',
          visual_direction: 'Grafik masalah dengan animasi visual terstruktur.',
          action: 'Animasi grafis menggambarkan pergeseran dari masalah menuju kejelasan.',
          camera: 'Zoom out dinamis.',
          voiceover: hookText,
          on_screen_text: hookText,
          scene_type: 'graphic_motion',
          required_assets: ['motion_graphic'],
        },
        {
          scene_number: 2,
          duration_seconds: 7,
          purpose: 'Framework Breakdown',
          visual_direction: 'Animasi diagram tahapan atau poin framework terstruktur.',
          action: 'Poin framework muncul berurutan diiringi transisi motion yang rapi.',
          camera: 'Smooth slider transition.',
          voiceover: valueText,
          on_screen_text: valueText,
          scene_type: 'graphic_motion',
          required_assets: ['brand_visual'],
        },
        {
          scene_number: 3,
          duration_seconds: 6,
          purpose: 'Medium CTA',
          visual_direction: 'Kartu rangkuman dengan visual ajakan bertindak.',
          action: 'Animasi rangkuman beralih menjadi tampilan CTA konten.',
          camera: 'Static focus.',
          voiceover: actionText,
          on_screen_text: actionText,
          scene_type: 'end_card',
          required_assets: ['end_card_graphic'],
        },
      ];
    }
    // TOFU Motion Explainer
    return [
      {
        scene_number: 1,
        duration_seconds: 5,
        purpose: 'Visual Hook',
        visual_direction: 'Tipografi bergerak (motion text) tebal dan warna kontras.',
        action: 'Teks beranimasi muncul secara ritmis dan dinamis.',
        camera: 'Dynamic transition zoom.',
        voiceover: hookText,
        on_screen_text: hookText,
        scene_type: 'graphic_motion',
        required_assets: ['motion_graphic'],
      },
      {
        scene_number: 2,
        duration_seconds: 7,
        purpose: 'Concept Awareness',
        visual_direction: 'Ilustrasi konsep visual berupa bentuk geometris dan relasi grafis.',
        action: 'Animasi elemen grafis berputar menjelaskan relasi ide.',
        camera: 'Symmetrical orthographic view.',
        voiceover: valueText,
        on_screen_text: valueText,
        scene_type: 'graphic_motion',
        required_assets: ['motion_graphic'],
      },
      {
        scene_number: 3,
        duration_seconds: 6,
        purpose: 'Soft CTA',
        visual_direction: 'Animasi teks ajakan bertindak minimalis.',
        action: 'Tulisan CTA memudar masuk dari tengah layar.',
        camera: 'Static vertical alignment.',
        voiceover: actionText,
        on_screen_text: actionText,
        scene_type: 'end_card',
        required_assets: ['end_card_graphic'],
      },
    ];
  }

  // Explicit Human Led mode (no silent fallback)
  if (productionMode === 'human_led') {
    if (stage === 'BOFU') {
      return [
        {
          scene_number: 1,
          duration_seconds: 5,
          purpose: 'Proof Hook',
          visual_direction: script?.proof
            ? `Talent menyampaikan poin bukti: ${script.proof}`
            : 'Talent berbicara percaya diri menyampaikan poin penegasan hasil.',
          action: 'Talent menatap kamera menyampaikan pesan utama dengan meyakinkan.',
          camera: 'Close-up vertikal terang.',
          voiceover: hookText,
          on_screen_text: hookText,
          scene_type: 'talking_head',
          required_assets: ['character'],
        },
        {
          scene_number: 2,
          duration_seconds: 7,
          purpose: 'Offer Benefit',
          visual_direction: 'Talent merekomendasikan solusi utama dengan mantap.',
          action: 'Talent mengarahkan gestur menjelaskan manfaat inti solusi.',
          camera: 'Medium close-up vertikal.',
          voiceover: valueText,
          on_screen_text: valueText,
          scene_type: 'talking_head',
          required_assets: ['character'],
        },
        {
          scene_number: 3,
          duration_seconds: 6,
          purpose: 'Decision CTA',
          visual_direction: 'Talent mengarahkan audiens untuk merespons CTA.',
          action: 'Talent memberikan isyarat visual penutup sesuai ajakan bertindak konten.',
          camera: 'Medium shot vertikal.',
          voiceover: actionText,
          on_screen_text: actionText,
          scene_type: 'talking_head',
          required_assets: ['character'],
        },
      ];
    }

    if (stage === 'MOFU') {
      return [
        {
          scene_number: 1,
          duration_seconds: 5,
          purpose: 'Specific Problem Hook',
          visual_direction: 'Talent berekspresi fokus membahas masalah audiens.',
          action: 'Talent menatap kamera dengan gestur bertanya.',
          camera: 'Close-up vertikal.',
          voiceover: hookText,
          on_screen_text: hookText,
          scene_type: 'talking_head',
          required_assets: ['character'],
        },
        {
          scene_number: 2,
          duration_seconds: 7,
          purpose: 'Framework Solution',
          visual_direction: 'Talent menjelaskan poin-poin framework dengan detail.',
          action: 'Talent menghitung poin menggunakan gestur tangan yang jelas.',
          camera: 'Medium close-up vertikal.',
          voiceover: valueText,
          on_screen_text: valueText,
          scene_type: 'talking_head',
          required_assets: ['character'],
        },
        {
          scene_number: 3,
          duration_seconds: 6,
          purpose: 'Medium CTA',
          visual_direction: 'Talent mengajak interaksi atau diskusi seputar konten.',
          action: 'Talent melambaikan tangan atau menunjuk mengajak interaksi.',
          camera: 'Medium shot vertikal.',
          voiceover: actionText,
          on_screen_text: actionText,
          scene_type: 'talking_head',
          required_assets: ['character'],
        },
      ];
    }

    // TOFU Human Led
    return [
      {
        scene_number: 1,
        duration_seconds: 5,
        purpose: 'Curiosity Hook',
        visual_direction: 'Talent berbicara santai ke kamera dengan latar belakang rapi.',
        action: 'Talent melakukan gerakan pembuka menarik perhatian.',
        camera: 'Medium close-up vertikal, eye-level.',
        voiceover: hookText,
        on_screen_text: hookText,
        scene_type: 'talking_head',
        required_assets: ['character'],
      },
      {
        scene_number: 2,
        duration_seconds: 7,
        purpose: 'Light Insight',
        visual_direction: 'Talent tersenyum ramah memberikan penjelasan ringkas.',
        action: 'Talent mengangguk menjelaskan poin utama.',
        camera: 'Close-up vertikal hangat.',
        voiceover: valueText,
        on_screen_text: valueText,
        scene_type: 'talking_head',
        required_assets: ['character'],
      },
      {
        scene_number: 3,
        duration_seconds: 6,
        purpose: 'Soft CTA',
        visual_direction: 'Talent memberi isyarat ajakan bertindak halus.',
        action: 'Talent tersenyum mengarahkan gestur ramah ke penonton.',
        camera: 'Medium shot vertikal.',
        voiceover: actionText,
        on_screen_text: actionText,
        scene_type: 'talking_head',
        required_assets: ['character'],
      },
    ];
  }

  throw new Error(`Unhandled video productionMode: ${productionMode}`);
}

/**
 * Builds a VideoProductionCandidate from clean structured values.
 */
export function buildVideoProductionCandidate(params: {
  candidate_id: string;
  production_mode: VideoProductionMode;
  objective: string;
  format: string;
  hook: string;
  scenes: VideoSceneProductionPlan[];
  voiceover?: string;
  on_screen_text?: string;
  camera_direction?: string;
  motion_direction?: string;
  audio_direction?: string;
  branding?: string;
  negative_constraints: string;
  final_prompt: string;
}): VideoProductionCandidate {
  const totalDuration = params.scenes.reduce((acc, s) => acc + s.duration_seconds, 0);
  const combinedVoiceover = params.voiceover ?? params.scenes.map((s) => s.voiceover).join(' ');
  const combinedOverlay = params.on_screen_text ?? params.scenes.map((s) => s.on_screen_text).join(' | ');

  return {
    candidate_type: 'video',
    candidate_id: params.candidate_id,
    production_details: {
      production_mode: params.production_mode,
      objective: params.objective,
      duration_seconds: totalDuration,
      format: params.format,
      hook: params.hook,
      scenes: params.scenes,
      voiceover: combinedVoiceover,
      on_screen_text: combinedOverlay,
      camera_direction: params.camera_direction ?? params.scenes[0]?.camera ?? '',
      motion_direction: params.motion_direction ?? '',
      audio_direction: params.audio_direction ?? '',
      branding: params.branding ?? '',
      negative_constraints: params.negative_constraints,
    },
    final_prompt: params.final_prompt,
  };
}

export {
  resolveSelectedVideoProductionCandidate,
  getSceneTypeLabel,
  getRequiredAssetLabel,
  buildCanonicalSceneProductionInstructions,
} from './video-canonical-scene-resolver';
export type {
  CanonicalSceneResolveParams,
  BuildSceneInstructionsParams,
  SceneProductionInstructions,
} from './video-canonical-scene-resolver';

