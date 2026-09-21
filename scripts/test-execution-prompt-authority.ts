import {
  EXECUTION_PROMPT_CONTRACT_VERSION,
  buildExecutionPromptAuthority,
  hashDeterministicString,
  isValidExecutionSignatureFormat,
} from '../lib/execution-prompt-authority';
import {
  translateImageProductionPrompt,
  translateCarouselProductionPrompts,
  translateVideoProductionPrompts,
  type ImageTranslatedPromptBundle,
  type CarouselTranslatedPromptBundle,
  type VideoTranslatedPromptBundle,
} from '../lib/prompt-translation';
import { bindTranslatedPromptBundleToAssetInput } from '../lib/prompt-package-binding';
import { adaptProductionCandidateToAssetInput } from '../lib/production-candidate-adapter';
import {
  buildProductionPackage,
  type ProductionPackageMetadata,
} from '../lib/production-engine';
import { buildProductionEngineContext } from '../lib/production-engine-context';
import { validateProductionPackage } from '../lib/production-contract';
import {
  buildImageProductionCandidate,
  buildCarouselProductionCandidate,
  buildVideoProductionCandidate,
  buildCanonicalVideoScenePlan,
} from '../lib/production-candidate';
import type { SharedContentContext, ContentItem, CharacterDNA } from '../lib/content-contract';
import type { FunnelStrategy } from '../lib/funnel-strategy';

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
  brand_name: 'Luminary Skin',
  category: 'Skincare',
  primary_audience: 'Women 25-40',
  positioning: 'Clean botanical skincare',
  main_offer: 'Hydrating Glow Serum',
  core_message: 'Healthy radiant skin naturally',
  campaign_goal: 'Customer acquisition',
  brand_visual_snapshot: {
    visual_style: 'Minimalist editorial',
    typography_style: 'Modern serif',
    design_mood: 'Fresh and radiant',
  },
};

const mockFunnelStrategy: FunnelStrategy = {
  funnel_stage: 'mofu',
  funnel_objective: 'Educate on active botanical ingredients',
  message_direction: 'Ingredient breakdown and results',
  cta_direction: 'Learn more about formulation',
};

const mockContentItem: ContentItem = {
  content_item_id: 'ci_200',
  content_format: 'image',
  funnel_stage: 'mofu',
  strategic_objective: 'Showcase formula benefits',
  strategic_rationale: 'Addresses barrier repair needs',
  headline: 'Restore Your Moisture Barrier',
  body: 'Formulated with 5 restorative botanicals for luminous hydration.',
  caption: 'Skin barrier repair in 7 days.',
  cta: 'Discover the Serum',
  visual_direction: 'Crisp studio photography of serum droplet on dewy skin.',
};

const mockCharacterDNA: CharacterDNA = {
  character_id: 'char_amber',
  canonical_name: 'Dr. Amber Hayes',
  role: 'Lead Biochemist',
  appearance_traits: ['warm hazel eyes', 'structured lab coat over ochre knit'],
  wardrobe_style: 'Professional clinician',
  personality_tone: 'Authoritative yet empathetic',
  continuity_anchors: ['gold hexagonal brooch on collar'],
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
      layout: 'left_aligned_text_bold',
      visual_description: 'Skin diagram showing micro tears',
      text_structure: { headline: 'Signs of Barrier Distress', body: 'Redness and flaking' },
      visual_prompts: { prompt: 'Infographic of dry skin cells under microscope' },
    },
    {
      slide_number: 2,
      role: 'solution',
      layout: 'centered_focus',
      visual_description: 'Botanical formulation actives',
      text_structure: { headline: 'Restorative Botanical Complex', body: 'Centella + Ceramides' },
      visual_prompts: { prompt: 'Clean macro photograph of botanical leaves with moisture drops' },
    },
    {
      slide_number: 3,
      role: 'cta',
      layout: 'bottom_card',
      visual_description: 'Serum bottle with radiant skin in background',
      text_structure: { headline: 'Restore Your Glow', body: 'Available now' },
      visual_prompts: { prompt: 'Hero bottle with soft luminous sunlight' },
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

// Valid Canonical Video Candidate
const videoScenes = buildCanonicalVideoScenePlan('MOFU', 'product_demo', {
  hook: 'Is your skin barrier dehydrated?',
  solusi: 'This botanical serum repairs moisture deeply.',
  cta: 'Try Luminary Skin today.',
});

const mockVideoCandidate = buildVideoProductionCandidate({
  candidate_id: 'cand_vid_001',
  production_mode: 'product_demo',
  objective: 'Demonstrate formulation texture and instant barrier hydration',
  format: 'vertical_reel',
  hook: 'Is your skin barrier dehydrated?',
  scenes: videoScenes,
  negative_constraints: 'No harsh artificial studio strobes',
  final_prompt: 'Video demonstration of serum application and absorption.',
});

const mockMetadata: ProductionPackageMetadata = {
  package_id: 'pkg_test_001',
  created_at: '2026-09-21T00:00:00.000Z',
};

// ----------------------------------------------------
// TEST GROUP 1: Deterministic Hashing & Signatures
// ----------------------------------------------------
console.log('--- TEST GROUP 1: Deterministic Hashing & Signatures ---');

const imgTransRes = translateImageProductionPrompt({ candidate: mockImageCandidate, characterDNA: mockCharacterDNA });
assert(imgTransRes.ok, 'Image translation succeeds');
const imgBundle = imgTransRes.bundle as ImageTranslatedPromptBundle;

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
const carBundle = carTransRes.bundle as CarouselTranslatedPromptBundle;

const vidTransRes = translateVideoProductionPrompts({ candidate: mockVideoCandidate, characterDNA: mockCharacterDNA });
assert(vidTransRes.ok, 'Video translation succeeds');
const vidBundle = vidTransRes.bundle as VideoTranslatedPromptBundle;

const imgAuth1 = buildExecutionPromptAuthority(imgBundle);
const imgAuth2 = buildExecutionPromptAuthority(imgBundle);

assert(imgAuth1.ok && imgAuth2.ok, 'Image authority builds successfully');
if (imgAuth1.ok && imgAuth2.ok) {
  assert(imgAuth1.authority.execution_signature === imgAuth2.authority.execution_signature, 'Image signature is 100% deterministic across multiple calls');
  assert(isValidExecutionSignatureFormat('image', imgAuth1.authority.execution_signature), 'Image signature matches exec_sig_image_[0-9a-f]{8}');
  assert(imgAuth1.authority.contract_version === EXECUTION_PROMPT_CONTRACT_VERSION, 'Contract version is execution_prompt_v1');
  assert(imgAuth1.authority.candidate_id === mockImageCandidate.candidate_id, 'Candidate ID preserved in authority');
}

const carAuth1 = buildExecutionPromptAuthority(carBundle);
const carAuth2 = buildExecutionPromptAuthority(carBundle);

assert(carAuth1.ok && carAuth2.ok, 'Carousel authority builds successfully');
if (carAuth1.ok && carAuth2.ok) {
  assert(carAuth1.authority.execution_signature === carAuth2.authority.execution_signature, 'Carousel signature is 100% deterministic');
  assert(isValidExecutionSignatureFormat('carousel', carAuth1.authority.execution_signature), 'Carousel signature matches exec_sig_carousel_[0-9a-f]{8}');
  assert(carAuth1.authority.contract_version === EXECUTION_PROMPT_CONTRACT_VERSION, 'Contract version is execution_prompt_v1');
}

const vidAuth1 = buildExecutionPromptAuthority(vidBundle);
const vidAuth2 = buildExecutionPromptAuthority(vidBundle);

assert(vidAuth1.ok && vidAuth2.ok, 'Video authority builds successfully');
if (vidAuth1.ok && vidAuth2.ok) {
  assert(vidAuth1.authority.execution_signature === vidAuth2.authority.execution_signature, 'Video signature is 100% deterministic');
  assert(isValidExecutionSignatureFormat('video', vidAuth1.authority.execution_signature), 'Video signature matches exec_sig_video_[0-9a-f]{8}');
  assert(vidAuth1.authority.contract_version === EXECUTION_PROMPT_CONTRACT_VERSION, 'Contract version is execution_prompt_v1');
}

// Ensure prompt modification changes signature
const mutatedImgBundle: ImageTranslatedPromptBundle = {
  ...imgBundle,
  execution_prompt: imgBundle.execution_prompt + ' [MODIFIED]',
};
const mutatedImgAuth = buildExecutionPromptAuthority(mutatedImgBundle);
assert(mutatedImgAuth.ok, 'Mutated bundle builds authority');
if (imgAuth1.ok && mutatedImgAuth.ok) {
  assert(imgAuth1.authority.execution_signature !== mutatedImgAuth.authority.execution_signature, 'Different prompt content yields different execution signature');
}

// ----------------------------------------------------
// TEST GROUP 2: Fail-Closed Validation on Malformed Bundles
// ----------------------------------------------------
console.log('\n--- TEST GROUP 2: Fail-Closed on Malformed Bundles ---');

// Null bundle
const nullRes = buildExecutionPromptAuthority(null as any);
assert(!nullRes.ok, 'Null bundle fails closed');

// Missing candidate_id
const noCandIdRes = buildExecutionPromptAuthority({ ...imgBundle, candidate_id: '' });
assert(!noCandIdRes.ok, 'Empty candidate_id fails closed');

// Empty image prompt
const emptyImgPromptRes = buildExecutionPromptAuthority({ ...imgBundle, execution_prompt: '   ' });
assert(!emptyImgPromptRes.ok, 'Whitespace/empty image prompt fails closed');

// Carousel slides out of order
const outOfOrderCarBundle: CarouselTranslatedPromptBundle = {
  ...carBundle,
  slides: [
    { slide_number: 2, execution_prompt: 'Slide 2 prompt' },
    { slide_number: 1, execution_prompt: 'Slide 1 prompt' },
    { slide_number: 3, execution_prompt: 'Slide 3 prompt' },
  ],
};
const outOfOrderRes = buildExecutionPromptAuthority(outOfOrderCarBundle);
assert(!outOfOrderRes.ok, 'Out-of-order carousel slides fail closed without auto-repair');

// Carousel empty slide prompt
const emptySlidePromptBundle: CarouselTranslatedPromptBundle = {
  ...carBundle,
  slides: [
    { slide_number: 1, execution_prompt: 'Slide 1' },
    { slide_number: 2, execution_prompt: '   ' },
    { slide_number: 3, execution_prompt: 'Slide 3' },
  ],
};
const emptySlideRes = buildExecutionPromptAuthority(emptySlidePromptBundle);
assert(!emptySlideRes.ok, 'Empty carousel slide prompt fails closed');

// Video with 2 scenes instead of 3
const twoSceneVidBundle: VideoTranslatedPromptBundle = {
  ...vidBundle,
  scenes: [vidBundle.scenes[0], vidBundle.scenes[1], vidBundle.scenes[2]].slice(0, 2) as any,
};
const twoSceneRes = buildExecutionPromptAuthority(twoSceneVidBundle);
assert(!twoSceneRes.ok, 'Video with 2 scenes fails closed');

// Video with empty motion prompt
const emptyMotionVidBundle: VideoTranslatedPromptBundle = {
  ...vidBundle,
  scenes: [
    vidBundle.scenes[0],
    { ...vidBundle.scenes[1], motion_prompt: '' },
    vidBundle.scenes[2],
  ],
};
const emptyMotionRes = buildExecutionPromptAuthority(emptyMotionVidBundle);
assert(!emptyMotionRes.ok, 'Video scene with empty motion prompt fails closed');

// ----------------------------------------------------
// TEST GROUP 3: Binding Layer & ProductionAssetInput
// ----------------------------------------------------
console.log('\n--- TEST GROUP 3: Binding Layer Execution Authority Integration ---');

const imgBindingRes = bindTranslatedPromptBundleToAssetInput(mockImageCandidate, imgBundle);
assert(imgBindingRes.ok, 'Image binding succeeds');
if (imgBindingRes.ok) {
  assert(imgBindingRes.assetInput.asset_type === 'image', 'AssetInput asset_type is image');
  assert(Boolean(imgBindingRes.assetInput.execution_authority), 'Image assetInput contains execution_authority');
  assert(imgBindingRes.assetInput.execution_authority.asset_type === 'image', 'Image authority asset_type matches');
  assert(isValidExecutionSignatureFormat('image', imgBindingRes.assetInput.execution_authority.execution_signature), 'Image authority signature is valid');
}

const carBindingRes = bindTranslatedPromptBundleToAssetInput(mockCarouselCandidate, carBundle);
assert(carBindingRes.ok, 'Carousel binding succeeds');
if (carBindingRes.ok) {
  assert(carBindingRes.assetInput.asset_type === 'carousel', 'AssetInput asset_type is carousel');
  assert(Boolean(carBindingRes.assetInput.execution_authority), 'Carousel assetInput contains execution_authority');
  assert(carBindingRes.assetInput.execution_authority.asset_type === 'carousel', 'Carousel authority asset_type matches');
  assert(isValidExecutionSignatureFormat('carousel', carBindingRes.assetInput.execution_authority.execution_signature), 'Carousel authority signature is valid');
}

const vidBindingRes = bindTranslatedPromptBundleToAssetInput(mockVideoCandidate, vidBundle);
assert(vidBindingRes.ok, 'Video binding succeeds');
if (vidBindingRes.ok) {
  assert(vidBindingRes.assetInput.asset_type === 'video', 'AssetInput asset_type is video');
  assert(Boolean(vidBindingRes.assetInput.execution_authority), 'Video assetInput contains execution_authority');
  assert(vidBindingRes.assetInput.execution_authority.asset_type === 'video', 'Video authority asset_type matches');
  assert(isValidExecutionSignatureFormat('video', vidBindingRes.assetInput.execution_authority.execution_signature), 'Video authority signature is valid');
}

// ----------------------------------------------------
// TEST GROUP 4: Single Production Engine & Package Validation
// ----------------------------------------------------
console.log('\n--- TEST GROUP 4: Production Engine & Package Validation ---');

const contextRes = buildProductionEngineContext(
  'proj_100',
  mockSharedContext,
  mockFunnelStrategy,
  mockContentItem,
  mockCharacterDNA
);
assert(contextRes.isValid && Boolean(contextRes.context), 'ProductionEngineContext built successfully');
const context = contextRes.context!;

// Build Image package
if (imgBindingRes.ok) {
  const pkgRes = buildProductionPackage(context, imgBindingRes.assetInput, mockMetadata);
  assert(pkgRes.isValid && Boolean(pkgRes.package), 'Image ProductionPackage builds successfully');
  if (pkgRes.package) {
    assert(Boolean(pkgRes.package.execution_authority), 'Image package contains execution_authority');
    assert(pkgRes.package.execution_authority?.candidate_id === mockImageCandidate.candidate_id, 'Package authority candidate_id matches');
    assert(pkgRes.package.execution_authority?.execution_signature === imgBindingRes.assetInput.execution_authority.execution_signature, 'Package authority matches asset input authority');
    const valRes = validateProductionPackage(pkgRes.package);
    assert(valRes.isValid, 'validateProductionPackage accepts package with valid execution_authority');
  }
}

// Build Carousel package
if (carBindingRes.ok) {
  const pkgRes = buildProductionPackage(context, carBindingRes.assetInput, { ...mockMetadata, package_id: 'pkg_car_001' });
  assert(pkgRes.isValid && Boolean(pkgRes.package), 'Carousel ProductionPackage builds successfully');
  if (pkgRes.package) {
    assert(Boolean(pkgRes.package.execution_authority), 'Carousel package contains execution_authority');
    assert(pkgRes.package.execution_authority?.execution_signature === carBindingRes.assetInput.execution_authority.execution_signature, 'Carousel package authority matches asset input authority');
    const valRes = validateProductionPackage(pkgRes.package);
    assert(valRes.isValid, 'validateProductionPackage accepts carousel package with execution_authority');
  }
}

// Build Video package
if (vidBindingRes.ok) {
  const pkgRes = buildProductionPackage(context, vidBindingRes.assetInput, { ...mockMetadata, package_id: 'pkg_vid_001' });
  assert(pkgRes.isValid && Boolean(pkgRes.package), 'Video ProductionPackage builds successfully');
  if (pkgRes.package) {
    assert(Boolean(pkgRes.package.execution_authority), 'Video package contains execution_authority');
    assert(pkgRes.package.execution_authority?.execution_signature === vidBindingRes.assetInput.execution_authority.execution_signature, 'Video package authority matches asset input authority');
    const valRes = validateProductionPackage(pkgRes.package);
    assert(valRes.isValid, 'validateProductionPackage accepts video package with execution_authority');
  }
}

// Engine fails closed if execution_authority is missing on assetInput
if (imgBindingRes.ok) {
  const noAuthInput = { ...imgBindingRes.assetInput } as any;
  delete noAuthInput.execution_authority;
  const noAuthPkgRes = buildProductionPackage(context, noAuthInput, mockMetadata);
  assert(!noAuthPkgRes.isValid, 'Production Engine rejects assetInput missing execution_authority');
}

// Engine fails closed if execution_authority asset_type mismatches
if (imgBindingRes.ok) {
  const mismatchAuthInput = {
    ...imgBindingRes.assetInput,
    execution_authority: {
      ...imgBindingRes.assetInput.execution_authority,
      asset_type: 'video' as any,
    },
  };
  const mismatchRes = buildProductionPackage(context, mismatchAuthInput, mockMetadata);
  assert(!mismatchRes.isValid, 'Production Engine rejects assetInput with mismatched execution_authority asset_type');
}

// Backward compatibility: Legacy packages without execution_authority remain valid in validateProductionPackage
if (imgBindingRes.ok) {
  const pkgRes = buildProductionPackage(context, imgBindingRes.assetInput, mockMetadata);
  if (pkgRes.package) {
    const legacyPkg = { ...pkgRes.package };
    delete legacyPkg.execution_authority;
    const legacyValRes = validateProductionPackage(legacyPkg);
    assert(legacyValRes.isValid, 'validateProductionPackage maintains backward compatibility for legacy packages without execution_authority');
  }
}

// ----------------------------------------------------
// TEST GROUP 5: Raw Candidate Adapter Fail-Closed
// ----------------------------------------------------
console.log('\n--- TEST GROUP 5: Raw Candidate Adapter Fail-Closed ---');

const rawImgAdaptRes = adaptProductionCandidateToAssetInput(mockImageCandidate);
assert(!rawImgAdaptRes.ok, 'adaptProductionCandidateToAssetInput fails closed for raw Image candidate');
if (!rawImgAdaptRes.ok) {
  assert(
    rawImgAdaptRes.error.includes('Image ProductionAssetInput requires translated execution prompt authority'),
    'Raw Image adaptation error explicitly directs to translated prompt bundle workflow'
  );
}

const rawCarAdaptRes = adaptProductionCandidateToAssetInput(mockCarouselCandidate);
assert(!rawCarAdaptRes.ok, 'adaptProductionCandidateToAssetInput fails closed for raw Carousel candidate');
if (!rawCarAdaptRes.ok) {
  assert(
    rawCarAdaptRes.error.includes('Carousel ProductionAssetInput requires translated execution prompt authority'),
    'Raw Carousel adaptation error explicitly directs to translated prompt bundle workflow'
  );
}

const rawVidAdaptRes = adaptProductionCandidateToAssetInput(mockVideoCandidate);
assert(!rawVidAdaptRes.ok, 'adaptProductionCandidateToAssetInput fails closed for raw Video candidate');
if (!rawVidAdaptRes.ok) {
  assert(
    rawVidAdaptRes.error.includes('Video ProductionAssetInput requires translated execution prompt authority'),
    'Raw Video adaptation error explicitly directs to translated prompt bundle workflow'
  );
}

console.log('\n====================================================');
console.log('ALL PHASE 4C-A TESTS PASSED SUCCESSFULLY! ✅');
console.log('====================================================');
