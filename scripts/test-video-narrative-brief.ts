import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import * as brief from '../lib/video-narrative-brief';
import * as candidates from '../lib/production-candidate';
import { normalizeFunnelStage, getFunnelRules } from '../lib/funnel-rules';
import { translateSingleVideoScenePrompt } from '../lib/prompt-translation';
import { ContentItem } from '../lib/content-contract';

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
  videoPrompt: 'Vertical camera framing with clean natural lighting and steady motion.',
  negative_constraints: 'No visual artifacts or unreadable text.',
}));
const snapshot = JSON.stringify(styles);
const accepted = normalize(snapshot, item, null);
assert.ok(accepted, 'calendar-grounded modes must pass actual normalizer');
for (const style of JSON.parse(accepted)) {
  const scenes = style.productionCandidate.production_details.scenes;
  assert.equal(scenes[0].voiceover, item.headline);
  assert.equal(scenes[1].voiceover, `${item.body} ${item.solusi}`);
  assert.equal(scenes[2].voiceover, item.cta);
  for (const scene of scenes) {
    assert.ok(scene.duration_seconds >= Math.ceil(scene.voiceover.split(/\s+/u).length / 2.5 + 1));
    if (style.productionMode === 'motion_explainer') {
      const result = translateSingleVideoScenePrompt({ scene, productionMode: 'motion_explainer' });
      assert.ok(result.isValid);
      assert.equal(result.instructions?.voiceover, scene.voiceover);
      assert.ok(result.instructions?.motionPrompt.includes(`Duration: ${scene.duration_seconds}s`));
    }
  }
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
const sparseStyles = styles.map(style => ({ ...style, script: sparseBrief.script, captionForPost: '' }));
assert.ok(normalize(JSON.stringify(sparseStyles), sparseItem, null), 'missing optional sources stay empty without fabricated copy');
assert.equal(JSON.stringify(styles), snapshot, 'source records must remain intact');
assert.ok(!page.includes('attachCandidate) || videoOutput;'), 'rejected legacy output must not fall back to raw candidates');
console.log('Video narrative brief: normalizer, all modes, mixed topics, stale output, duration and translation passed.');
