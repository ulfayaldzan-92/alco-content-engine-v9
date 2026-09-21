import { ProductionEngineContext, validateProductionEngineContext } from './production-engine-context';
import { VideoProductionMode } from './production-contract';
import { ProductAssetContext, ProductAssetReference } from './video-production-input';
import { CharacterDNA } from './content-contract';

export interface VideoProductionReadiness {
  mode: VideoProductionMode;

  is_ready: boolean;

  required_inputs: string[];
  missing_required_inputs: string[];

  optional_inputs: string[];

  warnings: string[];
}

export interface ResolveVideoProductionReadinessOptions {
  productionContext: ProductionEngineContext;
  selectedMode: VideoProductionMode;
  productAssetContext?: ProductAssetContext | null;
}

const VALID_VIDEO_PRODUCTION_MODES: VideoProductionMode[] = [
  'human_led',
  'product_demo',
  'motion_explainer',
];

/**
 * Validates whether an asset reference is a valid product screenshot.
 * Strictly requires non-empty id, non-empty name, and kind === 'screenshot'.
 * Logos and screen recordings are NOT valid screenshot replacements.
 */
export function isValidProductScreenshotReference(ref: unknown): boolean {
  if (!ref || typeof ref !== 'object') return false;
  const r = ref as Partial<ProductAssetReference>;
  return (
    typeof r.id === 'string' &&
    r.id.trim().length > 0 &&
    typeof r.name === 'string' &&
    r.name.trim().length > 0 &&
    r.kind === 'screenshot'
  );
}

/**
 * Validates whether a CharacterDNA object is usable and project-isolated.
 * Requires non-empty character_id, project_id matching canonicalProjectId,
 * non-empty identity.display_name, and non-empty visual prompt asset.
 */
export function isUsableCharacterDNA(
  dna: unknown,
  canonicalProjectId?: string
): boolean {
  if (!dna || typeof dna !== 'object') return false;
  const c = dna as Partial<CharacterDNA>;
  if (typeof c.character_id !== 'string' || !c.character_id.trim()) return false;
  if (typeof c.project_id !== 'string' || !c.project_id.trim()) return false;
  if (canonicalProjectId && c.project_id !== canonicalProjectId) return false;
  if (!c.identity || typeof c.identity !== 'object') return false;
  if (typeof c.identity.display_name !== 'string' || !c.identity.display_name.trim()) return false;

  const hasDnaSummary =
    typeof c.prompt_assets?.dna_summary_prompt === 'string' &&
    c.prompt_assets.dna_summary_prompt.trim().length > 0;
  const hasLockedVisual =
    typeof c.prompt_assets?.locked_visual_prompt === 'string' &&
    c.prompt_assets.locked_visual_prompt.trim().length > 0;

  return hasDnaSummary || hasLockedVisual;
}

/**
 * Canonical Resolver for Video Production Readiness (Phase 3D-C1C-A).
 * Evaluates readiness based on SELECTED mode and mode-specific required inputs.
 * FAIL-CLOSED: Strictly validates ProductionEngineContext and selectedMode.
 */
export function resolveVideoProductionReadiness(
  options: ResolveVideoProductionReadinessOptions
): VideoProductionReadiness {
  if (!options || typeof options !== 'object') {
    throw new Error(
      'resolveVideoProductionReadiness: Options object is required (FAIL CLOSED).'
    );
  }

  const { productionContext, selectedMode, productAssetContext } = options;

  // 1. Validate ProductionEngineContext strictly via canonical validator
  const validation = validateProductionEngineContext(productionContext);
  if (!validation.isValid) {
    throw new Error(
      `resolveVideoProductionReadiness: ${validation.error || 'Invalid ProductionEngineContext'} (FAIL CLOSED).`
    );
  }

  // 2. Validate selected VideoProductionMode strictly (exact string, no normalization)
  if (
    typeof selectedMode !== 'string' ||
    !VALID_VIDEO_PRODUCTION_MODES.includes(selectedMode as VideoProductionMode)
  ) {
    throw new Error(
      `resolveVideoProductionReadiness: Invalid video production mode "${selectedMode}". Mode must be exactly 'human_led', 'product_demo', or 'motion_explainer' (FAIL CLOSED).`
    );
  }

  const canonicalProjectId = productionContext.project_id;

  // 3. Mode-specific readiness evaluation
  switch (selectedMode) {
    case 'human_led': {
      const required_inputs = ['character'];
      const optional_inputs: string[] = [];
      const missing_required_inputs: string[] = [];
      const warnings: string[] = [];

      const characterDNA = productionContext.character_dna;
      if (!characterDNA) {
        missing_required_inputs.push('character');
        warnings.push('Video dengan Talent membutuhkan CharacterDNA yang dipilih untuk project aktif.');
        return {
          mode: 'human_led',
          is_ready: false,
          required_inputs,
          missing_required_inputs,
          optional_inputs,
          warnings,
        };
      }

      // Check character_id
      if (typeof characterDNA.character_id !== 'string' || !characterDNA.character_id.trim()) {
        missing_required_inputs.push('character');
        warnings.push('CharacterDNA tidak valid: ID character kosong.');
        return {
          mode: 'human_led',
          is_ready: false,
          required_inputs,
          missing_required_inputs,
          optional_inputs,
          warnings,
        };
      }

      // Check project isolation
      if (characterDNA.project_id !== canonicalProjectId) {
        missing_required_inputs.push('character');
        warnings.push(
          `Project Isolation Violation: CharacterDNA project ID ("${characterDNA.project_id}") tidak sesuai dengan project aktif ("${canonicalProjectId}").`
        );
        return {
          mode: 'human_led',
          is_ready: false,
          required_inputs,
          missing_required_inputs,
          optional_inputs,
          warnings,
        };
      }

      // Check usable identity and prompt assets
      if (!isUsableCharacterDNA(characterDNA, canonicalProjectId)) {
        missing_required_inputs.push('character');
        warnings.push('CharacterDNA tidak valid: Nama display atau prompt visual character belum lengkap.');
        return {
          mode: 'human_led',
          is_ready: false,
          required_inputs,
          missing_required_inputs,
          optional_inputs,
          warnings,
        };
      }

      return {
        mode: 'human_led',
        is_ready: true,
        required_inputs,
        missing_required_inputs: [],
        optional_inputs,
        warnings: [],
      };
    }

    case 'product_demo': {
      const required_inputs = ['product_name', 'product_screenshot'];
      const optional_inputs = [
        'feature_focus',
        'demo_steps',
        'logo_reference',
        'screen_recording_reference',
      ];
      const missing_required_inputs: string[] = [];
      const warnings: string[] = [];

      if (!productAssetContext || typeof productAssetContext !== 'object') {
        missing_required_inputs.push('product_name', 'product_screenshot');
        warnings.push('Mode Product Demo membutuhkan nama produk dan minimal satu tangkapan layar (screenshot).');
        return {
          mode: 'product_demo',
          is_ready: false,
          required_inputs,
          missing_required_inputs,
          optional_inputs,
          warnings,
        };
      }

      const hasProductName =
        typeof productAssetContext.product_name === 'string' &&
        productAssetContext.product_name.trim().length > 0;

      const validScreenshots = Array.isArray(productAssetContext.screenshots)
        ? productAssetContext.screenshots.filter(isValidProductScreenshotReference)
        : [];

      const hasScreenshot = validScreenshots.length > 0;

      if (!hasProductName) {
        missing_required_inputs.push('product_name');
        warnings.push('Nama produk belum diisi.');
      }

      if (!hasScreenshot) {
        missing_required_inputs.push('product_screenshot');
        warnings.push('Minimal satu tangkapan layar (screenshot) produk wajib disediakan.');
      }

      const isReady = missing_required_inputs.length === 0;

      return {
        mode: 'product_demo',
        is_ready: isReady,
        required_inputs,
        missing_required_inputs,
        optional_inputs,
        warnings,
      };
    }

    case 'motion_explainer': {
      // motion_explainer does not require external uploaded assets
      return {
        mode: 'motion_explainer',
        is_ready: true,
        required_inputs: [],
        missing_required_inputs: [],
        optional_inputs: ['brand_visual', 'diagram_framework', 'data_points'],
        warnings: [],
      };
    }
  }
}
