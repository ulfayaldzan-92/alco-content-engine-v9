import {
  type ProductionCandidate,
  validateProductionCandidate,
} from './production-candidate';
import type { ProductionAssetInput } from './production-engine';

// ============================================================================
// PRODUCTION CANDIDATE ADAPTER BOUNDARY (PHASE 3C-B)
// Pure boundary for explicitly selecting and adapting validated ProductionCandidate
// into ProductionAssetInput without repair, fallbacks, or package authority fields.
// ============================================================================

export type ProductionCandidateAdapterResult =
  | {
      ok: true;
      assetInput: ProductionAssetInput;
    }
  | {
      ok: false;
      error: string;
    };

/**
 * Validates and converts a single canonical ProductionCandidate to ProductionAssetInput.
 * Strict boundary: returns error on validation failure without attempting repair or fallbacks.
 */
export function adaptProductionCandidateToAssetInput(
  candidate: ProductionCandidate
): ProductionCandidateAdapterResult {
  const validation = validateProductionCandidate(candidate);
  if (!validation.isValid) {
    return {
      ok: false,
      error: validation.error || 'Invalid production candidate',
    };
  }

  if (candidate.candidate_type === 'image') {
    return {
      ok: true,
      assetInput: {
        asset_type: 'image',
        image: candidate.production_details,
        final_prompt: candidate.final_prompt,
      },
    };
  }

  if (candidate.candidate_type === 'carousel') {
    return {
      ok: true,
      assetInput: {
        asset_type: 'carousel',
        carousel: candidate.production_details,
        final_prompts: candidate.final_prompts,
      },
    };
  }

  if (candidate.candidate_type === 'video') {
    return {
      ok: true,
      assetInput: {
        asset_type: 'video',
        video: candidate.production_details,
        final_prompt: candidate.final_prompt,
        execution_prompts: {
          candidate_id: candidate.candidate_id,
          production_mode: candidate.production_details.production_mode,
          scenes: candidate.production_details.scenes.map((s) => ({
            scene_number: s.scene_number as 1 | 2 | 3,
            start_frame_prompt: s.visual_direction,
            motion_prompt: s.action,
            voiceover: s.voiceover,
            on_screen_text: s.on_screen_text,
          })) as [
            {
              scene_number: 1 | 2 | 3;
              start_frame_prompt: string;
              motion_prompt: string;
              voiceover: string;
              on_screen_text: string;
            },
            {
              scene_number: 1 | 2 | 3;
              start_frame_prompt: string;
              motion_prompt: string;
              voiceover: string;
              on_screen_text: string;
            },
            {
              scene_number: 1 | 2 | 3;
              start_frame_prompt: string;
              motion_prompt: string;
              voiceover: string;
              on_screen_text: string;
            }
          ],
        },
      },
    };
  }

  return {
    ok: false,
    error: 'Unsupported candidate type',
  };
}

export type SelectRawCandidateResult =
  | {
      ok: true;
      candidate: ProductionCandidate;
    }
  | {
      ok: false;
      error: string;
    };

/**
 * Validates and selects a candidate by ID from candidates list without premature asset conversion.
 */
export function selectRawProductionCandidate(
  candidates: ProductionCandidate[],
  selectedCandidateId: string
): SelectRawCandidateResult {
  if (!selectedCandidateId || typeof selectedCandidateId !== 'string' || selectedCandidateId.trim().length === 0) {
    return {
      ok: false,
      error: 'Selected candidate ID must be a non-empty string',
    };
  }

  if (!Array.isArray(candidates) || candidates.length === 0) {
    return {
      ok: false,
      error: 'Candidates list must be a non-empty array',
    };
  }

  const cleanSelectedId = selectedCandidateId.trim();

  // Validate candidate object structures and check for duplicate candidate IDs
  const idCounts = new Map<string, number>();
  for (const c of candidates) {
    if (!c || typeof c !== 'object' || typeof c.candidate_id !== 'string') {
      return {
        ok: false,
        error: 'Candidates list contains invalid or malformed candidate object',
      };
    }
    const id = c.candidate_id;
    idCounts.set(id, (idCounts.get(id) || 0) + 1);
  }

  const matchingCandidates = candidates.filter((c) => c.candidate_id === cleanSelectedId);

  if (matchingCandidates.length === 0) {
    return {
      ok: false,
      error: `Selected candidate ID '${cleanSelectedId}' not found in candidates list`,
    };
  }

  for (const [id, count] of idCounts.entries()) {
    if (count > 1) {
      return {
        ok: false,
        error: `Duplicate candidate ID found: '${id}'`,
      };
    }
  }

  return {
    ok: true,
    candidate: matchingCandidates[0],
  };
}

/**
 * Explicitly selects a candidate by ID from candidates array and adapts it to ProductionAssetInput.
 * Strict fail-closed rules:
 * - Empty selectedCandidateId fails
 * - Unknown selectedCandidateId fails
 * - Duplicate candidate IDs in candidates list fail
 * - No fallback to first candidate or default
 */
export function selectProductionCandidate(
  candidates: ProductionCandidate[],
  selectedCandidateId: string
): ProductionCandidateAdapterResult {
  const selection = selectRawProductionCandidate(candidates, selectedCandidateId);
  if (!selection.ok) {
    return {
      ok: false,
      error: selection.error,
    };
  }

  return adaptProductionCandidateToAssetInput(selection.candidate);
}

