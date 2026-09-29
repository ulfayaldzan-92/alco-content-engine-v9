/**
 * Phase 5B.3-F Image Authority Regression Lock Test Suite
 *
 * Deterministic test suite verifying:
 * 1. Output Source Authority Lock (functional & static)
 * 2. Generation Admission Lock (validation & normalization before save)
 * 3. Inline Image Production Gate Lock (fail-closed checks in handleGenerateImage)
 * 4. Execution Ordering Lock (prepare & save package before fetch)
 * 5. Exact Candidate Resolution Lock (no fallback to [0] or recommendedAngleId)
 * 6. Async Stale Response Guard Lock (project, content item, and authority signature matching)
 * 7. ImagePanel Execution Output Lock (freshness check and authority prompt binding)
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  isAuthoritativeProductionOutputSource,
  ProductionOutputSource,
} from '../lib/production-output-source';
import {
  isGeneratedImageOutputCurrent,
  GeneratedImageExecutionOutput,
} from '../lib/image-generated-output-state';
import {
  EXECUTION_PROMPT_CONTRACT_VERSION,
  ExecutionPromptAuthority,
} from '../lib/execution-prompt-authority';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    throw new Error(`Assertion Failed: ${message}`);
  }
  console.log(`✅ ${message}`);
}

console.log('====================================================');
console.log('IMAGE AUTHORITY REGRESSION LOCK TESTS');
console.log('====================================================\n');

// ============================================================================
// 1. OUTPUT SOURCE AUTHORITY LOCK
// ============================================================================
console.log('--- 1. OUTPUT SOURCE AUTHORITY LOCK ---');

// Functional checks on isAuthoritativeProductionOutputSource
const authoritativeSources: ProductionOutputSource[] = [
  'stored_output',
  'generated_output',
  'user_edited_output',
];
for (const src of authoritativeSources) {
  assert(
    isAuthoritativeProductionOutputSource(src) === true,
    `ProductionOutputSource "${src}" must be authoritative (true)`
  );
}

const nonAuthoritativeSources: ProductionOutputSource[] = ['none', 'initial_draft'];
for (const src of nonAuthoritativeSources) {
  assert(
    isAuthoritativeProductionOutputSource(src) === false,
    `ProductionOutputSource "${src}" must NOT be authoritative (false)`
  );
}

// Static page.tsx checks
const pagePath = path.join(__dirname, '../app/production-studio/page.tsx');
const pageContent = fs.readFileSync(pagePath, 'utf-8');

assert(
  pageContent.includes("setImageOutputSource('none')"),
  "page.tsx must contain setImageOutputSource('none')"
);
assert(
  pageContent.includes("setImageOutputSource('stored_output')"),
  "page.tsx must contain setImageOutputSource('stored_output')"
);
assert(
  pageContent.includes("setImageOutputSource('generated_output')"),
  "page.tsx must contain setImageOutputSource('generated_output')"
);
assert(
  pageContent.includes("setImageOutputSource('user_edited_output')"),
  "page.tsx must contain setImageOutputSource('user_edited_output')"
);

// Image MUST NOT use initial_draft
assert(
  !pageContent.includes("setImageOutputSource('initial_draft')"),
  "page.tsx must NOT contain setImageOutputSource('initial_draft')"
);

// ============================================================================
// 2. GENERATION ADMISSION LOCK
// ============================================================================
console.log('\n--- 2. GENERATION ADMISSION LOCK ---');

assert(
  pageContent.includes('validateAndNormalizeImageAngles(generatedText'),
  'Image AI optimization must pass raw generatedText through validateAndNormalizeImageAngles'
);
assert(
  pageContent.includes('saveImageOutput(normalized)'),
  'Only validated and normalized Image angles may be saved to saveImageOutput'
);
assert(
  !pageContent.includes('saveImageOutput(generatedText)'),
  'Raw generatedText must NEVER be saved directly via saveImageOutput(generatedText)'
);

// ============================================================================
// 3. INLINE IMAGE PRODUCTION GATE LOCK (handleGenerateImage)
// ============================================================================
console.log('\n--- 3. INLINE IMAGE PRODUCTION GATE LOCK ---');

// Extract handleGenerateImage implementation
const handleGenerateImageStart = pageContent.indexOf('const handleGenerateImage = async');
assert(handleGenerateImageStart !== -1, 'handleGenerateImage function must exist in page.tsx');

const handleGenerateImageEnd = pageContent.indexOf(
  'const handleDownloadImage',
  handleGenerateImageStart
);
const handleGenerateImageCode = pageContent.slice(
  handleGenerateImageStart,
  handleGenerateImageEnd !== -1 ? handleGenerateImageEnd : handleGenerateImageStart + 15000
);

// Fail-closed checks in handleGenerateImage
assert(
  handleGenerateImageCode.includes('!sourceItem || !sourceItem.content_item_id'),
  'handleGenerateImage must fail closed if sourceItem or content_item_id is missing'
);
assert(
  handleGenerateImageCode.includes('!sharedContextSnapshot'),
  'handleGenerateImage must fail closed if sharedContextSnapshot is missing'
);
assert(
  handleGenerateImageCode.includes('!funnelStrategySnapshot'),
  'handleGenerateImage must fail closed if funnelStrategySnapshot is missing'
);
assert(
  handleGenerateImageCode.includes('!isAuthoritativeProductionOutputSource(imageOutputSource)'),
  'handleGenerateImage must fail closed if imageOutputSource is not authoritative'
);
assert(
  handleGenerateImageCode.includes('!imageAnglesPackage'),
  'handleGenerateImage must fail closed if imageAnglesPackage is missing'
);
assert(
  handleGenerateImageCode.includes('!selectedCandidate'),
  'handleGenerateImage must fail closed if selectedCandidate is missing'
);
assert(
  handleGenerateImageCode.includes('!translatedBundle'),
  'handleGenerateImage must fail closed if translatedBundle is missing'
);
assert(
  handleGenerateImageCode.includes('buildExecutionPromptAuthority(translatedBundle)'),
  'handleGenerateImage must build execution authority from translatedBundle'
);
assert(
  handleGenerateImageCode.includes("requestExecutionAuthority.asset_type !== 'image'"),
  'handleGenerateImage must verify requestExecutionAuthority.asset_type is image'
);
assert(
  handleGenerateImageCode.includes(
    'requestExecutionAuthority.candidate_id !== selectedCandidate.candidate_id'
  ),
  'handleGenerateImage must verify requestExecutionAuthority.candidate_id matches selectedCandidate'
);
assert(
  handleGenerateImageCode.includes("productionPackage.asset_type !== 'image'"),
  'handleGenerateImage must verify productionPackage.asset_type is image'
);
assert(
  handleGenerateImageCode.includes('!saveResult.ok'),
  'handleGenerateImage must fail closed if saveProductionPackage fails'
);

// ============================================================================
// 4. ORDERING LOCK
// ============================================================================
console.log('\n--- 4. ORDERING LOCK ---');

const prepareIndex = handleGenerateImageCode.indexOf('prepareProductionPackage(');
const saveIndex = handleGenerateImageCode.indexOf('saveProductionPackage(');
const fetchIndex = handleGenerateImageCode.indexOf("fetch('/api/gemini/generate-image'");

assert(prepareIndex !== -1, 'prepareProductionPackage must be called in handleGenerateImage');
assert(saveIndex !== -1, 'saveProductionPackage must be called in handleGenerateImage');
assert(fetchIndex !== -1, "fetch('/api/gemini/generate-image') must be called in handleGenerateImage");

assert(
  prepareIndex < fetchIndex,
  'prepareProductionPackage MUST be executed BEFORE fetch(/api/gemini/generate-image)'
);
assert(
  saveIndex < fetchIndex,
  'saveProductionPackage MUST be executed BEFORE fetch(/api/gemini/generate-image)'
);

// ============================================================================
// 5. EXACT CANDIDATE LOCK
// ============================================================================
console.log('\n--- 5. EXACT CANDIDATE LOCK ---');

assert(
  handleGenerateImageCode.includes('candidates.find(c => c.candidate_id === angleId)'),
  'handleGenerateImage must resolve candidate by matching exact clicked angleId'
);
assert(
  !handleGenerateImageCode.includes('selectedCandidate = candidates[0]'),
  'handleGenerateImage must NOT fall back to candidates[0]'
);
assert(
  !handleGenerateImageCode.includes('selectedCandidate = angles[0]'),
  'handleGenerateImage must NOT fall back to angles[0]'
);
assert(
  !handleGenerateImageCode.includes('selectedCandidateId: recommendedAngleId'),
  'handleGenerateImage must NOT use recommendedAngleId as production package candidate'
);

// ============================================================================
// 6. ASYNC STALE RESPONSE LOCK
// ============================================================================
console.log('\n--- 6. ASYNC STALE RESPONSE LOCK ---');

assert(
  handleGenerateImageCode.includes('getActiveProjectId() !== requestProjectId'),
  'Async guard must verify getActiveProjectId() === requestProjectId'
);
assert(
  handleGenerateImageCode.includes('canonicalProjectId !== requestProjectId'),
  'Async guard must verify canonicalProjectId === requestProjectId'
);
assert(
  handleGenerateImageCode.includes('currentContentItemIdRef.current !== requestContentItemId'),
  'Async guard must verify currentContentItemIdRef.current === requestContentItemId'
);
assert(
  handleGenerateImageCode.includes('!isAuthorityMatch'),
  'Async guard must verify !isAuthorityMatch to discard stale responses'
);

// Verify isAuthorityMatch binds to required fields
assert(
  handleGenerateImageCode.includes("currentAuthority.asset_type === 'image'"),
  'isAuthorityMatch must verify asset_type === image'
);
assert(
  handleGenerateImageCode.includes('currentAuthority.candidate_id === requestCandidateId'),
  'isAuthorityMatch must verify candidate_id === requestCandidateId'
);
assert(
  handleGenerateImageCode.includes(
    'currentAuthority.contract_version === requestExecutionAuthority.contract_version'
  ),
  'isAuthorityMatch must verify contract_version matches'
);
assert(
  handleGenerateImageCode.includes(
    'currentAuthority.execution_signature === requestExecutionAuthority.execution_signature'
  ),
  'isAuthorityMatch must verify execution_signature matches'
);
assert(
  handleGenerateImageCode.includes('Discarding stale generated image response'),
  'Async guard must log discard warning for stale generated image response'
);

// ============================================================================
// 7. IMAGE PANEL EXECUTION OUTPUT LOCK
// ============================================================================
console.log('\n--- 7. IMAGE PANEL EXECUTION OUTPUT LOCK ---');

const imagePanelPath = path.join(
  __dirname,
  '../components/production-studio/ImagePanel.tsx'
);
const imagePanelContent = fs.readFileSync(imagePanelPath, 'utf-8');

assert(
  imagePanelContent.includes('isGeneratedImageOutputCurrent(rawGeneratedImg'),
  'ImagePanel must use isGeneratedImageOutputCurrent to check freshness'
);
assert(
  imagePanelContent.includes('imageExecutionAuthorities?.[activeAngle.id]'),
  'ImagePanel must resolve active authority by activeAngle.id'
);
assert(
  imagePanelContent.includes('const generatedImg = isOutputCurrent ? rawGeneratedImg : null;'),
  'ImagePanel must only use rawGeneratedImg when isOutputCurrent is true'
);
assert(
  imagePanelContent.includes('activeBundle?.execution_prompt'),
  'ImagePanel must use activeBundle?.execution_prompt as effectivePrompt'
);

// Functional verification of isGeneratedImageOutputCurrent
const validAuthority: ExecutionPromptAuthority = {
  asset_type: 'image',
  candidate_id: 'angle_A',
  contract_version: EXECUTION_PROMPT_CONTRACT_VERSION,
  execution_signature: 'exec_sig_image_12345678',
};

const validOutput: GeneratedImageExecutionOutput = {
  project_id: 'proj_1',
  content_item_id: 'item_1',
  candidate_id: 'angle_A',
  imageDataUrl: 'data:image/png;base64,valid',
  execution_authority: validAuthority,
};

assert(
  isGeneratedImageOutputCurrent(validOutput, {
    project_id: 'proj_1',
    content_item_id: 'item_1',
    candidate_id: 'angle_A',
    execution_authority: validAuthority,
  }) === true,
  'isGeneratedImageOutputCurrent must return true for valid matching output'
);

const staleAuthority: ExecutionPromptAuthority = {
  asset_type: 'image',
  candidate_id: 'angle_A',
  contract_version: EXECUTION_PROMPT_CONTRACT_VERSION,
  execution_signature: 'exec_sig_image_87654321', // Different signature
};

assert(
  isGeneratedImageOutputCurrent(validOutput, {
    project_id: 'proj_1',
    content_item_id: 'item_1',
    candidate_id: 'angle_A',
    execution_authority: staleAuthority,
  }) === false,
  'isGeneratedImageOutputCurrent must return false for stale authority signature'
);

assert(
  isGeneratedImageOutputCurrent(validOutput, {
    project_id: 'proj_2', // Different project
    content_item_id: 'item_1',
    candidate_id: 'angle_A',
    execution_authority: validAuthority,
  }) === false,
  'isGeneratedImageOutputCurrent must return false for mismatched project_id'
);

assert(
  isGeneratedImageOutputCurrent(validOutput, {
    project_id: 'proj_1',
    content_item_id: 'item_2', // Different content item
    candidate_id: 'angle_A',
    execution_authority: validAuthority,
  }) === false,
  'isGeneratedImageOutputCurrent must return false for mismatched content_item_id'
);

assert(
  isGeneratedImageOutputCurrent(validOutput, {
    project_id: 'proj_1',
    content_item_id: 'item_1',
    candidate_id: 'angle_B', // Different candidate
    execution_authority: validAuthority,
  }) === false,
  'isGeneratedImageOutputCurrent must return false for mismatched candidate_id'
);

console.log('\n====================================================');
console.log('🎉 ALL IMAGE AUTHORITY REGRESSION LOCK TESTS PASSED!');
console.log('====================================================');
