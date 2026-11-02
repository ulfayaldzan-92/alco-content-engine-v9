export const VIDEO_SCENE_SECONDS = 8;
export const VIDEO_TOTAL_SECONDS = 24;
export const VIDEO_MAX_SPOKEN_WORDS = 18;

export function validateVideoSceneSpeech(scene: { duration_seconds: number; voiceover: string }): string | null {
  if (scene.duration_seconds !== VIDEO_SCENE_SECONDS) return 'Setiap scene video harus tepat 8 detik; buat ulang rencana lama.';
  if (typeof scene.voiceover !== 'string') return 'Voiceover scene harus berupa teks.';
  const words = scene.voiceover.trim().split(/\s+/u).filter(Boolean).length;
  if (words > VIDEO_MAX_SPOKEN_WORDS) return `Voiceover berisi ${words} kata; batas per scene 8 detik adalah ${VIDEO_MAX_SPOKEN_WORDS} kata. Ringkas dialog tanpa mengubah makna lalu buat ulang. Teks tidak dipotong otomatis.`;
  return null;
}
