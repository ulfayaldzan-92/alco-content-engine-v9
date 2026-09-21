import fs from 'fs';
import path from 'path';
import {
  EXECUTION_PROMPT_CONTRACT_VERSION,
  buildExecutionPromptAuthority,
  isValidExecutionSignatureFormat,
} from '../lib/execution-prompt-authority';
import {
  translateImageProductionPrompt,
  translateCarouselProductionPrompts,
  translateVideoProductionPrompts,
  type VideoTranslatedPromptBundle,
} from '../lib/prompt-translation';
import { bindTranslatedPromptBundleToAssetInput } from '../lib/prompt-package-binding';
import {
  adaptProductionCandidateToAssetInput,
  selectProductionCandidate,
  selectRawProductionCandidate,
} from '../lib/production-candidate-adapter';
import {
  buildProductionPackage,
  type ProductionPackageMetadata,
} from '../lib/production-engine';
import { buildProductionEngineContext } from '../lib/production-engine-context';
import { validateProductionPackage, type ProductionPackage } from '../lib/production-contract';
import {
  buildImageProductionCandidate,
  buildCarouselProductionCandidate,
  buildVideoProductionCandidate,
  buildCanonicalVideoScenePlan,
} from '../lib/production-candidate';
import type { SharedContentContext, ContentItem, CharacterDNA } from '../lib/content-contract';
import { type FunnelStrategy, buildFunnelStrategyFromContext } from '../lib/funnel-strategy';
import type { ProductAssetContext } from '../lib/video-production-input';
import {
  saveProductionPackage,
  loadProductionPackage,
  removeProductionPackage,
} from '../lib/production-package-storage';

// Polyfill window and localStorage in Node test environment
if (typeof window === 'undefined') {
  const store = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
  (global as any).window = global;
  (global as any).localStorage = mockLocalStorage;
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    throw new Error(message);
  }
  console.log(`✅ ${message}`);
}

console.log('====================================================');
console.log('PHASE 4C-A EXECUTION PROMPT AUTHORITY CONTRACT TESTS');
console.log('====================================================\n');

// ----------------------------------------------------
// Fixtures
// ----------------------------------------------------
const mockSharedContext: SharedContentContext = {
  project_id: 'proj_100',
  project_name: 'Luminary Skin Project',
  source: { origin: 'manual_context' },
  brand_context: {
    brand_name: 'Luminary Skin',
    category: 'Skincare',
    brand_summary: 'Clean botanical skincare',
    brand_voice: 'Professional',
  },
  audience_context: {
    primary_audience: 'Women 25-40',
    pain_points: ['Dehydrated skin'],
    desires: ['Hydrated glow'],
    objections: ['Price point'],
  },
  strategy_context: {
    positioning: 'Clean botanical skincare',
    usp: ['Botanical actives'],
    main_offer: 'Hydrating Glow Serum',
    offer_benefits: ['Barrier repair'],
    core_message: 'Healthy radiant skin naturally',
    copy_direction: ['Informative'],
    content_pillars: ['Education'],
  },
  system_flags: {
    is_complete_for_planning: true,
    missing_required_fields: [],
  },
};

const mockFunnelStrategy: FunnelStrategy = buildFunnelStrategyFromContext(mockSharedContext);

const mockContentItem: ContentItem = {
  no: 1,
  content_item_id: 'ci_200',
  project_id: 'proj_100',
  projectId: 'proj_100',
  tanggal: '2026-09-21',
  jenis: 'MOFU',
  tujuan: 'Showcase formula benefits',
  hookType: 'Problem-Solution',
  headline: 'Restore Your Moisture Barrier',
  body: 'Formulated with 5 restorative botanicals for luminous hydration.',
  caption: 'Skin barrier repair in 7 days.',
  cta: 'Discover the Serum',
  format: 'Single',
  recommendedAssetTypes: ['image', 'carousel', 'video'],
  primaryAssetType: 'image',
  referensi: 'Internal reference',
  visual: 'Crisp studio photography of serum droplet on dewy skin.',
  keterangan: 'Addresses barrier repair needs',
};

const mockCharacterDNA: CharacterDNA = {
  character_id: 'char_amber',
  project_id: 'proj_100',
  reference_images: [],
  identity: {
    display_name: 'Dr. Amber Hayes',
  },
  style: {},
  behavior: {
    on_camera_persona: 'Authoritative yet empathetic',
  },
  consistency_rules: {
    locked_traits: ['warm hazel eyes', 'structured lab coat over ochre knit'],
    avoid_traits: [],
  },
  prompt_assets: {
    dna_summary_prompt: 'Dr. Amber Hayes, Lead Biochemist',
    locked_visual_prompt: 'gold hexagonal brooch on collar',
    preview_generation_prompt: 'Generate preview',
    scene_reuse_prompt_template: 'Reuse character',
  },
  timestamps: {
    created_at: '2026-09-21T00:00:00.000Z',
    updated_at: '2026-09-21T00:00:00.000Z',
  },
};

const mockProductAssetContext: ProductAssetContext = {
  product_name: 'Luminary Glow Serum',
  product_type: 'Botanical Serum',
  screenshots: [
    {
      id: 'screen_001',
      name: 'Texture and bottle UI screenshot',
      kind: 'screenshot',
    },
  ],
  feature_focus: ['Barrier repair', 'Hydration'],
  demo_steps: ['Dispense dropper', 'Apply to face'],
};

// Valid Canonical Image Candidate
const mockImageCandidate = buildImageProductionCandidate({
  candidate_id: 'cand_img_001',
  visualObjective: 'High-contrast product focus',
  scene: 'Minimalist studio counter',
  subject: 'Amber glass serum bottle with dropper',
  composition: 'Rule of thirds, sharp foreground',
  environment: 'Soft natural daylight',
  lighting: 'Diffused morning sunlight',
  camera: 'Eye-level 50mm lens',
  visualStyle: 'Clean botanical aesthetic',
  textOverlay: '',
  branding: 'Luminary Skin logo minimal',
  negativeConstraints: 'No artificial plastic reflections, no blur',
  finalPrompt: 'Studio shot of serum bottle beside blooming botanicals.',
});

// Valid Canonical Carousel Candidate
const mockCarouselCandidate = buildCarouselProductionCandidate({
  candidate_id: 'cand_car_001',
  objective: 'Educate on barrier repair in 3 steps',
  slide_count: 3,
  cover_direction: 'Skin barrier restoration overview',
  visual_continuity: 'Consistent sage green palette and serif typography',
  branding: 'Luminary Skin watermark',
  negative_constraints: 'No cluttered layouts',
  slides: [
    {
      slide_number: 1,
      role: 'hook',
      headline: 'Signs of Barrier Distress',
      body: 'Redness and flaking',
      visual_direction: 'Skin diagram showing micro tears',
      layout_direction: 'Left-aligned text bold',
    },
    {
      slide_number: 2,
      role: 'solution',
      headline: 'Restorative Botanical Complex',
      body: 'Centella + Ceramides',
      visual_direction: 'Botanical formulation actives',
      layout_direction: 'Centered focus',
    },
    {
      slide_number: 3,
      role: 'cta',
      headline: 'Restore Your Glow',
      body: 'Available now',
      visual_direction: 'Serum bottle with radiant skin in background',
      layout_direction: 'Bottom card',
    },
  ],
  final_prompts: {
    master_prompt: 'Editorial carousel highlighting skin barrier restoration in 3 steps.',
    slides: [
      { slide_number: 1, prompt: 'Slide 1: Identify barrier damage symptoms with clean infographic.' },
      { slide_number: 2, prompt: 'Slide 2: Active botanical mechanism diagram.' },
      { slide_number: 3, prompt: 'Slide 3: Clinical result transformation stats.' },
    ],
  },
});

// Valid Canonical Video Candidates for all 3 modes
const humanLedCandidate = buildVideoProductionCandidate({
  candidate_id: 'cand_vid_human',
  production_mode: 'human_led',
  objective: 'Demonstrate formulation texture and instant barrier hydration',
  format: '9:16 Vertical Video (Reels/TikTok/Shorts)',
  hook: 'Is your skin barrier dehydrated?',
  scenes: buildCanonicalVideoScenePlan('MOFU', 'human_led', {
    hook: 'Is your skin barrier dehydrated?',
    solusi: 'This botanical serum repairs moisture deeply.',
    cta: 'Try Luminary Skin today.',
  }),
  camera_direction: 'Direct to camera eye level',
  motion_direction: 'Smooth subtle zoom',
  audio_direction: 'Soft background music',
  negative_constraints: 'No harsh artificial studio strobes',
  final_prompt: 'Video demonstration of serum application and absorption.',
});

const productDemoCandidate = buildVideoProductionCandidate({
  candidate_id: 'cand_vid_demo',
  production_mode: 'product_demo',
  objective: 'Demonstrate product application and texture',
  format: '9:16 Vertical Video (Reels/TikTok/Shorts)',
  hook: 'See the Luminary Glow Serum in action',
  scenes: buildCanonicalVideoScenePlan('MOFU', 'product_demo', {
    hook: 'See the Luminary Glow Serum in action',
    solusi: 'Dispense 2 drops for instant hydration.',
    cta: 'Order yours today.',
  }),
  camera_direction: 'Macro close-up shot',
  motion_direction: 'Slow panning across product',
  audio_direction: 'Upbeat background track',
  negative_constraints: 'No blurry text',
  final_prompt: 'Product demo showing serum drops.',
});

const motionExplainerCandidate = buildVideoProductionCandidate({
  candidate_id: 'cand_vid_explain',
  production_mode: 'motion_explainer',
  objective: 'Explain barrier repair mechanism',
  format: '9:16 Vertical Video (Reels/TikTok/Shorts)',
  hook: 'How does your skin barrier repair itself?',
  scenes: buildCanonicalVideoScenePlan('MOFU', 'motion_explainer', {
    hook: 'How does your skin barrier repair itself?',
    solusi: 'Ceramides penetrate micro-cracks in skin.',
    cta: 'Learn more about barrier health.',
  }),
  camera_direction: '2D graphic motion framing',
  motion_direction: 'Dynamic kinetic typography',
  audio_direction: 'Clean voiceover with synth pads',
  negative_constraints: 'No realistic human faces',
  final_prompt: 'Motion graphics explainer of skin barrier.',
});

const mockMetadata: ProductionPackageMetadata = {
  package_id: 'pkg_test_001',
  created_at: '2026-09-21T00:00:00.000Z',
};

// ----------------------------------------------------
// TEST GROUP 1: Three Video Mode Fixtures & Translation
// ----------------------------------------------------
console.log('--- TEST GROUP 1: Three Video Mode Fixtures & Translation ---');

const imgTransRes = translateImageProductionPrompt({ candidate: mockImageCandidate, characterDNA: mockCharacterDNA });
assert(imgTransRes.ok, 'Image translation succeeds');
if (!imgTransRes.ok || imgTransRes.bundle.asset_type !== 'image') {
  throw new Error('Expected ImageTranslatedPromptBundle');
}
const imgBundle = imgTransRes.bundle;

const carTransRes = translateCarouselProductionPrompts({
  candidate: mockCarouselCandidate,
  slides: [
    { slide_number: 1, visual_format: 'infographic' },
    { slide_number: 2, visual_format: 'photography' },
    { slide_number: 3, visual_format: 'photography' },
  ],
  characterDNA: mockCharacterDNA,
});
assert(carTransRes.ok, 'Carousel translation succeeds');
if (!carTransRes.ok || carTransRes.bundle.asset_type !== 'carousel') {
  throw new Error('Expected CarouselTranslatedPromptBundle');
}
const carBundle = carTransRes.bundle;

// 1. human_led video translation
const humanTransRes = translateVideoProductionPrompts({ candidate: humanLedCandidate, characterDNA: mockCharacterDNA });
assert(humanTransRes.ok, 'human_led video translation succeeds with CharacterDNA');
if (!humanTransRes.ok || humanTransRes.bundle.asset_type !== 'video') {
  throw new Error('Expected VideoTranslatedPromptBundle');
}
const humanVidBundle = humanTransRes.bundle;

// 2. product_demo video translation
const demoTransRes = translateVideoProductionPrompts({ candidate: productDemoCandidate, productAssetContext: mockProductAssetContext });
assert(demoTransRes.ok, 'product_demo video translation succeeds with ProductAssetContext');
if (!demoTransRes.ok || demoTransRes.bundle.asset_type !== 'video') {
  throw new Error('Expected VideoTranslatedPromptBundle');
}
const demoVidBundle = demoTransRes.bundle;

// 3. motion_explainer video translation
const explainTransRes = translateVideoProductionPrompts({ candidate: motionExplainerCandidate });
assert(explainTransRes.ok, 'motion_explainer video translation succeeds without CharacterDNA/ProductAssetContext');
if (!explainTransRes.ok || explainTransRes.bundle.asset_type !== 'video') {
  throw new Error('Expected VideoTranslatedPromptBundle');
}
const explainVidBundle = explainTransRes.bundle;

const humanAuth = buildExecutionPromptAuthority(humanVidBundle);
const demoAuth = buildExecutionPromptAuthority(demoVidBundle);
const explainAuth = buildExecutionPromptAuthority(explainVidBundle);

assert(humanAuth.ok && demoAuth.ok && explainAuth.ok, 'Execution authority built for all 3 Video modes');
if (humanAuth.ok && demoAuth.ok && explainAuth.ok) {
  assert(humanAuth.authority.execution_signature !== demoAuth.authority.execution_signature, 'Different Video modes produce different execution signatures (human vs demo)');
  assert(humanAuth.authority.execution_signature !== explainAuth.authority.execution_signature, 'Different Video modes produce different execution signatures (human vs explain)');
}

// ----------------------------------------------------
// TEST GROUP 2: Image Signature Determinism & Mutation
// ----------------------------------------------------
console.log('\n--- TEST GROUP 2: Image Signature Determinism & Mutation ---');

const imgAuth1 = buildExecutionPromptAuthority(imgBundle);
const imgAuth2 = buildExecutionPromptAuthority(imgBundle);

assert(imgAuth1.ok && imgAuth2.ok, 'Image authority builds successfully');
if (imgAuth1.ok && imgAuth2.ok) {
  assert(imgAuth1.authority.execution_signature === imgAuth2.authority.execution_signature, 'Image signature is 100% deterministic across multiple calls');
  assert(isValidExecutionSignatureFormat('image', imgAuth1.authority.execution_signature), 'Image signature matches exec_sig_image_[0-9a-f]{8}');
  assert(imgAuth1.authority.contract_version === EXECUTION_PROMPT_CONTRACT_VERSION, 'Contract version is execution_prompt_v1');
  assert(imgAuth1.authority.candidate_id === mockImageCandidate.candidate_id, 'Candidate ID preserved in authority');
}

// B. Change execution_prompt -> different execution_signature
const mutatedImgPromptBundle = {
  ...imgBundle,
  execution_prompt: imgBundle.execution_prompt + ' [MODIFIED PROMPT]',
};
const mutatedImgPromptAuth = buildExecutionPromptAuthority(mutatedImgPromptBundle);
assert(mutatedImgPromptAuth.ok, 'Mutated image prompt bundle builds authority');
if (imgAuth1.ok && mutatedImgPromptAuth.ok) {
  assert(imgAuth1.authority.execution_signature !== mutatedImgPromptAuth.authority.execution_signature, 'Change execution_prompt yields different image execution signature');
}

// C. Change candidate_id -> different execution_signature
const mutatedImgCandBundle = {
  ...imgBundle,
  candidate_id: 'cand_img_999',
};
const mutatedImgCandAuth = buildExecutionPromptAuthority(mutatedImgCandBundle);
assert(mutatedImgCandAuth.ok, 'Mutated image candidate_id builds authority');
if (imgAuth1.ok && mutatedImgCandAuth.ok) {
  assert(imgAuth1.authority.execution_signature !== mutatedImgCandAuth.authority.execution_signature, 'Change candidate_id yields different image execution signature');
}

// D. Empty execution_prompt -> FAIL CLOSED
const emptyImgPromptAuth = buildExecutionPromptAuthority({ ...imgBundle, execution_prompt: '   ' });
assert(!emptyImgPromptAuth.ok, 'Empty/whitespace image execution_prompt fails closed');

// E. Empty candidate_id -> FAIL CLOSED
const emptyImgCandAuth = buildExecutionPromptAuthority({ ...imgBundle, candidate_id: '' });
assert(!emptyImgCandAuth.ok, 'Empty image candidate_id fails closed');

// ----------------------------------------------------
// TEST GROUP 3: Carousel Signature Determinism & Mutation
// ----------------------------------------------------
console.log('\n--- TEST GROUP 3: Carousel Signature Determinism & Mutation ---');

const carAuth1 = buildExecutionPromptAuthority(carBundle);
const carAuth2 = buildExecutionPromptAuthority(carBundle);

assert(carAuth1.ok && carAuth2.ok, 'Carousel authority builds successfully');
if (carAuth1.ok && carAuth2.ok) {
  assert(carAuth1.authority.execution_signature === carAuth2.authority.execution_signature, 'Carousel signature is 100% deterministic');
  assert(isValidExecutionSignatureFormat('carousel', carAuth1.authority.execution_signature), 'Carousel signature matches exec_sig_carousel_[0-9a-f]{8}');
  assert(carAuth1.authority.contract_version === EXECUTION_PROMPT_CONTRACT_VERSION, 'Contract version is execution_prompt_v1');
}

// B. Change master_prompt -> different execution_signature
const mutatedCarMasterBundle = {
  ...carBundle,
  master_prompt: carBundle.master_prompt + ' [MODIFIED MASTER]',
};
const mutatedCarMasterAuth = buildExecutionPromptAuthority(mutatedCarMasterBundle);
assert(mutatedCarMasterAuth.ok, 'Mutated carousel master prompt builds authority');
if (carAuth1.ok && mutatedCarMasterAuth.ok) {
  assert(carAuth1.authority.execution_signature !== mutatedCarMasterAuth.authority.execution_signature, 'Change master_prompt yields different carousel execution signature');
}

// C. Change one slide execution_prompt -> different execution_signature
const mutatedCarSlideBundle = {
  ...carBundle,
  slides: [
    carBundle.slides[0],
    { ...carBundle.slides[1], execution_prompt: carBundle.slides[1].execution_prompt + ' [MODIFIED SLIDE]' },
    carBundle.slides[2],
  ],
};
const mutatedCarSlideAuth = buildExecutionPromptAuthority(mutatedCarSlideBundle);
assert(mutatedCarSlideAuth.ok, 'Mutated carousel slide prompt builds authority');
if (carAuth1.ok && mutatedCarSlideAuth.ok) {
  assert(carAuth1.authority.execution_signature !== mutatedCarSlideAuth.authority.execution_signature, 'Change slide execution_prompt yields different carousel execution signature');
}

// D. Change candidate_id -> different execution_signature
const mutatedCarCandBundle = {
  ...carBundle,
  candidate_id: 'cand_car_888',
};
const mutatedCarCandAuth = buildExecutionPromptAuthority(mutatedCarCandBundle);
assert(mutatedCarCandAuth.ok, 'Mutated carousel candidate_id builds authority');
if (carAuth1.ok && mutatedCarCandAuth.ok) {
  assert(carAuth1.authority.execution_signature !== mutatedCarCandAuth.authority.execution_signature, 'Change candidate_id yields different carousel execution signature');
}

// E. Out-of-order slide sequence -> FAIL CLOSED
const outOfOrderCarBundle = {
  ...carBundle,
  slides: [
    { slide_number: 2, execution_prompt: 'Slide 2 prompt' },
    { slide_number: 1, execution_prompt: 'Slide 1 prompt' },
    { slide_number: 3, execution_prompt: 'Slide 3 prompt' },
  ],
};
const outOfOrderRes = buildExecutionPromptAuthority(outOfOrderCarBundle);
assert(!outOfOrderRes.ok, 'Out-of-order carousel slides fail closed without auto-repair');

// F. Duplicate slide_number -> FAIL CLOSED
const duplicateCarSlideBundle = {
  ...carBundle,
  slides: [
    { slide_number: 1, execution_prompt: 'Slide 1' },
    { slide_number: 1, execution_prompt: 'Duplicate Slide 1' },
    { slide_number: 3, execution_prompt: 'Slide 3' },
  ],
};
const duplicateCarRes = buildExecutionPromptAuthority(duplicateCarSlideBundle);
assert(!duplicateCarRes.ok, 'Duplicate carousel slide_number fails closed');

// G. Empty slide execution_prompt -> FAIL CLOSED
const emptySlidePromptBundle = {
  ...carBundle,
  slides: [
    { slide_number: 1, execution_prompt: 'Slide 1' },
    { slide_number: 2, execution_prompt: '   ' },
    { slide_number: 3, execution_prompt: 'Slide 3' },
  ],
};
const emptySlideRes = buildExecutionPromptAuthority(emptySlidePromptBundle);
assert(!emptySlideRes.ok, 'Empty carousel slide execution_prompt fails closed');

// H. Empty master_prompt -> FAIL CLOSED
const emptyMasterCarBundle = {
  ...carBundle,
  master_prompt: '   ',
};
const emptyMasterRes = buildExecutionPromptAuthority(emptyMasterCarBundle);
assert(!emptyMasterRes.ok, 'Empty carousel master_prompt fails closed');

// ----------------------------------------------------
// TEST GROUP 4: Video Signature Determinism & Mutation
// ----------------------------------------------------
console.log('\n--- TEST GROUP 4: Video Signature Determinism & Mutation ---');

const vidAuth1 = buildExecutionPromptAuthority(humanVidBundle);
const vidAuth2 = buildExecutionPromptAuthority(humanVidBundle);

assert(vidAuth1.ok && vidAuth2.ok, 'Video authority builds successfully');
if (vidAuth1.ok && vidAuth2.ok) {
  assert(vidAuth1.authority.execution_signature === vidAuth2.authority.execution_signature, 'Video signature is 100% deterministic');
  assert(isValidExecutionSignatureFormat('video', vidAuth1.authority.execution_signature), 'Video signature matches exec_sig_video_[0-9a-f]{8}');
  assert(vidAuth1.authority.contract_version === EXECUTION_PROMPT_CONTRACT_VERSION, 'Contract version is execution_prompt_v1');
}

// B. Change start_frame_prompt -> different execution_signature
const mutVidStartFrame: VideoTranslatedPromptBundle = {
  ...humanVidBundle,
  scenes: [
    { ...humanVidBundle.scenes[0], start_frame_prompt: humanVidBundle.scenes[0].start_frame_prompt + ' [MODIFIED START]' },
    humanVidBundle.scenes[1],
    humanVidBundle.scenes[2],
  ],
};
const mutVidStartFrameAuth = buildExecutionPromptAuthority(mutVidStartFrame);
assert(mutVidStartFrameAuth.ok, 'Mutated video start_frame_prompt builds authority');
if (vidAuth1.ok && mutVidStartFrameAuth.ok) {
  assert(vidAuth1.authority.execution_signature !== mutVidStartFrameAuth.authority.execution_signature, 'Change start_frame_prompt yields different video execution signature');
}

// C. Change motion_prompt -> different execution_signature
const mutVidMotion: VideoTranslatedPromptBundle = {
  ...humanVidBundle,
  scenes: [
    { ...humanVidBundle.scenes[0], motion_prompt: humanVidBundle.scenes[0].motion_prompt + ' [MODIFIED MOTION]' },
    humanVidBundle.scenes[1],
    humanVidBundle.scenes[2],
  ],
};
const mutVidMotionAuth = buildExecutionPromptAuthority(mutVidMotion);
assert(mutVidMotionAuth.ok, 'Mutated video motion_prompt builds authority');
if (vidAuth1.ok && mutVidMotionAuth.ok) {
  assert(vidAuth1.authority.execution_signature !== mutVidMotionAuth.authority.execution_signature, 'Change motion_prompt yields different video execution signature');
}

// D. Change voiceover -> different execution_signature
const mutVidVoice: VideoTranslatedPromptBundle = {
  ...humanVidBundle,
  scenes: [
    { ...humanVidBundle.scenes[0], voiceover: humanVidBundle.scenes[0].voiceover + ' [MODIFIED VO]' },
    humanVidBundle.scenes[1],
    humanVidBundle.scenes[2],
  ],
};
const mutVidVoiceAuth = buildExecutionPromptAuthority(mutVidVoice);
assert(mutVidVoiceAuth.ok, 'Mutated video voiceover builds authority');
if (vidAuth1.ok && mutVidVoiceAuth.ok) {
  assert(vidAuth1.authority.execution_signature !== mutVidVoiceAuth.authority.execution_signature, 'Change voiceover yields different video execution signature');
}

// E. Change on_screen_text -> different execution_signature
const mutVidText: VideoTranslatedPromptBundle = {
  ...humanVidBundle,
  scenes: [
    { ...humanVidBundle.scenes[0], on_screen_text: humanVidBundle.scenes[0].on_screen_text + ' [MODIFIED TEXT]' },
    humanVidBundle.scenes[1],
    humanVidBundle.scenes[2],
  ],
};
const mutVidTextAuth = buildExecutionPromptAuthority(mutVidText);
assert(mutVidTextAuth.ok, 'Mutated video on_screen_text builds authority');
if (vidAuth1.ok && mutVidTextAuth.ok) {
  assert(vidAuth1.authority.execution_signature !== mutVidTextAuth.authority.execution_signature, 'Change on_screen_text yields different video execution signature');
}

// F. Change candidate_id -> different execution_signature
const mutVidCand: VideoTranslatedPromptBundle = {
  ...humanVidBundle,
  candidate_id: 'cand_vid_777',
};
const mutVidCandAuth = buildExecutionPromptAuthority(mutVidCand);
assert(mutVidCandAuth.ok, 'Mutated video candidate_id builds authority');
if (vidAuth1.ok && mutVidCandAuth.ok) {
  assert(vidAuth1.authority.execution_signature !== mutVidCandAuth.authority.execution_signature, 'Change candidate_id yields different video execution signature');
}

// G. Change production_mode -> different execution_signature
const mutVidMode: VideoTranslatedPromptBundle = {
  ...humanVidBundle,
  production_mode: 'motion_explainer',
};
const mutVidModeAuth = buildExecutionPromptAuthority(mutVidMode);
assert(mutVidModeAuth.ok, 'Mutated video production_mode builds authority');
if (vidAuth1.ok && mutVidModeAuth.ok) {
  assert(vidAuth1.authority.execution_signature !== mutVidModeAuth.authority.execution_signature, 'Change production_mode yields different video execution signature');
}

// H. Scene count != 3 -> FAIL CLOSED
const twoSceneVidBundle = {
  ...humanVidBundle,
  scenes: [
    humanVidBundle.scenes[0],
    humanVidBundle.scenes[1],
  ],
} as unknown as VideoTranslatedPromptBundle;
const twoSceneRes = buildExecutionPromptAuthority(twoSceneVidBundle);
assert(!twoSceneRes.ok, 'Video with 2 scenes fails closed');

// I. Scene sequence not exactly 1,2,3 -> FAIL CLOSED
const badSeqVidBundle: VideoTranslatedPromptBundle = {
  ...humanVidBundle,
  scenes: [
    humanVidBundle.scenes[0],
    { ...humanVidBundle.scenes[2], scene_number: 3 },
    { ...humanVidBundle.scenes[1], scene_number: 2 },
  ],
};
const badSeqRes = buildExecutionPromptAuthority(badSeqVidBundle);
assert(!badSeqRes.ok, 'Video scene sequence not 1,2,3 fails closed');

// J. Empty start_frame_prompt -> FAIL CLOSED
const emptyStartVidBundle: VideoTranslatedPromptBundle = {
  ...humanVidBundle,
  scenes: [
    { ...humanVidBundle.scenes[0], start_frame_prompt: '   ' },
    humanVidBundle.scenes[1],
    humanVidBundle.scenes[2],
  ],
};
const emptyStartRes = buildExecutionPromptAuthority(emptyStartVidBundle);
assert(!emptyStartRes.ok, 'Video scene with empty start_frame_prompt fails closed');

// K. Empty motion_prompt -> FAIL CLOSED
const emptyMotionVidBundle: VideoTranslatedPromptBundle = {
  ...humanVidBundle,
  scenes: [
    humanVidBundle.scenes[0],
    { ...humanVidBundle.scenes[1], motion_prompt: '' },
    humanVidBundle.scenes[2],
  ],
};
const emptyMotionRes = buildExecutionPromptAuthority(emptyMotionVidBundle);
assert(!emptyMotionRes.ok, 'Video scene with empty motion_prompt fails closed');

// ----------------------------------------------------
// TEST GROUP 5: Binding Layer & ProductionAssetInput
// ----------------------------------------------------
console.log('\n--- TEST GROUP 5: Binding Layer Execution Authority Integration ---');

const imgBindingRes = bindTranslatedPromptBundleToAssetInput(mockImageCandidate, imgBundle);
assert(imgBindingRes.ok, 'Image binding succeeds');
if (imgBindingRes.ok) {
  assert(imgBindingRes.assetInput.asset_type === 'image', 'AssetInput asset_type is image');
  assert(Boolean(imgBindingRes.assetInput.execution_authority), 'Image assetInput contains execution_authority');
  assert(imgBindingRes.assetInput.execution_authority.asset_type === 'image', 'Image authority asset_type matches');
  assert(imgBindingRes.assetInput.execution_authority.candidate_id === mockImageCandidate.candidate_id, 'Image authority candidate_id matches');
  assert(imgBindingRes.assetInput.execution_authority.contract_version === EXECUTION_PROMPT_CONTRACT_VERSION, 'Image authority contract_version matches');
  assert(isValidExecutionSignatureFormat('image', imgBindingRes.assetInput.execution_authority.execution_signature), 'Image authority signature is valid');
}

const carBindingRes = bindTranslatedPromptBundleToAssetInput(mockCarouselCandidate, carBundle);
assert(carBindingRes.ok, 'Carousel binding succeeds');
if (carBindingRes.ok) {
  assert(carBindingRes.assetInput.asset_type === 'carousel', 'AssetInput asset_type is carousel');
  assert(Boolean(carBindingRes.assetInput.execution_authority), 'Carousel assetInput contains execution_authority');
  assert(carBindingRes.assetInput.execution_authority.asset_type === 'carousel', 'Carousel authority asset_type matches');
  assert(carBindingRes.assetInput.execution_authority.candidate_id === mockCarouselCandidate.candidate_id, 'Carousel authority candidate_id matches');
  assert(carBindingRes.assetInput.execution_authority.contract_version === EXECUTION_PROMPT_CONTRACT_VERSION, 'Carousel authority contract_version matches');
  assert(isValidExecutionSignatureFormat('carousel', carBindingRes.assetInput.execution_authority.execution_signature), 'Carousel authority signature is valid');
}

const vidBindingRes = bindTranslatedPromptBundleToAssetInput(humanLedCandidate, humanVidBundle);
assert(vidBindingRes.ok, 'Video binding succeeds');
if (vidBindingRes.ok) {
  assert(vidBindingRes.assetInput.asset_type === 'video', 'AssetInput asset_type is video');
  assert(Boolean(vidBindingRes.assetInput.execution_authority), 'Video assetInput contains execution_authority');
  assert(vidBindingRes.assetInput.execution_authority.asset_type === 'video', 'Video authority asset_type matches');
  assert(vidBindingRes.assetInput.execution_authority.candidate_id === humanLedCandidate.candidate_id, 'Video authority candidate_id matches');
  assert(vidBindingRes.assetInput.execution_authority.contract_version === EXECUTION_PROMPT_CONTRACT_VERSION, 'Video authority contract_version matches');
  assert(isValidExecutionSignatureFormat('video', vidBindingRes.assetInput.execution_authority.execution_signature), 'Video authority signature is valid');
}

// ----------------------------------------------------
// TEST GROUP 6: ProductionAssetInput Fail-Closed Coverage
// ----------------------------------------------------
console.log('\n--- TEST GROUP 6: ProductionAssetInput Fail-Closed Coverage ---');

const contextRes = buildProductionEngineContext(
  'proj_100',
  mockSharedContext,
  mockFunnelStrategy,
  mockContentItem,
  mockCharacterDNA
);
assert(contextRes.isValid && Boolean(contextRes.context), 'ProductionEngineContext built successfully');
const context = contextRes.context!;

// Image input without execution_authority fails
if (imgBindingRes.ok) {
  const noAuthImgInput = { ...imgBindingRes.assetInput };
  delete (noAuthImgInput as Partial<typeof noAuthImgInput>).execution_authority;
  const noAuthPkgRes = buildProductionPackage(context, noAuthImgInput, mockMetadata);
  assert(!noAuthPkgRes.isValid, 'Production Engine rejects Image assetInput missing execution_authority');
}

// Carousel input without execution_authority fails
if (carBindingRes.ok) {
  const noAuthCarInput = { ...carBindingRes.assetInput };
  delete (noAuthCarInput as Partial<typeof noAuthCarInput>).execution_authority;
  const noAuthPkgRes = buildProductionPackage(context, noAuthCarInput, mockMetadata);
  assert(!noAuthPkgRes.isValid, 'Production Engine rejects Carousel assetInput missing execution_authority');
}

// Video input without execution_authority fails
if (vidBindingRes.ok) {
  const noAuthVidInput = { ...vidBindingRes.assetInput };
  delete (noAuthVidInput as Partial<typeof noAuthVidInput>).execution_authority;
  const noAuthPkgRes = buildProductionPackage(context, noAuthVidInput, mockMetadata);
  assert(!noAuthPkgRes.isValid, 'Production Engine rejects Video assetInput missing execution_authority');
}

// ----------------------------------------------------
// TEST GROUP 7: Authority Validation Coverage
// ----------------------------------------------------
console.log('\n--- TEST GROUP 7: Authority Validation Coverage ---');

if (imgBindingRes.ok) {
  // A. authority.asset_type mismatch
  const typeMismatchInput = {
    ...imgBindingRes.assetInput,
    execution_authority: {
      ...imgBindingRes.assetInput.execution_authority,
      asset_type: 'video' as const,
    },
  };
  const typeMismatchPkgRes = buildProductionPackage(context, typeMismatchInput, mockMetadata);
  assert(!typeMismatchPkgRes.isValid, 'Production Engine rejects assetInput with mismatched execution_authority asset_type');

  // B. authority.candidate_id empty
  const emptyCandAuthInput = {
    ...imgBindingRes.assetInput,
    execution_authority: {
      ...imgBindingRes.assetInput.execution_authority,
      candidate_id: '',
    },
  };
  const emptyCandPkgRes = buildProductionPackage(context, emptyCandAuthInput, mockMetadata);
  assert(!emptyCandPkgRes.isValid, 'Production Engine rejects assetInput with empty execution_authority candidate_id');

  // C. contract_version invalid
  const invalidVersionInput = {
    ...imgBindingRes.assetInput,
    execution_authority: {
      ...imgBindingRes.assetInput.execution_authority,
      contract_version: 'execution_prompt_v2' as any,
    },
  };
  const invalidVerPkgRes = buildProductionPackage(context, invalidVersionInput, mockMetadata);
  assert(!invalidVerPkgRes.isValid, 'Production Engine rejects assetInput with invalid contract_version');

  // D. execution_signature malformed
  const malformedSigInput = {
    ...imgBindingRes.assetInput,
    execution_authority: {
      ...imgBindingRes.assetInput.execution_authority,
      execution_signature: 'exec_sig_image_NOTHEX12',
    },
  };
  const malformedSigPkgRes = buildProductionPackage(context, malformedSigInput, mockMetadata);
  assert(!malformedSigPkgRes.isValid, 'Production Engine rejects assetInput with malformed non-hex execution_signature');

  const wrongPrefixSigInput = {
    ...imgBindingRes.assetInput,
    execution_authority: {
      ...imgBindingRes.assetInput.execution_authority,
      execution_signature: 'exec_sig_carousel_a1b2c3d4',
    },
  };
  const wrongPrefixPkgRes = buildProductionPackage(context, wrongPrefixSigInput, mockMetadata);
  assert(!wrongPrefixPkgRes.isValid, 'Production Engine rejects assetInput with wrong asset_type prefix in execution_signature');
}

// ----------------------------------------------------
// TEST GROUP 8: New Package Preservation
// ----------------------------------------------------
console.log('\n--- TEST GROUP 8: New Package Preservation ---');

let builtImgPackage: ProductionPackage | null = null;
let builtCarPackage: ProductionPackage | null = null;
let builtVidPackage: ProductionPackage | null = null;

if (imgBindingRes.ok) {
  const pkgRes = buildProductionPackage(context, imgBindingRes.assetInput, mockMetadata);
  assert(pkgRes.isValid && Boolean(pkgRes.package), 'Image ProductionPackage builds successfully');
  if (pkgRes.package) {
    builtImgPackage = pkgRes.package;
    assert(Boolean(builtImgPackage.execution_authority), 'Image package contains execution_authority');
    assert(builtImgPackage.execution_authority?.asset_type === imgBindingRes.assetInput.execution_authority.asset_type, 'Package authority asset_type matches assetInput');
    assert(builtImgPackage.execution_authority?.candidate_id === imgBindingRes.assetInput.execution_authority.candidate_id, 'Package authority candidate_id matches assetInput');
    assert(builtImgPackage.execution_authority?.contract_version === imgBindingRes.assetInput.execution_authority.contract_version, 'Package authority contract_version matches assetInput');
    assert(builtImgPackage.execution_authority?.execution_signature === imgBindingRes.assetInput.execution_authority.execution_signature, 'Package authority execution_signature matches assetInput');
  }
}

if (carBindingRes.ok) {
  const pkgRes = buildProductionPackage(context, carBindingRes.assetInput, { ...mockMetadata, package_id: 'pkg_car_001' });
  assert(pkgRes.isValid && Boolean(pkgRes.package), 'Carousel ProductionPackage builds successfully');
  if (pkgRes.package) {
    builtCarPackage = pkgRes.package;
    assert(Boolean(builtCarPackage.execution_authority), 'Carousel package contains execution_authority');
    assert(builtCarPackage.execution_authority?.asset_type === carBindingRes.assetInput.execution_authority.asset_type, 'Package authority asset_type matches assetInput');
    assert(builtCarPackage.execution_authority?.candidate_id === carBindingRes.assetInput.execution_authority.candidate_id, 'Package authority candidate_id matches assetInput');
    assert(builtCarPackage.execution_authority?.contract_version === carBindingRes.assetInput.execution_authority.contract_version, 'Package authority contract_version matches assetInput');
    assert(builtCarPackage.execution_authority?.execution_signature === carBindingRes.assetInput.execution_authority.execution_signature, 'Package authority execution_signature matches assetInput');
  }
}

if (vidBindingRes.ok) {
  const pkgRes = buildProductionPackage(context, vidBindingRes.assetInput, { ...mockMetadata, package_id: 'pkg_vid_001' });
  assert(pkgRes.isValid && Boolean(pkgRes.package), 'Video ProductionPackage builds successfully');
  if (pkgRes.package) {
    builtVidPackage = pkgRes.package;
    assert(Boolean(builtVidPackage.execution_authority), 'Video package contains execution_authority');
    assert(builtVidPackage.execution_authority?.asset_type === vidBindingRes.assetInput.execution_authority.asset_type, 'Package authority asset_type matches assetInput');
    assert(builtVidPackage.execution_authority?.candidate_id === vidBindingRes.assetInput.execution_authority.candidate_id, 'Package authority candidate_id matches assetInput');
    assert(builtVidPackage.execution_authority?.contract_version === vidBindingRes.assetInput.execution_authority.contract_version, 'Package authority contract_version matches assetInput');
    assert(builtVidPackage.execution_authority?.execution_signature === vidBindingRes.assetInput.execution_authority.execution_signature, 'Package authority execution_signature matches assetInput');
  }
}

// ----------------------------------------------------
// TEST GROUP 9: Legacy Compatibility — All Three Formats
// ----------------------------------------------------
console.log('\n--- TEST GROUP 9: Legacy Compatibility — All Three Formats ---');

if (builtImgPackage) {
  const legacyImgPackage: ProductionPackage = { ...builtImgPackage };
  delete legacyImgPackage.execution_authority;
  const valRes = validateProductionPackage(legacyImgPackage);
  assert(valRes.isValid, 'Legacy Image package without execution_authority remains valid');
}

if (builtCarPackage) {
  const legacyCarPackage: ProductionPackage = { ...builtCarPackage };
  delete legacyCarPackage.execution_authority;
  const valRes = validateProductionPackage(legacyCarPackage);
  assert(valRes.isValid, 'Legacy Carousel package without execution_authority remains valid');
}

if (builtVidPackage) {
  const legacyVidPackage = { ...builtVidPackage };
  delete legacyVidPackage.execution_authority;
  const valRes = validateProductionPackage(legacyVidPackage);
  assert(valRes.isValid, 'Legacy Video package without execution_authority remains valid');
}

// ----------------------------------------------------
// TEST GROUP 10: Save / Load Roundtrip
// ----------------------------------------------------
console.log('\n--- TEST GROUP 10: Save / Load Roundtrip ---');

if (builtImgPackage) {
  const saveRes = saveProductionPackage('proj_100', builtImgPackage);
  assert(saveRes.ok, 'Image package save succeeds');
  const loadedPkg = loadProductionPackage('proj_100', 'ci_200', 'image');
  assert(Boolean(loadedPkg), 'Loaded Image package exists');
  if (loadedPkg) {
    assert(Boolean(loadedPkg.execution_authority), 'Loaded Image package preserves execution_authority');
    assert(loadedPkg.execution_authority?.asset_type === builtImgPackage.execution_authority?.asset_type, 'Loaded Image authority asset_type matches');
    assert(loadedPkg.execution_authority?.candidate_id === builtImgPackage.execution_authority?.candidate_id, 'Loaded Image authority candidate_id matches');
    assert(loadedPkg.execution_authority?.contract_version === builtImgPackage.execution_authority?.contract_version, 'Loaded Image authority contract_version matches');
    assert(loadedPkg.execution_authority?.execution_signature === builtImgPackage.execution_authority?.execution_signature, 'Loaded Image authority execution_signature matches');
  }
  removeProductionPackage('proj_100', 'ci_200', 'image');
}

if (builtCarPackage) {
  const saveRes = saveProductionPackage('proj_100', builtCarPackage);
  assert(saveRes.ok, 'Carousel package save succeeds');
  const loadedPkg = loadProductionPackage('proj_100', 'ci_200', 'carousel');
  assert(Boolean(loadedPkg), 'Loaded Carousel package exists');
  if (loadedPkg) {
    assert(Boolean(loadedPkg.execution_authority), 'Loaded Carousel package preserves execution_authority');
    assert(loadedPkg.execution_authority?.asset_type === builtCarPackage.execution_authority?.asset_type, 'Loaded Carousel authority asset_type matches');
    assert(loadedPkg.execution_authority?.candidate_id === builtCarPackage.execution_authority?.candidate_id, 'Loaded Carousel authority candidate_id matches');
    assert(loadedPkg.execution_authority?.contract_version === builtCarPackage.execution_authority?.contract_version, 'Loaded Carousel authority contract_version matches');
    assert(loadedPkg.execution_authority?.execution_signature === builtCarPackage.execution_authority?.execution_signature, 'Loaded Carousel authority execution_signature matches');
  }
  removeProductionPackage('proj_100', 'ci_200', 'carousel');
}

if (builtVidPackage) {
  const saveRes = saveProductionPackage('proj_100', builtVidPackage);
  assert(saveRes.ok, 'Video package save succeeds');
  const loadedPkg = loadProductionPackage('proj_100', 'ci_200', 'video');
  assert(Boolean(loadedPkg), 'Loaded Video package exists');
  if (loadedPkg) {
    assert(Boolean(loadedPkg.execution_authority), 'Loaded Video package preserves execution_authority');
    assert(loadedPkg.execution_authority?.asset_type === builtVidPackage.execution_authority?.asset_type, 'Loaded Video authority asset_type matches');
    assert(loadedPkg.execution_authority?.candidate_id === builtVidPackage.execution_authority?.candidate_id, 'Loaded Video authority candidate_id matches');
    assert(loadedPkg.execution_authority?.contract_version === builtVidPackage.execution_authority?.contract_version, 'Loaded Video authority contract_version matches');
    assert(loadedPkg.execution_authority?.execution_signature === builtVidPackage.execution_authority?.execution_signature, 'Loaded Video authority execution_signature matches');
  }
  removeProductionPackage('proj_100', 'ci_200', 'video');
}

// ----------------------------------------------------
// TEST GROUP 11: Raw Candidate Adapter Fail-Closed & Selection
// ----------------------------------------------------
console.log('\n--- TEST GROUP 11: Raw Candidate Adapter Fail-Closed & Selection ---');

const rawImgAdaptRes = adaptProductionCandidateToAssetInput(mockImageCandidate);
assert(!rawImgAdaptRes.ok, 'adaptProductionCandidateToAssetInput fails closed for raw Image candidate');

const rawCarAdaptRes = adaptProductionCandidateToAssetInput(mockCarouselCandidate);
assert(!rawCarAdaptRes.ok, 'adaptProductionCandidateToAssetInput fails closed for raw Carousel candidate');

const rawVidAdaptRes = adaptProductionCandidateToAssetInput(humanLedCandidate);
assert(!rawVidAdaptRes.ok, 'adaptProductionCandidateToAssetInput fails closed for raw Video candidate');

const selectAdapterRes = selectProductionCandidate([mockImageCandidate], 'cand_img_001');
assert(!selectAdapterRes.ok, 'selectProductionCandidate fails closed because raw candidate adapter requires translated authority');

const selectRawRes = selectRawProductionCandidate([mockImageCandidate], 'cand_img_001');
assert(selectRawRes.ok, 'selectRawProductionCandidate remains available and succeeds');
if (selectRawRes.ok) {
  assert(selectRawRes.candidate.candidate_id === mockImageCandidate.candidate_id, 'selectRawProductionCandidate returns selected candidate');
}

// ----------------------------------------------------
// TEST GROUP 12: Static Architecture & Boundary Guards
// ----------------------------------------------------
console.log('\n--- TEST GROUP 12: Static Architecture & Boundary Guards ---');

const projectRoot = path.resolve(__dirname, '..');

// 1. lib/execution-prompt-authority.ts purity check
const execAuthContent = fs.readFileSync(path.join(projectRoot, 'lib', 'execution-prompt-authority.ts'), 'utf-8');
const forbiddenInExecAuth = [
  "from 'react'",
  'from "react"',
  'Date.now(',
  'Math.random(',
  'crypto.randomUUID',
  '@google/genai',
  'gemini',
  'saveProjectData',
  'loadProjectData',
];
for (const pattern of forbiddenInExecAuth) {
  assert(!execAuthContent.includes(pattern), `lib/execution-prompt-authority.ts does not contain forbidden pattern "${pattern}"`);
}

// 2. lib/prompt-translation.ts boundary check
const promptTransContent = fs.readFileSync(path.join(projectRoot, 'lib', 'prompt-translation.ts'), 'utf-8');
assert(!promptTransContent.includes('execution-prompt-authority'), 'lib/prompt-translation.ts does not import execution-prompt-authority');

// 3. lib/production-engine.ts boundary check
const prodEngineContent = fs.readFileSync(path.join(projectRoot, 'lib', 'production-engine.ts'), 'utf-8');
assert(!prodEngineContent.includes('prompt-translation'), 'lib/production-engine.ts does not import prompt-translation');
assert(!prodEngineContent.includes('buildExecutionPromptAuthority('), 'lib/production-engine.ts does not call buildExecutionPromptAuthority()');
assert(!prodEngineContent.includes('fnv1a32('), 'lib/production-engine.ts does not contain FNV hashing logic');

// 4. lib/production-candidate-adapter.ts boundary check
const candAdapterContent = fs.readFileSync(path.join(projectRoot, 'lib', 'production-candidate-adapter.ts'), 'utf-8');
assert(!candAdapterContent.includes('prompt-translation'), 'lib/production-candidate-adapter.ts does not import prompt-translation');
assert(!candAdapterContent.includes('buildExecutionPromptAuthority('), 'lib/production-candidate-adapter.ts does not call buildExecutionPromptAuthority()');
assert(!candAdapterContent.includes('exec_sig_'), 'lib/production-candidate-adapter.ts does not construct execution signatures');

// 5. Phase 4C-B Absence check
const vidCompletionContent = fs.readFileSync(path.join(projectRoot, 'lib', 'video-scene-completion.ts'), 'utf-8');
assert(!vidCompletionContent.includes('execution_prompt_signature'), 'lib/video-scene-completion.ts does not contain execution_prompt_signature (Phase 4C-B absent)');

const carCompletionContent = fs.readFileSync(path.join(projectRoot, 'lib', 'carousel-slide-completion.ts'), 'utf-8');
assert(!carCompletionContent.includes('execution_prompt_signature'), 'lib/carousel-slide-completion.ts does not contain execution_prompt_signature (Phase 4C-B absent)');

const vidGateContent = fs.readFileSync(path.join(projectRoot, 'lib', 'video-production-gate.ts'), 'utf-8');
assert(!vidGateContent.includes('execution_signature') && !vidGateContent.includes('execution_prompt_signature'), 'lib/video-production-gate.ts does not contain execution signature logic (Phase 4C-B absent)');

const carGateContent = fs.readFileSync(path.join(projectRoot, 'lib', 'carousel-production-gate.ts'), 'utf-8');
assert(!carGateContent.includes('execution_signature') && !carGateContent.includes('execution_prompt_signature'), 'lib/carousel-production-gate.ts does not contain execution signature logic (Phase 4C-B absent)');

console.log('\n====================================================');
console.log('ALL PHASE 4C-A TESTS PASSED SUCCESSFULLY! ✅');
console.log('====================================================');
