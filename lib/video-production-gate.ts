import {
  ProductionEngineContext,
  validateProductionEngineContext,
} from './production-engine-context';
import { ContentItem } from './content-contract';
import {
  ProductionOutputSource,
  isAuthoritativeProductionOutputSource,
} from './production-output-source';
import {
  VideoProductionMode,
  VideoProductionCandidate,
  validateProductionCandidate,
} from './production-candidate';
import { VideoProductionReadiness } from './video-production-readiness';
import {
  VideoSceneCompletionState,
  buildVideoScenePlanSignature,
  validateVideoSceneCompletionState,
  areAllVideoScenesCreated,
} from './video-scene-completion';

export interface VideoProductionGateResult {
  is_allowed: boolean;
  blockers: string[];
}

export interface EvaluateVideoProductionGateParams {
  production_context: ProductionEngineContext | null;
  source_item: ContentItem | null;
  output_source: ProductionOutputSource;
  selected_mode: VideoProductionMode | null;
  selected_candidate: VideoProductionCandidate | null;
  readiness: VideoProductionReadiness | null;
  completion_state: VideoSceneCompletionState | null;
  current_scene_plan_signature: string;
  current_production_input_signature: string;
}

const VALID_VIDEO_PRODUCTION_MODES: readonly VideoProductionMode[] = [
  'human_led',
  'product_demo',
  'motion_explainer',
];

/**
 * Pure, deterministic evaluation of the Video Production Gate (Phase 3D-C).
 *
 * Requirements:
 * 1. Output source must be authoritative (stored_output, generated_output, user_edited_output).
 * 2. ProductionEngineContext must exist and pass strict validation.
 * 3. source_item must exist, have valid content_item_id, and match production_context.content_item.content_item_id.
 * 4. selected_mode must be one of 'human_led', 'product_demo', 'motion_explainer'.
 * 5. selected_candidate must exist, validate, be candidate_type 'video', and match selected_mode.
 * 6. readiness must be strictly is_ready === true and match selected_mode.
 * 7. current_scene_plan_signature must be non-empty and match recomputed signature of selected_candidate.
 * 8. current_production_input_signature must be non-empty.
 * 9. completion_state must exist and validate against expected identity and both signatures.
 * 10. All 3 scenes must have clip_created === true.
 *
 * FAIL CLOSED: Returns is_allowed === false and explicit blockers if ANY requirement fails.
 */
export function evaluateVideoProductionGate(
  params: EvaluateVideoProductionGateParams
): VideoProductionGateResult {
  const blockers: string[] = [];

  // 1. Authoritative Output Source
  if (!isAuthoritativeProductionOutputSource(params.output_source)) {
    blockers.push('Output video belum memiliki sumber otoritatif (bukan draft awal atau kosong).');
  }

  // 2. Production Engine Context
  let isContextValid = false;
  if (!params.production_context) {
    blockers.push('ProductionEngineContext wajib tersedia.');
  } else {
    const contextValidation = validateProductionEngineContext(params.production_context);
    if (!contextValidation.isValid) {
      blockers.push(contextValidation.error || 'ProductionEngineContext tidak valid.');
    } else {
      isContextValid = true;
    }
  }

  // 3. Authoritative sourceItem & Strict Project Isolation
  const authoritativeContentItemId =
    typeof params.source_item?.content_item_id === 'string'
      ? params.source_item.content_item_id.trim()
      : '';

  const rawProjectId =
    typeof params.source_item?.project_id === 'string'
      ? params.source_item.project_id.trim()
      : '';
  const rawLegacyProjectId =
    typeof params.source_item?.projectId === 'string'
      ? params.source_item.projectId.trim()
      : '';

  let sourceItemProjectId = '';
  let isSourceItemValid = false;

  if (!params.source_item) {
    blockers.push('source_item wajib tersedia.');
  } else {
    let hasContentId = false;
    if (!authoritativeContentItemId) {
      blockers.push('source_item wajib memiliki content_item_id yang valid.');
    } else {
      hasContentId = true;
    }

    let hasProjectIdentity = false;
    if (!rawProjectId && !rawLegacyProjectId) {
      blockers.push(
        'source_item wajib memiliki setidaknya satu identitas project (project_id atau projectId) yang valid.'
      );
    } else if (rawProjectId && rawLegacyProjectId && rawProjectId !== rawLegacyProjectId) {
      blockers.push(
        'Identitas project_id dan projectId pada source_item tidak cocok (harus identik jika keduanya ada).'
      );
    } else {
      sourceItemProjectId = rawProjectId || rawLegacyProjectId;
      hasProjectIdentity = true;
    }

    let matchesContextProject = true;
    let matchesContextItem = true;

    if (params.production_context) {
      if (hasProjectIdentity && sourceItemProjectId !== params.production_context.project_id) {
        matchesContextProject = false;
        blockers.push(
          'Identitas project pada source_item tidak cocok dengan production_context.project_id.'
        );
      }
      if (
        hasContentId &&
        params.production_context.content_item &&
        params.production_context.content_item.content_item_id !== authoritativeContentItemId
      ) {
        matchesContextItem = false;
        blockers.push(
          'Identitas source_item.content_item_id tidak cocok dengan content_item pada ProductionEngineContext.'
        );
      }
    }

    if (hasContentId && hasProjectIdentity && matchesContextProject && matchesContextItem) {
      isSourceItemValid = true;
    }
  }

  // 4. Selected Mode
  const isSelectedModeValid =
    !!params.selected_mode && VALID_VIDEO_PRODUCTION_MODES.includes(params.selected_mode);
  if (!isSelectedModeValid) {
    blockers.push(
      'Mode produksi video yang dipilih tidak valid (harus human_led, product_demo, atau motion_explainer).'
    );
  }

  // 5. Exact Canonical Candidate
  let isCandidateValid = false;
  if (!params.selected_candidate) {
    blockers.push('Candidate produksi video yang dipilih wajib tersedia.');
  } else {
    const candidateValidation = validateProductionCandidate(params.selected_candidate);
    if (!candidateValidation.isValid) {
      blockers.push(candidateValidation.error || 'Candidate produksi video tidak valid.');
    } else {
      if (params.selected_candidate.candidate_type !== 'video') {
        blockers.push('Candidate produksi yang dipilih harus bertipe video.');
      } else {
        isCandidateValid = true;
      }

      if (
        params.selected_mode &&
        params.selected_candidate.production_details?.production_mode !== params.selected_mode
      ) {
        blockers.push(
          `Mode pada candidate ("${params.selected_candidate.production_details?.production_mode}") tidak cocok dengan mode yang dipilih ("${params.selected_mode}").`
        );
      }
    }
  }

  // 6. Video Readiness
  if (!params.readiness) {
    blockers.push('Status kesiapan produksi video (readiness) belum tersedia.');
  } else {
    if (params.readiness.is_ready !== true) {
      blockers.push('Status kesiapan produksi video belum terpenuhi (is_ready bernilai false).');
    }
    if (params.selected_mode && params.readiness.mode !== params.selected_mode) {
      blockers.push(
        `Mode pada kesiapan produksi ("${params.readiness.mode}") tidak cocok dengan mode yang dipilih ("${params.selected_mode}").`
      );
    }
  }

  // 7. Current Scene Signature
  const isSceneSignatureProvided =
    typeof params.current_scene_plan_signature === 'string' &&
    params.current_scene_plan_signature.trim().length > 0;

  if (!isSceneSignatureProvided) {
    blockers.push('Signature scene plan saat ini wajib tersedia dan tidak boleh kosong.');
  } else if (params.selected_candidate && isCandidateValid) {
    const recomputed = buildVideoScenePlanSignature(params.selected_candidate);
    if (recomputed !== params.current_scene_plan_signature) {
      blockers.push(
        'Signature scene plan saat ini tidak cocok dengan recomputed signature dari candidate video yang dipilih.'
      );
    }
  }

  // 8. Current Production Input Signature
  const isInputSignatureProvided =
    typeof params.current_production_input_signature === 'string' &&
    params.current_production_input_signature.trim().length > 0;

  if (!isInputSignatureProvided) {
    blockers.push('Signature input produksi saat ini wajib tersedia dan tidak boleh kosong.');
  }

  // 9. Completion State Validation
  if (!params.completion_state) {
    blockers.push('State penyelesaian scene video (completion_state) belum tersedia.');
  } else {
    if (
      isContextValid &&
      params.production_context &&
      isSourceItemValid &&
      params.source_item &&
      isSelectedModeValid &&
      params.selected_mode &&
      isSceneSignatureProvided &&
      isInputSignatureProvided
    ) {
      const expected = {
        project_id: params.production_context.project_id,
        content_item_id: authoritativeContentItemId,
        production_mode: params.selected_mode,
        scene_plan_signature: params.current_scene_plan_signature,
        production_input_signature: params.current_production_input_signature,
      };

      const completionValidation = validateVideoSceneCompletionState(
        params.completion_state,
        expected
      );

      if (!completionValidation.isValid) {
        blockers.push(
          completionValidation.error ||
            'State penyelesaian scene video tidak valid terhadap konteks dan signature saat ini.'
        );
      }
    } else {
      blockers.push(
        'State penyelesaian scene video tidak dapat divalidasi karena prasyarat konteks atau signature belum valid.'
      );
    }
  }

  // 10. Real 3/3 Completion
  if (!areAllVideoScenesCreated(params.completion_state)) {
    blockers.push(
      'Belum semua scene (3/3) selesai dibuat (clip_created harus bernilai true untuk semua scene).'
    );
  }

  return {
    is_allowed: blockers.length === 0,
    blockers,
  };
}
