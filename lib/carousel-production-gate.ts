import { ContentItem } from './content-contract';
import { ProductionEngineContext } from './production-engine-context';
import { validateProductionEngineContext } from './production-engine-context';
import {
  ProductionOutputSource,
  isAuthoritativeProductionOutputSource,
} from './production-output-source';
import { CarouselProductionCandidate } from './production-candidate';
import { validateProductionCandidate } from './production-candidate';
import {
  CarouselSlideCompletionState,
  validateCarouselSlideCompletionState,
  areAllCarouselSlidesCreated,
  getCompletedCarouselSlideCount,
} from './carousel-slide-completion';
import { buildCarouselProductionPlanSignature } from './carousel-production-path';

export interface CarouselProductionGateResult {
  is_allowed: boolean;
  blockers: string[];
}

export interface EvaluateCarouselProductionGateParams {
  production_context: ProductionEngineContext | null;
  source_item: ContentItem | null;
  output_source: ProductionOutputSource;
  effective_candidate: CarouselProductionCandidate | null;
  completion_state: CarouselSlideCompletionState | null;
  current_production_plan_signature: string;
}

/**
 * Evaluates the authoritative Carousel Production Gate.
 *
 * Fail-closed pure validation function. Returns is_allowed=true ONLY if:
 * 1. Output source is authoritative (stored_output, generated_output, user_edited_output; not none or initial_draft)
 * 2. Authoritative ProductionEngineContext is valid
 * 3. source_item is authoritative and matches context project & content item identities
 * 4. Effective CarouselProductionCandidate exists and validates as canonical carousel candidate
 * 5. Current production plan signature matches recomputed signature from effective candidate
 * 6. Completion state is valid and matches all canonical identities
 * 7. All N slides are explicitly marked as created (asset_created === true)
 */
export function evaluateCarouselProductionGate(
  params: EvaluateCarouselProductionGateParams
): CarouselProductionGateResult {
  const blockers: string[] = [];

  if (!params || typeof params !== 'object') {
    return {
      is_allowed: false,
      blockers: ['Parameter evaluasi gate tidak valid.'],
    };
  }

  // 1. Authoritative Output Source Check
  if (!isAuthoritativeProductionOutputSource(params.output_source)) {
    blockers.push(
      'Output carousel belum otoritatif (harus stored_output, generated_output, atau user_edited_output; bukan none atau initial_draft).'
    );
  }

  // 2. ProductionEngineContext Check
  if (!params.production_context) {
    blockers.push('ProductionEngineContext belum tersedia.');
  } else {
    const ctxValidation = validateProductionEngineContext(params.production_context);
    if (!ctxValidation.isValid) {
      blockers.push(
        `ProductionEngineContext tidak valid: ${ctxValidation.error || 'Validasi konteks gagal'}.`
      );
    }
  }

  // 3. sourceItem Authority & Strict Project Isolation
  if (!params.source_item || typeof params.source_item !== 'object') {
    blockers.push('source_item tidak valid atau belum tersedia.');
  } else {
    if (
      !params.source_item.content_item_id ||
      typeof params.source_item.content_item_id !== 'string' ||
      params.source_item.content_item_id.trim().length === 0
    ) {
      blockers.push('source_item wajib memiliki content_item_id yang valid.');
    } else if (
      params.production_context?.content_item?.content_item_id &&
      params.source_item.content_item_id !== params.production_context.content_item.content_item_id
    ) {
      blockers.push(
        'source_item content_item_id tidak cocok dengan production_context.content_item.content_item_id.'
      );
    }

    const rawProjectId =
      typeof params.source_item.project_id === 'string'
        ? params.source_item.project_id.trim()
        : '';
    const rawLegacyProjectId =
      typeof params.source_item.projectId === 'string'
        ? params.source_item.projectId.trim()
        : '';

    if (!rawProjectId && !rawLegacyProjectId) {
      blockers.push(
        'source_item wajib memiliki setidaknya satu identitas project (project_id atau projectId) yang valid.'
      );
    } else if (rawProjectId && rawLegacyProjectId && rawProjectId !== rawLegacyProjectId) {
      blockers.push(
        'Identitas project_id dan projectId pada source_item tidak cocok (harus identik jika keduanya ada).'
      );
    } else {
      const sourceItemProjectId = rawProjectId || rawLegacyProjectId;
      if (
        params.production_context &&
        params.production_context.project_id &&
        sourceItemProjectId !== params.production_context.project_id
      ) {
        blockers.push(
          'Identitas project pada source_item tidak cocok dengan production_context.project_id.'
        );
      }
    }
  }

  // 4. Effective Candidate Check
  if (!params.effective_candidate) {
    blockers.push('Effective CarouselProductionCandidate belum tersedia.');
  } else {
    const candValidation = validateProductionCandidate(params.effective_candidate);
    if (!candValidation.isValid) {
      blockers.push(
        `Effective CarouselProductionCandidate tidak valid: ${candValidation.error || 'Schema validation error'}.`
      );
    }
    if (params.effective_candidate.candidate_type !== 'carousel') {
      blockers.push('Tipe candidate bukan carousel.');
    }
    if (
      !params.effective_candidate.candidate_id ||
      typeof params.effective_candidate.candidate_id !== 'string' ||
      params.effective_candidate.candidate_id.trim().length === 0
    ) {
      blockers.push('candidate_id carousel kosong.');
    }
  }

  // 5. Production Plan Signature Check
  if (
    !params.current_production_plan_signature ||
    typeof params.current_production_plan_signature !== 'string' ||
    params.current_production_plan_signature.trim().length === 0
  ) {
    blockers.push(
      'Tanda tangan rencana produksi carousel (production_plan_signature) kosong.'
    );
  } else if (params.effective_candidate) {
    const recomputedSig = buildCarouselProductionPlanSignature(params.effective_candidate);
    if (!recomputedSig || recomputedSig !== params.current_production_plan_signature) {
      blockers.push(
        'Tanda tangan rencana produksi carousel tidak sesuai dengan candidate aktif (terdeteksi perubahan strategi atau karakter).'
      );
    }
  }

  // 6. Completion State Validation
  if (!params.completion_state) {
    blockers.push('Status penyelesaian slide carousel belum tersedia.');
  } else {
    const expected = {
      project_id: params.production_context?.project_id,
      content_item_id: params.source_item?.content_item_id,
      candidate_id: params.effective_candidate?.candidate_id,
      production_plan_signature: params.current_production_plan_signature,
      slide_count: params.effective_candidate?.production_details?.slide_count,
    };

    const compValidation = validateCarouselSlideCompletionState(
      params.completion_state,
      expected
    );

    if (!compValidation.isValid) {
      blockers.push(
        `Status penyelesaian slide tidak valid: ${compValidation.error || 'Validasi completion gagal'}.`
      );
    } else {
      // 7. All Slides Created Check
      const allCreated = areAllCarouselSlidesCreated(params.completion_state);
      if (!allCreated) {
        const completed = getCompletedCarouselSlideCount(params.completion_state);
        const total = params.completion_state.slide_count;
        blockers.push(
          `Slide carousel belum lengkap dibuat (${completed}/${total} slide selesai). Semua slide harus ditandai selesai dibuat sebelum menyiapkan paket produksi.`
        );
      }
    }
  }

  return {
    is_allowed: blockers.length === 0,
    blockers,
  };
}
