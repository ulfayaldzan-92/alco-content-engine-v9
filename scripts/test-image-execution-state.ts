import {
  GeneratedImageExecutionOutput,
  getGeneratedImageOutputKey,
  isGeneratedImageOutputCurrent,
} from '../lib/image-generated-output-state';
import {
  ExecutionPromptAuthority,
  EXECUTION_PROMPT_CONTRACT_VERSION,
} from '../lib/execution-prompt-authority';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    throw new Error(message);
  }
  console.log(`✅ ${message}`);
}

console.log('====================================================');
console.log('PHASE 4C-B IMAGE EXECUTION STATE PROTECTION TESTS');
console.log('====================================================\n');

// Valid templates for test setup
const validAuthority: ExecutionPromptAuthority = {
  asset_type: 'image',
  candidate_id: 'cand_01',
  contract_version: EXECUTION_PROMPT_CONTRACT_VERSION,
  execution_signature: 'exec_sig_image_a1b2c3d4',
};

const validOutput: GeneratedImageExecutionOutput = {
  project_id: 'proj_01',
  content_item_id: 'item_01',
  candidate_id: 'cand_01',
  imageDataUrl: 'data:image/png;base64,iVBOR...',
  model: 'gemini-2.0-flash',
  aspectRatio: '4:5',
  execution_authority: validAuthority,
};

const validExpected = {
  project_id: 'proj_01',
  content_item_id: 'item_01',
  candidate_id: 'cand_01',
  execution_authority: validAuthority,
};

// Running 14 specified test cases
try {
  // Test Case 1: getGeneratedImageOutputKey produces deterministic canonical keys
  console.log('Test Case 1: Testing key determinism');
  const key1 = getGeneratedImageOutputKey('proj_01', 'item_01', 'cand_01');
  assert(key1 === 'proj_01::item_01::cand_01', 'Key format should match "projectId::contentItemId::candidateId"');

  // Test Case 2: getGeneratedImageOutputKey trims whitespace in inputs
  console.log('Test Case 2: Testing key trimming');
  const key2 = getGeneratedImageOutputKey(' proj_01 ', '\nitem_01\t', 'cand_01 ');
  assert(key2 === 'proj_01::item_01::cand_01', 'Whitespace should be successfully trimmed');

  // Test Case 3: isGeneratedImageOutputCurrent returns false if output is null or undefined
  console.log('Test Case 3: Null/undefined output check');
  assert(!isGeneratedImageOutputCurrent(null, validExpected), 'Should fail on null output');
  assert(!isGeneratedImageOutputCurrent(undefined, validExpected), 'Should fail on undefined output');

  // Test Case 4: isGeneratedImageOutputCurrent returns false if expected parameters are null or undefined
  console.log('Test Case 4: Null/undefined expected parameters check');
  assert(!isGeneratedImageOutputCurrent(validOutput, null), 'Should fail on null expected parameters');
  assert(!isGeneratedImageOutputCurrent(validOutput, undefined), 'Should fail on undefined expected parameters');

  // Test Case 5: isGeneratedImageOutputCurrent returns false if expected.execution_authority is null or undefined
  console.log('Test Case 5: Null/undefined expected execution_authority check');
  assert(!isGeneratedImageOutputCurrent(validOutput, { ...validExpected, execution_authority: null }), 'Should fail on null expected authority');
  assert(!isGeneratedImageOutputCurrent(validOutput, { ...validExpected, execution_authority: undefined }), 'Should fail on undefined expected authority');

  // Test Case 6: isGeneratedImageOutputCurrent returns false if expected.execution_authority has asset_type !== "image"
  console.log('Test Case 6: Non-image asset_type check');
  const nonImageAuth = { ...validAuthority, asset_type: 'video' as const };
  assert(!isGeneratedImageOutputCurrent(validOutput, { ...validExpected, execution_authority: nonImageAuth }), 'Should fail if asset_type is video');

  // Test Case 7: isGeneratedImageOutputCurrent returns false if expected.execution_authority has empty candidate_id
  console.log('Test Case 7: Empty expected candidate_id check');
  const emptyCandAuth = { ...validAuthority, candidate_id: '   ' };
  assert(!isGeneratedImageOutputCurrent(validOutput, { ...validExpected, execution_authority: emptyCandAuth }), 'Should fail if candidate_id is empty/whitespace');

  // Test Case 8: isGeneratedImageOutputCurrent returns false if expected.execution_authority contract_version is invalid
  console.log('Test Case 8: Invalid contract_version check');
  const invalidVerAuth = { ...validAuthority, contract_version: 'execution_prompt_v2' as any };
  assert(!isGeneratedImageOutputCurrent(validOutput, { ...validExpected, execution_authority: invalidVerAuth }), 'Should fail on invalid contract_version');

  // Test Case 9: isGeneratedImageOutputCurrent returns false if expected.execution_authority execution_signature is malformed
  console.log('Test Case 9: Malformed expected execution_signature check');
  const malformedSigAuth1 = { ...validAuthority, execution_signature: 'exec_sig_image_nothex12' };
  const malformedSigAuth2 = { ...validAuthority, execution_signature: 'exec_sig_carousel_a1b2c3d4' };
  assert(!isGeneratedImageOutputCurrent(validOutput, { ...validExpected, execution_authority: malformedSigAuth1 }), 'Should fail on non-hex signature');
  assert(!isGeneratedImageOutputCurrent(validOutput, { ...validExpected, execution_authority: malformedSigAuth2 }), 'Should fail on wrong asset type prefix signature');

  // Test Case 10: isGeneratedImageOutputCurrent returns false if project_id mismatch
  console.log('Test Case 10: Project ID mismatch check');
  assert(!isGeneratedImageOutputCurrent(validOutput, { ...validExpected, project_id: 'proj_different' }), 'Should fail if project_id mismatches');

  // Test Case 11: isGeneratedImageOutputCurrent returns false if content_item_id mismatch
  console.log('Test Case 11: Content Item ID mismatch check');
  assert(!isGeneratedImageOutputCurrent(validOutput, { ...validExpected, content_item_id: 'item_different' }), 'Should fail if content_item_id mismatches');

  // Test Case 12: isGeneratedImageOutputCurrent returns false if candidate_id mismatch
  console.log('Test Case 12: Candidate ID mismatch check');
  assert(!isGeneratedImageOutputCurrent(validOutput, { ...validExpected, candidate_id: 'cand_different' }), 'Should fail if candidate_id mismatches');

  // Test Case 13: isGeneratedImageOutputCurrent returns false if execution_signature mismatch (stale prompt)
  console.log('Test Case 13: Stale prompt/signature mismatch check');
  const differentSigAuth = { ...validAuthority, execution_signature: 'exec_sig_image_fedcba98' };
  assert(!isGeneratedImageOutputCurrent(validOutput, { ...validExpected, execution_authority: differentSigAuth }), 'Should fail if execution_signature mismatches');

  // Test Case 14: isGeneratedImageOutputCurrent returns true if all parameters match perfectly (current output)
  console.log('Test Case 14: Perfect match current check');
  assert(isGeneratedImageOutputCurrent(validOutput, validExpected), 'Should pass when all fields are identical and valid');

  console.log('\n🎉 ALL 14 TEST CASES PASSED SUCCESSFULLY!');
} catch (error) {
  console.error('\n❌ Tests Failed!');
  process.exit(1);
}
