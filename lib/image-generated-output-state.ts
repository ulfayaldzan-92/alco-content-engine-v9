import {
  ExecutionPromptAuthority,
  EXECUTION_PROMPT_CONTRACT_VERSION,
  isValidExecutionSignatureFormat,
} from './execution-prompt-authority';

export interface GeneratedImageExecutionOutput {
  project_id: string;
  content_item_id: string;
  candidate_id: string;

  imageDataUrl: string;
  model?: string;
  aspectRatio?: string;

  execution_authority: ExecutionPromptAuthority;
}

export function getGeneratedImageOutputKey(
  projectId: string,
  contentItemId: string,
  candidateId: string
): string {
  const p = typeof projectId === 'string' ? projectId.trim() : '';
  const item = typeof contentItemId === 'string' ? contentItemId.trim() : '';
  const cand = typeof candidateId === 'string' ? candidateId.trim() : '';
  return `${p}::${item}::${cand}`;
}

export interface IsGeneratedImageOutputCurrentExpected {
  project_id: string;
  content_item_id: string;
  candidate_id: string;
  execution_authority: ExecutionPromptAuthority | null | undefined;
}

export function isGeneratedImageOutputCurrent(
  output: GeneratedImageExecutionOutput | null | undefined,
  expected: IsGeneratedImageOutputCurrentExpected | null | undefined
): boolean {
  if (!output || typeof output !== 'object') return false;
  if (!expected || typeof expected !== 'object') return false;

  if (!expected.execution_authority || typeof expected.execution_authority !== 'object') {
    return false;
  }

  const expAuth = expected.execution_authority;
  if (
    expAuth.asset_type !== 'image' ||
    typeof expAuth.candidate_id !== 'string' ||
    expAuth.candidate_id.trim().length === 0 ||
    expAuth.contract_version !== EXECUTION_PROMPT_CONTRACT_VERSION ||
    !isValidExecutionSignatureFormat('image', expAuth.execution_signature)
  ) {
    return false;
  }

  if (typeof output.project_id !== 'string' || output.project_id !== expected.project_id) {
    return false;
  }

  if (typeof output.content_item_id !== 'string' || output.content_item_id !== expected.content_item_id) {
    return false;
  }

  if (typeof output.candidate_id !== 'string' || output.candidate_id !== expected.candidate_id) {
    return false;
  }

  if (typeof output.imageDataUrl !== 'string' || output.imageDataUrl.trim().length === 0) {
    return false;
  }

  const outAuth = output.execution_authority;
  if (!outAuth || typeof outAuth !== 'object') return false;

  if (outAuth.asset_type !== 'image') return false;
  if (outAuth.candidate_id !== expected.candidate_id) return false;
  if (outAuth.contract_version !== EXECUTION_PROMPT_CONTRACT_VERSION) return false;
  if (!isValidExecutionSignatureFormat('image', outAuth.execution_signature)) return false;

  if (outAuth.execution_signature !== expAuth.execution_signature) {
    return false;
  }

  return true;
}
