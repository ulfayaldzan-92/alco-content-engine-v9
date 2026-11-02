import { ContentItem } from './content-contract';
import type { VideoSceneProductionPlan } from './production-candidate';
import { VIDEO_SCENE_SECONDS, validateVideoSceneSpeech } from './video-scene-contract';

const clean = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

/** Calendar copy is the narrative authority; modes change presentation only. */
export function buildVideoNarrativeBrief(item: ContentItem) {
  return {
    script: {
      hook: clean(item.headline),
      masalah: clean(item.body),
      solusi: clean(item.solusi) || clean(item.solution),
      proof: clean(item.proof) || clean(item.proof_data),
      cta: clean(item.cta),
    },
    caption: clean(item.caption),
  };
}

/** Compares authority snapshots only. Never use this to reject spoken paraphrases. */
export function matchesVideoNarrativeBrief(brief: ReturnType<typeof buildVideoNarrativeBrief>, script: unknown, caption: unknown): boolean {
  if (!script || typeof script !== 'object') return false;
  const candidate = script as Record<string, unknown>;
  return Object.entries(brief.script).every(([key, value]) => typeof candidate[key] === 'string' && clean(candidate[key]) === value)
    && typeof caption === 'string' && clean(caption) === brief.caption;
}

export interface VideoSpokenScript { hook: string; insight: string; cta: string }

export function buildSourceVideoSpokenScript(brief: ReturnType<typeof buildVideoNarrativeBrief>): VideoSpokenScript {
  return { hook: brief.script.hook, insight: brief.script.solusi || brief.script.masalah, cta: brief.script.cta };
}

/** Accept creative dialogue for review; identical source copy needs no semantic inference. */
export function assessVideoSpokenScript(brief: ReturnType<typeof buildVideoNarrativeBrief>, value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { isValid: false, requiresReview: false, error: 'Dialog video belum tersedia. Buat ulang dengan hook, insight dan CTA ringkas.' };
  const raw = value as Record<string, unknown>;
  if (!['hook', 'insight', 'cta'].every(key => typeof raw[key] === 'string')) return { isValid: false, requiresReview: false, error: 'Hook, insight dan CTA dialog harus berupa teks.' };
  const spoken: VideoSpokenScript = { hook: clean(raw.hook), insight: clean(raw.insight), cta: clean(raw.cta) };
  if (!spoken.hook || !spoken.insight) return { isValid: false, requiresReview: false, error: 'Hook dan insight harus diisi dari pesan kalender. Jangan menambah solusi yang tidak tersedia.' };
  if (!brief.script.cta && spoken.cta) return { isValid: false, requiresReview: false, error: 'Kalender tidak menyediakan CTA. Kosongkan CTA dialog; jangan membuat ajakan generik.' };
  for (const [index, voiceover] of Object.values(spoken).entries()) {
    const issue = validateVideoSceneSpeech({ duration_seconds: VIDEO_SCENE_SECONDS, voiceover });
    if (issue) return { isValid: false, requiresReview: false, error: `Scene ${index + 1}: ${issue}` };
  }
  const original = buildSourceVideoSpokenScript(brief);
  const normalized = (text: string) => text.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('id');
  const requiresReview = normalized(original.hook) !== normalized(spoken.hook)
    || normalized(original.cta) !== normalized(spoken.cta)
    || ![brief.script.solusi, brief.script.masalah].filter(Boolean).some(text => normalized(text) === normalized(spoken.insight));
  return { isValid: true, requiresReview, spoken, error: requiresReview ? 'Dialog parafrasa memerlukan tinjauan makna terhadap kalender. Produksi diblokir; periksa topik, klaim dan CTA, lalu gunakan dialog dari sumber atau revisi sumber kalender yang sudah ditinjau dan buat ulang.' : undefined };
}

/** Exactly 8 seconds; reject infeasible speech instead of extending or clipping it. */
export function fitVideoVoiceoverDuration(scenes: VideoSceneProductionPlan[]): VideoSceneProductionPlan[] {
  return scenes.map(scene => {
    const fitted = { ...scene, duration_seconds: VIDEO_SCENE_SECONDS };
    const issue = validateVideoSceneSpeech(fitted);
    if (issue) throw new Error(issue);
    return fitted;
  });
}
