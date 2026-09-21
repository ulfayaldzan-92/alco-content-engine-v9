import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  ImageProductionCandidate,
  CarouselProductionCandidate,
  VideoProductionCandidate,
} from '../lib/production-candidate';
import { CharacterDNA } from '../lib/content-contract';
import { ProductAssetContext } from '../lib/video-production-input';
import {
  translateImageProductionPrompt,
  translateCarouselProductionPrompts,
  translateVideoProductionPrompts,
  CarouselPromptSlideMetadata,
  ImageTranslatedPromptBundle,
  CarouselTranslatedPromptBundle,
  VideoTranslatedPromptBundle,
} from '../lib/prompt-translation';
import { buildEffectiveCarouselProductionCandidate } from '../lib/carousel-production-path';

console.log('--- RUNNING PHASE 4A TEST SUITE: PROMPT TRANSLATION CONTRACT ---');

// Helper to construct a valid base ImageProductionCandidate
function makeValidImageCandidate(overrides?: Partial<ImageProductionCandidate>): ImageProductionCandidate {
  return {
    candidate_id: 'img_cand_123',
    candidate_type: 'image',
    production_details: {
      objective: 'Drive brand awareness',
      scene: 'Studio setting',
      subject: 'Luxury smartwatch',
      composition: 'Centrally framed product shot',
      environment: 'Sleek black marble table',
      lighting: 'Soft directional studio lighting',
      camera_direction: 'Eye-level macro lens',
      visual_style: 'Minimalist premium photography',
      negative_constraints: 'no blurry elements',
      text_overlay: '',
      branding: '',
    },
    final_prompt: 'A vibrant studio photograph of a luxury smartwatch on a sleek black marble surface.',
    ...overrides,
  };
}

// Helper to construct a valid base CarouselProductionCandidate
function makeValidCarouselCandidate(slideCount: number = 3, overrides?: Partial<CarouselProductionCandidate>): CarouselProductionCandidate {
  const slidesPlan = Array.from({ length: slideCount }, (_, i) => ({
    slide_number: i + 1,
    role: i === 0 ? 'hook' : i === slideCount - 1 ? 'cta' : 'solution',
    headline: `Header ${i + 1}`,
    body: `Body text for slide ${i + 1}`,
    visual_direction: `Visual direction for slide ${i + 1}`,
    layout_direction: `Layout direction for slide ${i + 1}`,
  }));

  const slidesPrompts = Array.from({ length: slideCount }, (_, i) => ({
    slide_number: i + 1,
    prompt: `Visual prompt for slide ${i + 1} showing feature ${i + 1}.`,
  }));

  return {
    candidate_id: 'car_cand_456',
    candidate_type: 'carousel',
    production_details: {
      objective: 'Drive engagement',
      cover_direction: 'Bold product reveal',
      visual_continuity: 'Consistent warm neutral theme',
      negative_constraints: 'no messy text overlay',
      branding: 'Logo on top right',
      slide_count: slideCount,
      slides: slidesPlan,
    },
    final_prompts: {
      master_prompt: 'Master prompt for entire carousel campaign.',
      slides: slidesPrompts,
    },
    ...overrides,
  };
}

// Helper to construct a valid base VideoProductionCandidate
function makeValidVideoCandidate(mode: 'human_led' | 'product_demo' | 'motion_explainer' = 'motion_explainer', overrides?: Partial<VideoProductionCandidate>): VideoProductionCandidate {
  return {
    candidate_id: 'vid_cand_789',
    candidate_type: 'video',
    final_prompt: 'Video campaign master prompt',
    production_details: {
      production_mode: mode,
      duration_seconds: 15,
      objective: 'Drive conversions',
      format: '9:16 Vertical',
      hook: 'Attention grabbing opener',
      camera_direction: 'Dynamic pan and zoom',
      motion_direction: 'Fluid motion graphics',
      audio_direction: 'Upbeat background music',
      negative_constraints: 'no visual glitch',
      voiceover: 'Voiceover script',
      on_screen_text: 'Text overlay',
      branding: 'Logo watermark',
      scenes: [
        {
          scene_number: 1,
          duration_seconds: 5,
          purpose: 'Hook viewer with product intro',
          visual_direction: 'Dynamic zoom in on product logo',
          action: 'Camera pans left to reveal product',
          camera: 'Close-up, 24fps',
          voiceover: 'Introducing the future of smart living.',
          on_screen_text: 'The Future Is Here',
          scene_type: mode === 'human_led' ? 'talking_head' : mode === 'product_demo' ? 'product_screen' : 'graphic_motion',
          required_assets: mode === 'human_led' ? ['character'] : mode === 'product_demo' ? ['product_screenshot'] : ['motion_graphic'],
        },
        {
          scene_number: 2,
          duration_seconds: 5,
          purpose: 'Highlight core feature',
          visual_direction: 'Sleek motion graphics showing feature highlights',
          action: 'Graphic elements expand smoothly',
          camera: 'Medium shot',
          voiceover: 'Effortless control at your fingertips.',
          on_screen_text: 'Instant Control',
          scene_type: 'graphic_motion',
          required_assets: ['motion_graphic'],
        },
        {
          scene_number: 3,
          duration_seconds: 5,
          purpose: 'Call to action',
          visual_direction: 'Bold brand logo with CTA text',
          action: 'Fade in download button',
          camera: 'Static front shot',
          voiceover: 'Download now on App Store.',
          on_screen_text: 'Get Started Today',
          scene_type: 'end_card',
          required_assets: ['end_card_graphic'],
        },
      ],
    },
    ...overrides,
  };
}

// Helper for valid CharacterDNA
function makeValidCharacterDNA(overrides?: Partial<CharacterDNA>): CharacterDNA {
  return {
    character_id: 'char_001',
    project_id: 'proj_001',
    reference_images: ['https://example.com/ref1.png'],
    identity: {
      display_name: 'Alex Rivera',
      gender_presentation: 'Non-binary',
      estimated_age_range: '28-32',
      ethnicity_or_region_hint: 'Southeast Asian',
      skin_tone: 'Warm Olive',
      hair_description: 'Short dark brown crop',
    },
    style: {
      wardrobe_style: 'Modern tech casual',
    },
    behavior: {
      speaking_tone: 'Confident and approachable',
    },
    consistency_rules: {
      locked_traits: ['Short dark crop'],
      avoid_traits: ['blurry features'],
    },
    prompt_assets: {
      dna_summary_prompt: 'Alex, a 30yo Southeast Asian creator with short dark crop and warm olive skin.',
      locked_visual_prompt: 'Alex wearing modern tech-casual attire with confident warm smile.',
      preview_generation_prompt: 'Preview of Alex in modern tech-casual attire.',
      scene_reuse_prompt_template: 'Alex, a 30yo Southeast Asian creator in custom scene.',
    },
    timestamps: {
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    ...overrides,
  };
}

// Helper for valid ProductAssetContext
function makeValidProductContext(): ProductAssetContext {
  return {
    product_name: 'Alco Analytics Dashboard',
    product_type: 'SaaS Software',
    screenshots: [
      {
        id: 'scr_01',
        name: 'Main Revenue Analytics View',
        kind: 'screenshot',
      },
    ],
    feature_focus: ['Real-time tracking'],
    demo_steps: ['Open app', 'View revenue dashboard'],
  };
}

// ==================================================
// IMAGE TESTS (1 - 6)
// ==================================================

console.log('\n--- IMAGE TESTS ---');

// Test 1: Valid ImageProductionCandidate translates successfully
{
  const cand = makeValidImageCandidate();
  const res = translateImageProductionPrompt({ candidate: cand });
  assert.strictEqual(res.ok, true, 'Test 1: Valid image candidate should translate successfully');
  if (res.ok) {
    assert.strictEqual(res.bundle.asset_type, 'image');
    assert.strictEqual(res.bundle.candidate_id, cand.candidate_id);
    assert.strictEqual(res.bundle.execution_prompt, cand.final_prompt);
  }
  console.log('✅ Test 1: Valid ImageProductionCandidate translates successfully');
}

// Test 2: Without CharacterDNA: execution_prompt === candidate.final_prompt
{
  const cand = makeValidImageCandidate();
  const res = translateImageProductionPrompt({ candidate: cand, characterDNA: null });
  assert.strictEqual(res.ok, true);
  if (res.ok && res.bundle.asset_type === 'image') {
    assert.strictEqual(res.bundle.execution_prompt, cand.final_prompt, 'Test 2: Without CharacterDNA, execution_prompt must match candidate.final_prompt');
  }
  console.log('✅ Test 2: Without CharacterDNA: execution_prompt === candidate.final_prompt');
}

// Test 3: With CharacterDNA: execution_prompt contains declared CharacterDNA information
{
  const cand = makeValidImageCandidate();
  const dna = makeValidCharacterDNA();
  const res = translateImageProductionPrompt({ candidate: cand, characterDNA: dna });
  assert.strictEqual(res.ok, true);
  if (res.ok && res.bundle.asset_type === 'image') {
    assert(res.bundle.execution_prompt.includes('[CHARACTER CONSISTENCY]'), 'Test 3: Must include consistency block');
    assert(res.bundle.execution_prompt.includes('Alex Rivera'), 'Test 3: Must include display_name');
  }
  console.log('✅ Test 3: With CharacterDNA: execution_prompt contains declared CharacterDNA info');
}

// Test 4: Image candidate is not mutated
{
  const cand = makeValidImageCandidate();
  const originalJson = JSON.stringify(cand);
  translateImageProductionPrompt({ candidate: cand, characterDNA: makeValidCharacterDNA() });
  assert.strictEqual(JSON.stringify(cand), originalJson, 'Test 4: Input candidate must remain unmutated');
  console.log('✅ Test 4: Image candidate is not mutated');
}

// Test 5: Invalid image candidate fails closed
{
  const invalidCand = { candidate_id: 'bad', candidate_type: 'image' } as any;
  const res = translateImageProductionPrompt({ candidate: invalidCand });
  assert.strictEqual(res.ok, false, 'Test 5: Invalid image candidate must fail closed');
  console.log('✅ Test 5: Invalid image candidate fails closed');
}

// Test 6: Missing candidate final_prompt fails closed
{
  const badCand = makeValidImageCandidate({ final_prompt: '' });
  const res = translateImageProductionPrompt({ candidate: badCand });
  assert.strictEqual(res.ok, false, 'Test 6: Missing final_prompt must fail closed');
  console.log('✅ Test 6: Missing candidate final_prompt fails closed');
}

// ==================================================
// CHARACTER AUTHORITY TESTS (7 - 13)
// ==================================================

console.log('\n--- CHARACTER AUTHORITY TESTS ---');

// Test 7: CharacterDNA missing gender: output must NOT contain invented "woman"
{
  const cand = makeValidImageCandidate();
  const dna = {
    character_id: 'c1',
    identity: {
      display_name: 'Alex',
      // gender_presentation omitted
      estimated_age_range: '30yo',
      ethnicity_or_region_hint: 'Asian',
    },
  } as unknown as CharacterDNA;
  const res = translateImageProductionPrompt({ candidate: cand, characterDNA: dna });
  assert.strictEqual(res.ok, true);
  if (res.ok && res.bundle.asset_type === 'image') {
    assert(!res.bundle.execution_prompt.toLowerCase().includes('woman'), 'Test 7: Must NOT contain invented "woman"');
  }
  console.log('✅ Test 7: CharacterDNA missing gender does NOT invent "woman"');
}

// Test 8: CharacterDNA missing age: output must NOT contain "around 28 years old"
{
  const cand = makeValidImageCandidate();
  const dna = {
    character_id: 'c1',
    identity: {
      display_name: 'Alex',
      gender_presentation: 'Man',
      // estimated_age_range omitted
    },
  } as unknown as CharacterDNA;
  const res = translateImageProductionPrompt({ candidate: cand, characterDNA: dna });
  assert.strictEqual(res.ok, true);
  if (res.ok && res.bundle.asset_type === 'image') {
    assert(!res.bundle.execution_prompt.includes('around 28 years old'), 'Test 8: Must NOT contain invented "around 28 years old"');
  }
  console.log('✅ Test 8: CharacterDNA missing age does NOT invent "around 28 years old"');
}

// Test 9: CharacterDNA missing region: output must NOT automatically contain "Indonesian"
{
  const cand = makeValidImageCandidate();
  const dna = {
    character_id: 'c1',
    identity: {
      display_name: 'Alex',
      // ethnicity_or_region_hint omitted
    },
  } as unknown as CharacterDNA;
  const res = translateImageProductionPrompt({ candidate: cand, characterDNA: dna });
  assert.strictEqual(res.ok, true);
  if (res.ok && res.bundle.asset_type === 'image') {
    assert(!res.bundle.execution_prompt.includes('Indonesian'), 'Test 9: Must NOT contain invented "Indonesian"');
  }
  console.log('✅ Test 9: CharacterDNA missing region does NOT invent "Indonesian"');
}

// Test 10: Explicit declared gender is preserved
{
  const cand = makeValidImageCandidate();
  const dna = {
    character_id: 'c1',
    identity: {
      display_name: 'Jordan',
      gender_presentation: 'Man',
    },
  } as unknown as CharacterDNA;
  const res = translateImageProductionPrompt({ candidate: cand, characterDNA: dna });
  assert.strictEqual(res.ok, true);
  if (res.ok && res.bundle.asset_type === 'image') {
    assert(res.bundle.execution_prompt.toLowerCase().includes('man'), 'Test 10: Explicit declared gender "Man" must be preserved');
  }
  console.log('✅ Test 10: Explicit declared gender is preserved');
}

// Test 11: Explicit declared age is preserved
{
  const cand = makeValidImageCandidate();
  const dna = {
    character_id: 'c1',
    identity: {
      display_name: 'Jordan',
      estimated_age_range: '45 years old',
    },
  } as unknown as CharacterDNA;
  const res = translateImageProductionPrompt({ candidate: cand, characterDNA: dna });
  assert.strictEqual(res.ok, true);
  if (res.ok && res.bundle.asset_type === 'image') {
    assert(res.bundle.execution_prompt.includes('45 years old'), 'Test 11: Explicit declared age must be preserved');
  }
  console.log('✅ Test 11: Explicit declared age is preserved');
}

// Test 12: Explicit declared region is preserved
{
  const cand = makeValidImageCandidate();
  const dna = {
    character_id: 'c1',
    identity: {
      display_name: 'Jordan',
      ethnicity_or_region_hint: 'Latin American',
    },
  } as unknown as CharacterDNA;
  const res = translateImageProductionPrompt({ candidate: cand, characterDNA: dna });
  assert.strictEqual(res.ok, true);
  if (res.ok && res.bundle.asset_type === 'image') {
    assert(res.bundle.execution_prompt.includes('Latin American'), 'Test 12: Explicit declared region must be preserved');
  }
  console.log('✅ Test 12: Explicit declared region is preserved');
}

// Test 13: Same CharacterDNA input produces identical result
{
  const cand = makeValidImageCandidate();
  const dna = makeValidCharacterDNA();
  const res1 = translateImageProductionPrompt({ candidate: cand, characterDNA: dna });
  const res2 = translateImageProductionPrompt({ candidate: cand, characterDNA: dna });
  assert.strictEqual(JSON.stringify(res1), JSON.stringify(res2), 'Test 13: Translation must be deterministic');
  console.log('✅ Test 13: Same CharacterDNA input produces identical result');
}

// ==================================================
// CAROUSEL TESTS (14 - 25)
// ==================================================

console.log('\n--- CAROUSEL TESTS ---');

// Test 14: Valid Carousel candidate translates all N slides
{
  const cand = makeValidCarouselCandidate(3);
  const slidesMeta: CarouselPromptSlideMetadata[] = [
    { slide_number: 1, visual_format: 'photography' },
    { slide_number: 2, visual_format: 'infographic' },
    { slide_number: 3, visual_format: 'hybrid' },
  ];
  const res = translateCarouselProductionPrompts({ candidate: cand, slides: slidesMeta });
  assert.strictEqual(res.ok, true, 'Test 14: Valid carousel candidate should translate');
  if (res.ok && res.bundle.asset_type === 'carousel') {
    assert.strictEqual(res.bundle.slides.length, 3);
  }
  console.log('✅ Test 14: Valid Carousel candidate translates all N slides');
}

// Test 15: Translated slide count === canonical slide_count
{
  const cand = makeValidCarouselCandidate(5);
  const slidesMeta: CarouselPromptSlideMetadata[] = Array.from({ length: 5 }, (_, i) => ({
    slide_number: i + 1,
    visual_format: i === 0 ? 'photography' : 'infographic',
  }));
  const res = translateCarouselProductionPrompts({ candidate: cand, slides: slidesMeta });
  assert.strictEqual(res.ok, true);
  if (res.ok && res.bundle.asset_type === 'carousel') {
    assert.strictEqual(res.bundle.slides.length, 5, 'Test 15: Slide count must match 5');
  }
  console.log('✅ Test 15: Translated slide count === canonical slide_count');
}

// Test 16: Slide numbers remain exactly sequential
{
  const cand = makeValidCarouselCandidate(3);
  const slidesMeta: CarouselPromptSlideMetadata[] = [
    { slide_number: 1, visual_format: 'photography' },
    { slide_number: 2, visual_format: 'photography' },
    { slide_number: 3, visual_format: 'photography' },
  ];
  const res = translateCarouselProductionPrompts({ candidate: cand, slides: slidesMeta });
  assert.strictEqual(res.ok, true);
  if (res.ok && res.bundle.asset_type === 'carousel') {
    assert.strictEqual(res.bundle.slides[0].slide_number, 1);
    assert.strictEqual(res.bundle.slides[1].slide_number, 2);
    assert.strictEqual(res.bundle.slides[2].slide_number, 3);
  }
  console.log('✅ Test 16: Slide numbers remain exactly sequential');
}

// Test 17: Without CharacterDNA: execution prompts equal base final prompts
{
  const cand = makeValidCarouselCandidate(3);
  const slidesMeta: CarouselPromptSlideMetadata[] = [
    { slide_number: 1, visual_format: 'photography' },
    { slide_number: 2, visual_format: 'infographic' },
    { slide_number: 3, visual_format: 'hybrid' },
  ];
  const res = translateCarouselProductionPrompts({ candidate: cand, slides: slidesMeta, characterDNA: null });
  assert.strictEqual(res.ok, true);
  if (res.ok && res.bundle.asset_type === 'carousel') {
    assert.strictEqual(res.bundle.slides[0].execution_prompt, cand.final_prompts.slides[0].prompt);
    assert.strictEqual(res.bundle.slides[1].execution_prompt, cand.final_prompts.slides[1].prompt);
    assert.strictEqual(res.bundle.slides[2].execution_prompt, cand.final_prompts.slides[2].prompt);
  }
  console.log('✅ Test 17: Without CharacterDNA: execution prompts equal base final prompts');
}

// Test 18: With CharacterDNA: applicable photography prompt receives CharacterDNA
{
  const cand = makeValidCarouselCandidate(3);
  const dna = makeValidCharacterDNA();
  const slidesMeta: CarouselPromptSlideMetadata[] = [
    { slide_number: 1, visual_format: 'photography' },
    { slide_number: 2, visual_format: 'infographic' },
    { slide_number: 3, visual_format: 'photography' },
  ];
  const res = translateCarouselProductionPrompts({ candidate: cand, slides: slidesMeta, characterDNA: dna });
  assert.strictEqual(res.ok, true);
  if (res.ok && res.bundle.asset_type === 'carousel') {
    assert(res.bundle.slides[0].execution_prompt.includes('[CHARACTER CONSISTENCY]'), 'Test 18: Photography slide must receive CharacterDNA');
  }
  console.log('✅ Test 18: With CharacterDNA: photography prompt receives CharacterDNA');
}

// Test 19: Infographic prompt does not incorrectly receive character when isCharacterApplicable rejects it
{
  const cand = makeValidCarouselCandidate(3);
  const dna = makeValidCharacterDNA();
  const slidesMeta: CarouselPromptSlideMetadata[] = [
    { slide_number: 1, visual_format: 'photography' },
    { slide_number: 2, visual_format: 'infographic' },
    { slide_number: 3, visual_format: 'photography' },
  ];
  const res = translateCarouselProductionPrompts({ candidate: cand, slides: slidesMeta, characterDNA: dna });
  assert.strictEqual(res.ok, true);
  if (res.ok && res.bundle.asset_type === 'carousel') {
    assert(!res.bundle.slides[1].execution_prompt.includes('[CHARACTER CONSISTENCY]'), 'Test 19: Infographic slide without explicit human must NOT receive CharacterDNA');
  }
  console.log('✅ Test 19: Infographic prompt does NOT receive character when non-applicable');
}

// Test 20: Invalid visual_format fails closed
{
  const cand = makeValidCarouselCandidate(3);
  const slidesMeta = [
    { slide_number: 1, visual_format: 'photography' },
    { slide_number: 2, visual_format: 'invalid_format' as any },
    { slide_number: 3, visual_format: 'hybrid' },
  ];
  const res = translateCarouselProductionPrompts({ candidate: cand, slides: slidesMeta });
  assert.strictEqual(res.ok, false, 'Test 20: Invalid visual_format must fail closed');
  console.log('✅ Test 20: Invalid visual_format fails closed');
}

// Test 21: Duplicate slide metadata fails closed
{
  const cand = makeValidCarouselCandidate(3);
  const slidesMeta: CarouselPromptSlideMetadata[] = [
    { slide_number: 1, visual_format: 'photography' },
    { slide_number: 1, visual_format: 'infographic' }, // Duplicate 1
    { slide_number: 3, visual_format: 'hybrid' },
  ];
  const res = translateCarouselProductionPrompts({ candidate: cand, slides: slidesMeta });
  assert.strictEqual(res.ok, false, 'Test 21: Duplicate slide_number in metadata must fail closed');
  console.log('✅ Test 21: Duplicate slide metadata fails closed');
}

// Test 22: Missing slide metadata fails closed
{
  const cand = makeValidCarouselCandidate(3);
  const res = translateCarouselProductionPrompts({ candidate: cand, slides: null as any });
  assert.strictEqual(res.ok, false, 'Test 22: Missing slide metadata must fail closed');
  console.log('✅ Test 22: Missing slide metadata fails closed');
}

// Test 23: Slide metadata count mismatch fails closed
{
  const cand = makeValidCarouselCandidate(3);
  const slidesMeta: CarouselPromptSlideMetadata[] = [
    { slide_number: 1, visual_format: 'photography' },
    { slide_number: 2, visual_format: 'infographic' },
  ]; // Only 2 for 3-slide candidate
  const res = translateCarouselProductionPrompts({ candidate: cand, slides: slidesMeta });
  assert.strictEqual(res.ok, false, 'Test 23: Slide metadata count mismatch must fail closed');
  console.log('✅ Test 23: Slide metadata count mismatch fails closed');
}

// Test 24: Carousel candidate remains immutable
{
  const cand = makeValidCarouselCandidate(3);
  const originalJson = JSON.stringify(cand);
  const slidesMeta: CarouselPromptSlideMetadata[] = [
    { slide_number: 1, visual_format: 'photography' },
    { slide_number: 2, visual_format: 'infographic' },
    { slide_number: 3, visual_format: 'hybrid' },
  ];
  translateCarouselProductionPrompts({ candidate: cand, slides: slidesMeta, characterDNA: makeValidCharacterDNA() });
  assert.strictEqual(JSON.stringify(cand), originalJson, 'Test 24: Candidate must remain unmutated');
  console.log('✅ Test 24: Carousel candidate remains immutable');
}

// Test 25: Translation behavior matches current buildEffectiveCarouselProductionCandidate for final slide prompt execution text
{
  const cand = makeValidCarouselCandidate(3);
  const dna = makeValidCharacterDNA();
  const slidesMeta: CarouselPromptSlideMetadata[] = [
    { slide_number: 1, visual_format: 'photography' },
    { slide_number: 2, visual_format: 'infographic' },
    { slide_number: 3, visual_format: 'photography' },
  ];

  const translatedRes = translateCarouselProductionPrompts({ candidate: cand, slides: slidesMeta, characterDNA: dna });
  assert.strictEqual(translatedRes.ok, true);

  const effectiveCand = buildEffectiveCarouselProductionCandidate(
    cand,
    [
      { slide: 1, visual_format: 'photography' },
      { slide: 2, visual_format: 'infographic' },
      { slide: 3, visual_format: 'photography' },
    ],
    dna
  );

  assert(effectiveCand !== null, 'Effective candidate must build');
  if (translatedRes.ok && translatedRes.bundle.asset_type === 'carousel' && effectiveCand) {
    for (let i = 0; i < 3; i++) {
      assert.strictEqual(
        translatedRes.bundle.slides[i].execution_prompt,
        effectiveCand.final_prompts.slides[i].prompt,
        `Test 25: Slide ${i + 1} translated execution prompt must match effective candidate prompt`
      );
    }
  }
  console.log('✅ Test 25: Translator matches buildEffectiveCarouselProductionCandidate execution prompts');
}

// ==================================================
// VIDEO TESTS (26 - 40)
// ==================================================

console.log('\n--- VIDEO TESTS ---');

// Test 26: Valid human_led candidate + valid CharacterDNA translates exactly 3 scenes
{
  const cand = makeValidVideoCandidate('human_led');
  const dna = makeValidCharacterDNA();
  const res = translateVideoProductionPrompts({ candidate: cand, characterDNA: dna });
  assert.strictEqual(res.ok, true, 'Test 26: Valid human_led video candidate should translate');
  if (res.ok && res.bundle.asset_type === 'video') {
    assert.strictEqual(res.bundle.scenes.length, 3);
    assert.strictEqual(res.bundle.production_mode, 'human_led');
  }
  console.log('✅ Test 26: Valid human_led candidate + valid CharacterDNA translates exactly 3 scenes');
}

// Test 27: human_led without CharacterDNA fails closed
{
  const cand = makeValidVideoCandidate('human_led');
  const res = translateVideoProductionPrompts({ candidate: cand, characterDNA: null });
  assert.strictEqual(res.ok, false, 'Test 27: human_led without CharacterDNA must fail closed');
  console.log('✅ Test 27: human_led without CharacterDNA fails closed');
}

// Test 28: human_led CharacterDNA missing usable prompt authority fails closed
{
  const cand = makeValidVideoCandidate('human_led');
  const emptyDna = {
    character_id: 'c1',
    identity: { display_name: 'Alex' },
    // prompt_assets missing
  } as unknown as CharacterDNA;
  const res = translateVideoProductionPrompts({ candidate: cand, characterDNA: emptyDna });
  assert.strictEqual(res.ok, false, 'Test 28: human_led missing usable prompt authority must fail closed');
  console.log('✅ Test 28: human_led CharacterDNA missing usable prompt authority fails closed');
}

// Test 29: product_demo + valid ProductAssetContext translates exactly 3 scenes
{
  const cand = makeValidVideoCandidate('product_demo');
  const ctx = makeValidProductContext();
  const res = translateVideoProductionPrompts({ candidate: cand, productAssetContext: ctx });
  assert.strictEqual(res.ok, true, 'Test 29: product_demo should translate');
  if (res.ok && res.bundle.asset_type === 'video') {
    assert.strictEqual(res.bundle.scenes.length, 3);
    assert.strictEqual(res.bundle.production_mode, 'product_demo');
  }
  console.log('✅ Test 29: product_demo + valid ProductAssetContext translates exactly 3 scenes');
}

// Test 30: product_demo without ProductAssetContext fails closed
{
  const cand = makeValidVideoCandidate('product_demo');
  const res = translateVideoProductionPrompts({ candidate: cand, productAssetContext: null });
  assert.strictEqual(res.ok, false, 'Test 30: product_demo without ProductAssetContext must fail closed');
  console.log('✅ Test 30: product_demo without ProductAssetContext fails closed');
}

// Test 31: product_demo without product_name fails closed
{
  const cand = makeValidVideoCandidate('product_demo');
  const badCtx = {
    product_name: '',
    screenshots: [{ id: 's1', name: 'Sc1', kind: 'screenshot' }],
  } as unknown as ProductAssetContext;
  const res = translateVideoProductionPrompts({ candidate: cand, productAssetContext: badCtx });
  assert.strictEqual(res.ok, false, 'Test 31: product_demo without product_name must fail closed');
  console.log('✅ Test 31: product_demo without product_name fails closed');
}

// Test 32: product_demo without valid screenshot fails closed
{
  const cand = makeValidVideoCandidate('product_demo');
  const badCtx = {
    product_name: 'My Product',
    screenshots: [],
  } as unknown as ProductAssetContext;
  const res = translateVideoProductionPrompts({ candidate: cand, productAssetContext: badCtx });
  assert.strictEqual(res.ok, false, 'Test 32: product_demo without valid screenshot must fail closed');
  console.log('✅ Test 32: product_demo without valid screenshot fails closed');
}

// Test 33: motion_explainer succeeds without CharacterDNA/ProductAssetContext
{
  const cand = makeValidVideoCandidate('motion_explainer');
  const res = translateVideoProductionPrompts({ candidate: cand });
  assert.strictEqual(res.ok, true, 'Test 33: motion_explainer needs no extra inputs');
  if (res.ok && res.bundle.asset_type === 'video') {
    assert.strictEqual(res.bundle.scenes.length, 3);
    assert.strictEqual(res.bundle.production_mode, 'motion_explainer');
  }
  console.log('✅ Test 33: motion_explainer succeeds without CharacterDNA/ProductAssetContext');
}

// Test 34: Every translated video scene preserves exact scene_number
{
  const cand = makeValidVideoCandidate('motion_explainer');
  const res = translateVideoProductionPrompts({ candidate: cand });
  assert.strictEqual(res.ok, true);
  if (res.ok && res.bundle.asset_type === 'video') {
    assert.strictEqual(res.bundle.scenes[0].scene_number, 1);
    assert.strictEqual(res.bundle.scenes[1].scene_number, 2);
    assert.strictEqual(res.bundle.scenes[2].scene_number, 3);
  }
  console.log('✅ Test 34: Every translated video scene preserves exact scene_number (1, 2, 3)');
}

// Test 35: Every translated video scene contains non-empty start_frame_prompt
{
  const cand = makeValidVideoCandidate('motion_explainer');
  const res = translateVideoProductionPrompts({ candidate: cand });
  assert.strictEqual(res.ok, true);
  if (res.ok && res.bundle.asset_type === 'video') {
    for (let i = 0; i < 3; i++) {
      assert(res.bundle.scenes[i].start_frame_prompt.trim().length > 0, `Scene ${i + 1} start_frame_prompt must be non-empty`);
    }
  }
  console.log('✅ Test 35: Every translated video scene contains non-empty start_frame_prompt');
}

// Test 36: Every translated video scene contains non-empty motion_prompt
{
  const cand = makeValidVideoCandidate('motion_explainer');
  const res = translateVideoProductionPrompts({ candidate: cand });
  assert.strictEqual(res.ok, true);
  if (res.ok && res.bundle.asset_type === 'video') {
    for (let i = 0; i < 3; i++) {
      assert(res.bundle.scenes[i].motion_prompt.trim().length > 0, `Scene ${i + 1} motion_prompt must be non-empty`);
    }
  }
  console.log('✅ Test 36: Every translated video scene contains non-empty motion_prompt');
}

// Test 37: Voiceover equals canonical scene voiceover
{
  const cand = makeValidVideoCandidate('motion_explainer');
  const res = translateVideoProductionPrompts({ candidate: cand });
  assert.strictEqual(res.ok, true);
  if (res.ok && res.bundle.asset_type === 'video') {
    for (let i = 0; i < 3; i++) {
      assert.strictEqual(res.bundle.scenes[i].voiceover, cand.production_details.scenes[i].voiceover);
    }
  }
  console.log('✅ Test 37: Voiceover equals canonical scene voiceover');
}

// Test 38: On_screen_text equals canonical scene on_screen_text
{
  const cand = makeValidVideoCandidate('motion_explainer');
  const res = translateVideoProductionPrompts({ candidate: cand });
  assert.strictEqual(res.ok, true);
  if (res.ok && res.bundle.asset_type === 'video') {
    for (let i = 0; i < 3; i++) {
      assert.strictEqual(res.bundle.scenes[i].on_screen_text, cand.production_details.scenes[i].on_screen_text);
    }
  }
  console.log('✅ Test 38: On_screen_text equals canonical scene on_screen_text');
}

// Test 39: Invalid runtime production_mode fails closed
{
  const badCand = makeValidVideoCandidate('motion_explainer');
  (badCand.production_details as any).production_mode = 'unknown_mode';
  const res = translateVideoProductionPrompts({ candidate: badCand });
  assert.strictEqual(res.ok, false, 'Test 39: Unknown production_mode must fail closed');
  console.log('✅ Test 39: Invalid runtime production_mode fails closed');
}

// Test 40: Video candidate remains immutable
{
  const cand = makeValidVideoCandidate('motion_explainer');
  const originalJson = JSON.stringify(cand);
  translateVideoProductionPrompts({ candidate: cand });
  assert.strictEqual(JSON.stringify(cand), originalJson, 'Test 40: Candidate must remain unmutated');
  console.log('✅ Test 40: Video candidate remains immutable');
}

// ==================================================
// DETERMINISM TESTS (41 - 43)
// ==================================================

console.log('\n--- DETERMINISM TESTS ---');

// Test 41: Same image translation input -> same result
{
  const cand = makeValidImageCandidate();
  const dna = makeValidCharacterDNA();
  const resA = translateImageProductionPrompt({ candidate: cand, characterDNA: dna });
  const resB = translateImageProductionPrompt({ candidate: cand, characterDNA: dna });
  assert.deepStrictEqual(resA, resB);
  console.log('✅ Test 41: Same image translation input -> same result');
}

// Test 42: Same carousel translation input -> same result
{
  const cand = makeValidCarouselCandidate(3);
  const slidesMeta: CarouselPromptSlideMetadata[] = [
    { slide_number: 1, visual_format: 'photography' },
    { slide_number: 2, visual_format: 'infographic' },
    { slide_number: 3, visual_format: 'hybrid' },
  ];
  const resA = translateCarouselProductionPrompts({ candidate: cand, slides: slidesMeta });
  const resB = translateCarouselProductionPrompts({ candidate: cand, slides: slidesMeta });
  assert.deepStrictEqual(resA, resB);
  console.log('✅ Test 42: Same carousel translation input -> same result');
}

// Test 43: Same video translation input -> same result
{
  const cand = makeValidVideoCandidate('human_led');
  const dna = makeValidCharacterDNA();
  const resA = translateVideoProductionPrompts({ candidate: cand, characterDNA: dna });
  const resB = translateVideoProductionPrompts({ candidate: cand, characterDNA: dna });
  assert.deepStrictEqual(resA, resB);
  console.log('✅ Test 43: Same video translation input -> same result');
}

// ==================================================
// NO AUTHORITY INVENTION TESTS (44 - 48)
// ==================================================

console.log('\n--- NO AUTHORITY INVENTION TESTS ---');

// Test 44: Translator does not add project_id
// Test 45: Translator does not add content_item_id
// Test 46: Translator does not add package_id
// Test 47: Translator does not add production_status
// Test 48: Translator does not create timestamps
{
  const imgRes = translateImageProductionPrompt({ candidate: makeValidImageCandidate() });
  assert.strictEqual(imgRes.ok, true);
  if (imgRes.ok) {
    const b: any = imgRes.bundle;
    assert.strictEqual(b.project_id, undefined, 'Test 44: Must not add project_id');
    assert.strictEqual(b.content_item_id, undefined, 'Test 45: Must not add content_item_id');
    assert.strictEqual(b.package_id, undefined, 'Test 46: Must not add package_id');
    assert.strictEqual(b.production_status, undefined, 'Test 47: Must not add production_status');
    assert.strictEqual(b.created_at, undefined, 'Test 48: Must not create created_at timestamp');
    assert.strictEqual(b.updated_at, undefined, 'Test 48: Must not create updated_at timestamp');
  }
  console.log('✅ Tests 44-48: Translator does NOT add extraneous authority or timestamps');
}

// ==================================================
// STATIC ARCHITECTURE TESTS (49 - 52)
// ==================================================

console.log('\n--- STATIC ARCHITECTURE TESTS ---');

const translatorPath = path.join(process.cwd(), 'lib', 'prompt-translation.ts');
const translatorSource = fs.readFileSync(translatorPath, 'utf-8');

// Test 49: lib/prompt-translation.ts contains no forbidden keywords
{
  const forbiddenKeywords = [
    'fetch(',
    'localStorage',
    'saveProjectData',
    'loadProjectData',
    'crypto.randomUUID',
    'Date.now',
    'new Date',
  ];
  for (const kw of forbiddenKeywords) {
    assert(!translatorSource.includes(kw), `Test 49: lib/prompt-translation.ts must NOT contain "${kw}"`);
  }
  console.log('✅ Test 49: lib/prompt-translation.ts contains no side effects or non-deterministic calls');
}

// Test 50: new translator file does not import React
{
  assert(!translatorSource.includes("from 'react'"), 'Test 50: Must not import React');
  assert(!translatorSource.includes('from "react"'), 'Test 50: Must not import React');
  console.log('✅ Test 50: lib/prompt-translation.ts does not import React');
}

// Test 51: new translator file does not import ProductionPackage storage
{
  assert(!translatorSource.includes('production-package-storage'), 'Test 51: Must not import ProductionPackage storage');
  console.log('✅ Test 51: lib/prompt-translation.ts does not import ProductionPackage storage');
}

// Test 52: translator does not import Gemini client/API utilities
{
  assert(!translatorSource.includes('gemini'), 'Test 52: Must not import Gemini');
  assert(!translatorSource.includes('@google/genai'), 'Test 52: Must not import @google/genai');
  console.log('✅ Test 52: lib/prompt-translation.ts does not import Gemini client/API utilities');
}

console.log('\n🎉 ALL 52 PHASE 4A TESTS PASSED SUCCESSFULLY (100% OK)');
