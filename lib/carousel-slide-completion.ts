export interface CarouselSlideCompletionEntry {
  slide_number: number;
  asset_created: boolean;
  marked_at: string | null;
}

export interface CarouselSlideCompletionState {
  project_id: string;
  content_item_id: string;
  candidate_id: string;
  production_plan_signature: string;
  slide_count: number;
  slides: CarouselSlideCompletionEntry[];
  updated_at: string;
}

export interface CarouselSlideCompletionValidationResult {
  isValid: boolean;
  error?: string;
}

export interface CarouselSlideCompletionExpected {
  project_id?: string;
  content_item_id?: string;
  candidate_id?: string;
  production_plan_signature?: string;
  slide_count?: number;
}

/**
 * Storage key helper for carousel slide completion persistence.
 */
export function getCarouselSlideCompletionStorageKey(
  content_item_id: string,
  candidate_id: string
): string {
  return `studio_carousel_slide_completion_${content_item_id}_${candidate_id}`;
}

/**
 * Creates an initial empty slide completion state for dynamic N slides.
 */
export function createEmptyCarouselSlideCompletionState(
  project_id: string,
  content_item_id: string,
  candidate_id: string,
  production_plan_signature: string,
  slide_count: number
): CarouselSlideCompletionState {
  const slides: CarouselSlideCompletionEntry[] = [];
  for (let i = 1; i <= slide_count; i++) {
    slides.push({
      slide_number: i,
      asset_created: false,
      marked_at: null,
    });
  }

  return {
    project_id,
    content_item_id,
    candidate_id,
    production_plan_signature,
    slide_count,
    slides,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Validates CarouselSlideCompletionState strictly and fail-closed.
 */
export function validateCarouselSlideCompletionState(
  state: unknown,
  expected?: CarouselSlideCompletionExpected
): CarouselSlideCompletionValidationResult {
  if (!state || typeof state !== 'object') {
    return { isValid: false, error: 'CarouselSlideCompletionState must be a non-null object' };
  }

  const s = state as Record<string, unknown>;

  if (typeof s.project_id !== 'string' || s.project_id.trim().length === 0) {
    return { isValid: false, error: 'project_id must be a non-empty string' };
  }

  if (typeof s.content_item_id !== 'string' || s.content_item_id.trim().length === 0) {
    return { isValid: false, error: 'content_item_id must be a non-empty string' };
  }

  if (typeof s.candidate_id !== 'string' || s.candidate_id.trim().length === 0) {
    return { isValid: false, error: 'candidate_id must be a non-empty string' };
  }

  if (
    typeof s.production_plan_signature !== 'string' ||
    s.production_plan_signature.trim().length === 0
  ) {
    return { isValid: false, error: 'production_plan_signature must be a non-empty string' };
  }

  if (
    typeof s.slide_count !== 'number' ||
    !Number.isInteger(s.slide_count) ||
    s.slide_count <= 0
  ) {
    return { isValid: false, error: 'slide_count must be a positive integer' };
  }

  if (typeof s.updated_at !== 'string' || s.updated_at.trim().length === 0) {
    return { isValid: false, error: 'updated_at must be a non-empty string' };
  }

  if (!Array.isArray(s.slides) || s.slides.length !== s.slide_count) {
    return {
      isValid: false,
      error: `slides array length (${Array.isArray(s.slides) ? s.slides.length : 0}) does not match slide_count (${s.slide_count})`,
    };
  }

  const seenSlideNumbers = new Set<number>();
  for (let i = 0; i < s.slides.length; i++) {
    const entry = s.slides[i] as Record<string, unknown>;
    if (!entry || typeof entry !== 'object') {
      return { isValid: false, error: `Slide entry at index ${i} is not a valid object` };
    }

    if (
      typeof entry.slide_number !== 'number' ||
      !Number.isInteger(entry.slide_number) ||
      entry.slide_number < 1 ||
      entry.slide_number > s.slide_count
    ) {
      return {
        isValid: false,
        error: `Slide at index ${i} has invalid slide_number ${entry.slide_number}`,
      };
    }

    if (seenSlideNumbers.has(entry.slide_number)) {
      return {
        isValid: false,
        error: `Duplicate slide_number detected: ${entry.slide_number}`,
      };
    }
    seenSlideNumbers.add(entry.slide_number);

    if (typeof entry.asset_created !== 'boolean') {
      return {
        isValid: false,
        error: `Slide ${entry.slide_number} has invalid asset_created boolean`,
      };
    }

    if (entry.asset_created === true) {
      if (typeof entry.marked_at !== 'string' || entry.marked_at.trim().length === 0) {
        return {
          isValid: false,
          error: `Slide ${entry.slide_number} has asset_created=true but missing or empty marked_at string`,
        };
      }
    } else {
      if (entry.marked_at !== null) {
        return {
          isValid: false,
          error: `Slide ${entry.slide_number} has asset_created=false but non-null marked_at`,
        };
      }
    }
  }

  // Verify all slide numbers from 1 to slide_count exist
  for (let i = 1; i <= s.slide_count; i++) {
    if (!seenSlideNumbers.has(i)) {
      return {
        isValid: false,
        error: `Missing slide_number ${i} in slides array`,
      };
    }
  }

  // Verify against expected identities if supplied
  if (expected) {
    if (expected.project_id && s.project_id !== expected.project_id) {
      return {
        isValid: false,
        error: `project_id mismatch: state=${s.project_id} expected=${expected.project_id}`,
      };
    }
    if (expected.content_item_id && s.content_item_id !== expected.content_item_id) {
      return {
        isValid: false,
        error: `content_item_id mismatch: state=${s.content_item_id} expected=${expected.content_item_id}`,
      };
    }
    if (expected.candidate_id && s.candidate_id !== expected.candidate_id) {
      return {
        isValid: false,
        error: `candidate_id mismatch: state=${s.candidate_id} expected=${expected.candidate_id}`,
      };
    }
    if (
      expected.production_plan_signature &&
      s.production_plan_signature !== expected.production_plan_signature
    ) {
      return {
        isValid: false,
        error: `production_plan_signature mismatch: state=${s.production_plan_signature} expected=${expected.production_plan_signature}`,
      };
    }
    if (
      expected.slide_count !== undefined &&
      s.slide_count !== expected.slide_count
    ) {
      return {
        isValid: false,
        error: `slide_count mismatch: state=${s.slide_count} expected=${expected.slide_count}`,
      };
    }
  }

  return { isValid: true };
}

/**
 * Pure state transition helper to mark or unmark a slide as created.
 */
export function setCarouselSlideAssetCreated(
  currentState: CarouselSlideCompletionState,
  slide_number: number,
  asset_created: boolean
): CarouselSlideCompletionState {
  const nextSlides: CarouselSlideCompletionEntry[] = currentState.slides.map((s) => {
    if (s.slide_number === slide_number) {
      return {
        slide_number: s.slide_number,
        asset_created,
        marked_at: asset_created ? new Date().toISOString() : null,
      };
    }
    return {
      slide_number: s.slide_number,
      asset_created: s.asset_created,
      marked_at: s.marked_at,
    };
  });

  return {
    project_id: currentState.project_id,
    content_item_id: currentState.content_item_id,
    candidate_id: currentState.candidate_id,
    production_plan_signature: currentState.production_plan_signature,
    slide_count: currentState.slide_count,
    slides: nextSlides,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Returns the count of slides with asset_created === true.
 */
export function getCompletedCarouselSlideCount(
  state: CarouselSlideCompletionState | null | undefined
): number {
  if (!state || !Array.isArray(state.slides)) return 0;
  return state.slides.filter((s) => s.asset_created === true).length;
}

/**
 * Checks if all slides in the completion state have asset_created === true.
 */
export function areAllCarouselSlidesCreated(
  state: CarouselSlideCompletionState | null | undefined
): boolean {
  if (!state) return false;
  const validation = validateCarouselSlideCompletionState(state);
  if (!validation.isValid) return false;
  return (
    state.slide_count > 0 &&
    state.slides.length === state.slide_count &&
    state.slides.every((s) => s.asset_created === true)
  );
}

/**
 * Checks if a specific slide is marked as asset_created === true.
 */
export function isCarouselSlideAssetCreated(
  state: CarouselSlideCompletionState | null | undefined,
  slide_number: number
): boolean {
  if (!state || !Array.isArray(state.slides)) return false;
  const entry = state.slides.find((s) => s.slide_number === slide_number);
  return Boolean(entry?.asset_created);
}

/**
 * Gets the completion entry for a specific slide number.
 */
export function getCarouselSlideCompletionEntry(
  state: CarouselSlideCompletionState | null | undefined,
  slide_number: number
): CarouselSlideCompletionEntry | null {
  if (!state || !Array.isArray(state.slides)) return null;
  return state.slides.find((s) => s.slide_number === slide_number) || null;
}
