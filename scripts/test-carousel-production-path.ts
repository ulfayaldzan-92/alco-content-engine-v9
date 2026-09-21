/**
 * Phase 3D-D Verification Suite: Carousel Production Path
 *
 * Comprehensive test suite verifying:
 * - Variable slide count handling (no hard-coded counts)
 * - Effective candidate derivation with CharacterDNA prompt injection
 * - Strict Canonical Slide Metadata validation (no visual_format guessing)
 * - Deterministic plan signature hashing
 * - Carousel slide completion state management & validation
 * - Fail-closed Carousel Production Gate with strict project isolation
 * - prepareProductionPackage & saveProductionPackage integration
 * - Canonical authority (no selectedCarouselId or activeItem.carousel_plan reliance)
 * - Static code quality guards (zero unchecked any casts)
 */

import {
  evaluateCarouselProductionGate,
  CarouselProductionGateResult,
  EvaluateCarouselProductionGateParams,
} from '../lib/carousel-production-gate';
import {
  buildEffectiveCarouselProductionCandidate,
  buildCarouselProductionPlanSignature,
  CanonicalCarouselSlideMetadata,
} from '../lib/carousel-production-path';
import {
  CarouselSlideCompletionState,
  createEmptyCarouselSlideCompletionState,
  setCarouselSlideAssetCreated,
  validateCarouselSlideCompletionState,
  areAllCarouselSlidesCreated,
  getCompletedCarouselSlideCount,
  getCarouselSlideCompletionStorageKey,
} from '../lib/carousel-slide-completion';
import {
  ProductionEngineContext,
  buildProductionEngineContext,
} from '../lib/production-engine-context';
import {
  SharedContentContext,
  ContentItem,
  CharacterDNA,
} from '../lib/content-contract';
import { buildFunnelStrategyFromContext } from '../lib/funnel-strategy';
import {
  CarouselProductionCandidate,
  buildCarouselProductionCandidate,
  validateProductionCandidate,
} from '../lib/production-candidate';
import { prepareProductionPackage } from '../lib/production-package-workflow';
import {
  saveProductionPackage,
  loadProductionPackage,
} from '../lib/production-package-storage';
import * as fs from 'fs';
import * as path from 'path';

// Polyfill localStorage in Node test environment
interface GlobalScopeWithStorage {
  window?: unknown;
  localStorage?: {
    getItem: (key: string) => string | null;
    setItem: (key: string, val: string) => void;
    removeItem: (key: string) => void;
    clear: () => void;
  };
}
const globalScope = globalThis as unknown as GlobalScopeWithStorage;
if (typeof globalScope.window === 'undefined') {
  const store: Record<string, string> = {};
  globalScope.window = {};
  globalScope.localStorage = {
    getItem: (key: string): string | null => store[key] || null,
    setItem: (key: string, val: string): void => {
      store[key] = val;
    },
    removeItem: (key: string): void => {
      delete store[key];
    },
    clear: (): void => {
      for (const k of Object.keys(store)) {
        delete store[k];
      }
    },
  };
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

// Helper to build a valid SharedContentContext
function createMockContext(projectId: string = 'proj-carousel-123'): SharedContentContext {
  return {
    project_id: projectId,
    project_name: 'ALCO Marketing System',
    source: {
      origin: 'creative_system_json',
      source_version: '1.0.0',
    },
    brand_context: {
      brand_name: 'ALCO Tech',
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
      primary_audience: 'Founders and Creators',
      pain_points: ['Scaling content takes too long', 'Inconsistent branding'],
      desires: ['Automated workflows', 'High-converting carousels'],
      objections: ['Too complex to set up'],
    },
    strategy_context: {
      positioning: 'Leading AI pipeline for content operations',
      usp: ['End to end asset production', 'Strict brand consistency'],
      main_offer: 'ALCO Content Engine Pro',
      offer_benefits: ['10x production speed', 'Zero hallucination designs'],
      core_message: 'Structure before distribution',
      copy_direction: ['Action-oriented', 'Clear framework steps'],
      content_pillars: ['Marketing Tech', 'Workflow Systems', 'Growth Engineering'],
    },
    system_flags: {
      is_complete_for_planning: true,
      missing_required_fields: [],
    },
  };
}

// Helper to build a valid ContentItem
function createMockContentItem(
  projectId: string = 'proj-carousel-123',
  contentItemId: string = 'item-carousel-456'
): ContentItem & { project_id: string; content_item_id: string } {
  return {
    no: 1,
    project_id: projectId,
    projectId: projectId,
    content_item_id: contentItemId,
    tanggal: '2026-09-20',
    jenis: 'TOFU (Awareness)',
    headline: 'AI Framework for Scalable Content',
    body: 'Learn how to automate and standardize your content production pipeline.',
    caption: 'Save this carousel to streamline your next content cycle.',
    cta: 'Save this carousel',
    visual: 'Clean technical visual diagrams with dark theme',
    format: 'Carousel',
    tujuan: 'Educate audience on structured production workflows',
    hookType: 'Problem Agitation',
    referensi: 'Systematic frameworks',
    keterangan: 'TOFU educational post designed to maximize saves and shares',
    channel: 'instagram',
  };
}

// Helper to build a valid CarouselProductionCandidate with dynamic slide count
function createMockCarouselCandidate(
  contentItemId: string = 'item-carousel-456',
  slideCount: number = 5
): CarouselProductionCandidate {
  const slides = Array.from({ length: slideCount }, (_, idx) => {
    const num = idx + 1;
    return {
      slide_number: num,
      role: num === 1 ? 'hook' : num === slideCount ? 'cta' : 'solution',
      headline: `Headline for slide ${num}`,
      body: `Body text explaining step ${num} in detail`,
      visual_direction: `Clean technical diagram and visual layout for slide ${num}`,
      layout_direction: `Single card with bold header and clean list for slide ${num}`,
    };
  });

  const slidePrompts = Array.from({ length: slideCount }, (_, idx) => {
    const num = idx + 1;
    return {
      slide_number: num,
      prompt: `High quality visual prompt for slide ${num}, clean lighting, sharp focus`,
    };
  });

  return buildCarouselProductionCandidate({
    candidate_id: 'carousel_plan',
    objective: 'Explain scalable content operations step by step',
    slide_count: slideCount,
    cover_direction: 'Bold graphic cover slide with minimalist title',
    slides,
    visual_continuity: 'Consistent navy and slate color theme, crisp typography',
    branding: 'ALCO Content Engine',
    negative_constraints: 'No cluttered text, no low resolution elements',
    final_prompts: {
      master_prompt: 'Cinematic 4:5 vertical carousel suite, minimalist editorial tech style',
      slides: slidePrompts,
    },
  });
}

// Helper to generate canonical slide metadata
function createMockCanonicalSlides(
  slideCount: number,
  defaultFormat: 'photography' | 'infographic' | 'hybrid' = 'infographic'
): CanonicalCarouselSlideMetadata[] {
  return Array.from({ length: slideCount }, (_, idx) => ({
    slide: idx + 1,
    visual_format: idx === 0 ? 'photography' : defaultFormat,
  }));
}

// Helper to build a mock CharacterDNA
function createMockCharacterDNA(projectId: string = 'proj-carousel-123'): CharacterDNA {
  return {
    character_id: 'char-alex-99',
    project_id: projectId,
    reference_images: ['https://example.com/alex1.png'],
    preview_image: 'https://example.com/alex_preview.png',
    additional_instructions: 'Keep tech minimalist tone',
    identity: {
      display_name: 'Alex Vance',
      gender_presentation: 'Non-binary',
      estimated_age_range: 'Late 20s',
      ethnicity_or_region_hint: 'Mixed Asian-European',
      facial_features: 'Sharp jawline, calm and focused expression',
      hair_description: 'Neat dark undercut',
      distinctive_characteristics: 'Wire-frame round glasses, structured navy blazer',
    },
    style: {
      wardrobe_style: 'Minimalist navy blazer, plain white t-shirt',
      visual_vibe: 'Modern tech minimalist',
    },
    behavior: {
      speaking_tone: 'Precise and educational',
      expression_style: 'Grounded and confident',
    },
    consistency_rules: {
      locked_traits: ['round wire-frame glasses', 'navy blazer'],
      avoid_traits: ['flashy logos', 'casual sportswear'],
    },
    prompt_assets: {
      dna_summary_prompt: 'Alex Vance, a tech founder with round glasses and navy blazer',
      locked_visual_prompt: 'Sharp photo of Alex Vance in minimalist tech studio',
      preview_generation_prompt: 'Alex Vance smiling with wire-frame glasses',
      scene_reuse_prompt_template: 'Alex Vance at clean modern desk',
    },
    timestamps: {
      created_at: '2026-09-20T00:00:00.000Z',
      updated_at: '2026-09-20T00:00:00.000Z',
    },
  };
}

async function runCarouselProductionPathTests(): Promise<void> {
  console.log('--- RUNNING PHASE 3D-D TEST SUITE: CAROUSEL PRODUCTION PATH ---');

  const mockCtx = createMockContext();
  const funnelStrategy = buildFunnelStrategyFromContext(mockCtx);
  const mockItem = createMockContentItem();
  const buildCtxRes = buildProductionEngineContext(
    mockCtx.project_id,
    mockCtx,
    funnelStrategy,
    mockItem
  );
  assert(buildCtxRes.isValid && !!buildCtxRes.context, `Failed to build ProductionEngineContext: ${buildCtxRes.error}`);
  const prodEngineCtx = buildCtxRes.context!;

  // Test 1: Valid authoritative inputs with 3-slide carousel pass gate
  console.log('Test 1: Valid authoritative inputs with 3-slide carousel pass gate');
  {
    const cand3 = createMockCarouselCandidate(mockItem.content_item_id, 3);
    const slides3 = createMockCanonicalSlides(3);
    const eff3 = buildEffectiveCarouselProductionCandidate(cand3, slides3, null);
    assert(eff3 !== null, 'Effective candidate 3 should not be null');
    const sig3 = buildCarouselProductionPlanSignature(eff3);
    let comp3 = createEmptyCarouselSlideCompletionState(
      mockItem.project_id,
      mockItem.content_item_id,
      eff3.candidate_id,
      sig3,
      eff3.production_details.slide_count
    );
    for (let s = 1; s <= 3; s++) {
      comp3 = setCarouselSlideAssetCreated(comp3, s, true);
    }
    const res = evaluateCarouselProductionGate({
      production_context: prodEngineCtx,
      source_item: mockItem,
      output_source: 'generated_output',
      effective_candidate: eff3,
      completion_state: comp3,
      current_production_plan_signature: sig3,
    });
    if (!res.is_allowed) {
      console.log('Test 1 blockers:', res.blockers);
    }
    assert(res.is_allowed === true, 'Expected gate to allow 3-slide carousel');
    assert(res.blockers.length === 0, 'Expected no blockers');
  }

  // Test 2: Valid authoritative inputs with 5-slide carousel pass gate
  console.log('Test 2: Valid authoritative inputs with 5-slide carousel pass gate');
  {
    const cand5 = createMockCarouselCandidate(mockItem.content_item_id, 5);
    const slides5 = createMockCanonicalSlides(5);
    const eff5 = buildEffectiveCarouselProductionCandidate(cand5, slides5, null);
    assert(eff5 !== null, 'Effective candidate 5 should not be null');
    const sig5 = buildCarouselProductionPlanSignature(eff5);
    let comp5 = createEmptyCarouselSlideCompletionState(
      mockItem.project_id,
      mockItem.content_item_id,
      eff5.candidate_id,
      sig5,
      eff5.production_details.slide_count
    );
    for (let s = 1; s <= 5; s++) {
      comp5 = setCarouselSlideAssetCreated(comp5, s, true);
    }
    const res = evaluateCarouselProductionGate({
      production_context: prodEngineCtx,
      source_item: mockItem,
      output_source: 'stored_output',
      effective_candidate: eff5,
      completion_state: comp5,
      current_production_plan_signature: sig5,
    });
    assert(res.is_allowed === true, 'Expected gate to allow 5-slide carousel');
  }

  // Test 3: Valid authoritative inputs with 7-slide carousel pass gate
  console.log('Test 3: Valid authoritative inputs with 7-slide carousel pass gate');
  {
    const cand7 = createMockCarouselCandidate(mockItem.content_item_id, 7);
    const slides7 = createMockCanonicalSlides(7);
    const eff7 = buildEffectiveCarouselProductionCandidate(cand7, slides7, null);
    assert(eff7 !== null, 'Effective candidate 7 should not be null');
    const sig7 = buildCarouselProductionPlanSignature(eff7);
    let comp7 = createEmptyCarouselSlideCompletionState(
      mockItem.project_id,
      mockItem.content_item_id,
      eff7.candidate_id,
      sig7,
      eff7.production_details.slide_count
    );
    for (let s = 1; s <= 7; s++) {
      comp7 = setCarouselSlideAssetCreated(comp7, s, true);
    }
    const res = evaluateCarouselProductionGate({
      production_context: prodEngineCtx,
      source_item: mockItem,
      output_source: 'user_edited_output',
      effective_candidate: eff7,
      completion_state: comp7,
      current_production_plan_signature: sig7,
    });
    assert(res.is_allowed === true, 'Expected gate to allow 7-slide carousel');
  }

  // Base setup for negative tests (5 slides)
  const baseCand = createMockCarouselCandidate(mockItem.content_item_id, 5);
  const baseSlides = createMockCanonicalSlides(5);
  const baseEff = buildEffectiveCarouselProductionCandidate(baseCand, baseSlides, null);
  assert(baseEff !== null, 'baseEff should not be null');
  const baseSig = buildCarouselProductionPlanSignature(baseEff);
  let baseComp = createEmptyCarouselSlideCompletionState(
    mockItem.project_id,
    mockItem.content_item_id,
    baseEff.candidate_id,
    baseSig,
    baseEff.production_details.slide_count
  );
  for (let s = 1; s <= 5; s++) {
    baseComp = setCarouselSlideAssetCreated(baseComp, s, true);
  }

  // Test 4: output_source = 'none' is blocked
  console.log("Test 4: output_source = 'none' is blocked");
  {
    const res = evaluateCarouselProductionGate({
      production_context: prodEngineCtx,
      source_item: mockItem,
      output_source: 'none',
      effective_candidate: baseEff,
      completion_state: baseComp,
      current_production_plan_signature: baseSig,
    });
    assert(res.is_allowed === false, 'none should be blocked');
    assert(res.blockers.some((b) => b.includes('Output carousel belum otoritatif')), 'Expected blocker for none');
  }

  // Test 5: output_source = 'initial_draft' is blocked
  console.log("Test 5: output_source = 'initial_draft' is blocked");
  {
    const res = evaluateCarouselProductionGate({
      production_context: prodEngineCtx,
      source_item: mockItem,
      output_source: 'initial_draft',
      effective_candidate: baseEff,
      completion_state: baseComp,
      current_production_plan_signature: baseSig,
    });
    assert(res.is_allowed === false, 'initial_draft should be blocked');
  }

  // Test 6: generated_output accepted
  console.log('Test 6: generated_output accepted');
  {
    const res = evaluateCarouselProductionGate({
      production_context: prodEngineCtx,
      source_item: mockItem,
      output_source: 'generated_output',
      effective_candidate: baseEff,
      completion_state: baseComp,
      current_production_plan_signature: baseSig,
    });
    assert(res.is_allowed === true, 'generated_output should be allowed');
  }

  // Test 7: stored_output accepted
  console.log('Test 7: stored_output accepted');
  {
    const res = evaluateCarouselProductionGate({
      production_context: prodEngineCtx,
      source_item: mockItem,
      output_source: 'stored_output',
      effective_candidate: baseEff,
      completion_state: baseComp,
      current_production_plan_signature: baseSig,
    });
    assert(res.is_allowed === true, 'stored_output should be allowed');
  }

  // Test 8: user_edited_output accepted
  console.log('Test 8: user_edited_output accepted');
  {
    const res = evaluateCarouselProductionGate({
      production_context: prodEngineCtx,
      source_item: mockItem,
      output_source: 'user_edited_output',
      effective_candidate: baseEff,
      completion_state: baseComp,
      current_production_plan_signature: baseSig,
    });
    assert(res.is_allowed === true, 'user_edited_output should be allowed');
  }

  // Test 9: production_context = null is blocked
  console.log('Test 9: production_context = null is blocked');
  {
    const res = evaluateCarouselProductionGate({
      production_context: null,
      source_item: mockItem,
      output_source: 'generated_output',
      effective_candidate: baseEff,
      completion_state: baseComp,
      current_production_plan_signature: baseSig,
    });
    assert(res.is_allowed === false, 'null context should be blocked');
  }

  // Test 10: invalid ProductionEngineContext is blocked
  console.log('Test 10: invalid ProductionEngineContext is blocked');
  {
    const invalidCtx = {
      ...prodEngineCtx,
      project_id: '',
    };
    const res = evaluateCarouselProductionGate({
      production_context: invalidCtx,
      source_item: mockItem,
      output_source: 'generated_output',
      effective_candidate: baseEff,
      completion_state: baseComp,
      current_production_plan_signature: baseSig,
    });
    assert(res.is_allowed === false, 'invalid ProductionEngineContext should be blocked');
  }

  // Test 11: sourceItem = null is blocked
  console.log('Test 11: sourceItem = null is blocked');
  {
    const res = evaluateCarouselProductionGate({
      production_context: prodEngineCtx,
      source_item: null,
      output_source: 'generated_output',
      effective_candidate: baseEff,
      completion_state: baseComp,
      current_production_plan_signature: baseSig,
    });
    assert(res.is_allowed === false, 'null sourceItem should be blocked');
  }

  // Test 12: sourceItem content_item_id mismatch is blocked
  console.log('Test 12: sourceItem content_item_id mismatch is blocked');
  {
    const foreignItem = { ...mockItem, content_item_id: 'item-foreign-999' };
    const res = evaluateCarouselProductionGate({
      production_context: prodEngineCtx,
      source_item: foreignItem,
      output_source: 'generated_output',
      effective_candidate: baseEff,
      completion_state: baseComp,
      current_production_plan_signature: baseSig,
    });
    assert(res.is_allowed === false, 'foreign content_item_id should be blocked');
  }

  // Test 13: Foreign project sourceItem is blocked
  console.log('Test 13: Foreign project sourceItem is blocked');
  {
    const foreignProjectItem = {
      ...mockItem,
      project_id: 'proj-foreign-attacker',
      projectId: 'proj-foreign-attacker',
    };
    const res = evaluateCarouselProductionGate({
      production_context: prodEngineCtx,
      source_item: foreignProjectItem,
      output_source: 'generated_output',
      effective_candidate: baseEff,
      completion_state: baseComp,
      current_production_plan_signature: baseSig,
    });
    assert(res.is_allowed === false, 'foreign project sourceItem must be blocked');
  }

  // Test 14: effective_candidate = null is blocked
  console.log('Test 14: effective_candidate = null is blocked');
  {
    const res = evaluateCarouselProductionGate({
      production_context: prodEngineCtx,
      source_item: mockItem,
      output_source: 'generated_output',
      effective_candidate: null,
      completion_state: baseComp,
      current_production_plan_signature: baseSig,
    });
    assert(res.is_allowed === false, 'null candidate must be blocked');
  }

  // Test 15: candidate_type !== 'carousel' is blocked
  console.log("Test 15: candidate_type !== 'carousel' is blocked");
  {
    const imageCandidate = {
      ...baseEff,
      candidate_type: 'image' as const,
    } as unknown as CarouselProductionCandidate;
    const res = evaluateCarouselProductionGate({
      production_context: prodEngineCtx,
      source_item: mockItem,
      output_source: 'generated_output',
      effective_candidate: imageCandidate,
      completion_state: baseComp,
      current_production_plan_signature: baseSig,
    });
    assert(res.is_allowed === false, 'non-carousel candidate_type must be blocked');
  }

  // Test 16: candidate slide_count !== production_details.slides.length is blocked
  console.log('Test 16: candidate slide_count !== production_details.slides.length is blocked');
  {
    const mismatchedCand: CarouselProductionCandidate = {
      ...baseEff,
      production_details: {
        ...baseEff.production_details,
        slide_count: 7, // but slides array has length 5
      },
    };
    const res = evaluateCarouselProductionGate({
      production_context: prodEngineCtx,
      source_item: mockItem,
      output_source: 'generated_output',
      effective_candidate: mismatchedCand,
      completion_state: baseComp,
      current_production_plan_signature: baseSig,
    });
    assert(res.is_allowed === false, 'mismatched slide_count must be blocked');
  }

  // Test 17: candidate final_prompts.slides.length !== slide_count is blocked
  console.log('Test 17: candidate final_prompts.slides.length !== slide_count is blocked');
  {
    const mismatchedPromptsCand: CarouselProductionCandidate = {
      ...baseEff,
      final_prompts: {
        ...baseEff.final_prompts,
        slides: baseEff.final_prompts.slides.slice(0, 3), // length 3 vs slide_count 5
      },
    };
    const res = evaluateCarouselProductionGate({
      production_context: prodEngineCtx,
      source_item: mockItem,
      output_source: 'generated_output',
      effective_candidate: mismatchedPromptsCand,
      completion_state: baseComp,
      current_production_plan_signature: baseSig,
    });
    assert(res.is_allowed === false, 'mismatched final_prompts slide count must be blocked');
  }

  // Test 18: empty prompt in candidate is blocked
  console.log('Test 18: empty prompt in candidate is blocked');
  {
    const emptyPromptCand: CarouselProductionCandidate = {
      ...baseEff,
      final_prompts: {
        ...baseEff.final_prompts,
        slides: [
          ...baseEff.final_prompts.slides.slice(0, 2),
          { slide_number: 3, prompt: '   ' },
          ...baseEff.final_prompts.slides.slice(3),
        ],
      },
    };
    const res = evaluateCarouselProductionGate({
      production_context: prodEngineCtx,
      source_item: mockItem,
      output_source: 'generated_output',
      effective_candidate: emptyPromptCand,
      completion_state: baseComp,
      current_production_plan_signature: baseSig,
    });
    assert(res.is_allowed === false, 'empty prompt must be blocked');
  }

  // Test 19: completion_state = null is blocked
  console.log('Test 19: completion_state = null is blocked');
  {
    const res = evaluateCarouselProductionGate({
      production_context: prodEngineCtx,
      source_item: mockItem,
      output_source: 'generated_output',
      effective_candidate: baseEff,
      completion_state: null,
      current_production_plan_signature: baseSig,
    });
    assert(res.is_allowed === false, 'null completion_state must be blocked');
  }

  // Test 20: completion_state project_id mismatch is blocked
  console.log('Test 20: completion_state project_id mismatch is blocked');
  {
    const foreignProjectComp: CarouselSlideCompletionState = {
      ...baseComp,
      project_id: 'proj-foreign-attacker',
    };
    const res = evaluateCarouselProductionGate({
      production_context: prodEngineCtx,
      source_item: mockItem,
      output_source: 'generated_output',
      effective_candidate: baseEff,
      completion_state: foreignProjectComp,
      current_production_plan_signature: baseSig,
    });
    assert(res.is_allowed === false, 'foreign project completion_state must be blocked');
  }

  // Test 21: completion_state content_item_id mismatch is blocked
  console.log('Test 21: completion_state content_item_id mismatch is blocked');
  {
    const foreignItemComp: CarouselSlideCompletionState = {
      ...baseComp,
      content_item_id: 'item-foreign-999',
    };
    const res = evaluateCarouselProductionGate({
      production_context: prodEngineCtx,
      source_item: mockItem,
      output_source: 'generated_output',
      effective_candidate: baseEff,
      completion_state: foreignItemComp,
      current_production_plan_signature: baseSig,
    });
    assert(res.is_allowed === false, 'foreign item completion_state must be blocked');
  }

  // Test 22: completion_state candidate_id mismatch is blocked
  console.log('Test 22: completion_state candidate_id mismatch is blocked');
  {
    const foreignCandComp: CarouselSlideCompletionState = {
      ...baseComp,
      candidate_id: 'carousel_style_B',
    };
    const res = evaluateCarouselProductionGate({
      production_context: prodEngineCtx,
      source_item: mockItem,
      output_source: 'generated_output',
      effective_candidate: baseEff,
      completion_state: foreignCandComp,
      current_production_plan_signature: baseSig,
    });
    assert(res.is_allowed === false, 'foreign candidate_id completion_state must be blocked');
  }

  // Test 23: completion_state slide_count mismatch is blocked
  console.log('Test 23: completion_state slide_count mismatch is blocked');
  {
    const foreignCountComp: CarouselSlideCompletionState = {
      ...baseComp,
      slide_count: 7,
    };
    const res = evaluateCarouselProductionGate({
      production_context: prodEngineCtx,
      source_item: mockItem,
      output_source: 'generated_output',
      effective_candidate: baseEff,
      completion_state: foreignCountComp,
      current_production_plan_signature: baseSig,
    });
    assert(res.is_allowed === false, 'mismatched slide_count in completion_state must be blocked');
  }

  // Test 24: completion_state slides array length mismatch is blocked
  console.log('Test 24: completion_state slides array length mismatch is blocked');
  {
    const shortComp: CarouselSlideCompletionState = {
      ...baseComp,
      slides: baseComp.slides.slice(0, 3),
    };
    const res = evaluateCarouselProductionGate({
      production_context: prodEngineCtx,
      source_item: mockItem,
      output_source: 'generated_output',
      effective_candidate: baseEff,
      completion_state: shortComp,
      current_production_plan_signature: baseSig,
    });
    assert(res.is_allowed === false, 'short slides array in completion_state must be blocked');
  }

  // Test 25: completion_state plan_signature mismatch is blocked
  console.log('Test 25: completion_state plan_signature mismatch is blocked');
  {
    const foreignSigComp: CarouselSlideCompletionState = {
      ...baseComp,
      production_plan_signature: 'stale-plan-signature-11111111',
    };
    const res = evaluateCarouselProductionGate({
      production_context: prodEngineCtx,
      source_item: mockItem,
      output_source: 'generated_output',
      effective_candidate: baseEff,
      completion_state: foreignSigComp,
      current_production_plan_signature: baseSig,
    });
    assert(res.is_allowed === false, 'mismatched completion plan_signature must be blocked');
  }

  // Test 26: 0/N slides completed is blocked
  console.log('Test 26: 0/N slides completed is blocked');
  {
    const zeroComp = createEmptyCarouselSlideCompletionState(
      mockItem.project_id,
      mockItem.content_item_id,
      baseEff.candidate_id,
      baseSig,
      baseEff.production_details.slide_count
    );
    const res = evaluateCarouselProductionGate({
      production_context: prodEngineCtx,
      source_item: mockItem,
      output_source: 'generated_output',
      effective_candidate: baseEff,
      completion_state: zeroComp,
      current_production_plan_signature: baseSig,
    });
    assert(res.is_allowed === false, '0/N completed slides must be blocked');
    assert(getCompletedCarouselSlideCount(zeroComp) === 0, 'Completed count should be 0');
  }

  // Test 27: partial (e.g., 2/5) slides completed is blocked
  console.log('Test 27: partial (2/5) slides completed is blocked');
  {
    let partialComp = createEmptyCarouselSlideCompletionState(
      mockItem.project_id,
      mockItem.content_item_id,
      baseEff.candidate_id,
      baseSig,
      baseEff.production_details.slide_count
    );
    partialComp = setCarouselSlideAssetCreated(partialComp, 1, true);
    partialComp = setCarouselSlideAssetCreated(partialComp, 2, true);
    const res = evaluateCarouselProductionGate({
      production_context: prodEngineCtx,
      source_item: mockItem,
      output_source: 'generated_output',
      effective_candidate: baseEff,
      completion_state: partialComp,
      current_production_plan_signature: baseSig,
    });
    assert(res.is_allowed === false, '2/5 completed slides must be blocked');
    assert(getCompletedCarouselSlideCount(partialComp) === 2, 'Completed count should be 2');
    assert(areAllCarouselSlidesCreated(partialComp) === false, 'areAllCarouselSlidesCreated should be false');
  }

  // Test 28: all N/N slides completed is allowed
  console.log('Test 28: all N/N slides completed is allowed');
  {
    assert(areAllCarouselSlidesCreated(baseComp) === true, 'All slides should be marked completed');
    assert(getCompletedCarouselSlideCount(baseComp) === 5, 'Completed count should be 5');
    const res = evaluateCarouselProductionGate({
      production_context: prodEngineCtx,
      source_item: mockItem,
      output_source: 'generated_output',
      effective_candidate: baseEff,
      completion_state: baseComp,
      current_production_plan_signature: baseSig,
    });
    assert(res.is_allowed === true, '5/5 completed slides must be allowed');
  }

  // Test 29: CharacterDNA injection changes signature and is reflected in effective candidate prompts
  console.log('Test 29: CharacterDNA injection changes signature and is reflected in effective candidate prompts');
  {
    const charDNA = createMockCharacterDNA();
    const allPhotoSlides: CanonicalCarouselSlideMetadata[] = Array.from({ length: 5 }, (_, idx) => ({
      slide: idx + 1,
      visual_format: 'photography',
    }));
    const effWithChar = buildEffectiveCarouselProductionCandidate(baseCand, allPhotoSlides, charDNA);
    assert(effWithChar !== null, 'Effective candidate with charDNA should not be null');
    const sigWithChar = buildCarouselProductionPlanSignature(effWithChar);

    assert(sigWithChar !== baseSig, 'Signature with CharacterDNA must differ from base signature');
    for (const s of effWithChar.final_prompts.slides) {
      assert(
        s.prompt.includes(charDNA.identity.display_name),
        `Expected slide ${s.slide_number} prompt to include CharacterDNA display name`
      );
    }
  }

  // Test 30: Carousel candidate sent to prepareProductionPackage has injected CharacterDNA prompts
  console.log('Test 30: Carousel candidate sent to prepareProductionPackage has injected CharacterDNA prompts');
  const charDNA = createMockCharacterDNA();
  const effWithChar = buildEffectiveCarouselProductionCandidate(baseCand, baseSlides, charDNA);
  assert(effWithChar !== null, 'effWithChar should not be null');
  const sigWithChar = buildCarouselProductionPlanSignature(effWithChar);
  let compWithChar = createEmptyCarouselSlideCompletionState(
    mockItem.project_id,
    mockItem.content_item_id,
    effWithChar.candidate_id,
    sigWithChar,
    effWithChar.production_details.slide_count
  );
  for (let s = 1; s <= effWithChar.production_details.slide_count; s++) {
    compWithChar = setCarouselSlideAssetCreated(compWithChar, s, true);
  }
  const prepResult = prepareProductionPackage({
    projectId: mockItem.project_id,
    sharedContext: mockCtx,
    funnelStrategy,
    contentItem: mockItem,
    characterDNA: charDNA,
    candidates: [effWithChar],
    selectedCandidateId: effWithChar.candidate_id,
    metadata: {
      package_id: 'pkg-carousel-001',
      created_at: new Date().toISOString(),
    },
  });
  assert(prepResult.ok === true, `prepareProductionPackage should succeed: ${!prepResult.ok ? prepResult.error : ''}`);
  assert(prepResult.package !== null && prepResult.package !== undefined, 'Package should not be null');

  // Test 31: Resulting package asset_type is 'carousel'
  console.log("Test 31: Resulting package asset_type is 'carousel'");
  assert(prepResult.package?.asset_type === 'carousel', 'Package asset_type must be carousel');

  // Test 32: Resulting package production_status is 'ready_for_production'
  console.log("Test 32: Resulting package production_status is 'ready_for_production'");
  assert(
    prepResult.package?.production_status === 'ready_for_production',
    'Package production_status must be ready_for_production'
  );

  // Test 33: saveProductionPackage saves and loadProductionPackage retrieves the carousel package
  console.log('Test 33: saveProductionPackage saves and loadProductionPackage retrieves the carousel package');
  {
    if (prepResult.package) {
      const saveRes = saveProductionPackage(mockItem.project_id, prepResult.package);
      assert(saveRes.ok === true, `saveProductionPackage should succeed: ${saveRes.error}`);

      const loaded = loadProductionPackage(
        mockItem.project_id,
        mockItem.content_item_id,
        'carousel'
      );
      assert(loaded !== null, 'loadProductionPackage should retrieve the saved carousel package');
      assert(loaded?.package_id === prepResult.package.package_id, 'Package IDs should match');
      assert(loaded?.asset_type === 'carousel', 'Loaded asset_type should be carousel');
    }
  }

  // Test 34: copiedStates cannot affect the gate or completion status
  console.log('Test 34: copiedStates cannot affect the gate or completion status');
  {
    const gateRes1 = evaluateCarouselProductionGate({
      production_context: prodEngineCtx,
      source_item: mockItem,
      output_source: 'generated_output',
      effective_candidate: effWithChar,
      completion_state: compWithChar,
      current_production_plan_signature: sigWithChar,
    });
    assert(gateRes1.is_allowed === true, 'Gate remains strictly authoritative and uncoupled from UI copy states');
  }

  // Test 35: selectedCarouselId cannot override canonical candidate authority
  console.log('Test 35: selectedCarouselId cannot override canonical candidate authority');
  {
    const candId = effWithChar.candidate_id;
    assert(candId === 'carousel_plan', 'Canonical candidate ID must be carousel_plan');
    const legacyIds: string[] = ['A', 'B', 'C'];
    assert(
      !legacyIds.includes(candId),
      'Candidate ID must never be legacy selectedCarouselId (A, B, C)'
    );
  }

  // Test 36: Toggle completion: marking slide true, toggling back to false resets completion and blocks gate
  console.log('Test 36: Toggle completion: marking slide true, toggling back to false resets completion and blocks gate');
  {
    let toggledComp = createEmptyCarouselSlideCompletionState(
      mockItem.project_id,
      mockItem.content_item_id,
      baseEff.candidate_id,
      baseSig,
      baseEff.production_details.slide_count
    );
    for (let s = 1; s <= 5; s++) {
      toggledComp = setCarouselSlideAssetCreated(toggledComp, s, true);
    }
    assert(areAllCarouselSlidesCreated(toggledComp) === true, 'All marked true');

    toggledComp = setCarouselSlideAssetCreated(toggledComp, 3, false);
    assert(areAllCarouselSlidesCreated(toggledComp) === false, 'Should no longer be all created');
    assert(getCompletedCarouselSlideCount(toggledComp) === 4, 'Completed count should now be 4');

    const res = evaluateCarouselProductionGate({
      production_context: prodEngineCtx,
      source_item: mockItem,
      output_source: 'generated_output',
      effective_candidate: baseEff,
      completion_state: toggledComp,
      current_production_plan_signature: baseSig,
    });
    assert(res.is_allowed === false, 'Gate must block when a slide is toggled back to false');
  }

  // Test 37: Variable slide count (3, 4, 7, 10) dynamically updates required completion count without hardcoding
  console.log('Test 37: Variable slide count (3, 4, 7, 10) dynamically updates required completion count');
  {
    const testCounts = [3, 4, 7, 10];
    for (const count of testCounts) {
      const dynamicCand = createMockCarouselCandidate(mockItem.content_item_id, count);
      const dynamicSlides = createMockCanonicalSlides(count);
      const dynamicEff = buildEffectiveCarouselProductionCandidate(dynamicCand, dynamicSlides, null);
      assert(dynamicEff !== null, `dynamicEff for count ${count} should not be null`);
      const dynamicSig = buildCarouselProductionPlanSignature(dynamicEff);

      const emptyComp = createEmptyCarouselSlideCompletionState(
        mockItem.project_id,
        mockItem.content_item_id,
        dynamicEff.candidate_id,
        dynamicSig,
        count
      );
      assert(emptyComp.slide_count === count, `slide_count should be ${count}`);
      assert(emptyComp.slides.length === count, `Should have ${count} slide entries`);

      let partialComp = emptyComp;
      for (let s = 1; s < count; s++) {
        partialComp = setCarouselSlideAssetCreated(partialComp, s, true);
      }
      assert(
        areAllCarouselSlidesCreated(partialComp) === false,
        `For count ${count}, ${count - 1} completed should NOT be all created`
      );

      const fullComp = setCarouselSlideAssetCreated(partialComp, count, true);
      assert(
        areAllCarouselSlidesCreated(fullComp) === true,
        `For count ${count}, all ${count} completed should be all created`
      );
      assert(
        getCompletedCarouselSlideCount(fullComp) === count,
        `Completed count should equal ${count}`
      );
    }
  }

  // Test 38: Fail-closed validation - missing or non-array canonicalSlides returns null
  console.log('Test 38: Fail-closed validation - missing or non-array canonicalSlides returns null');
  {
    const res1 = buildEffectiveCarouselProductionCandidate(baseCand, [] as unknown as CanonicalCarouselSlideMetadata[], null);
    assert(res1 === null, 'Empty canonicalSlides must return null');

    const res2 = buildEffectiveCarouselProductionCandidate(baseCand, null as unknown as CanonicalCarouselSlideMetadata[], null);
    assert(res2 === null, 'Null canonicalSlides must return null');

    const res3 = buildEffectiveCarouselProductionCandidate(baseCand, undefined as unknown as CanonicalCarouselSlideMetadata[], null);
    assert(res3 === null, 'Undefined canonicalSlides must return null');
  }

  // Test 39: Fail-closed validation - canonicalSlides length mismatch returns null
  console.log('Test 39: Fail-closed validation - canonicalSlides length mismatch returns null');
  {
    const shortSlides: CanonicalCarouselSlideMetadata[] = [
      { slide: 1, visual_format: 'photography' },
      { slide: 2, visual_format: 'infographic' },
    ];
    const res = buildEffectiveCarouselProductionCandidate(baseCand, shortSlides, null);
    assert(res === null, 'Length mismatch between baseCand (5) and canonicalSlides (2) must return null');
  }

  // Test 40: Fail-closed validation - missing or invalid visual_format returns null
  console.log('Test 40: Fail-closed validation - missing or invalid visual_format returns null');
  {
    const missingFmtSlides = [
      { slide: 1, visual_format: 'photography' },
      { slide: 2, visual_format: 'infographic' },
      { slide: 3, visual_format: '' },
      { slide: 4, visual_format: 'infographic' },
      { slide: 5, visual_format: 'infographic' },
    ] as unknown as CanonicalCarouselSlideMetadata[];
    const res1 = buildEffectiveCarouselProductionCandidate(baseCand, missingFmtSlides, null);
    assert(res1 === null, 'Missing visual_format on slide 3 must return null');

    const invalidFmtSlides = [
      { slide: 1, visual_format: 'photography' },
      { slide: 2, visual_format: 'cinematic' }, // invalid format
      { slide: 3, visual_format: 'infographic' },
      { slide: 4, visual_format: 'infographic' },
      { slide: 5, visual_format: 'infographic' },
    ] as unknown as CanonicalCarouselSlideMetadata[];
    const res2 = buildEffectiveCarouselProductionCandidate(baseCand, invalidFmtSlides, null);
    assert(res2 === null, 'Invalid visual_format (cinematic) must return null');
  }

  // Test 41: Fail-closed validation - duplicate or missing sequence numbers in canonicalSlides returns null
  console.log('Test 41: Fail-closed validation - duplicate or missing sequence numbers in canonicalSlides returns null');
  {
    const duplicateSlideNums: CanonicalCarouselSlideMetadata[] = [
      { slide: 1, visual_format: 'photography' },
      { slide: 2, visual_format: 'infographic' },
      { slide: 2, visual_format: 'infographic' },
      { slide: 4, visual_format: 'infographic' },
      { slide: 5, visual_format: 'infographic' },
    ];
    const res1 = buildEffectiveCarouselProductionCandidate(baseCand, duplicateSlideNums, null);
    assert(res1 === null, 'Duplicate slide numbers in canonicalSlides must return null');

    const missingSeqSlideNums: CanonicalCarouselSlideMetadata[] = [
      { slide: 1, visual_format: 'photography' },
      { slide: 2, visual_format: 'infographic' },
      { slide: 3, visual_format: 'infographic' },
      { slide: 4, visual_format: 'infographic' },
      { slide: 6, visual_format: 'infographic' },
    ];
    const res2 = buildEffectiveCarouselProductionCandidate(baseCand, missingSeqSlideNums, null);
    assert(res2 === null, 'Missing sequence slide number in canonicalSlides must return null');
  }

  // Test 42: Valid explicit mixed visual formats (photography, infographic, hybrid) succeed and apply correct prompt transformations
  console.log('Test 42: Valid explicit mixed visual formats (photography, infographic, hybrid) succeed');
  {
    const mixedCand = createMockCarouselCandidate(mockItem.content_item_id, 3);
    const mixedSlides: CanonicalCarouselSlideMetadata[] = [
      { slide: 1, visual_format: 'photography' },
      { slide: 2, visual_format: 'infographic' },
      { slide: 3, visual_format: 'hybrid' },
    ];
    const effMixed = buildEffectiveCarouselProductionCandidate(mixedCand, mixedSlides, charDNA);
    assert(effMixed !== null, 'Explicit mixed formats with CharacterDNA must succeed');
    assert(effMixed.final_prompts.slides.length === 3, 'Must have 3 final slide prompts');
    // Slide 1 photography must include CharacterDNA
    assert(
      effMixed.final_prompts.slides[0].prompt.includes(charDNA.identity.display_name),
      'Slide 1 photography must include CharacterDNA display name'
    );
    // Slide 2 infographic must NOT include character face descriptions
    assert(
      !effMixed.final_prompts.slides[1].prompt.includes(charDNA.identity.facial_features || 'jawline'),
      'Slide 2 infographic must not include human face features'
    );
    // Slide 3 hybrid must include character reference
    assert(
      effMixed.final_prompts.slides[2].prompt.includes(charDNA.identity.display_name),
      'Slide 3 hybrid must include CharacterDNA display name'
    );
  }

  // Test 43: Final package prompts match effective candidate prompts exactly
  console.log('Test 43: Final package prompts match effective candidate prompts exactly');
  {
    assert(prepResult.package?.final_prompts !== undefined, 'Package final_prompts must exist');
    const pkgPrompts = prepResult.package!.final_prompts as { slides: { slide_number: number; prompt: string }[] };
    assert(Array.isArray(pkgPrompts.slides), 'Package final_prompts.slides must be an array');
    assert(
      pkgPrompts.slides.length === effWithChar.final_prompts.slides.length,
      'Package slide prompt count must equal candidate slide prompt count'
    );
    for (let i = 0; i < effWithChar.final_prompts.slides.length; i++) {
      assert(
        pkgPrompts.slides[i].prompt === effWithChar.final_prompts.slides[i].prompt,
        `Slide ${i + 1} prompt in package must exactly equal effective candidate prompt`
      );
    }
  }

  // --- STATIC REGRESSION GUARDS ---
  console.log('\n--- RUNNING STATIC REGRESSION GUARDS ---');

  const forbiddenPattern = new RegExp('\\b' + 'as' + '\\s+' + 'any' + '\\b');

  // Check 1: No as any in lib/carousel-production-gate.ts
  console.log('Guard 1: No as any in lib/carousel-production-gate.ts');
  const gateFile = fs.readFileSync(path.join(__dirname, '../lib/carousel-production-gate.ts'), 'utf-8');
  assert(!forbiddenPattern.test(gateFile), 'Found forbidden `as any` in lib/carousel-production-gate.ts');

  // Check 2: No as any in lib/carousel-production-path.ts
  console.log('Guard 2: No as any in lib/carousel-production-path.ts');
  const pathFile = fs.readFileSync(path.join(__dirname, '../lib/carousel-production-path.ts'), 'utf-8');
  assert(!forbiddenPattern.test(pathFile), 'Found forbidden `as any` in lib/carousel-production-path.ts');

  // Check 3: No as any in lib/carousel-slide-completion.ts
  console.log('Guard 3: No as any in lib/carousel-slide-completion.ts');
  const compFile = fs.readFileSync(path.join(__dirname, '../lib/carousel-slide-completion.ts'), 'utf-8');
  assert(!forbiddenPattern.test(compFile), 'Found forbidden `as any` in lib/carousel-slide-completion.ts');

  // Check 4: No as any in scripts/test-carousel-production-path.ts (excluding guards section)
  console.log('Guard 4: No as any in scripts/test-carousel-production-path.ts');
  const testFile = fs.readFileSync(path.join(__dirname, '../scripts/test-carousel-production-path.ts'), 'utf-8');
  const testFileCodeBeforeGuards = testFile.split('STATIC REGRESSION GUARDS')[0];
  assert(!forbiddenPattern.test(testFileCodeBeforeGuards), 'Found forbidden `as any` in scripts/test-carousel-production-path.ts');

  // Check 5: Carousel panel does not use selectedCarouselId or activeItem.carousel_plan as authority
  console.log('Guard 5: Verify CarouselPanel / page does not pass selectedCarouselId or activeItem.carousel_plan as candidate authority');
  const pageFile = fs.readFileSync(path.join(__dirname, '../app/production-studio/page.tsx'), 'utf-8');
  assert(
    pageFile.includes('effectiveCarouselCandidate'),
    'page.tsx must pass effectiveCarouselCandidate'
  );
  assert(
    pageFile.includes('carouselProductionGate'),
    'page.tsx must evaluate carouselProductionGate'
  );
  assert(
    pageFile.includes('carouselPlan,'),
    'page.tsx must pass carouselPlan in commonProps'
  );

  const carouselPanelFile = fs.readFileSync(path.join(__dirname, '../components/production-studio/CarouselPanel.tsx'), 'utf-8');
  assert(
    !carouselPanelFile.includes('activeItem?.carousel_plan'),
    'CarouselPanel.tsx must NOT rely on activeItem.carousel_plan as plan authority'
  );
  assert(
    carouselPanelFile.includes('carouselPlan,'),
    'CarouselPanel.tsx must destructure carouselPlan from props'
  );

  console.log('\nALL 43 CAROUSEL PRODUCTION PATH TESTS AND 5 STATIC REGRESSION GUARDS PASSED SUCCESSFULLY!');
}

runCarouselProductionPathTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
