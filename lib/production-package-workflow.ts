import type { SharedContentContext, ContentItem, CharacterDNA } from './content-contract';
import type { FunnelStrategy } from './funnel-strategy';
import type { ProductionCandidate } from './production-candidate';
import { selectRawProductionCandidate } from './production-candidate-adapter';
import { buildProductionEngineContext } from './production-engine-context';
import type { ProductionPackage } from './production-contract';
import {
  type ProductionPackageMetadata,
  buildProductionPackage,
} from './production-engine';
import type { TranslatedProductionPromptBundle } from './prompt-translation';
import { bindTranslatedPromptBundleToAssetInput } from './prompt-package-binding';

export interface PrepareProductionPackageInput {
  projectId: string;
  sharedContext: SharedContentContext;
  funnelStrategy: FunnelStrategy;
  contentItem: ContentItem;
  characterDNA?: CharacterDNA | null;
  candidates: ProductionCandidate[];
  selectedCandidateId: string;
  translatedPromptBundle: TranslatedProductionPromptBundle;
  metadata: ProductionPackageMetadata;
}

export type PrepareProductionPackageResult =
  | {
      ok: true;
      package: ProductionPackage;
    }
  | {
      ok: false;
      error: string;
    };

/**
 * Pure canonical orchestration function for preparing a ProductionPackage.
 *
 * Flow (Phase 4B-A):
 * 1. Validates & builds ProductionEngineContext via buildProductionEngineContext()
 * 2. Explicitly selects canonical candidate via selectRawProductionCandidate()
 * 3. Binds candidate + translatedPromptBundle into authoritative ProductionAssetInput
 * 4. Delegates ProductionPackage creation strictly to Single Production Engine buildProductionPackage()
 *
 * FAIL-CLOSED: Does not repair, normalize, or fabricate inputs or metadata.
 * Does not generate timestamps, UUIDs, or fallback candidates.
 */
export function prepareProductionPackage(
  input: PrepareProductionPackageInput
): PrepareProductionPackageResult {
  if (!input || typeof input !== 'object') {
    return {
      ok: false,
      error: 'Input must be a valid non-null object',
    };
  }

  // 1. Build authoritative ProductionEngineContext
  const contextResult = buildProductionEngineContext(
    input.projectId,
    input.sharedContext,
    input.funnelStrategy,
    input.contentItem,
    input.characterDNA
  );

  if (!contextResult.isValid || !contextResult.context) {
    return {
      ok: false,
      error: contextResult.error || 'Failed to build ProductionEngineContext',
    };
  }

  // 2. Explicit candidate selection
  const selectionResult = selectRawProductionCandidate(
    input.candidates,
    input.selectedCandidateId
  );

  if (!selectionResult.ok) {
    return {
      ok: false,
      error: selectionResult.error || 'Failed to select production candidate',
    };
  }

  // 3. Strict translated prompt bundle presence & binding (Phase 4B-A)
  if (!input.translatedPromptBundle || typeof input.translatedPromptBundle !== 'object' || !('asset_type' in input.translatedPromptBundle)) {
    return {
      ok: false,
      error: 'Missing or invalid required translatedPromptBundle for package creation (FAIL CLOSED).',
    };
  }

  const bindingResult = bindTranslatedPromptBundleToAssetInput(
    selectionResult.candidate,
    input.translatedPromptBundle
  );

  if (!bindingResult.ok) {
    return {
      ok: false,
      error: bindingResult.error || 'Failed to bind translated prompt bundle to production asset input.',
    };
  }

  // 4. Delegate package construction strictly to Single Production Engine
  const engineResult = buildProductionPackage(
    contextResult.context,
    bindingResult.assetInput,
    input.metadata
  );

  if (!engineResult.isValid || !engineResult.package) {
    return {
      ok: false,
      error: engineResult.error || 'Failed to build ProductionPackage',
    };
  }

  return {
    ok: true,
    package: engineResult.package,
  };
}
