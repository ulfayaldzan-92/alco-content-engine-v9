import {
  SharedContentContext,
  ContentItem,
  CharacterDNA,
} from './content-contract';
import {
  FunnelStrategy,
  validateFunnelStrategyProjectIsolation,
  validateItemAgainstFunnelStrategy,
} from './funnel-strategy';
import { parseStrictFunnelStage, FunnelStage } from './funnel-rules';

export interface ProductionEngineContext {
  project_id: string;

  shared_context: SharedContentContext;
  funnel_strategy: FunnelStrategy;
  content_item: ContentItem;

  canonical_funnel_stage: FunnelStage;
  character_dna?: CharacterDNA | null;
}

export interface ProductionEngineContextValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates a ProductionEngineContext against all canonical authority and project isolation rules.
 * 
 * STRICT AUTHORITY RULES:
 * 1. ROOT PROJECT ID: Must be a non-empty string.
 * 2. SHARED CONTENT CONTEXT: Must exist, be an object, and shared_context.project_id === context.project_id.
 * 3. FUNNEL STRATEGY: Must exist, be an object, funnel_strategy.project_id === context.project_id,
 *    and funnel_strategy.provenance.source_project_id === context.project_id.
 *    Reuses validateFunnelStrategyProjectIsolation().
 * 4. CONTENT ITEM: Must exist, content_item.content_item_id non-empty string.
 *    Project identity: if project_id exists -> === context.project_id;
 *    if projectId exists -> === context.project_id;
 *    At least one must exist; if both exist, both must match.
 * 5. CANONICAL FUNNEL STAGE: Exact 'TOFU' | 'MOFU' | 'BOFU'.
 *    Must match parseStrictFunnelStage(content_item.jenis) exactly.
 * 6. CHARACTER DNA: Optional, but if present, character_dna.project_id === context.project_id.
 * 7. FUNNEL STRATEGY vs CONTENT ITEM: validateItemAgainstFunnelStrategy() must pass.
 * 
 * FAIL-CLOSED: Does not mutate, repair, normalize, or fabricate IDs.
 */
export function validateProductionEngineContext(
  context: unknown
): ProductionEngineContextValidationResult {
  if (!context || typeof context !== 'object') {
    return {
      isValid: false,
      error: 'ProductionEngineContext wajib tersedia dan berupa object (FAIL CLOSED).',
    };
  }

  const ctx = context as Record<string, any>;

  // 1. ROOT PROJECT ID
  if (typeof ctx.project_id !== 'string' || !ctx.project_id || !ctx.project_id.trim()) {
    return {
      isValid: false,
      error: 'ProductionEngineContext.project_id wajib berupa non-empty string (FAIL CLOSED).',
    };
  }
  const rootProjectId = ctx.project_id;

  // 2. SHARED CONTENT CONTEXT
  if (!ctx.shared_context || typeof ctx.shared_context !== 'object') {
    return {
      isValid: false,
      error: 'ProductionEngineContext.shared_context wajib tersedia dan berupa object (FAIL CLOSED).',
    };
  }
  if (
    typeof ctx.shared_context.project_id !== 'string' ||
    ctx.shared_context.project_id !== rootProjectId
  ) {
    return {
      isValid: false,
      error: `Project Identity Mismatch: SharedContentContext.project_id ("${ctx.shared_context.project_id}") tidak cocok dengan root project ID ("${rootProjectId}") (FAIL CLOSED).`,
    };
  }

  // 3. FUNNEL STRATEGY
  if (!ctx.funnel_strategy || typeof ctx.funnel_strategy !== 'object') {
    return {
      isValid: false,
      error: 'ProductionEngineContext.funnel_strategy wajib tersedia dan berupa object (FAIL CLOSED).',
    };
  }

  const isolationCheck = validateFunnelStrategyProjectIsolation(ctx.funnel_strategy, rootProjectId);
  if (!isolationCheck.isValid) {
    return {
      isValid: false,
      error: isolationCheck.error || `FunnelStrategy project isolation violation against project "${rootProjectId}" (FAIL CLOSED).`,
    };
  }

  if (
    !ctx.funnel_strategy.provenance ||
    typeof ctx.funnel_strategy.provenance !== 'object' ||
    typeof ctx.funnel_strategy.provenance.source_project_id !== 'string' ||
    ctx.funnel_strategy.provenance.source_project_id !== rootProjectId
  ) {
    return {
      isValid: false,
      error: `Project Identity Mismatch: FunnelStrategy.provenance.source_project_id ("${ctx.funnel_strategy.provenance?.source_project_id}") tidak cocok dengan root project ID ("${rootProjectId}") (FAIL CLOSED).`,
    };
  }

  // 4. CONTENT ITEM
  if (!ctx.content_item || typeof ctx.content_item !== 'object') {
    return {
      isValid: false,
      error: 'ProductionEngineContext.content_item wajib tersedia dan berupa object (FAIL CLOSED).',
    };
  }

  const contentItem = ctx.content_item;
  if (
    typeof contentItem.content_item_id !== 'string' ||
    !contentItem.content_item_id ||
    !contentItem.content_item_id.trim()
  ) {
    return {
      isValid: false,
      error: 'ContentItem wajib memiliki content_item_id non-empty string (FAIL CLOSED).',
    };
  }

  const hasSnakeProjectId = 'project_id' in contentItem && contentItem.project_id !== undefined && contentItem.project_id !== null;
  const hasCamelProjectId = 'projectId' in contentItem && contentItem.projectId !== undefined && contentItem.projectId !== null;

  if (!hasSnakeProjectId && !hasCamelProjectId) {
    return {
      isValid: false,
      error: 'ContentItem wajib memiliki setidaknya satu project identity (project_id atau projectId) yang authoritative (FAIL CLOSED).',
    };
  }

  if (hasSnakeProjectId) {
    if (typeof contentItem.project_id !== 'string' || contentItem.project_id !== rootProjectId) {
      return {
        isValid: false,
        error: `Project Identity Mismatch: ContentItem.project_id ("${contentItem.project_id}") tidak cocok dengan root project ID ("${rootProjectId}") (FAIL CLOSED).`,
      };
    }
  }

  if (hasCamelProjectId) {
    if (typeof contentItem.projectId !== 'string' || contentItem.projectId !== rootProjectId) {
      return {
        isValid: false,
        error: `Project Identity Mismatch: ContentItem.projectId ("${contentItem.projectId}") tidak cocok dengan root project ID ("${rootProjectId}") (FAIL CLOSED).`,
      };
    }
  }

  // 5. CANONICAL FUNNEL STAGE
  const canonicalStage = ctx.canonical_funnel_stage;
  const allowedStages: FunnelStage[] = ['TOFU', 'MOFU', 'BOFU'];
  if (typeof canonicalStage !== 'string' || !allowedStages.includes(canonicalStage as FunnelStage)) {
    return {
      isValid: false,
      error: `canonical_funnel_stage ("${canonicalStage}") tidak valid. Wajib salah satu dari nilai exact: 'TOFU', 'MOFU', atau 'BOFU' (FAIL CLOSED).`,
    };
  }

  const parsedItemStage = parseStrictFunnelStage(contentItem.jenis);
  if (!parsedItemStage) {
    return {
      isValid: false,
      error: `ContentItem.jenis ("${contentItem.jenis}") tidak dapat diurai secara strict menjadi FunnelStage (FAIL CLOSED).`,
    };
  }

  if (parsedItemStage !== canonicalStage) {
    return {
      isValid: false,
      error: `Canonical Stage Mismatch: canonical_funnel_stage ("${canonicalStage}") tidak cocok dengan ContentItem.jenis yang diurai ("${parsedItemStage}") (FAIL CLOSED).`,
    };
  }

  // 6. CHARACTER DNA (Optional, but project-isolated)
  if (ctx.character_dna !== undefined && ctx.character_dna !== null) {
    if (typeof ctx.character_dna !== 'object') {
      return {
        isValid: false,
        error: 'CharacterDNA harus berupa object jika disertakan (FAIL CLOSED).',
      };
    }
    if (
      typeof ctx.character_dna.project_id !== 'string' ||
      ctx.character_dna.project_id !== rootProjectId
    ) {
      return {
        isValid: false,
        error: `Project Isolation Violation: CharacterDNA.project_id ("${ctx.character_dna.project_id}") tidak cocok dengan root project ID ("${rootProjectId}") (FAIL CLOSED).`,
      };
    }
  }

  // 7. FUNNEL STRATEGY vs CONTENT ITEM
  const strategyValidation = validateItemAgainstFunnelStrategy(contentItem, ctx.funnel_strategy);
  if (!strategyValidation.isValid) {
    return {
      isValid: false,
      error: `ContentItem tidak sesuai dengan authoritative FunnelStrategy: ${strategyValidation.violations.join('; ')} (FAIL CLOSED).`,
    };
  }

  return {
    isValid: true,
  };
}

export interface BuildProductionEngineContextResult {
  isValid: boolean;
  context?: ProductionEngineContext;
  error?: string;
}

/**
 * Builds the canonical, authoritative ProductionEngineContext.
 * FAIL-CLOSED: Rejects immediately if project identity mismatches,
 * content item ID is missing, funnel stage is non-canonical,
 * strategy is missing/mismatched, or CharacterDNA belongs to another project.
 * 
 * STRICT RULES:
 * - NO automatic ID fabrication (e.g. item_${projectId}_${no}).
 * - NO silent project relabeling.
 * - NO silent funnel stage normalization (parseStrictFunnelStage only).
 * - NO format invented (no format || 'Single').
 * - NO auto-derivation of FunnelStrategy at the gate.
 */
export function buildProductionEngineContext(
  canonicalProjectId: string | null | undefined,
  sharedContext: SharedContentContext | null | undefined,
  funnelStrategy: FunnelStrategy | null | undefined,
  contentItem: ContentItem | null | undefined,
  characterDNA?: CharacterDNA | null | undefined
): BuildProductionEngineContextResult {
  // 1. Canonical Project ID must be non-empty string
  if (!canonicalProjectId || typeof canonicalProjectId !== 'string' || !canonicalProjectId.trim()) {
    return {
      isValid: false,
      error: 'Project ID tidak ditemukan atau kosong. Canonical project ID wajib diisi.',
    };
  }
  const cleanProjectId = canonicalProjectId.trim();

  // 2. SharedContentContext must exist and match canonicalProjectId
  if (!sharedContext || typeof sharedContext !== 'object') {
    return {
      isValid: false,
      error: 'SharedContentContext belum tersedia untuk project ini. Lengkapi data strategi terlebih dahulu.',
    };
  }

  if (!sharedContext.project_id || typeof sharedContext.project_id !== 'string' || !sharedContext.project_id.trim()) {
    return {
      isValid: false,
      error: 'SharedContentContext.project_id kosong atau tidak valid.',
    };
  }

  if (sharedContext.project_id !== cleanProjectId) {
    return {
      isValid: false,
      error: `Project Identity Mismatch: SharedContentContext.project_id ("${sharedContext.project_id}") berbeda dari canonical project ID ("${cleanProjectId}").`,
    };
  }

  if (sharedContext.system_flags?.is_complete_for_planning === false) {
    const missing = sharedContext.system_flags.missing_required_fields || [];
    return {
      isValid: false,
      error: `Data strategi project belum lengkap (${missing.join(', ')}). Lengkapi data di Strategy Intake sebelum melanjutkan produksi.`,
    };
  }

  if (!sharedContext.brand_context?.brand_name?.trim()) {
    return {
      isValid: false,
      error: 'Nama brand pada strategi project kosong. Lengkapi data brand terlebih dahulu.',
    };
  }

  // 3. FunnelStrategy must exist, be authoritative, and match canonicalProjectId & provenance
  if (!funnelStrategy || typeof funnelStrategy !== 'object') {
    return {
      isValid: false,
      error: 'FunnelStrategy wajib tersedia secara authoritative. Production gate dilarang auto-derive generic funnel strategy.',
    };
  }

  const isolationCheck = validateFunnelStrategyProjectIsolation(funnelStrategy, cleanProjectId);
  if (!isolationCheck.isValid) {
    return {
      isValid: false,
      error: isolationCheck.error || 'FunnelStrategy project isolation violation.',
    };
  }

  // Provenance check: provenance.source_project_id must match cleanProjectId
  if (!funnelStrategy.provenance?.source_project_id || funnelStrategy.provenance.source_project_id !== cleanProjectId) {
    return {
      isValid: false,
      error: `Project Identity Mismatch: FunnelStrategy.provenance.source_project_id ("${funnelStrategy.provenance?.source_project_id}") berbeda dari canonical project ID ("${cleanProjectId}").`,
    };
  }

  // 4. ContentItem must exist
  if (!contentItem || typeof contentItem !== 'object') {
    return {
      isValid: false,
      error: 'ContentItem belum dipilih atau tidak valid.',
    };
  }

  // ContentItem project identity must match canonicalProjectId
  // Check both project_id and projectId
  const itemProjectId = contentItem.project_id || contentItem.projectId;
  if (!itemProjectId || typeof itemProjectId !== 'string' || !itemProjectId.trim()) {
    return {
      isValid: false,
      error: 'ContentItem tidak memiliki project_id / projectId authoritative. Silent relabeling dilarang.',
    };
  }

  if (itemProjectId !== cleanProjectId) {
    return {
      isValid: false,
      error: `Project Identity Mismatch: ContentItem project ID ("${itemProjectId}") berbeda dari canonical project ID ("${cleanProjectId}"). Cross-project item leakage diblokir.`,
    };
  }

  // If both exist, neither should conflict with canonicalProjectId
  if (contentItem.project_id && contentItem.project_id !== cleanProjectId) {
    return {
      isValid: false,
      error: `Project Identity Mismatch: ContentItem.project_id ("${contentItem.project_id}") tidak cocok dengan canonical project ID ("${cleanProjectId}").`,
    };
  }
  if (contentItem.projectId && contentItem.projectId !== cleanProjectId) {
    return {
      isValid: false,
      error: `Project Identity Mismatch: ContentItem.projectId ("${contentItem.projectId}") tidak cocok dengan canonical project ID ("${cleanProjectId}").`,
    };
  }

  // 5. ContentItem content_item_id MUST be authoritative and non-empty string
  // DILARANG membuat ID baru di production gate (tidak boleh item_${projectId}_${no}, tidak boleh random ID)
  if (!contentItem.content_item_id || typeof contentItem.content_item_id !== 'string' || !contentItem.content_item_id.trim()) {
    return {
      isValid: false,
      error: 'ContentItem wajib memiliki content_item_id authoritative non-empty string. Pembuatan ID baru di production gate dilarang.',
    };
  }

  // 6. Strict Funnel Stage parsing (parseStrictFunnelStage ONLY, do NOT use normalizeFunnelStage)
  const parsedStage = parseStrictFunnelStage(contentItem.jenis);
  if (!parsedStage) {
    return {
      isValid: false,
      error: `ContentItem funnel stage "${contentItem.jenis || ''}" tidak valid. Wajib salah satu dari canonical stage: TOFU, MOFU, atau BOFU. Normalisasi permisif dinonaktifkan.`,
    };
  }

  // 7. Validate ContentItem against FunnelStrategy
  const strategyValidation = validateItemAgainstFunnelStrategy(contentItem, funnelStrategy);
  if (!strategyValidation.isValid) {
    return {
      isValid: false,
      error: `ContentItem tidak sesuai dengan authoritative FunnelStrategy: ${strategyValidation.violations.join('; ')}`,
    };
  }

  // 8. Format check: do not invent 'Single' if empty. Preserve or reject if required
  // If format is present and non-empty, it must be string
  if (contentItem.format !== undefined && contentItem.format !== null && typeof contentItem.format !== 'string') {
    return {
      isValid: false,
      error: 'ContentItem.format tidak valid (harus bertipe string).',
    };
  }

  // 9. CharacterDNA check: optional, but project-scoped
  let resolvedCharacterDNA: CharacterDNA | null = null;
  if (characterDNA !== undefined && characterDNA !== null) {
    if (!characterDNA.project_id || characterDNA.project_id !== cleanProjectId) {
      return {
        isValid: false,
        error: `Project Isolation Violation: CharacterDNA.project_id ("${characterDNA.project_id}") tidak cocok dengan canonical project ID ("${cleanProjectId}"). Menggunakan persona project lain atau generic persona dilarang.`,
      };
    }
    resolvedCharacterDNA = characterDNA;
  }

  const context: ProductionEngineContext = {
    project_id: cleanProjectId,
    shared_context: sharedContext,
    funnel_strategy: funnelStrategy,
    content_item: contentItem,
    canonical_funnel_stage: parsedStage,
    character_dna: resolvedCharacterDNA,
  };

  // Run canonical authority validator on the constructed context
  const validation = validateProductionEngineContext(context);
  if (!validation.isValid) {
    return {
      isValid: false,
      error: validation.error || 'ProductionEngineContext authority validation failed (FAIL CLOSED).',
    };
  }

  return {
    isValid: true,
    context,
  };
}

export interface ResolveProductionTargetOptions {
  calendarItems: ContentItem[];
  contentItemId?: string | null;
  itemNo?: number | string | null;
  hasExplicitContentItemId?: boolean;
  hasExplicitItemNo?: boolean;
  savedSelectedItem?: ContentItem | null;
}

export interface ResolveProductionTargetResult {
  isValid: boolean;
  item?: ContentItem;
  error?: string;
}

/**
 * Resolves the target ContentItem for production strictly.
 * 
 * Rules:
 * 1. If explicit contentItemId is provided:
 *    - If blank or malformed -> FAIL CLOSED (no fallback).
 *    - Must match an item in calendarItems.
 *    - If not found -> FAIL (no fallback to itemNo, saved selected item, or first item).
 * 2. Else if explicit itemNo is provided:
 *    - If not a positive integer (e.g. "abc", "", 0, -1) -> FAIL CLOSED (no fallback).
 *    - Must match an item in calendarItems.
 *    - If not found -> FAIL (no fallback).
 * 3. Only if NO explicit target is specified:
 *    - If savedSelectedItem exists with valid content_item_id:
 *      * Search in active calendarItems.
 *      * If found -> return matching item FROM calendarItems (never return raw saved object).
 *      * If not found -> treat saved state as stale, proceed to first calendar item.
 *    - Fallback to first calendar item (if available).
 *    - Otherwise FAIL.
 * 
 * Never mutates any item.
 */
export function resolveProductionContentItemTarget(
  options: ResolveProductionTargetOptions
): ResolveProductionTargetResult {
  const {
    calendarItems,
    contentItemId,
    itemNo,
    hasExplicitContentItemId,
    hasExplicitItemNo,
    savedSelectedItem,
  } = options;

  if (!Array.isArray(calendarItems)) {
    return {
      isValid: false,
      error: 'Daftar kalender konten tidak valid.',
    };
  }

  // 1. Explicit contentItemId target takes highest precedence
  const isExplicitId = hasExplicitContentItemId ?? (contentItemId !== undefined && contentItemId !== null);
  if (isExplicitId) {
    if (typeof contentItemId !== 'string' || !contentItemId.trim()) {
      return {
        isValid: false,
        error: 'Explicit content_item_id disediakan tetapi kosong atau malformed. Fallback dilarang.',
      };
    }
    const cleanId = contentItemId.trim();
    const found = calendarItems.find((it) => it && it.content_item_id === cleanId);
    if (found) {
      return { isValid: true, item: found };
    }
    return {
      isValid: false,
      error: `Explicit content_item_id "${cleanId}" tidak ditemukan di kalender project. Fallback ke item lain dilarang.`,
    };
  }

  // 2. Explicit itemNo target (only evaluated if contentItemId was not provided)
  const isExplicitNo = hasExplicitItemNo ?? (itemNo !== undefined && itemNo !== null);
  if (isExplicitNo) {
    if (itemNo === null || itemNo === undefined || String(itemNo).trim() === '') {
      return {
        isValid: false,
        error: 'Explicit itemNo disediakan tetapi kosong atau malformed. Fallback dilarang.',
      };
    }
    const strVal = String(itemNo).trim();
    // Validate positive integer string
    if (!/^\d+$/.test(strVal)) {
      return {
        isValid: false,
        error: `Explicit itemNo "${itemNo}" tidak valid (harus positive integer). Fallback dilarang.`,
      };
    }
    const parsedNo = Number(strVal);
    if (parsedNo <= 0 || !Number.isInteger(parsedNo)) {
      return {
        isValid: false,
        error: `Explicit itemNo "${itemNo}" tidak valid (harus positive integer > 0). Fallback dilarang.`,
      };
    }

    const found = calendarItems.find((it) => it && it.no === parsedNo);
    if (found) {
      return { isValid: true, item: found };
    }
    return {
      isValid: false,
      error: `Explicit itemNo "${itemNo}" tidak ditemukan di kalender project. Fallback ke item lain dilarang.`,
    };
  }

  // 3. No explicit target: pointer lookup in active calendarItems via savedSelectedItem
  if (savedSelectedItem && typeof savedSelectedItem === 'object' && savedSelectedItem.content_item_id) {
    const cleanSavedId = savedSelectedItem.content_item_id.trim();
    if (cleanSavedId) {
      const foundInCalendar = calendarItems.find((it) => it && it.content_item_id === cleanSavedId);
      if (foundInCalendar) {
        return {
          isValid: true,
          item: foundInCalendar,
        };
      }
      // If not found in current calendar, treat saved pointer as stale and continue to first calendar item
    }
  }

  if (calendarItems.length > 0 && calendarItems[0]) {
    return {
      isValid: true,
      item: calendarItems[0],
    };
  }

  return {
    isValid: false,
    error: 'Tidak ada item konten di kalender project.',
  };
}
