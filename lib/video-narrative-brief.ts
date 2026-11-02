import { ContentItem } from './content-contract';
import { VideoSceneProductionPlan } from './production-candidate';

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

/** Deliberately conservative: no lexical similarity can prove a paraphrase factual. */
export function matchesVideoNarrativeBrief(brief: ReturnType<typeof buildVideoNarrativeBrief>, script: unknown, caption: unknown): boolean {
  if (!script || typeof script !== 'object') return false;
  const candidate = script as Record<string, unknown>;
  return Object.entries(brief.script).every(([key, value]) => typeof candidate[key] === 'string' && clean(candidate[key]) === value)
    && typeof caption === 'string' && clean(caption) === brief.caption;
}

/** Planning estimate at 150 words/minute plus one second for a pause; never clip copy. */
export function fitVideoVoiceoverDuration(scenes: VideoSceneProductionPlan[]): VideoSceneProductionPlan[] {
  return scenes.map(scene => ({
    ...scene,
    duration_seconds: Math.max(scene.duration_seconds, Math.ceil(scene.voiceover.trim().split(/\s+/u).filter(Boolean).length / 2.5 + 1)),
  }));
}
