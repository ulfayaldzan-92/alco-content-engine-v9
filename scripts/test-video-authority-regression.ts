/**
 * Phase 5B.3-F Video Authority Regression Lock Test Suite
 *
 * Deterministic test suite verifying:
 * 1. Static guards in app/production-studio/page.tsx
 * 2. Static guards in components/production-studio/VideoPanel.tsx
 * 3. Static guards in lib/production-candidate.ts
 * 4. Functional canonical video scene plan verification (3 modes, proof === '')
 * 5. Functional proof integration verification (3 modes, proof === 'PROOF AUTHORITY')
 * 6. Production output source authority verification
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  buildCanonicalVideoScenePlan,
  VideoProductionMode,
} from '../lib/production-candidate';
import { isAuthoritativeProductionOutputSource, ProductionOutputSource } from '../lib/production-output-source';
import { FunnelStage } from '../lib/funnel-rules';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    throw new Error(`Assertion Failed: ${message}`);
  }
  console.log(`✅ ${message}`);
}

console.log('====================================================');
console.log('PHASE 5B.3-F VIDEO AUTHORITY REGRESSION LOCK TESTS');
console.log('====================================================\n');

// ============================================================================
// 1. STATIC GUARDS — PAGE.TSX
// ============================================================================
console.log('--- 1. STATIC GUARDS: app/production-studio/page.tsx ---');
const pagePath = path.join(__dirname, '../app/production-studio/page.tsx');
const pageContent = fs.readFileSync(pagePath, 'utf-8');

// Positive Assertions
assert(
  pageContent.includes('VIDEO AUTHORITY CONTRACT — STRICT'),
  'page.tsx must contain "VIDEO AUTHORITY CONTRACT — STRICT"'
);
assert(
  pageContent.includes('validateAndNormalizeVideoStyles(generatedText'),
  'page.tsx must pass Video generation through validateAndNormalizeVideoStyles(generatedText'
);
assert(
  pageContent.includes("setVideoOutputSource('generated_output')"),
  'page.tsx must set videoOutputSource to "generated_output" upon authoritative generation'
);
assert(
  pageContent.includes('Buat Rencana Video'),
  'page.tsx must use button label "Buat Rencana Video" for video generation'
);
assert(
  pageContent.includes('OUTPUT FIELD RULES:'),
  'page.tsx must contain "OUTPUT FIELD RULES:" before video schema'
);

const videoPromptMatches = pageContent.match(/"videoPrompt":\s*""/g) || [];
assert(
  videoPromptMatches.length === 3,
  `page.tsx must have exactly 3 occurrences of '"videoPrompt": ""', found ${videoPromptMatches.length}`
);

const captionMatches = pageContent.match(/"captionForPost":\s*""/g) || [];
assert(
  captionMatches.length === 3,
  `page.tsx must have exactly 3 occurrences of '"captionForPost": ""', found ${captionMatches.length}`
);

// Forbidden Assertions
const forbiddenPageTerms = [
  'saveVideoOutput(generatedText)',
  'buildFunnelAlignedVideoCaption',
  'Prompt deskriptif 9:16 vertical video',
  '[Garis besar alur voiceover yang grounded]',
  '[Garis besar alur walkthrough yang grounded]',
  '[Garis besar alur konsep gerak yang grounded]',
  '[Rencana visual adegan]',
  '[Rencana visual adegan UI/produk]',
  '[Rencana visual tipografi dan motion graphic]',
  '[Caption Instagram sesuai aturan Caption Authority di atas]',
  'Pernah merasa konten kamu sudah dibuat maksimal tapi hasilnya stagnan?',
  'Banyak kreator menghemat waktu',
  'secara instan.',
  'Otomatisasi membantu menjaga kualitas ide',
  'kurva grafik melesat naik',
];

for (const term of forbiddenPageTerms) {
  assert(
    !pageContent.includes(term),
    `page.tsx must NOT contain forbidden term: "${term}"`
  );
}

// ============================================================================
// 2. STATIC GUARDS — VIDEOPANEL.TSX
// ============================================================================
console.log('\n--- 2. STATIC GUARDS: components/production-studio/VideoPanel.tsx ---');
const videoPanelPath = path.join(__dirname, '../components/production-studio/VideoPanel.tsx');
const videoPanelContent = fs.readFileSync(videoPanelPath, 'utf-8');

// Positive Assertions
const positiveVideoPanelTerms = [
  'isVideoOutputAuthoritative',
  'videoOutputSource',
  'Draft Awal • Belum Dioptimalkan',
  'Rencana Video Teroptimasi',
  'Caption Sumber • Belum Dioptimalkan',
  'Input Lengkap',
  'Struktur Naskah dari Source Authority',
];
for (const term of positiveVideoPanelTerms) {
  assert(
    videoPanelContent.includes(term),
    `VideoPanel.tsx must contain positive term: "${term}"`
  );
}

// Forbidden Assertions
const forbiddenVideoPanelTerms = [
  'Caption Postingan Video (Siap Posting)',
  'Siap Produksi',
  'Mode Motion Explainer siap diproduksi secara langsung!',
];
for (const term of forbiddenVideoPanelTerms) {
  assert(
    !videoPanelContent.includes(term),
    `VideoPanel.tsx must NOT contain forbidden term: "${term}"`
  );
}

// ============================================================================
// 3. STATIC GUARDS — CANONICAL SCENE BUILDER (production-candidate.ts)
// ============================================================================
console.log('\n--- 3. STATIC GUARDS: lib/production-candidate.ts ---');
const prodCandidatePath = path.join(__dirname, '../lib/production-candidate.ts');
const prodCandidateContent = fs.readFileSync(prodCandidatePath, 'utf-8');

const forbiddenCandidateTerms = [
  'membuktikan efektivitas solusi',
  'keunggulan solusi',
  'manfaat inti solusi',
  'penegasan hasil',
  'ringkasan data:',
];
for (const term of forbiddenCandidateTerms) {
  assert(
    !prodCandidateContent.includes(term),
    `production-candidate.ts must NOT contain forbidden term: "${term}"`
  );
}

const positiveCandidateTerms = [
  'const proofText',
  'const hasProof',
  'Primary Message Hook',
];
for (const term of positiveCandidateTerms) {
  assert(
    prodCandidateContent.includes(term),
    `production-candidate.ts must contain positive term: "${term}"`
  );
}

// ============================================================================
// 4. FUNCTIONAL TEST — CANONICAL VIDEO SCENES (No Proof Fixture)
// ============================================================================
console.log('\n--- 4. FUNCTIONAL TEST: CANONICAL VIDEO SCENES (No Proof) ---');
const modes: VideoProductionMode[] = ['human_led', 'product_demo', 'motion_explainer'];
const stages: FunnelStage[] = ['TOFU', 'MOFU', 'BOFU'];

const scriptNoProof = {
  hook: 'HOOK AUTHORITY',
  masalah: 'MASALAH AUTHORITY',
  solusi: 'SOLUSI AUTHORITY',
  proof: '',
  cta: 'CTA AUTHORITY',
};

const forbiddenNoProofWords = ['bukti performa', 'membuktikan', 'keunggulan'];

for (const mode of modes) {
  for (const stage of stages) {
    const scenes = buildCanonicalVideoScenePlan(stage, mode, scriptNoProof);

    // Exactly 3 scenes
    assert(scenes.length === 3, `[${mode} - ${stage}] Scene plan must have exactly 3 scenes`);

    // Sequential scene_numbers 1, 2, 3
    const sceneNumbers = scenes.map((s) => s.scene_number);
    assert(
      JSON.stringify(sceneNumbers) === JSON.stringify([1, 2, 3]),
      `[${mode} - ${stage}] Scene numbers must be exactly [1, 2, 3]`
    );

    // Valid scene fields
    for (const scene of scenes) {
      assert(scene.duration_seconds > 0, `[${mode} - ${stage}] Scene ${scene.scene_number} duration_seconds must be > 0`);
      assert(typeof scene.camera === 'string' && scene.camera.trim().length > 0, `[${mode} - ${stage}] Scene ${scene.scene_number} camera must be non-empty`);
      assert(typeof scene.scene_type === 'string' && scene.scene_type.trim().length > 0, `[${mode} - ${stage}] Scene ${scene.scene_number} scene_type must be non-empty`);
      assert(Array.isArray(scene.required_assets), `[${mode} - ${stage}] Scene ${scene.scene_number} required_assets must be an array`);

      // When proof is empty: No 'Proof Hook'
      assert(
        scene.purpose !== 'Proof Hook',
        `[${mode} - ${stage}] Scene ${scene.scene_number} purpose must not be "Proof Hook" when proof is empty`
      );

      // No ungrounded proof/outcome wording
      const combinedVisualAction = `${scene.visual_direction} ${scene.action}`.toLowerCase();
      for (const word of forbiddenNoProofWords) {
        assert(
          !combinedVisualAction.includes(word),
          `[${mode} - ${stage}] Scene ${scene.scene_number} visual/action must not contain "${word}" when proof is empty`
        );
      }
    }

    // Authority propagation check
    assert(
      scenes[0].voiceover.includes('HOOK AUTHORITY') || scenes[0].on_screen_text.includes('HOOK AUTHORITY'),
      `[${mode} - ${stage}] Scene 1 must ground voiceover/on_screen_text on "HOOK AUTHORITY"`
    );
    assert(
      scenes[1].voiceover.includes('SOLUSI AUTHORITY') ||
      scenes[1].voiceover.includes('MASALAH AUTHORITY') ||
      scenes[1].on_screen_text.includes('SOLUSI AUTHORITY') ||
      scenes[1].on_screen_text.includes('MASALAH AUTHORITY'),
      `[${mode} - ${stage}] Scene 2 must ground voiceover/on_screen_text on "SOLUSI AUTHORITY" or "MASALAH AUTHORITY"`
    );
    assert(
      scenes[2].voiceover.includes('CTA AUTHORITY') || scenes[2].on_screen_text.includes('CTA AUTHORITY'),
      `[${mode} - ${stage}] Scene 3 must ground voiceover/on_screen_text on "CTA AUTHORITY"`
    );
  }
}

// ============================================================================
// 5. FUNCTIONAL PROOF TEST (With Proof Fixture)
// ============================================================================
console.log('\n--- 5. FUNCTIONAL TEST: CANONICAL VIDEO SCENES (With Proof) ---');
const scriptWithProof = {
  hook: 'HOOK AUTHORITY',
  masalah: 'MASALAH AUTHORITY',
  solusi: 'SOLUSI AUTHORITY',
  proof: 'PROOF AUTHORITY',
  cta: 'CTA AUTHORITY',
};

for (const mode of modes) {
  // Test in BOFU where proof is directly integrated into Hook/Scene 1
  const bofuScenes = buildCanonicalVideoScenePlan('BOFU', mode, scriptWithProof);

  assert(
    bofuScenes[0].purpose === 'Proof Hook',
    `[${mode} - BOFU] Scene 1 purpose must be "Proof Hook" when proof is provided`
  );
  assert(
    bofuScenes[0].visual_direction.includes('PROOF AUTHORITY'),
    `[${mode} - BOFU] Scene 1 visual_direction must include "PROOF AUTHORITY"`
  );

  // Proof must not be altered into invented metrics/claims
  const fullPlanText = JSON.stringify(bofuScenes);
  assert(!fullPlanText.includes('10x'), `[${mode} - BOFU] Scene plan must not fabricate "10x"`);
  assert(!fullPlanText.includes('studi kasus'), `[${mode} - BOFU] Scene plan must not fabricate "studi kasus"`);
  assert(!fullPlanText.includes('testimoni pelanggan'), `[${mode} - BOFU] Scene plan must not fabricate "testimoni pelanggan"`);
}

// ============================================================================
// 6. PRODUCTION OUTPUT SOURCE LOCK
// ============================================================================
console.log('\n--- 6. PRODUCTION OUTPUT SOURCE AUTHORITY LOCK ---');
const authoritativeSources: ProductionOutputSource[] = [
  'stored_output',
  'generated_output',
  'user_edited_output',
];

for (const source of authoritativeSources) {
  assert(
    isAuthoritativeProductionOutputSource(source) === true,
    `Source "${source}" must be authoritative`
  );
}

const nonAuthoritativeSources: ProductionOutputSource[] = [
  'initial_draft',
  'none',
];

for (const source of nonAuthoritativeSources) {
  assert(
    isAuthoritativeProductionOutputSource(source) === false,
    `Source "${source}" must NOT be authoritative`
  );
}

console.log('\n====================================================');
console.log('🎉 ALL PHASE 5B.3-F VIDEO AUTHORITY REGRESSION TESTS PASSED!');
console.log('====================================================');
