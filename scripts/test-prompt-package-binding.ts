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
  VideoProductionPackage,
} from '../lib/production-contract';
import { buildFunnelStrategyFromContext } from '../lib/funnel-strategy';
import { adaptProductionCandidateToAssetInput } from '../lib/production-candidate-adapter';

console.log('--- RUNNING PHASE 4B-A TEST SUITE: PROMPT-PACKAGE BINDING ---');

function makeMockContext(projectId: string = 'proj_bind_123'): SharedContentContext {
  return {
    project_id: projectId,
    project_name: 'Test Project',
    source: { origin: 'creative_system_json', source_version: '1.0.0' },
    brand_context: {
      brand_name: 'Alco Corp',
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
      primary_audience: 'Creators',
      pain_points: ['Scaling content takes too long'],
      desires: ['Automated workflows'],
      objections: ['Too complex to set up'],
    },
    strategy_context: {
      positioning: 'Leading AI pipeline for content operations',
      usp: ['End to end asset production'],
      main_offer: 'Alco Suite',
      offer_benefits: ['10x production speed'],
      core_message: 'Create faster',
      copy_direction: ['Action-oriented'],
      content_pillars: ['Marketing Tech'],
    },
    system_flags: {
      is_complete_for_planning: true,
      missing_required_fields: [],
    },
  };
}

function makeMockContentItem(projectId: string = 'proj_bind_123', itemId: string = 'item_bind_123'): ContentItem {
  return {
    no: 1,
    content_item_id: itemId,
    project_id: projectId,
    projectId: projectId,
    tanggal: '2026-09-20',
    jenis: 'TOFU (Awareness)',
    format: 'Single Image Feed',
    hookType: 'Question',
    referensi: 'Ref 1',
    headline: 'Headline 1',
    body: 'Body text',
    caption: 'Caption text',
    cta: 'Learn more',
    visual: 'Modern office desk',
    tujuan: 'Awareness',
    keterangan: 'Strategic notes',
  };
}

function makeMockCharacterDNA(projectId: string = 'proj_bind_123'): CharacterDNA {
  return {
    character_id: 'char_bind_001',
    project_id: projectId,
    reference_images: ['https://example.com/ref.png'],
    identity: {
      display_name: 'Maya Lin',
      gender_presentation: 'Woman',
      estimated_age_range: '27-30',
      ethnicity_or_region_hint: 'East Asian',
      skin_tone: 'Fair Warm',
      hair_description: 'Sleek black bob',
    },
    style: { wardrobe_style: 'Minimalist tech casual' },
    behavior: { speaking_tone: 'Warm and precise' },
    consistency_rules: {
      locked_traits: ['Sleek black bob'],
      avoid_traits: ['blurry textures'],
    },
    prompt_assets: {
      dna_summary_prompt: 'Maya, a 28yo Asian female creator with sleek black bob.',
      locked_visual_prompt: 'Maya wearing minimalist tech casual blazer.',
      preview_generation_prompt: 'Preview of Maya.',
      scene_reuse_prompt_template: 'Maya in setting.',
    },
    timestamps: {
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  };
}

function makeImageCandidate(): ImageProductionCandidate {
  return buildImageProductionCandidate({
    candidate_id: 'cand_img_001',
    visualObjective: 'Awareness',
    scene: 'Studio setting',
    subject: 'Smart productivity watch',
    composition: 'Centered macro',
    environment: 'Black marble',
    lighting: 'Soft diffuse studio',
    camera: '50mm prime',
    visualStyle: 'Commercial photography',
    textOverlay: '',
    branding: '',
    negativeConstraints: 'No blur',
    finalPrompt: 'Commercial studio photo of a smart productivity watch on black marble.',
  });
}

function makeCarouselCandidate(): CarouselProductionCandidate {
  return buildCarouselProductionCandidate({
    candidate_id: 'cand_car_001',
    objective: 'Education',
    slide_count: 3,
    cover_direction: 'Bold product reveal',
    slides: [
      { slide_number: 1, role: 'hook', headline: 'H1', body: 'B1', visual_direction: 'V1', layout_direction: 'L1' },
      { slide_number: 2, role: 'solution', headline: 'H2', body: 'B2', visual_direction: 'V2', layout_direction: 'L2' },
      { slide_number: 3, role: 'cta', headline: 'H3', body: 'B3', visual_direction: 'V3', layout_direction: 'L3' },
    ],
    visual_continuity: 'Navy and cream',
    branding: 'Logo top right',
    negative_constraints: 'No cluttered text',
    final_prompts: {
      master_prompt: 'Master carousel prompt for entire series.',
      slides: [
        { slide_number: 1, prompt: 'Slide 1 raw prompt' },
        { slide_number: 2, prompt: 'Slide 2 raw prompt' },
        { slide_number: 3, prompt: 'Slide 3 raw prompt' },
      ],
    },
  });
}

function makeVideoCandidate(mode: 'human_led' | 'product_demo' | 'motion_explainer' = 'motion_explainer'): VideoProductionCandidate {
  return {
    candidate_id: 'cand_vid_001',
    candidate_type: 'video',
    final_prompt: 'Master video prompt',
    production_details: {
      production_mode: mode,
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
      branding: 'Alco logo',
      scenes: [
        {
          scene_number: 1,
          duration_seconds: 5,
          purpose: 'Hook',
          visual_direction: 'Dynamic pan',
          action: 'Speaker looks at camera',
          camera: 'Medium shot',
          voiceover: 'Stop guessing your workflow.',
          on_screen_text: 'Stop Guessing',
          scene_type: mode === 'human_led' ? 'talking_head' : mode === 'product_demo' ? 'product_screen' : 'graphic_motion',
          required_assets: mode === 'human_led' ? ['character'] : mode === 'product_demo' ? ['product_screenshot'] : ['motion_graphic'],
        },
        {
          scene_number: 2,
          duration_seconds: 5,
          purpose: 'Demo',
          visual_direction: 'Feature reveal',
          action: 'Interface expands',
          camera: 'Close up',
          voiceover: 'Use structured pipelines.',
          on_screen_text: 'Structured Pipelines',
          scene_type: 'graphic_motion',
          required_assets: ['motion_graphic'],
        },
        {
          scene_number: 3,
          duration_seconds: 5,
          purpose: 'CTA',
          visual_direction: 'End card',
          action: 'Logo pulse',
          camera: 'Static front',
          voiceover: 'Try Alco today.',
          on_screen_text: 'Alco.ai',
          scene_type: 'end_card',
          required_assets: ['end_card_graphic'],
        },
      ],
    },
  };
}

// ==================================================
// TESTS
// ==================================================

// Test 1: Image binding - candidate + TranslatedProductionPromptBundle -> ProductionAssetInput.final_prompt === execution_prompt
{
  const cand = makeImageCandidate();
  const transRes = translateImageProductionPrompt({ candidate: cand });
  assert.strictEqual(transRes.ok, true);
  if (transRes.ok && transRes.bundle.asset_type === 'image') {
    const bindRes = bindTranslatedPromptBundleToAssetInput(cand, transRes.bundle);
    assert.strictEqual(bindRes.ok, true, 'Test 1: Image binding should succeed');
    if (bindRes.ok && bindRes.assetInput.asset_type === 'image') {
      assert.strictEqual(bindRes.assetInput.final_prompt, transRes.bundle.execution_prompt);
      assert.strictEqual(bindRes.assetInput.final_prompt, cand.final_prompt);
    }
  }
  console.log('✅ Test 1: Image binding sets final_prompt === execution_prompt');
}

// Test 2: Image binding - CharacterDNA translated execution_prompt carries into ProductionAssetInput
{
  const cand = makeImageCandidate();
  const dna = makeMockCharacterDNA();
  const transRes = translateImageProductionPrompt({ candidate: cand, characterDNA: dna });
  assert.strictEqual(transRes.ok, true);
  if (transRes.ok && transRes.bundle.asset_type === 'image') {
    const bindRes = bindTranslatedPromptBundleToAssetInput(cand, transRes.bundle);
    assert.strictEqual(bindRes.ok, true);
    if (bindRes.ok && bindRes.assetInput.asset_type === 'image') {
      assert.strictEqual(bindRes.assetInput.final_prompt, transRes.bundle.execution_prompt);
      assert(bindRes.assetInput.final_prompt.includes('Maya Lin'));
      assert(bindRes.assetInput.final_prompt.includes('[CHARACTER CONSISTENCY]'));
    }
  }
  console.log('✅ Test 2: Image binding carries CharacterDNA translated prompt into ProductionAssetInput');
}

// Test 3: Carousel binding - TranslatedProductionPromptBundle.slides -> ProductionAssetInput.final_prompts.slides
// Test 4: Carousel binding - slide count preserved
// Test 5: Carousel binding - slide numbers preserved
// Test 6: Carousel binding - master_prompt preserved
{
  const cand = makeCarouselCandidate();
  const dna = makeMockCharacterDNA();
  const transRes = translateCarouselProductionPrompts({
    candidate: cand,
    slides: [
      { slide_number: 1, visual_format: 'photography' },
      { slide_number: 2, visual_format: 'infographic' },
      { slide_number: 3, visual_format: 'photography' },
    ],
    characterDNA: dna,
  });
  assert.strictEqual(transRes.ok, true);
  if (transRes.ok && transRes.bundle.asset_type === 'carousel') {
    const bindRes = bindTranslatedPromptBundleToAssetInput(cand, transRes.bundle);
    assert.strictEqual(bindRes.ok, true);
    if (bindRes.ok && bindRes.assetInput.asset_type === 'carousel') {
      // Test 3
      assert.strictEqual(bindRes.assetInput.final_prompts.slides[0].prompt, transRes.bundle.slides[0].execution_prompt);
      assert.strictEqual(bindRes.assetInput.final_prompts.slides[1].prompt, transRes.bundle.slides[1].execution_prompt);
      assert.strictEqual(bindRes.assetInput.final_prompts.slides[2].prompt, transRes.bundle.slides[2].execution_prompt);
      // Test 4
      assert.strictEqual(bindRes.assetInput.final_prompts.slides.length, 3);
      // Test 5
      assert.strictEqual(bindRes.assetInput.final_prompts.slides[0].slide_number, 1);
      assert.strictEqual(bindRes.assetInput.final_prompts.slides[1].slide_number, 2);
      assert.strictEqual(bindRes.assetInput.final_prompts.slides[2].slide_number, 3);
      // Test 6
      assert.strictEqual(bindRes.assetInput.final_prompts.master_prompt, cand.final_prompts.master_prompt);
    }
  }
  console.log('✅ Tests 3-6: Carousel binding preserves master_prompt, slide count, sequential numbers, and execution prompts');
}

// Test 7: Video binding - TranslatedProductionPromptBundle -> ProductionAssetInput.execution_prompts
// Test 8: Video binding - 3 scenes preserved with start_frame_prompt, motion_prompt, voiceover, on_screen_text
{
  const cand = makeVideoCandidate('motion_explainer');
  const transRes = translateVideoProductionPrompts({ candidate: cand });
  assert.strictEqual(transRes.ok, true);
  if (transRes.ok && transRes.bundle.asset_type === 'video') {
    const bindRes = bindTranslatedPromptBundleToAssetInput(cand, transRes.bundle);
    assert.strictEqual(bindRes.ok, true);
    if (bindRes.ok && bindRes.assetInput.asset_type === 'video') {
      const ep = bindRes.assetInput.execution_prompts;
      assert(ep !== undefined);
      assert.strictEqual(ep.candidate_id, cand.candidate_id);
      assert.strictEqual(ep.production_mode, 'motion_explainer');
      assert.strictEqual(ep.scenes.length, 3);
      for (let i = 0; i < 3; i++) {
        assert.strictEqual(ep.scenes[i].scene_number, i + 1);
        assert.strictEqual(ep.scenes[i].start_frame_prompt, transRes.bundle.scenes[i].start_frame_prompt);
        assert.strictEqual(ep.scenes[i].motion_prompt, transRes.bundle.scenes[i].motion_prompt);
        assert.strictEqual(ep.scenes[i].voiceover, transRes.bundle.scenes[i].voiceover);
        assert.strictEqual(ep.scenes[i].on_screen_text, transRes.bundle.scenes[i].on_screen_text);
      }
    }
  }
  console.log('✅ Tests 7-8: Video binding preserves execution_prompts with all 3 scenes and fields');
}

// Test 9: Video candidate_id mismatch -> binding fails closed
{
  const cand = makeVideoCandidate('motion_explainer');
  const transRes = translateVideoProductionPrompts({ candidate: cand });
  assert.strictEqual(transRes.ok, true);
  if (transRes.ok && transRes.bundle.asset_type === 'video') {
    const mismatchedBundle: VideoTranslatedPromptBundle = {
      ...transRes.bundle,
      candidate_id: 'other_cand_id',
    };
    const bindRes = bindTranslatedPromptBundleToAssetInput(cand, mismatchedBundle);
    assert.strictEqual(bindRes.ok, false);
    assert(bindRes.error?.includes('Candidate ID mismatch'));
  }
  console.log('✅ Test 9: Video candidate_id mismatch fails closed');
}

// Test 10: Video production_mode mismatch -> binding fails closed
{
  const cand = makeVideoCandidate('motion_explainer');
  const transRes = translateVideoProductionPrompts({ candidate: cand });
  assert.strictEqual(transRes.ok, true);
  if (transRes.ok && transRes.bundle.asset_type === 'video') {
    const mismatchedBundle: VideoTranslatedPromptBundle = {
      ...transRes.bundle,
      production_mode: 'human_led',
    };
    const bindRes = bindTranslatedPromptBundleToAssetInput(cand, mismatchedBundle);
    assert.strictEqual(bindRes.ok, false);
    assert(bindRes.error?.includes('production_mode mismatch'));
  }
  console.log('✅ Test 10: Video production_mode mismatch fails closed');
}

// Test 11: Image candidate_id mismatch -> binding fails closed
{
  const cand = makeImageCandidate();
  const transRes = translateImageProductionPrompt({ candidate: cand });
  assert.strictEqual(transRes.ok, true);
  if (transRes.ok && transRes.bundle.asset_type === 'image') {
    const mismatchedBundle: ImageTranslatedPromptBundle = {
      ...transRes.bundle,
      candidate_id: 'different_id',
    };
    const bindRes = bindTranslatedPromptBundleToAssetInput(cand, mismatchedBundle);
    assert.strictEqual(bindRes.ok, false);
    assert(bindRes.error?.includes('Candidate ID mismatch'));
  }
  console.log('✅ Test 11: Image candidate_id mismatch fails closed');
}

// Test 12: Carousel candidate_id mismatch -> binding fails closed
{
  const cand = makeCarouselCandidate();
  const transRes = translateCarouselProductionPrompts({
    candidate: cand,
    slides: [
      { slide_number: 1, visual_format: 'photography' },
      { slide_number: 2, visual_format: 'infographic' },
      { slide_number: 3, visual_format: 'photography' },
    ],
  });
  assert.strictEqual(transRes.ok, true);
  if (transRes.ok && transRes.bundle.asset_type === 'carousel') {
    const mismatchedBundle: CarouselTranslatedPromptBundle = {
      ...transRes.bundle,
      candidate_id: 'car_other_id',
    };
    const bindRes = bindTranslatedPromptBundleToAssetInput(cand, mismatchedBundle);
    assert.strictEqual(bindRes.ok, false);
    assert(bindRes.error?.includes('Candidate ID mismatch'));
  }
  console.log('✅ Test 12: Carousel candidate_id mismatch fails closed');
}

// Test 13: Carousel slide count mismatch with candidate -> binding fails closed
{
  const cand = makeCarouselCandidate();
  const transRes = translateCarouselProductionPrompts({
    candidate: cand,
    slides: [
      { slide_number: 1, visual_format: 'photography' },
      { slide_number: 2, visual_format: 'infographic' },
      { slide_number: 3, visual_format: 'photography' },
    ],
  });
  assert.strictEqual(transRes.ok, true);
  if (transRes.ok && transRes.bundle.asset_type === 'carousel') {
    const truncatedBundle: CarouselTranslatedPromptBundle = {
      ...transRes.bundle,
      slides: transRes.bundle.slides.slice(0, 2), // only 2 slides for 3-slide candidate
    };
    const bindRes = bindTranslatedPromptBundleToAssetInput(cand, truncatedBundle);
    assert.strictEqual(bindRes.ok, false);
    assert(bindRes.error?.toLowerCase().includes('slide count'));
  }
  console.log('✅ Test 13: Carousel slide count mismatch fails closed');
}

// Test 14: End-to-end prepareProductionPackage creates valid Image ProductionPackage with bound prompt
{
  const projId = 'proj_bind_e2e';
  const mockCtx = makeMockContext(projId);
  const mockItem = makeMockContentItem(projId, 'item_img_e2e');
  const funnelStrat = buildFunnelStrategyFromContext(mockCtx);
  const cand = makeImageCandidate();
  const transRes = translateImageProductionPrompt({ candidate: cand });
  assert.strictEqual(transRes.ok, true);
  if (transRes.ok) {
    const prepRes = prepareProductionPackage({
      projectId: projId,
      sharedContext: mockCtx,
      funnelStrategy: funnelStrat,
      contentItem: mockItem,
      candidates: [cand],
      selectedCandidateId: cand.candidate_id,
      translatedPromptBundle: transRes.bundle,
      metadata: {
        package_id: 'pkg_img_e2e',
        created_at: '2026-09-20T12:00:00Z',
      },
    });
    assert.strictEqual(prepRes.ok, true, 'Test 14: Image prepareProductionPackage should succeed');
    if (prepRes.ok && transRes.bundle.asset_type === 'image') {
      assert.strictEqual(prepRes.package.asset_type, 'image');
      assert.strictEqual(prepRes.package.final_prompt, transRes.bundle.execution_prompt);
      assert.strictEqual(prepRes.package.production_status, 'ready_for_production');
    }
  }
  console.log('✅ Test 14: End-to-end prepareProductionPackage creates valid Image ProductionPackage');
}

// Test 15: End-to-end prepareProductionPackage creates valid Carousel ProductionPackage with bound prompts
{
  const projId = 'proj_bind_e2e';
  const mockCtx = makeMockContext(projId);
  const mockItem = makeMockContentItem(projId, 'item_car_e2e');
  const funnelStrat = buildFunnelStrategyFromContext(mockCtx);
  const cand = makeCarouselCandidate();
  const transRes = translateCarouselProductionPrompts({
    candidate: cand,
    slides: [
      { slide_number: 1, visual_format: 'photography' },
      { slide_number: 2, visual_format: 'infographic' },
      { slide_number: 3, visual_format: 'photography' },
    ],
  });
  assert.strictEqual(transRes.ok, true);
  if (transRes.ok) {
    const prepRes = prepareProductionPackage({
      projectId: projId,
      sharedContext: mockCtx,
      funnelStrategy: funnelStrat,
      contentItem: mockItem,
      candidates: [cand],
      selectedCandidateId: cand.candidate_id,
      translatedPromptBundle: transRes.bundle,
      metadata: {
        package_id: 'pkg_car_e2e',
        created_at: '2026-09-20T12:00:00Z',
      },
    });
    assert.strictEqual(prepRes.ok, true, 'Test 15: Carousel prepareProductionPackage should succeed');
    if (prepRes.ok && prepRes.package.asset_type === 'carousel') {
      assert.strictEqual(prepRes.package.final_prompts.slides.length, 3);
      assert.strictEqual(prepRes.package.production_status, 'ready_for_production');
    }
  }
  console.log('✅ Test 15: End-to-end prepareProductionPackage creates valid Carousel ProductionPackage');
}

// Test 16: End-to-end prepareProductionPackage creates valid Video ProductionPackage with bound execution_prompts
{
  const projId = 'proj_bind_e2e';
  const mockCtx = makeMockContext(projId);
  const mockItem = makeMockContentItem(projId, 'item_vid_e2e');
  const funnelStrat = buildFunnelStrategyFromContext(mockCtx);
  const cand = makeVideoCandidate('motion_explainer');
  const transRes = translateVideoProductionPrompts({ candidate: cand });
  assert.strictEqual(transRes.ok, true);
  if (transRes.ok) {
    const prepRes = prepareProductionPackage({
      projectId: projId,
      sharedContext: mockCtx,
      funnelStrategy: funnelStrat,
      contentItem: mockItem,
      candidates: [cand],
      selectedCandidateId: cand.candidate_id,
      translatedPromptBundle: transRes.bundle,
      metadata: {
        package_id: 'pkg_vid_e2e',
        created_at: '2026-09-20T12:00:00Z',
      },
    });
    assert.strictEqual(prepRes.ok, true, 'Test 16: Video prepareProductionPackage should succeed');
    if (prepRes.ok && prepRes.package.asset_type === 'video') {
      assert.strictEqual(prepRes.package.production_status, 'ready_for_production');
      assert(prepRes.package.execution_prompts !== undefined);
      assert.strictEqual(prepRes.package.execution_prompts.scenes.length, 3);
    }
  }
  console.log('✅ Test 16: End-to-end prepareProductionPackage creates valid Video ProductionPackage');
}

// Test 17: Video build fails closed if execution_prompts is missing in buildProductionPackage
{
  const projId = 'proj_bind_e2e';
  const mockCtx = makeMockContext(projId);
  const mockItem = makeMockContentItem(projId, 'item_vid_e2e');
  const funnelStrat = buildFunnelStrategyFromContext(mockCtx);
  const engineCtxRes = buildProductionEngineContext(projId, mockCtx, funnelStrat, mockItem);
  assert.strictEqual(engineCtxRes.isValid, true);
  if (engineCtxRes.isValid && engineCtxRes.context) {
    const cand = makeVideoCandidate('motion_explainer');
    const assetInputWithoutEp = {
      asset_type: 'video' as const,
      video: cand.production_details,
      final_prompt: cand.final_prompt,
      // execution_prompts intentionally omitted
    };
    const buildRes = buildProductionPackage(engineCtxRes.context, assetInputWithoutEp as any, {
      package_id: 'pkg_vid_no_ep',
      created_at: '2026-09-20T12:00:00Z',
    });
    assert.strictEqual(buildRes.isValid, false, 'Test 17: Video build without execution_prompts must fail');
    assert(buildRes.error?.includes('execution_prompts'));
  }
  console.log('✅ Test 17: buildProductionPackage strictly fails closed when video execution_prompts is missing');
}

// Test 18: Backward compatibility: VideoProductionPackage without execution_prompts is still valid under validateProductionPackage (for existing packages)
{
  const existingLegacyVideoPackage: VideoProductionPackage = {
    package_id: 'legacy_vid_pkg_001',
    project_id: 'proj_bind_e2e',
    content_item_id: 'item_vid_e2e',
    funnel_stage: 'TOFU',
    asset_type: 'video',
    production_status: 'ready_for_production',
    strategy_snapshot: {
      brand_name: 'Alco Corp',
      category: 'SaaS',
      positioning: 'AI Engine',
      primary_audience: 'Creators',
      main_offer: 'Alco Suite',
      core_message: 'Create faster',
      campaign_goal: 'Awareness',
      funnel_stage: 'TOFU',
      funnel_objective: 'TOFU Awareness',
      message_direction: 'Fast delivery',
      cta_direction: 'Learn more',
    },
    content_snapshot: {
      headline: 'Headline 1',
      body: 'Body text',
      caption: 'Caption text',
      cta: 'Learn more',
      visual_direction: 'Modern office desk',
      content_format: 'Single Image Feed',
      strategic_objective: 'Awareness',
      strategic_rationale: 'Strategic notes',
    },
    video: {
      production_mode: 'motion_explainer',
      objective: 'Conversion',
      duration_seconds: 15,
      format: '9:16 Vertical Video (Reels/TikTok/Shorts)',
      hook: 'Stop wasting time',
      scenes: [
        {
          scene_number: 1,
          duration_seconds: 5,
          purpose: 'Hook',
          visual_direction: 'Dynamic pan',
          action: 'Speaker looks at camera',
          camera: 'Medium shot',
          voiceover: 'Stop guessing your workflow.',
          on_screen_text: 'Stop Guessing',
          scene_type: 'talking_head',
          required_assets: [],
        },
        {
          scene_number: 2,
          duration_seconds: 5,
          purpose: 'Demo',
          visual_direction: 'Feature reveal',
          action: 'Interface expands',
          camera: 'Close up',
          voiceover: 'Use structured pipelines.',
          on_screen_text: 'Structured Pipelines',
          scene_type: 'graphic_motion',
          required_assets: [],
        },
        {
          scene_number: 3,
          duration_seconds: 5,
          purpose: 'CTA',
          visual_direction: 'End card',
          action: 'Logo pulse',
          camera: 'Static front',
          voiceover: 'Try Alco today.',
          on_screen_text: 'Alco.ai',
          scene_type: 'end_card',
          required_assets: [],
        },
      ],
      camera_direction: 'Eye-level crisp',
      motion_direction: 'Smooth zoom',
      audio_direction: 'Upbeat beat',
      negative_constraints: 'No blur',
      voiceover: 'Top level voiceover',
      on_screen_text: 'Top level on screen text',
      branding: 'Alco logo',
    },
    final_prompt: 'Legacy video final prompt',
    // execution_prompts is undefined for legacy package
    created_at: '2026-09-15T12:00:00Z',
  };

  const validationRes = validateProductionPackage(existingLegacyVideoPackage);
  assert.strictEqual(validationRes.isValid, true, 'Test 18: Legacy video package without execution_prompts remains valid in validateProductionPackage');
  console.log('✅ Test 18: Backward compatibility: VideoProductionPackage without execution_prompts remains valid');
}

// --------------------------------------------------
// Test 19: Raw Production Candidate Adapter Fail-Closed for Video
// --------------------------------------------------
{
  const imgCand = makeImageCandidate();
  const imgAdaptRes = adaptProductionCandidateToAssetInput(imgCand);
  assert.strictEqual(imgAdaptRes.ok, true, 'Test 19a: Image candidate adapts normally');
  if (imgAdaptRes.ok) {
    assert.strictEqual(imgAdaptRes.assetInput.asset_type, 'image');
  }

  const carCand = makeCarouselCandidate();
  const carAdaptRes = adaptProductionCandidateToAssetInput(carCand);
  assert.strictEqual(carAdaptRes.ok, true, 'Test 19b: Carousel candidate adapts normally');
  if (carAdaptRes.ok) {
    assert.strictEqual(carAdaptRes.assetInput.asset_type, 'carousel');
  }

  const vidCand = makeVideoCandidate('human_led');
  const vidAdaptRes = adaptProductionCandidateToAssetInput(vidCand);
  assert.strictEqual(vidAdaptRes.ok, false, 'Test 19c: Raw Video candidate must fail closed in adaptProductionCandidateToAssetInput');
  if (!vidAdaptRes.ok) {
    assert.ok(
      vidAdaptRes.error.includes('Video ProductionAssetInput requires translated execution prompt authority'),
      'Test 19d: Error clearly indicates translated execution prompt authority is required'
    );
  }

  // Verify that full canonical path via TranslatedProductionPromptBundle still succeeds
  const projId = 'proj_bind_123';
  const mockCtx = makeMockContext(projId);
  const mockItem = makeMockContentItem(projId, 'item_bind_001');
  const funnelStrat = buildFunnelStrategyFromContext(mockCtx);
  const engineCtxRes = buildProductionEngineContext(projId, mockCtx, funnelStrat, mockItem);
  assert.strictEqual(engineCtxRes.isValid, true);
  const dna = makeMockCharacterDNA();
  const transRes = translateVideoProductionPrompts({
    candidate: vidCand,
    characterDNA: dna,
  });
  assert.strictEqual(transRes.ok, true);
  if (transRes.ok && engineCtxRes.isValid && engineCtxRes.context) {
    const bindRes = bindTranslatedPromptBundleToAssetInput(vidCand, transRes.bundle);
    assert.strictEqual(bindRes.ok, true);
    if (bindRes.ok) {
      const meta: ProductionPackageMetadata = {
        package_id: 'pkg_adapter_canonical_v1',
        created_at: new Date().toISOString(),
      };
      const buildRes = buildProductionPackage(engineCtxRes.context, bindRes.assetInput, meta);
      assert.strictEqual(buildRes.isValid, true, 'Test 19e: Video package creation through translation + binding succeeds');
      assert.strictEqual(buildRes.package?.asset_type, 'video');
      assert.ok(buildRes.package?.execution_prompts, 'Test 19f: Resulting Video package has valid execution_prompts');
    }
  }

  console.log('✅ Test 19: Raw Video Candidate Adapter boundary fails closed, requiring translated execution authority');
}

// ==================================================
// STATIC ARCHITECTURE GUARDS
// ==================================================

console.log('\n--- STATIC ARCHITECTURE GUARDS ---');

// Guard 1: Production Engine does not import prompt-translation
{
  const engineSource = fs.readFileSync(path.join(process.cwd(), 'lib', 'production-engine.ts'), 'utf-8');
  assert(!engineSource.includes('prompt-translation'), 'Guard 1: lib/production-engine.ts must NOT import prompt-translation');
  console.log('✅ Guard 1: lib/production-engine.ts does not import prompt-translation');
}

// Guard 2: prompt-package-binding does not import Gemini or React
{
  const bindingSource = fs.readFileSync(path.join(process.cwd(), 'lib', 'prompt-package-binding.ts'), 'utf-8');
  assert(!bindingSource.includes('from "react"'), 'Guard 2: lib/prompt-package-binding.ts must NOT import React');
  assert(!bindingSource.includes("from 'react'"), 'Guard 2: lib/prompt-package-binding.ts must NOT import React');
  assert(!bindingSource.includes('gemini'), 'Guard 2: lib/prompt-package-binding.ts must NOT import Gemini');
  assert(!bindingSource.includes('@google/genai'), 'Guard 2: lib/prompt-package-binding.ts must NOT import @google/genai');
  console.log('✅ Guard 2: lib/prompt-package-binding.ts does not import React or Gemini');
}

// Guard 3: production-candidate-adapter.ts does not import prompt-translation
{
  const adapterSource = fs.readFileSync(path.join(process.cwd(), 'lib', 'production-candidate-adapter.ts'), 'utf-8');
  assert(!adapterSource.includes('prompt-translation'), 'Guard 3: lib/production-candidate-adapter.ts must NOT import prompt-translation');
  console.log('✅ Guard 3: lib/production-candidate-adapter.ts does not import prompt-translation');
}

// Guard 4: production-candidate-adapter.ts does not fabricate Video execution_prompts
{
  const adapterSource = fs.readFileSync(path.join(process.cwd(), 'lib', 'production-candidate-adapter.ts'), 'utf-8');
  assert(!adapterSource.includes('start_frame_prompt: s.visual_direction'), 'Guard 4a: Adapter must not derive start_frame_prompt from visual_direction');
  assert(!adapterSource.includes('s.visual_direction'), 'Guard 4b: Adapter must not reference s.visual_direction for execution prompts');
  assert(!adapterSource.includes('motion_prompt: s.action'), 'Guard 4c: Adapter must not derive motion_prompt from action');
  assert(!adapterSource.includes('s.action'), 'Guard 4d: Adapter must not reference s.action for execution prompts');
  assert(!adapterSource.includes('VideoExecutionPrompts'), 'Guard 4e: Adapter must not construct VideoExecutionPrompts');
  console.log('✅ Guard 4: lib/production-candidate-adapter.ts does not fabricate execution prompts');
}

console.log('\n🎉 ALL 19 PROMPT-PACKAGE BINDING TESTS AND STATIC GUARDS PASSED (100% OK)');
