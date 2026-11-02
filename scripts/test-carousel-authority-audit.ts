import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as authority from '../lib/carousel-authority';
import * as candidates from '../lib/production-candidate';
import * as funnel from '../lib/funnel-rules';
import { ANTI_DRIFT_RULES } from '../lib/production-context';
import { evaluateCarouselProductionGate } from '../lib/carousel-production-gate';
import { buildProductionEngineContext } from '../lib/production-engine-context';
import { buildFunnelStrategyFromContext } from '../lib/funnel-strategy';
import { buildCarouselProductionPlanSignature } from '../lib/carousel-production-path';
import { buildExecutionPromptAuthority } from '../lib/execution-prompt-authority';
import { createEmptyCarouselSlideCompletionState, setCarouselSlideAssetCreated } from '../lib/carousel-slide-completion';
import { translateCarouselProductionPrompts } from '../lib/prompt-translation';
import type { ContentItem, SharedContentContext } from '../lib/content-contract';

const pagePath = 'app/production-studio/page.tsx';
const page = fs.readFileSync(pagePath, 'utf8');
const names = ['tryParseJSON', 'getBrandVisualRulesBlock', 'extractCarouselPromptLine', 'sanitizeAndGenerateSlideImagePrompt', 'validateAndNormalizeCarouselPlan', 'validateCarouselStage1ContentPlan', 'validateCarouselStage2VisualPlan', 'mergeCarouselPlanStages', 'buildCarouselStage1Prompt', 'buildCarouselStage2Prompt', 'getInitialDraft'];
const ast = ts.createSourceFile(pagePath, page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const source = ast.statements.filter(statement => ts.isFunctionDeclaration(statement) ? names.includes(statement.name?.text || '')
  : ts.isVariableStatement(statement) && statement.declarationList.declarations.some(declaration => names.includes(declaration.name.getText(ast))))
  .map(statement => statement.getText(ast)).join('\n');
const deps = { ...authority, ...candidates, ...funnel, ANTI_DRIFT_RULES };
const helpers = new Function(...Object.keys(deps), ts.transpile(source, { target: ts.ScriptTarget.ES2020 }) + `;return {${names.join(',')}};`)(...Object.values(deps));

const item = {
  project_id: 'project-documents', content_item_id: 'calendar-17', no: 17, jenis: 'MOFU',
  headline: 'Dokumen pembelajaran masih tercecer?', body: 'Guru kesulitan menemukan dokumen pembelajaran di banyak folder.',
  tujuan: 'Memahami penataan dokumen pembelajaran', cta: 'Simpan panduan penataan dokumen ini.',
  caption: 'Panduan menata dokumen pembelajaran guru agar mudah ditemukan.',
  visual: 'Folder dokumen pembelajaran', format: 'Carousel', hookType: 'Question', referensi: '',
} as ContentItem;
const context = {
  project_id: 'project-documents', project_name: 'Administrasi Guru',
  source: { origin: 'manual_context' },
  system_flags: { is_complete_for_planning: true, missing_required_fields: [] },
  brand_context: { brand_name: 'ALCO Administrasi', category: 'Pendidikan', brand_summary: 'Penataan dokumen guru', brand_voice: 'Edukatif' },
  audience_context: { primary_audience: 'Guru', pain_points: [item.body], desires: ['Dokumen mudah ditemukan'], objections: [] },
  strategy_context: { positioning: 'Penataan dokumen guru', usp: [], main_offer: 'Panduan pengelolaan dokumen', offer_benefits: [], core_message: 'Susun folder berdasarkan kebutuhan pembelajaran', copy_direction: [], content_pillars: ['Administrasi guru'] },
} as SharedContentContext;
const sourceBinding = authority.buildCarouselSourceBinding(item, context);
assert.ok(sourceBinding);
const roles = ['hook', 'problem', 'reframe', 'learn', 'cta'];
const headlines = [item.headline, 'Dokumen sulit ditemukan', 'Mulai dari kebutuhan pembelajaran', 'Susun folder berdasarkan kebutuhan', item.cta!];
const stage1 = {
  source_binding: sourceBinding, content_goal: item.tujuan, funnel_stage: 'MOFU', current_belief: item.body,
  desired_belief: 'Dokumen dapat ditata berdasarkan kebutuhan pembelajaran', core_promise: 'Panduan pengelolaan dokumen',
  primary_cta_type: 'engagement_save', primary_cta_text: item.cta, slide_count: 5,
  belief_journey_summary: 'Dari dokumen tercecer menuju penataan berdasarkan kebutuhan pembelajaran.', captionForPost: item.caption,
  messageAlignmentCheck: { isAligned: true },
  slides: roles.map((role, index) => ({ slide: index + 1, role, communication_job: role,
    headline: headlines[index], body: index === 4 ? item.cta : index < 2 ? item.body : context.strategy_context.core_message,
    swipe_bridge: 'Lanjut ke slide berikutnya', emotional_state: 'Memahami', core_message: headlines[index], audience_emotion: 'Memahami',
  })),
};
const validate1 = (value: unknown, source = item, ctx = context) => helpers.validateCarouselStage1ContentPlan(value, 'MOFU', source, ctx);
const valid1 = validate1(stage1);
assert.ok(valid1);
assert.equal(valid1.messageAlignmentCheck.isAligned, false, 'model self-alignment is never proof');
const stage2 = {
  source_binding: sourceBinding, narrative_signature: authority.carouselNarrativeSignature(valid1), visual_system_notes: 'Consistent cream and teal editorial style.',
  slides: roles.map((_, index) => ({ slide: index + 1, visual_format: 'infographic', visual_intent: headlines[index],
    visual_type: 'information-card', text_zone: 'Upper third', negative_space_plan: '40 percent empty space',
    visual_production: { subject: 'Folder dokumen pembelajaran', action: 'Penataan kartu folder', composition: 'Structured grid', layout: '4:5 vertical',
      visual_metaphor: 'Penataan folder', typography: 'Bold readable headline', background: 'Cream canvas', color_mood: 'Teal and cream', negative_space: '40 percent', negative_prompt: 'photography, unreadable text, clutter' },
    production_prompt: '4:5 vertical grid of document folders with large headline.',
    slide_image_prompt: `Visual Objective: ${headlines[index]}\nSubject/Object: Folder dokumen pembelajaran\nAction/Scene: Penataan kartu folder\nExpression/Emotion: Clear and calm\nEnvironment: Neutral cream canvas\nComposition: Structured grid\nLighting: Flat light\nCamera/Graphic Style: Vector design\nVisual Style: Teal and cream\nTypography: Large headline\nText Overlay: '${headlines[index]}'\nNegative Prompt: photography, unreadable text, clutter`,
  })),
};
const merge = (a = valid1, b: unknown = stage2, source = item, ctx = context) => helpers.mergeCarouselPlanStages(a, b, source, ctx, 'MOFU');
const normalize = (value: unknown, source = item, ctx = context) => helpers.validateAndNormalizeCarouselPlan(JSON.stringify(value), source, ctx, true);
const mergedText = merge();
assert.ok(mergedText, 'valid two-stage plan merges');
const merged = JSON.parse(mergedText);
assert.equal(merged.messageAlignmentCheck.isAligned, false);
assert.equal(merged.productionCandidate, undefined, 'unreviewed visual and narrative have no production authority');
assert.equal(merged.slides[0].headline, item.headline);
assert.equal(merged.slides[0].creative_strategy.text_overlay, item.headline);

const reviewed = { ...merged, review_stamp: authority.createCarouselReviewStamp(merged) };
const approved = JSON.parse(normalize(reviewed));
assert.ok(approved.productionCandidate, 'explicit review unlocks a canonical candidate');
assert.equal(approved.messageAlignmentCheck.isAligned, true);
assert.equal(normalize(approved), JSON.stringify(approved, null, 2), 'normalization and review signatures are idempotent');
assert.equal(authority.isCarouselReviewCurrent(approved, { character_id: 'different-character' }), false, 'changing character invalidates visual review');
const translated = translateCarouselProductionPrompts({ candidate: approved.productionCandidate, slides: approved.slides.map((s: any) => ({ slide_number: s.slide, visual_format: s.visual_format })) });
assert.ok(translated.ok);
if (translated.ok && translated.bundle.asset_type === 'carousel') {
  translated.bundle.slides.forEach((slide, index) => assert.ok(slide.execution_prompt.includes(`Text Overlay: '${headlines[index]}'`)));
}

// Creative drift cannot be certified automatically, even if all keywords or a source token match.
for (let index = 0; index < 5; index++) {
  const drifted = structuredClone(stage1);
  drifted.slides[index].headline = ['Views video meningkat', 'Masalah omzet penjualan', 'Konten viral adalah jawabannya', 'Dashboard otomatis menghasilkan 100 persen keuntungan', 'Follow tips pembuatan konten'][index];
  const result = validate1(drifted);
  assert.ok(result, 'creative copy remains available for review, not silently rewritten');
  assert.equal(result.messageAlignmentCheck.isAligned, false);
  assert.equal(merge(result), null, 'visuals from a different narrative cannot merge');
  const matchingVisuals = structuredClone(stage2);
  matchingVisuals.narrative_signature = authority.carouselNarrativeSignature(result);
  matchingVisuals.slides[index].slide_image_prompt = matchingVisuals.slides[index].slide_image_prompt.replace(`Text Overlay: '${headlines[index]}'`, `Text Overlay: '${drifted.slides[index].headline}'`);
  const pending = JSON.parse(merge(result, matchingVisuals));
  assert.equal(pending.messageAlignmentCheck.isAligned, false);
  assert.equal(pending.productionCandidate, undefined, 'even mutually consistent drift is not accepted for production');
}
for (const mutate of [
  (value: any) => { value.slides[1].headline = 'Foreign headline'; },
  (value: any) => { value.slides[2].body = 'Foreign body'; },
  (value: any) => { value.slides[3].creative_strategy = { core_message: 'New product feature' }; },
  (value: any) => { value.slides[4].slide_image_prompt = value.slides[4].slide_image_prompt.replace(`Text Overlay: '${headlines[4]}'`, 'Text Overlay: Foreign CTA'); },
  (value: any) => { value.slides[0].visual_production.subject = 'Synthetic analytics dashboard'; },
  (value: any) => { value.narrative_signature = 'another-stage1'; },
  (value: any) => { value.source_binding.project_id = 'other-project'; },
]) {
  const changed = structuredClone(stage2); mutate(changed);
  assert.equal(merge(valid1, changed), null, 'rewrites, mismatched overlays, visual fields and lineage fail closed');
}
for (const field of ['headline', 'body', 'tujuan', 'cta', 'caption', 'visual', 'jenis', 'format']) {
  const changedItem = { ...item, [field]: 'Changed calendar source' };
  assert.equal(normalize(approved, changedItem), null, `${field} changes invalidate same-ID output`);
}
assert.equal(normalize(approved, item, { ...context, strategy_context: { ...context.strategy_context, main_offer: 'A different offer' } }), null);
assert.equal(validate1(stage1, { ...item, project_id: 'other-project' }), null);
const legacy = structuredClone(approved); delete legacy.source_binding;
assert.equal(normalize(legacy), null, 'legacy records are not promoted without lineage');
const changed = structuredClone(approved); changed.slides[3].body = 'Unsupported feature';
const changedPlan = JSON.parse(normalize(changed));
assert.equal(changedPlan.messageAlignmentCheck.isAligned, false);
assert.equal(changedPlan.productionCandidate, undefined, 'editing copy invalidates review');
const changedVisual = structuredClone(approved); changedVisual.slides[2].visual_production.background = 'Fictitious dashboard';
assert.equal(JSON.parse(normalize(changedVisual)).productionCandidate, undefined, 'editing visuals invalidates review');
const thin = { ...item, body: '', cta: '', caption: '' };
assert.notEqual(authority.buildCarouselSourceBinding(thin, context)?.source_signature, sourceBinding.source_signature);
assert.equal(helpers.validateAndNormalizeCarouselPlan('{malformed', item, context), null);
for (const value of [null, {}, [], { slides: [] }, { slides: [null] }, { ...approved, slides: [undefined] }]) assert.equal(normalize(value), null);
for (const value of [null, undefined, 123, {}, []]) {
  const invalid = structuredClone(approved); invalid.slides[0].headline = value;
  assert.equal(normalize(invalid), null);
}

// Real React server render with the actual panel and its dependencies.
const panelPath = path.resolve('components/production-studio/CarouselPanel.tsx');
const localRequire = createRequire(panelPath);
function loadPanel(sourceText: string) {
  const panelModule = { exports: {} as any };
  const customRequire = (id: string) => localRequire(id.startsWith('@/') ? path.resolve(id.slice(2)) : id);
  new Function('require', 'module', 'exports', ts.transpile(sourceText, { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true }))(customRequire, panelModule, panelModule.exports);
  return panelModule.exports.default;
}
const panelText = fs.readFileSync(panelPath, 'utf8');
const Panel = loadPanel(panelText);
const props = { activeItem: item, activeContext: context, activeSlideNumber: 1, copiedStates: {}, carouselOutput: 'Carousel perlu ditinjau.', savedCharacters: [] };
for (const invalid of [null, {}, { slides: [] }, { slides: [null] }, { slides: [{ slide: 1, visual_production: {} }] }]) {
  assert.doesNotThrow(() => renderToStaticMarkup(React.createElement(Panel, { ...props, carouselPlan: invalid })));
}
assert.doesNotThrow(() => renderToStaticMarkup(React.createElement(Panel, { ...props, carouselPlan: merged })));
assert.doesNotThrow(() => renderToStaticMarkup(React.createElement(Panel, { ...props, carouselPlan: approved })));
const BaselinePanel = loadPanel(execFileSync('git', ['show', '0bbf845:components/production-studio/CarouselPanel.tsx'], { encoding: 'utf8' }));
assert.throws(() => renderToStaticMarkup(React.createElement(BaselinePanel, { ...props, carouselPlan: { slides: [null] } })), /slide/);
console.log('Historical 0bbf845 render crash reproduced: null legacy slide reaches CarouselPanel; a1af2fa panel renders an error state. Original minified includes stack is not mapped by this fixture.');
assert.match(helpers.getInitialDraft('carousel', { ...item, headline: null }, context), /tidak valid/);
assert.equal(helpers.getInitialDraft('carousel', item, context).includes('"isAligned": true'), false);
assert.match(helpers.getInitialDraft('carousel', { ...item, carousel_plan: { slides: [null] } }, context), /tidak lolos/);
assert.ok(!page.includes('const parsed = tryParseJSON(carouselOutput);'), 'raw stored plan fallback removed');
const originalData = JSON.stringify({ item, context, stage1, stage2 });
merge(); normalize(approved);
assert.equal(JSON.stringify({ item, context, stage1, stage2 }), originalData, 'validation never writes source data');
const blocked = evaluateCarouselProductionGate({ production_context: null, source_item: item, output_source: 'stored_output', effective_candidate: approved.productionCandidate, completion_state: null, current_production_plan_signature: 'old', current_execution_authority: null });
assert.ok(blocked.blockers.some(reason => reason.includes('belum ditinjau')));
const engine = buildProductionEngineContext(context.project_id, context, buildFunnelStrategyFromContext(context), item);
assert.ok(engine.isValid, engine.error);
assert.ok(translated.ok);
if (translated.ok) {
  const execution = buildExecutionPromptAuthority(translated.bundle);
  assert.ok(execution.ok);
  if (execution.ok) {
    const signature = buildCarouselProductionPlanSignature(approved.productionCandidate);
    let completion = createEmptyCarouselSlideCompletionState(context.project_id, item.content_item_id!, 'carousel_plan', signature, 5, execution.authority.execution_signature);
    for (let slide = 1; slide <= 5; slide++) completion = setCarouselSlideAssetCreated(completion, slide, true);
    const params = { production_context: engine.context!, source_item: item, output_source: 'generated_output' as const, effective_candidate: approved.productionCandidate,
      completion_state: completion, current_production_plan_signature: signature, current_execution_authority: execution.authority };
    assert.equal(evaluateCarouselProductionGate(params).is_allowed, false, 'otherwise ready production still requires semantic review');
    const content_review = { source_signature: sourceBinding.source_signature, candidate_signature: signature, reviewed: true };
    assert.equal(evaluateCarouselProductionGate({ ...params, content_review }).is_allowed, true);
    assert.equal(evaluateCarouselProductionGate({ ...params, content_review: { ...content_review, reviewed: false } }).is_allowed, false);
    assert.equal(evaluateCarouselProductionGate({ ...params, content_review: { ...content_review, source_signature: 'stale-source' } }).is_allowed, false);
    assert.equal(evaluateCarouselProductionGate({ ...params, content_review: { ...content_review, candidate_signature: 'stale-candidate' } }).is_allowed, false);
  }
}
console.log('PASS: malformed and legacy render, strict types, narrative review, five drift cases, stage linkage, visual mirroring, stale sources, immutable data, translation and gate.');
