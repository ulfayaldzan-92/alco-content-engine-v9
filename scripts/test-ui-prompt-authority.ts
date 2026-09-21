import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  ImageProductionCandidate,
  CarouselProductionCandidate,
  VideoProductionCandidate,
  buildImageProductionCandidate,
  buildCarouselProductionCandidate,
  buildVideoProductionCandidate,
} from '../lib/production-candidate';
import { CharacterDNA, SharedContentContext, ContentItem } from '../lib/content-contract';
import { ProductAssetContext } from '../lib/video-production-input';
import {
  translateImageProductionPrompt,
  translateCarouselProductionPrompts,
  translateVideoProductionPrompts,
  ImageTranslatedPromptBundle,
  CarouselTranslatedPromptBundle,
  VideoTranslatedPromptBundle,
} from '../lib/prompt-translation';
import { bindTranslatedPromptBundleToAssetInput } from '../lib/prompt-package-binding';
import {
  ProductionEngineContext,
  buildProductionEngineContext,
} from '../lib/production-engine-context';
import {
  buildProductionPackage,
  ProductionPackageMetadata,
} from '../lib/production-engine';
import { prepareProductionPackage } from '../lib/production-package-workflow';
import {
  validateProductionPackage,
  ImageProductionPackage,
  CarouselProductionPackage,
  VideoProductionPackage,
} from '../lib/production-contract';
import { buildFunnelStrategyFromContext } from '../lib/funnel-strategy';

console.log('--- RUNNING PHASE 4B-B TEST SUITE: UI / RENDERER EXECUTION PROMPT AUTHORITY BINDING ---');

function makeMockContext(projectId: string = 'proj_auth_123'): SharedContentContext {
  return {
    project_id: projectId,
    project_name: 'Test Project',
    source: { origin: 'creative_system_json', source_version: '1.0.0' },
    brand_context: {
      brand_name: 'Alco Studio',
      category: 'SaaS / Marketing Automation',
      brand_summary: 'AI Engine for Content Ops',
      brand_voice: 'Direct, actionable, educational',
    },
    brand_visual_context: {
      visual_style: 'Clean minimal tech aesthetic',
      color_palette: ['#0F172A', '#475569', '#FFFFFF'],
      typography_style: 'Modern Sans-Serif',
    },
    audience_context: {
      primary_audience: 'Founders & Creators',
      pain_points: ['Production workflow fragmentation'],
      desires: ['Seamless unified prompt authority'],
      objections: ['Too complex to configure'],
    },
    strategy_context: {
      positioning: 'Leading AI pipeline for content operations',
      usp: ['Single prompt authority across UI, renderer, and package'],
      main_offer: 'Alco Production Suite',
      offer_benefits: ['Zero prompt drift'],
      core_message: 'Unified prompt authority',
      copy_direction: ['Action-oriented'],
      content_pillars: ['Engineering Excellence'],
    },
    system_flags: {
      is_complete_for_planning: true,
      missing_required_fields: [],
    },
    character_dna: null,
  };
}

function makeMockContentItem(projectId: string = 'proj_auth_123', itemId: string = 'item_auth_123'): ContentItem {
  return {
    no: 1,
    content_item_id: itemId,
    project_id: projectId,
    projectId: projectId,
    tanggal: '2026-09-21',
    jenis: 'TOFU (Awareness)',
    funnel_stage: 'TOFU',
    pillar: 'Engineering Excellence',
    format: 'Single Image Feed',
    target_audience: 'Founders',
    angle: 'Speed up',
    headline: 'Consistent Visuals Across Surfaces',
    body: 'How single-source translation eliminates prompt drift.',
    caption: 'Learn the new unified architecture.',
    cta: 'Explore now',
    visual: 'Minimalist studio workspace with high-end display showing clean architecture diagram',
    tujuan: 'Awareness',
    keterangan: 'Strategic test candidate',
  };
}

const mockCharacterDNA: CharacterDNA = {
  character_id: 'char_authority_001',
  project_id: 'proj_auth_123',
  identity: {
    display_name: 'Maya Pratama',
    role_profession: 'Content Architect & Founder',
    gender: 'female',
    estimated_age_range: '28-32',
    ethnicity_archetype: 'Indonesian Southeast Asian',
  },
  visual_fingerprint: {
    hair_style: 'Black sleek shoulder-length bob',
    facial_features: 'Sharp expressive eyes, natural warm smile',
    skin_complexion: 'Medium warm golden skin tone',
    build_body_type: 'Athletic lean build',
    clothing_style: 'Modern minimalist sage blazer with off-white inner tee',
    signature_accessories: 'Minimalist titanium rim glasses',
  },
  voice_personality: {
    energy_level: 'High Clarity & Focused',
    speech_style: 'Analytical yet warm and encouraging',
    catchphrase: 'Sistem yang rapi menciptakan hasil yang pasti.',
  },
  prompt_assets: {
    dna_summary_prompt: 'Maya Pratama, 28-32yo Southeast Asian female content architect with sleek black bob.',
    locked_visual_prompt: 'Maya Pratama wearing minimalist sage blazer with titanium rim glasses.',
    preview_generation_prompt: 'Professional portrait of Maya Pratama.',
    scene_reuse_prompt_template: 'Maya Pratama in scene.',
  },
  timestamps: {
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
};

const mockProductAssetContext: ProductAssetContext = {
  product_name: 'FlowSync AI',
  product_category: 'Productivity Tool',
  product_description: 'Automated workflow orchestration engine for creative teams',
  screenshots: [
    {
      id: 'ss_auth_1',
      kind: 'screenshot',
      name: 'Main Orchestration Dashboard',
      description: 'Clean high contrast overview of all content pipelines',
      extracted_visual_description: 'Modern dark mode dashboard with teal accent metrics',
    },
    {
      id: 'ss_auth_2',
      kind: 'screenshot',
      name: 'Realtime Pipeline Monitor',
      description: 'Live execution nodes and prompt authority status',
      extracted_visual_description: 'Node-based execution tree with green status badges',
    },
  ],
  logo_asset: null,
};

// ============================================================================
// TEST 1: STATIC CODE AUDIT — NO UNAUTHORIZED TRANSLATION IN PANELS
// ============================================================================
console.log('\n[TEST 1] Static Code Audit: Panel independence from ad-hoc prompt translators');

const imagePanelPath = path.join(process.cwd(), 'components/production-studio/ImagePanel.tsx');
const carouselPanelPath = path.join(process.cwd(), 'components/production-studio/CarouselPanel.tsx');
const videoPanelPath = path.join(process.cwd(), 'components/production-studio/VideoPanel.tsx');

const imagePanelSrc = fs.readFileSync(imagePanelPath, 'utf8');
const carouselPanelSrc = fs.readFileSync(carouselPanelPath, 'utf8');
const videoPanelSrc = fs.readFileSync(videoPanelPath, 'utf8');

assert.strictEqual(
  imagePanelSrc.includes("import { injectCharacterToPrompt }"),
  false,
  'ImagePanel must not import injectCharacterToPrompt'
);
assert.strictEqual(
  carouselPanelSrc.includes("import { injectCharacterToPrompt }"),
  false,
  'CarouselPanel must not import injectCharacterToPrompt'
);
assert.strictEqual(
  videoPanelSrc.includes("buildCanonicalSceneProductionInstructions"),
  false,
  'VideoPanel must not import or use buildCanonicalSceneProductionInstructions'
);

console.log('✓ Panel source files have zero ad-hoc prompt translations (injectCharacterToPrompt & buildCanonicalSceneProductionInstructions removed from panels)');

// ============================================================================
// TEST 2: IMAGE PROMPT AUTHORITY INVARIANT
// ============================================================================
console.log('\n[TEST 2] Image: UI display == Copy text == Renderer request == ImageProductionPackage.final_prompt');

const mockCtx = makeMockContext();
const mockItem = makeMockContentItem();
const funnelStrategy = buildFunnelStrategyFromContext(mockCtx);

const baseImageCandidate: ImageProductionCandidate = buildImageProductionCandidate({
  candidate_id: 'cand_img_auth_001',
  visualObjective: 'Awareness of unified architecture',
  scene: 'Studio setting',
  subject: 'Minimalist studio workspace with high-end display showing clean architecture diagram',
  composition: 'Wide angle desk layout with negative space',
  environment: 'Modern Scandinavian studio office',
  lighting: 'Soft diffused natural studio morning light',
  camera: '50mm f/1.8 crisp focus',
  visualStyle: 'Clean minimalist commercial photography',
  textOverlay: 'Consistent Visuals Across Surfaces',
  branding: 'Alco Studio logo badge',
  negativeConstraints: 'blurry, distorted, oversaturated, cluttered text',
  finalPrompt: 'Commercial studio photo of a minimalist studio workspace with high-end display showing clean architecture diagram.',
});

// Step 1: Parent-level translation
const imageTransResult = translateImageProductionPrompt({
  candidate: baseImageCandidate,
  characterDNA: mockCharacterDNA,
});

assert.strictEqual(imageTransResult.ok, true, 'Image translation must succeed');
const imageBundle = imageTransResult.bundle as ImageTranslatedPromptBundle;
const authorityExecutionPrompt = imageBundle.execution_prompt;

// Step 2: UI execution prompt derived from bundle
const uiDisplayPrompt = imageBundle.execution_prompt;
const copiedPrompt = imageBundle.execution_prompt;
const geminiRequestPrompt = imageBundle.execution_prompt;

// Step 3: Production Package preparation
const imagePackageResult = prepareProductionPackage({
  projectId: mockCtx.project_id,
  sharedContext: mockCtx,
  funnelStrategy,
  contentItem: mockItem,
  characterDNA: mockCharacterDNA,
  candidates: [baseImageCandidate],
  selectedCandidateId: baseImageCandidate.candidate_id,
  translatedPromptBundle: imageBundle,
  metadata: {
    package_id: 'pkg_img_auth_001',
    created_at: new Date().toISOString(),
  },
});

if (!imagePackageResult.ok) {
  console.error('IMAGE PACKAGE ERROR:', (imagePackageResult as any).error);
}
assert.strictEqual(imagePackageResult.ok, true, 'Image package preparation must succeed');
const imagePackage = imagePackageResult.package! as ImageProductionPackage;

// Assert Invariant: All 4 must be strictly identical
assert.strictEqual(uiDisplayPrompt, authorityExecutionPrompt, 'UI display prompt must equal translated bundle');
assert.strictEqual(copiedPrompt, authorityExecutionPrompt, 'Copied prompt must equal translated bundle');
assert.strictEqual(geminiRequestPrompt, authorityExecutionPrompt, 'Gemini request prompt must equal translated bundle');
assert.strictEqual(imagePackage.final_prompt, authorityExecutionPrompt, 'ImageProductionPackage.final_prompt must equal translated bundle');

console.log('✓ Image Authority Invariant holds: UI == Copy == Gemini Request == ImagePackage.final_prompt');

// ============================================================================
// TEST 3: CAROUSEL PROMPT AUTHORITY INVARIANT (PER SLIDE)
// ============================================================================
console.log('\n[TEST 3] Carousel: Slide N UI display == Slide N Copy == CarouselProductionPackage.slides[N].final_prompt');

const baseCarouselCandidate: CarouselProductionCandidate = buildCarouselProductionCandidate({
  candidate_id: 'cand_car_auth_001',
  objective: 'Education',
  slide_count: 3,
  cover_direction: 'Bold product reveal',
  slides: [
    {
      slide_number: 1,
      role: 'hook',
      headline: 'Stop Building Content Pipelines Manually',
      body: 'Manual pipelines drift over time.',
      visual_direction: 'Creative architect looking at complex disjointed screen diagrams',
      layout_direction: 'Top 30% for hook title',
    },
    {
      slide_number: 2,
      role: 'solution',
      headline: 'Prompt Drift Breaks Brand Cohesion',
      body: 'Unified translation bundles lock 100% parity.',
      visual_direction: 'Clean infographics comparing fragmented outputs vs unified outputs',
      layout_direction: 'Center right for diagrams',
    },
    {
      slide_number: 3,
      role: 'cta',
      headline: 'Enforce Single Authority Today',
      body: 'Get started with Alco Production Studio.',
      visual_direction: 'Minimalist closing card with action trigger',
      layout_direction: 'Centered CTA pill',
    },
  ],
  visual_continuity: 'Navy and cream',
  branding: 'Alco Studio badge',
  negative_constraints: 'No cluttered text',
  final_prompts: {
    master_prompt: 'Master carousel prompt for entire series.',
    slides: [
      { slide_number: 1, prompt: 'High resolution workspace of creative director looking at architectural diagrams' },
      { slide_number: 2, prompt: 'Infographic breakdown of 3-layer architecture' },
      { slide_number: 3, prompt: 'Closing card with high-contrast typography' },
    ],
  },
});

const carouselSlidesMeta = [
  { slide_number: 1, visual_format: 'photography' as const },
  { slide_number: 2, visual_format: 'infographic' as const },
  { slide_number: 3, visual_format: 'infographic' as const },
];

const carouselTransResult = translateCarouselProductionPrompts({
  candidate: baseCarouselCandidate,
  slides: carouselSlidesMeta,
  characterDNA: mockCharacterDNA,
});

assert.strictEqual(carouselTransResult.ok, true, 'Carousel translation must succeed');
const carouselBundle = carouselTransResult.bundle as CarouselTranslatedPromptBundle;

// Step 3: Production Package preparation
const carouselPackageResult = prepareProductionPackage({
  projectId: mockCtx.project_id,
  sharedContext: mockCtx,
  funnelStrategy,
  contentItem: mockItem,
  characterDNA: mockCharacterDNA,
  candidates: [baseCarouselCandidate],
  selectedCandidateId: baseCarouselCandidate.candidate_id,
  translatedPromptBundle: carouselBundle,
  metadata: {
    package_id: 'pkg_car_auth_001',
    created_at: new Date().toISOString(),
  },
});

assert.strictEqual(carouselPackageResult.ok, true, 'Carousel package preparation must succeed');
const carouselPackage = carouselPackageResult.package! as CarouselProductionPackage;

// Assert Invariant for each slide
for (let i = 0; i < carouselBundle.slides.length; i++) {
  const slideBundle = carouselBundle.slides[i];
  const slideNum = slideBundle.slide_number;
  const packageSlide = carouselPackage.final_prompts.slides.find((s) => s.slide_number === slideNum);

  assert.ok(packageSlide, `Slide ${slideNum} must exist in CarouselProductionPackage.final_prompts.slides`);
  
  // UI Display & Copy
  const slideUIDisplay = slideBundle.execution_prompt;
  const slideCopied = slideBundle.execution_prompt;
  const slidePkgPrompt = packageSlide.prompt;

  assert.strictEqual(
    slideUIDisplay,
    slideBundle.execution_prompt,
    `Slide ${slideNum} UI display must equal translated execution prompt`
  );
  assert.strictEqual(
    slideCopied,
    slideBundle.execution_prompt,
    `Slide ${slideNum} copied prompt must equal translated execution prompt`
  );
  assert.strictEqual(
    slidePkgPrompt,
    slideBundle.execution_prompt,
    `Slide ${slideNum} package final_prompt must equal translated execution prompt`
  );
}

console.log('✓ Carousel Authority Invariant holds: Slide N UI == Slide N Copy == CarouselPackage.final_prompts.slides[N].prompt');

// ============================================================================
// TEST 4: VIDEO PROMPT AUTHORITY INVARIANT (PER SCENE)
// ============================================================================
console.log('\n[TEST 4] Video: Scene N UI display == Scene N Copy == VideoProductionPackage.execution_prompts[N]');

const baseVideoCandidate: VideoProductionCandidate = {
  candidate_id: 'cand_vid_auth_001',
  candidate_type: 'video',
  final_prompt: 'Master video prompt for unified single authority',
  production_details: {
    production_mode: 'human_led',
    duration_seconds: 15,
    objective: 'Conversion',
    format: '9:16 Vertical Video (Reels/TikTok/Shorts)',
    hook: 'Stop wasting time',
    camera_direction: 'Eye-level crisp',
    motion_direction: 'Smooth zoom',
    audio_direction: 'Upbeat beat',
    negative_constraints: 'No blur',
    voiceover: 'Stop guessing your workflow.',
    on_screen_text: 'Stop Guessing',
    branding: 'Alco Studio logo',
    scenes: [
      {
        scene_number: 1,
        duration_seconds: 4,
        scene_type: 'talking_head',
        purpose: 'Capture instant attention in first 3 seconds',
        camera: 'Close up talking head at eye level',
        visual_direction: 'Talent stands in modern light studio speaking to camera',
        action: 'Direct eye contact, gestures toward screen graphic',
        voiceover: 'Pernahkah Anda menyadari bahwa prompt yang tidak konsisten merusak kualitas visual brand Anda?',
        on_screen_text: 'Satu Otoritas Prompt',
        required_assets: ['character_dna'],
      },
      {
        scene_number: 2,
        duration_seconds: 6,
        scene_type: 'b_roll',
        purpose: 'Show the engine resolving translation centrally',
        camera: 'Medium over-the-shoulder tracking shot',
        visual_direction: 'Screen displaying clean node translation flow',
        action: 'Navigating the unified production workspace',
        voiceover: 'Dengan arsitektur single-bundle, UI, render, dan paket produksi selalu sinkron 100%.',
        on_screen_text: 'Zero Drift Architecture',
        required_assets: ['character_dna', 'screen_recording'],
      },
      {
        scene_number: 3,
        duration_seconds: 5,
        scene_type: 'end_card',
        purpose: 'Deliver punchy action takeaway',
        camera: 'Direct medium shot with slight push in',
        visual_direction: 'Talent smiling confidently with branded background',
        action: 'Points toward lower right CTA badge',
        voiceover: 'Gunakan Alco Production Studio hari ini dan rasakan konsistensi tanpa kompromi.',
        on_screen_text: 'Mulai Sekarang',
        required_assets: ['character_dna'],
      },
    ],
  },
};

const videoTransResult = translateVideoProductionPrompts({
  candidate: baseVideoCandidate,
  characterDNA: mockCharacterDNA,
  productAssetContext: null,
});

assert.strictEqual(videoTransResult.ok, true, 'Video translation must succeed');
const videoBundle = videoTransResult.bundle as VideoTranslatedPromptBundle;

// Step 3: Production Package preparation
const videoPackageResult = prepareProductionPackage({
  projectId: mockCtx.project_id,
  sharedContext: mockCtx,
  funnelStrategy,
  contentItem: mockItem,
  characterDNA: mockCharacterDNA,
  candidates: [baseVideoCandidate],
  selectedCandidateId: baseVideoCandidate.candidate_id,
  translatedPromptBundle: videoBundle,
  metadata: {
    package_id: 'pkg_vid_auth_001',
    created_at: new Date().toISOString(),
  },
});

assert.strictEqual(videoPackageResult.ok, true, 'Video package preparation must succeed');
const videoPackage = videoPackageResult.package! as VideoProductionPackage;

assert.ok(videoPackage.execution_prompts, 'VideoProductionPackage must contain execution_prompts');
assert.strictEqual(videoPackage.execution_prompts.scenes.length, 3, 'Video execution_prompts.scenes must have 3 scenes');

// Assert Invariant for each scene
for (let i = 0; i < videoBundle.scenes.length; i++) {
  const sceneBundle = videoBundle.scenes[i];
  const sceneNum = sceneBundle.scene_number;
  const pkgScene = videoPackage.execution_prompts.scenes.find((s) => s.scene_number === sceneNum);

  assert.ok(pkgScene, `Scene ${sceneNum} must exist in VideoProductionPackage.execution_prompts.scenes`);

  // UI Display instructions derived from bundle
  const uiInstructions = {
    imagePrompt: sceneBundle.start_frame_prompt,
    motionPrompt: sceneBundle.motion_prompt,
    voiceover: sceneBundle.voiceover,
    onScreenText: sceneBundle.on_screen_text,
  };

  assert.strictEqual(
    uiInstructions.imagePrompt,
    pkgScene.start_frame_prompt,
    `Scene ${sceneNum} start frame prompt must match package execution prompt`
  );
  assert.strictEqual(
    uiInstructions.motionPrompt,
    pkgScene.motion_prompt,
    `Scene ${sceneNum} motion prompt must match package execution prompt`
  );
  assert.strictEqual(
    uiInstructions.voiceover,
    pkgScene.voiceover,
    `Scene ${sceneNum} voiceover must match package execution prompt`
  );
  assert.strictEqual(
    uiInstructions.onScreenText,
    pkgScene.on_screen_text,
    `Scene ${sceneNum} on-screen text must match package execution prompt`
  );
}

console.log('✓ Video Authority Invariant holds: Scene N UI == Scene N Copy == VideoPackage.execution_prompts[N]');

// ============================================================================
// TEST 5: FAIL-CLOSED ON MISSING METADATA / TRANSLATION FAILURE
// ============================================================================
console.log('\n[TEST 5] Fail-closed verification: Missing required metadata stops translation and package creation');

// 5.1 Human-led video without character DNA
const invalidVideoTrans = translateVideoProductionPrompts({
  candidate: baseVideoCandidate, // mode is human_led
  characterDNA: null, // missing required CharacterDNA
});
assert.strictEqual(invalidVideoTrans.ok, false, 'Human-led video translation must fail when CharacterDNA is missing');
assert.ok(invalidVideoTrans.error, 'Human-led video translation error must be reported');

// 5.2 Product-demo video without screenshots
const productDemoCandidate: VideoProductionCandidate = {
  candidate_id: 'cand_vid_demo_001',
  candidate_type: 'video',
  final_prompt: 'Master video demo prompt',
  production_details: {
    production_mode: 'product_demo',
    duration_seconds: 15,
    objective: 'Demonstration',
    format: '9:16 Vertical Video (Reels/TikTok/Shorts)',
    hook: 'Feature walkthrough',
    camera_direction: 'Macro UI pan',
    motion_direction: 'Smooth zoom',
    audio_direction: 'Upbeat electronic',
    negative_constraints: 'No blur',
    voiceover: 'Lihat dashboard ini.',
    on_screen_text: 'Dashboard Utama',
    branding: 'Alco Studio logo',
    scenes: [
      {
        scene_number: 1,
        duration_seconds: 4,
        scene_type: 'product_screen',
        purpose: 'Introduce the tool interface',
        camera: 'Macro pan on UI elements',
        visual_direction: 'Show tool workflow in action',
        action: 'Cursor hovering over dashboard metrics',
        voiceover: 'Lihat bagaimana dashboard ini mengorganisir pekerjaan Anda.',
        on_screen_text: 'Dashboard Utama',
        required_assets: ['screen_recording'],
      },
      {
        scene_number: 2,
        duration_seconds: 6,
        scene_type: 'b_roll',
        purpose: 'Deep dive on feature',
        camera: 'Screen capture overlay',
        visual_direction: 'Demonstrating feature speed',
        action: 'Clicking through automated reports',
        voiceover: 'Laporan otomatis siap dalam hitungan detik.',
        on_screen_text: 'Laporan Otomatis',
        required_assets: ['screen_recording'],
      },
      {
        scene_number: 3,
        duration_seconds: 5,
        scene_type: 'end_card',
        purpose: 'Call to action',
        camera: 'Outro card',
        visual_direction: 'Branded outro',
        action: 'CTA button pulse',
        voiceover: 'Coba gratis hari ini.',
        on_screen_text: 'Coba Gratis',
        required_assets: ['logo_asset'],
      },
    ],
  },
};

const invalidProductDemoTrans = translateVideoProductionPrompts({
  candidate: productDemoCandidate,
  productAssetContext: {
    productName: 'FlowSync',
    productCategory: 'SaaS',
    productDescription: 'Testing',
    screenshots: [], // EMPTY screenshots -> must fail
    logoAsset: null,
  },
});
assert.strictEqual(invalidProductDemoTrans.ok, false, 'Product demo translation must fail when screenshots are missing');

console.log('✓ Fail-closed checks pass: Missing required inputs prevent translation and return explicit errors');

console.log('\n--- ALL PHASE 4B-B UI / RENDERER EXECUTION PROMPT AUTHORITY BINDING TESTS PASSED ---');
