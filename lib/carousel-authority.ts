import type { ContentItem, SharedContentContext } from './content-contract';

type Data = Record<string, any>;
const object = (value: unknown): value is Data => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string';
const fields = (value: Data, keys: string[]) => keys.every(key => text(value[key]));

/** Freshness fingerprint, not a security signature or proof of semantic alignment. */
export function carouselFingerprint(value: unknown): string {
  const stable = (entry: unknown): unknown => Array.isArray(entry) ? entry.map(stable)
    : object(entry) ? Object.fromEntries(Object.keys(entry).sort().map(key => [key, stable(entry[key])])) : entry;
  const serialized = JSON.stringify(stable(value)) ?? 'null';
  let hash = 2166136261;
  for (let i = 0; i < serialized.length; i++) hash = Math.imul(hash ^ serialized.charCodeAt(i), 16777619);
  return `carousel_v1_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function buildCarouselSourceBinding(item: ContentItem | null | undefined, context: SharedContentContext | null | undefined) {
  if (!item || !context || !text(context.project_id) || !context.project_id.trim() || !text(item.content_item_id) || !item.content_item_id.trim()) return null;
  const projectId = item.project_id || item.projectId;
  if (projectId !== context.project_id || (item.project_id && item.projectId && item.project_id !== item.projectId)) return null;
  const keys = ['no', 'headline', 'body', 'tujuan', 'jenis', 'hookType', 'cta', 'caption', 'visual', 'referensi', 'format', 'channel', 'solusi', 'solution', 'proof', 'proof_data'];
  return {
    project_id: context.project_id,
    content_item_id: item.content_item_id,
    source_signature: carouselFingerprint({
      item: Object.fromEntries(keys.map(key => [key, (item as unknown as Data)[key] ?? null])),
      brand: context.brand_context, audience: context.audience_context, strategy: context.strategy_context,
      visual: context.brand_visual_context ?? null,
    }),
  };
}

export function matchesCarouselSourceBinding(binding: unknown, item: ContentItem, context: SharedContentContext): boolean {
  const expected = buildCarouselSourceBinding(item, context);
  return !!expected && object(binding) && Object.entries(expected).every(([key, value]) => binding[key] === value);
}

const narrativeKeys = ['content_goal', 'funnel_stage', 'current_belief', 'desired_belief', 'core_promise', 'primary_cta_type', 'primary_cta_text', 'belief_journey_summary', 'captionForPost'];
const slideKeys = ['slide', 'role', 'communication_job', 'headline', 'body', 'swipe_bridge', 'emotional_state', 'core_message', 'audience_emotion'];
export function carouselNarrativeSignature(plan: Data): string {
  return carouselFingerprint({
    ...Object.fromEntries(narrativeKeys.map(key => [key, plan[key] ?? ''])),
    slides: plan.slides.map((slide: Data) => Object.fromEntries(slideKeys.map(key => [key,
      slide[key] ?? slide.creative_strategy?.[key] ?? '',
    ]))),
  });
}

export function carouselVisualSignature(plan: Data): string {
  return carouselFingerprint({ visual_system_notes: plan.visual_system_notes, slides: plan.slides.map((slide: Data) => ({
    slide: slide.slide, visual_format: slide.visual_format, visual_intent: slide.visual_intent, visual_type: slide.visual_type,
    text_zone: slide.text_zone, negative_space_plan: slide.negative_space_plan, creative_strategy: slide.creative_strategy,
    visual_production: slide.visual_production, production_prompt: slide.production_prompt, slide_image_prompt: slide.slide_image_prompt,
  })) });
}

/** User review is explicit and bound to exact sources and copy/visuals. Models cannot self-approve. */
export function createCarouselReviewStamp(plan: Data, character: unknown = null) {
  return {
    source_signature: plan.source_binding?.source_signature,
    narrative_signature: carouselNarrativeSignature(plan),
    visual_signature: carouselVisualSignature(plan),
    character_signature: carouselFingerprint(character),
    reviewer: 'user' as const,
  };
}

export function isCarouselReviewCurrent(plan: Data, character: unknown = null): boolean {
  return object(plan.review_stamp) && plan.review_stamp.reviewer === 'user'
    && object(plan.source_binding) && text(plan.source_binding.source_signature)
    && Object.entries(createCarouselReviewStamp(plan, character)).every(([key, value]) => plan.review_stamp[key] === value);
}

/** Reject invalid field types before any string helper/render can see them. No string coercion. */
export function hasCarouselNarrativeShape(plan: unknown): plan is Data {
  return object(plan) && fields(plan, narrativeKeys) && plan.slide_count === 5 && Array.isArray(plan.slides) && plan.slides.length === 5
    && plan.slides.every((slide: unknown, index: number) => object(slide) && slide.slide === index + 1
      && slide.role === ['hook', 'problem', 'reframe', 'learn', 'cta'][index]
      && fields(slide, slideKeys.filter(key => key !== 'slide')));
}

export function hasCarouselVisualShape(plan: unknown): plan is Data {
  return object(plan) && text(plan.visual_system_notes) && Array.isArray(plan.slides) && plan.slides.length === 5
    && plan.slides.every((slide: unknown) => object(slide)
      && fields(slide, ['visual_format', 'visual_intent', 'visual_type', 'text_zone', 'negative_space_plan', 'production_prompt', 'slide_image_prompt'])
      && object(slide.visual_production) && fields(slide.visual_production, ['subject', 'action', 'composition', 'layout', 'visual_metaphor', 'typography', 'background', 'color_mood', 'negative_space', 'negative_prompt'])
      && (!slide.creative_strategy || (object(slide.creative_strategy) && Object.values(slide.creative_strategy).every(text))));
}

export function isRenderableCarouselPlan(plan: unknown): boolean {
  return hasCarouselNarrativeShape(plan) && hasCarouselVisualShape(plan);
}

/** Structural linkage only. Creative relevance still requires user review, never a keyword score. */
export function isCarouselStage2Bound(stage1: Data, stage2: Data): boolean {
  if (stage2.narrative_signature !== carouselNarrativeSignature(stage1)
    || carouselFingerprint(stage2.source_binding ?? null) !== carouselFingerprint(stage1.source_binding ?? null)) return false;
  if (narrativeKeys.some(key => key in stage2)) return false;
  return stage2.slides.every((slide: Data) => {
    const original = stage1.slides.find((s: Data) => s.slide === slide.slide);
    if (!original || slideKeys.some(key => key !== 'slide' && key in slide && slide[key] !== original[key])) return false;
    const strategy = slide.creative_strategy;
    if (strategy && ((strategy.text_overlay !== undefined && strategy.text_overlay !== original.headline)
      || (strategy.core_message !== undefined && strategy.core_message !== original.core_message))) return false;
    const line = (label: string) => slide.slide_image_prompt.split(/\r?\n/u).find((entry: string) => entry.startsWith(`${label}:`))?.slice(label.length + 1).trim();
    const overlay = line('Text Overlay');
    return line('Subject/Object') === slide.visual_production.subject.trim()
      && line('Action/Scene') === slide.visual_production.action.trim()
      && (overlay === original.headline || overlay === `'${original.headline}'` || overlay === `"${original.headline}"`);
  });
}
