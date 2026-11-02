import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import * as brief from '../lib/video-narrative-brief';
import * as candidates from '../lib/production-candidate';
import { normalizeFunnelStage, getFunnelRules } from '../lib/funnel-rules';
import { translateSingleVideoScenePrompt, translateVideoProductionPrompts } from '../lib/prompt-translation';
import { ContentItem, CharacterDNA } from '../lib/content-contract';
import { validateVideoSceneSpeech } from '../lib/video-scene-contract';

// Execute the actual page normalizer without mounting Next/React or calling Gemini.
const page = fs.readFileSync('app/production-studio/page.tsx', 'utf8');
const source = page.slice(page.indexOf('function isValidVideoCaption('), page.indexOf('// Pure top-level function for building high-converting initial drafts'));
const dependencies = { ...brief, ...candidates, normalizeFunnelStage, getFunnelRules, tryParseJSON: JSON.parse };
const normalize = new Function(...Object.keys(dependencies), ts.transpile(source, { target: ts.ScriptTarget.ES2020 }) + '; return validateAndNormalizeVideoStyles;')(...Object.values(dependencies));
const item = {
  headline: 'Dokumen administrasi guru masih tercecer?',
  body: 'Dokumen pembelajaran tersimpan di banyak folder sehingga guru sulit menemukan dokumen yang dibutuhkan.',
  solusi: 'Susun dokumen administrasi dalam folder yang terstruktur.',
  cta: 'Simpan panduan pengelolaan dokumen ini.',
  caption: 'Panduan menata dokumen administrasi guru.',
  jenis: 'TOFU', tujuan: 'Edukasi administrasi guru',
} as ContentItem;
const narrative = brief.buildVideoNarrativeBrief(item);
const modes = ['human_led', 'product_demo', 'motion_explainer'] as const;
const styles = modes.map(productionMode => ({
  productionMode, script: { ...narrative.script }, captionForPost: narrative.caption,
  spokenScript: brief.buildSourceVideoSpokenScript(narrative),
  videoPrompt: 'Vertical camera framing with clean natural lighting and steady motion.',
  negative_constraints: 'No visual artifacts or unreadable text.',
}));
const snapshot = JSON.stringify(styles);
const accepted = normalize(snapshot, item, null);
assert.ok(accepted, 'calendar-grounded modes must pass actual normalizer');
for (const style of JSON.parse(accepted)) {
  const scenes = style.productionCandidate.production_details.scenes;
  assert.equal(scenes[0].voiceover, item.headline);
  assert.equal(scenes[1].voiceover, item.solusi, 'Scene 2 uses one authored insight, not raw concatenation');
  assert.equal(scenes[2].voiceover, item.cta);
  assert.equal(style.productionCandidate.production_details.duration_seconds, 24);
  assert.ok(style.productionCandidate.production_details.format.includes('9:16'));
  for (const scene of scenes) {
    assert.equal(scene.duration_seconds, 8);
    {
      const result = translateSingleVideoScenePrompt({ scene, productionMode: style.productionMode,
        characterDNA: { prompt_assets: { dna_summary_prompt: 'Project creator with consistent appearance' } } as CharacterDNA,
        productAssetContext: { product_name: 'Administrasi Guru', product_type: 'Document tool', screenshots: [{ id: 'doc-screen', name: 'Document folder', kind: 'screenshot' }], feature_focus: [], demo_steps: [] },
      });
      assert.ok(result.isValid);
      assert.equal(result.instructions?.voiceover, scene.voiceover);
      assert.ok(result.instructions?.motionPrompt.includes(`Duration: ${scene.duration_seconds}s`));
      assert.ok(result.instructions?.motionPrompt.includes('9:16'));
    }
  }
}
// Concise paraphrases are valid drafts, never blindly rejected or automatically approved.
for (const spokenScript of [
  { hook: 'Masih sulit mencari dokumen guru?', insight: 'Rapikan folder agar dokumen pembelajaran lebih mudah ditemukan.', cta: 'Simpan panduan penataan dokumen ini.' },
  { hook: 'Views konten kamu masih sepi?', insight: 'Guru kesulitan menemukan dokumen pembelajaran.', cta: 'Follow untuk tips pembuatan konten!' },
  { hook: 'Dokumen masih tercecer?', insight: 'Dashboard otomatis menghasilkan keuntungan seratus persen.', cta: 'Simpan panduan ini.' },
]) {
  const pending = normalize(JSON.stringify(styles.map(style => ({ ...style, spokenScript }))), item, null);
  assert.ok(pending, 'unproven dialogue remains available for review');
  for (const style of JSON.parse(pending)) {
    assert.equal(style.narrativeReview.required, true);
    assert.deepEqual(style.spokenScript, spokenScript, 'no silent rewriting or clipping');
    assert.equal(style.productionCandidate, undefined, 'unproven dialogue never receives production authority');
  }
}
const longSpeech = Array(19).fill('dokumen').join(' ');
const tooLong = styles.map(style => ({ ...style, spokenScript: { ...brief.buildSourceVideoSpokenScript(narrative), insight: longSpeech } }));
const errors: string[] = [];
assert.equal(normalize(JSON.stringify(tooLong), item, null, true, errors), null);
assert.match(errors[0], /18 kata/);
assert.equal(tooLong[0].spokenScript.insight, longSpeech);
assert.equal(validateVideoSceneSpeech({ duration_seconds: 8, voiceover: Array(18).fill('kata').join(' ') }), null);
assert.ok(validateVideoSceneSpeech({ duration_seconds: 9, voiceover: 'Singkat' }));
const inconsistent = styles.map(style => ({ ...style, spokenScript: brief.buildSourceVideoSpokenScript(narrative) }));
inconsistent[1].spokenScript.insight = 'Insight yang berbeda';
assert.equal(normalize(JSON.stringify(inconsistent), item, null), null, 'modes share one spoken script');
const legacyCandidate = JSON.parse(accepted)[0].productionCandidate;
legacyCandidate.production_details.scenes[0].duration_seconds = 5;
assert.equal(candidates.validateProductionCandidate(legacyCandidate).isValid, false);
assert.equal(translateVideoProductionPrompts({ candidate: legacyCandidate }).ok, false);
assert.equal(translateSingleVideoScenePrompt({ scene: legacyCandidate.production_details.scenes[0], productionMode: 'motion_explainer' }).isValid, false);
const wrongFormat = JSON.parse(accepted)[0].productionCandidate;
wrongFormat.production_details.format = '16:9';
assert.equal(candidates.validateProductionCandidate(wrongFormat).isValid, false);
const longScenes = JSON.parse(accepted)[0].productionCandidate.production_details.scenes;
longScenes[1].voiceover = longSpeech;
assert.throws(() => brief.fitVideoVoiceoverDuration(longScenes), /18 kata/);
assert.equal(longScenes[1].voiceover, longSpeech, 'fit never truncates source speech');
const modelSelfReview = styles.map(style => ({ ...style,
  spokenScript: { hook: 'Views masih sepi?', insight: 'Guru sulit menemukan dokumen.', cta: 'Follow tips konten.' },
  narrativeReview: { required: false },
}));
for (const style of JSON.parse(normalize(JSON.stringify(modelSelfReview), item, null))) {
  assert.equal(style.narrativeReview.required, true);
  assert.equal(style.productionCandidate, undefined, 'model cannot self-approve a paraphrase');
}
for (const index of [0, 1, 2]) {
  const drifted = JSON.parse(snapshot);
  drifted[index].script.hook = 'Views konten kamu masih sepi?';
  drifted[index].script.cta = 'Follow untuk tips pembuatan konten!';
  assert.equal(normalize(JSON.stringify(drifted), item, null), null, 'real mixed-topic case must fail in each mode');
  assert.equal(normalize(JSON.stringify(drifted), item, null, false), null, 'draft mode must also reject drift');
}
for (const field of ['hook', 'masalah', 'solusi', 'proof', 'cta']) {
  const drifted = JSON.parse(snapshot);
  drifted[0].script[field] = 'Topik asing yang tidak ada di kalender';
  assert.equal(normalize(JSON.stringify(drifted), item, null), null);
}
const stale = JSON.parse(snapshot);
stale[0].captionForPost = 'Tips meningkatkan views konten';
assert.equal(normalize(JSON.stringify(stale), item, null), null);
assert.equal(normalize(snapshot, { ...item, headline: 'Item kalender lain' }, null), null);
const sparseItem = { ...item, solusi: undefined, cta: undefined, caption: '' };
const sparseBrief = brief.buildVideoNarrativeBrief(sparseItem);
const sparseStyles = styles.map(style => ({ ...style, script: sparseBrief.script, spokenScript: brief.buildSourceVideoSpokenScript(sparseBrief), captionForPost: '' }));
assert.ok(normalize(JSON.stringify(sparseStyles), sparseItem, null), 'missing optional sources stay empty without fabricated copy');
assert.equal(JSON.stringify(styles), snapshot, 'source records must remain intact');
const legacyStyles = styles.map(({ spokenScript, ...style }) => style);
const legacySnapshot = JSON.stringify(legacyStyles);
assert.equal(normalize(legacySnapshot, item, null), null, 'legacy scripts are not silently promoted or retimed');
assert.equal(JSON.stringify(legacyStyles), legacySnapshot);
assert.ok(!page.includes('attachCandidate) || videoOutput;'), 'rejected legacy output must not fall back to raw candidates');
console.log('Video narrative brief: normalizer, all modes, mixed topics, stale output, duration and translation passed.');
