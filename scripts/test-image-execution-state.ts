import {
  GeneratedImageExecutionOutput,
  getGeneratedImageOutputKey,
  isGeneratedImageOutputCurrent,
} from '../lib/image-generated-output-state';
import {
  ExecutionPromptAuthority,
  EXECUTION_PROMPT_CONTRACT_VERSION,
  buildExecutionPromptAuthority,
} from '../lib/execution-prompt-authority';
import {
  translateImageProductionPrompt,
} from '../lib/prompt-translation';
import { ImageProductionCandidate } from '../lib/production-candidate';
import { CharacterDNA } from '../lib/content-contract';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    throw new Error(message);
  }
  console.log(`✅ ${message}`);
}

console.log('====================================================');
console.log('PHASE 4C-B.2.1 IMAGE EXECUTION STATE REGRESSION TESTS');
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

// Running 16 specified test cases
try {
  // Test 1: same project + item + candidate produces deterministic canonical key
  console.log('Test 1: Same project + item + candidate produces deterministic canonical key');
  const key1a = getGeneratedImageOutputKey('proj_01', 'item_01', 'cand_01');
  const key1b = getGeneratedImageOutputKey('proj_01', 'item_01', 'cand_01');
  assert(key1a === 'proj_01::item_01::cand_01', 'Key format should match "projectId::contentItemId::candidateId"');
  assert(key1a === key1b, 'Identical parameters must produce identical canonical key');

  // Test 2: different project produces a DIFFERENT key
  console.log('Test 2: Different project produces a DIFFERENT key');
  const key2 = getGeneratedImageOutputKey('proj_02', 'item_01', 'cand_01');
  assert(key1a !== key2, 'Keys with different project IDs must differ');

  // Test 3: different content item produces a DIFFERENT key
  console.log('Test 3: Different content item produces a DIFFERENT key');
  const key3 = getGeneratedImageOutputKey('proj_01', 'item_02', 'cand_01');
  assert(key1a !== key3, 'Keys with different content item IDs must differ');

  // Test 4: different candidate produces a DIFFERENT key
  console.log('Test 4: Different candidate produces a DIFFERENT key');
  const key4 = getGeneratedImageOutputKey('proj_01', 'item_01', 'cand_02');
  assert(key1a !== key4, 'Keys with different candidate IDs must differ');

  // Test 5: valid current output is accepted
  console.log('Test 5: Valid current output is accepted');
  assert(isGeneratedImageOutputCurrent(validOutput, validExpected), 'Should pass when all fields are identical and valid');

  // Test 6: different execution signature makes old output stale
  console.log('Test 6: Different execution signature makes old output stale');
  const differentSigAuth: ExecutionPromptAuthority = {
    ...validAuthority,
    execution_signature: 'exec_sig_image_fedcba98',
  };
  assert(
    !isGeneratedImageOutputCurrent(validOutput, { ...validExpected, execution_authority: differentSigAuth }),
    'Output must be stale when execution signature changes'
  );

  // Test 7: different project makes output stale
  console.log('Test 7: Different project makes output stale');
  assert(
    !isGeneratedImageOutputCurrent(validOutput, { ...validExpected, project_id: 'proj_different' }),
    'Output must be stale when project_id changes'
  );

  // Test 8: different content item makes output stale
  console.log('Test 8: Different content item makes output stale');
  assert(
    !isGeneratedImageOutputCurrent(validOutput, { ...validExpected, content_item_id: 'item_different' }),
    'Output must be stale when content_item_id changes'
  );

  // Test 9: different candidate makes output stale
  console.log('Test 9: Different candidate makes output stale');
  assert(
    !isGeneratedImageOutputCurrent(validOutput, { ...validExpected, candidate_id: 'cand_different' }),
    'Output must be stale when candidate_id changes'
  );

  // Test 10: wrong execution authority asset_type is stale
  console.log('Test 10: Wrong execution authority asset_type is stale');
  const nonImageAuth: ExecutionPromptAuthority = {
    ...validAuthority,
    asset_type: 'video' as unknown as 'image',
  };
  assert(
    !isGeneratedImageOutputCurrent(validOutput, { ...validExpected, execution_authority: nonImageAuth }),
    'Output must be stale when asset_type is not image'
  );

  // Test 11: malformed execution signature is stale
  console.log('Test 11: Malformed execution signature is stale');
  const malformedSigAuth1: ExecutionPromptAuthority = {
    ...validAuthority,
    execution_signature: 'exec_sig_image_nothex12',
  };
  const malformedSigAuth2: ExecutionPromptAuthority = {
    ...validAuthority,
    execution_signature: 'exec_sig_carousel_a1b2c3d4',
  };
  assert(
    !isGeneratedImageOutputCurrent(validOutput, { ...validExpected, execution_authority: malformedSigAuth1 }),
    'Output must be stale with non-hex execution signature'
  );
  assert(
    !isGeneratedImageOutputCurrent(validOutput, { ...validExpected, execution_authority: malformedSigAuth2 }),
    'Output must be stale with wrong asset type prefix in signature'
  );

  // Test 12: invalid contract version is stale
  console.log('Test 12: Invalid contract version is stale');
  const invalidVerAuth: ExecutionPromptAuthority = {
    ...validAuthority,
    contract_version: 'execution_prompt_v2' as unknown as typeof EXECUTION_PROMPT_CONTRACT_VERSION,
  };
  assert(
    !isGeneratedImageOutputCurrent(validOutput, { ...validExpected, execution_authority: invalidVerAuth }),
    'Output must be stale with invalid contract version'
  );

  // Test 13: old generated output shape WITHOUT execution_authority is stale
  console.log('Test 13: Old generated output shape WITHOUT execution_authority is stale');
  const legacyOutputMissingAuth: GeneratedImageExecutionOutput = {
    project_id: 'proj_01',
    content_item_id: 'item_01',
    candidate_id: 'cand_01',
    imageDataUrl: 'data:image/png;base64,iVBOR...',
    model: 'gemini-2.0-flash',
    aspectRatio: '4:5',
    execution_authority: undefined as unknown as ExecutionPromptAuthority,
  };
  const legacyOutputNullAuth: GeneratedImageExecutionOutput = {
    project_id: 'proj_01',
    content_item_id: 'item_01',
    candidate_id: 'cand_01',
    imageDataUrl: 'data:image/png;base64,iVBOR...',
    model: 'gemini-2.0-flash',
    aspectRatio: '4:5',
    execution_authority: null as unknown as ExecutionPromptAuthority,
  };
  assert(
    !isGeneratedImageOutputCurrent(legacyOutputMissingAuth, validExpected),
    'Output missing execution_authority must be stale'
  );
  assert(
    !isGeneratedImageOutputCurrent(legacyOutputNullAuth, validExpected),
    'Output with null execution_authority must be stale'
  );

  // Test 14: A REAL Image translated prompt bundle can be passed through translateImageProductionPrompt() -> buildExecutionPromptAuthority()
  console.log('Test 14: Real Image translation -> execution authority pipeline');
  const realCandidate: ImageProductionCandidate = {
    candidate_type: 'image',
    candidate_id: 'angle_A',
    production_details: {
      objective: 'Demonstrate premium skincare serum bottle in minimalist clinic studio',
      scene: 'Clean modern aesthetic dermatology clinic counter',
      subject: 'Glass serum bottle with dropper',
      composition: 'Centered subject with rule of thirds negative space on right',
      environment: 'Well-lit minimalist dermatology clinic, marble surface',
      lighting: 'Soft directional studio lighting with subtle rim light',
      camera_direction: 'Eye-level straight shot, shallow depth of field',
      visual_style: 'Hyper-realistic clean commercial product photography',
      text_overlay: 'Serum Retinol Murni 2%',
      branding: 'ALCO Derma Clinic',
      negative_constraints: 'No cluttered background, no blurry textures, no low resolution artifacts',
    },
    final_prompt: 'Hyper-realistic commercial product photography of a glass skincare serum bottle on a clean marble surface, soft directional lighting, modern dermatology clinic background',
  };

  const translation1 = translateImageProductionPrompt({ candidate: realCandidate });
  if (!translation1.ok) {
    throw new Error(`Expected translation success: ${translation1.error}`);
  }
  const bundle1 = translation1.bundle;
  assert(bundle1.asset_type === 'image', 'Translated bundle must be asset_type image');

  const authorityResult1 = buildExecutionPromptAuthority(bundle1);
  if (!authorityResult1.ok) {
    throw new Error(`Expected authority success: ${authorityResult1.error}`);
  }
  const realAuthority1 = authorityResult1.authority;
  assert(realAuthority1.asset_type === 'image', 'Authority asset_type must be image');
  assert(realAuthority1.candidate_id === 'angle_A', 'Candidate ID must match angle_A');
  assert(realAuthority1.execution_signature.startsWith('exec_sig_image_'), 'Signature must have exec_sig_image_ prefix');

  // Test 15: CharacterDNA/input change that changes the translated Image execution prompt must produce a different execution signature
  console.log('Test 15: CharacterDNA prompt alteration produces different execution signature');
  const realCharacterDNA: CharacterDNA = {
    character_id: 'char_sarah_01',
    project_id: 'proj_01',
    source_item_key: 'item_01',
    reference_images: ['https://example.com/sarah.png'],
    preview_image: 'https://example.com/sarah_prev.png',
    additional_instructions: 'Maintain professional dermatology clinical tone',
    identity: {
      display_name: 'Dr. Sarah Lin',
      gender_presentation: 'Female',
      estimated_age_range: 'Early 30s',
      ethnicity_or_region_hint: 'East Asian',
      body_type: 'Slim professional build',
      facial_features: 'Gentle warm smile, clear skin',
      hair_description: 'Black hair tied in a professional low bun',
      skin_tone: 'Fair clear complexion',
      distinctive_characteristics: 'Lab coat and silver stethoscope',
    },
    style: {
      wardrobe_style: 'Clean white lab coat over medical scrubs',
      accessories: ['Silver stethoscope', 'Small pearl earrings'],
      makeup_style: 'Clean natural makeup',
      visual_vibe: 'Professional, trustworthy medical expert',
      brand_fit_reason: 'Aligns with medical authority and skincare credibility',
    },
    behavior: {
      speaking_tone: 'Calm, authoritative, empathetic',
      expression_style: 'Warm and confident',
      pose_tendency: 'Standing upright holding product gently',
      gesture_style: 'Precise and welcoming hand gestures',
      on_camera_persona: 'Expert dermatologist giving trusted guidance',
    },
    consistency_rules: {
      locked_traits: ['white lab coat', 'low bun hairstyle', 'clear skin'],
      avoid_traits: ['casual clothing', 'dramatic makeup', 'flashy jewelry'],
      continuity_notes: ['Always maintain consistent lab lighting and medical setting'],
    },
    prompt_assets: {
      dna_summary_prompt: 'Dr. Sarah Lin, a female dermatologist in her early 30s wearing a white lab coat',
      locked_visual_prompt: 'Professional portrait of Dr. Sarah Lin in clean medical clinic setting',
      preview_generation_prompt: 'Studio portrait of Dr. Sarah Lin with warm smile in white lab coat',
      scene_reuse_prompt_template: 'Dr. Sarah Lin in clinic setting interacting with {scene_context}',
    },
    timestamps: {
      created_at: '2026-09-20T10:00:00.000Z',
      updated_at: '2026-09-20T10:00:00.000Z',
    },
  };

  const translation2 = translateImageProductionPrompt({
    candidate: realCandidate,
    characterDNA: realCharacterDNA,
  });
  if (!translation2.ok) {
    throw new Error(`Expected translation success: ${translation2.error}`);
  }
  const bundle2 = translation2.bundle;
  assert(bundle2.asset_type === 'image', 'Translated bundle with CharacterDNA must be asset_type image');
  if (bundle2.asset_type !== 'image') {
    throw new Error('Expected image bundle');
  }
  assert(
    bundle2.execution_prompt.includes(realCharacterDNA.identity.display_name),
    'Execution prompt must contain CharacterDNA display name'
  );

  const authorityResult2 = buildExecutionPromptAuthority(bundle2);
  if (!authorityResult2.ok) {
    throw new Error(`Expected authority success: ${authorityResult2.error}`);
  }
  const realAuthority2 = authorityResult2.authority;
  assert(realAuthority2.asset_type === 'image', 'Authority with CharacterDNA must be asset_type image');
  assert(
    realAuthority1.execution_signature !== realAuthority2.execution_signature,
    'Execution signatures must differ when prompt changes via CharacterDNA'
  );

  // Test 16: output created under the old Image authority must become stale against the new Image authority
  console.log('Test 16: Output created under old authority becomes stale against new authority');
  const realOutputCreatedUnderAuth1: GeneratedImageExecutionOutput = {
    project_id: 'proj_01',
    content_item_id: 'item_01',
    candidate_id: 'angle_A',
    imageDataUrl: 'data:image/png;base64,sampleRealGeneratedImage...',
    model: 'gemini-2.0-flash',
    aspectRatio: '4:5',
    execution_authority: realAuthority1,
  };

  const isCurrentUnderOldAuth = isGeneratedImageOutputCurrent(realOutputCreatedUnderAuth1, {
    project_id: 'proj_01',
    content_item_id: 'item_01',
    candidate_id: 'angle_A',
    execution_authority: realAuthority1,
  });
  assert(isCurrentUnderOldAuth === true, 'Output must be current when evaluated against matching old authority');

  const isCurrentUnderNewAuth = isGeneratedImageOutputCurrent(realOutputCreatedUnderAuth1, {
    project_id: 'proj_01',
    content_item_id: 'item_01',
    candidate_id: 'angle_A',
    execution_authority: realAuthority2,
  });
  assert(isCurrentUnderNewAuth === false, 'Output created under old authority MUST be stale when evaluated against new authority');

  console.log('\n🎉 ALL 16 PHASE 4C-B.2.1 IMAGE EXECUTION STATE TESTS PASSED SUCCESSFULLY!');
} catch (error) {
  console.error('\n❌ Tests Failed!');
  process.exit(1);
}
