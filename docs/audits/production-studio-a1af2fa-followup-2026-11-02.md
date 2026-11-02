# Video and Carousel follow-up — 2 November 2026

Verified checkout HEAD: `a1af2fa7468af28979fa945d915ce8f52b93d6d4`.
Repository: `D:\Repository Github\percobaan 1\alco-content-engine-v9`.
No commit/push, dependency addition, global storage change, license change, Image Production change, or project-data migration was performed. Existing package.json/package-lock.json edits remain untouched.

## Carousel

### Root cause and verification

Commit a1af2fa already removes the raw-plan fallback, checks narrative/visual types, preserves invalid stored records, binds the selected source and Stage 1, and requires explicit review before production. Those boundaries and the two-stage architecture are frozen.

The actual panel is rendered by the regression suite with valid, incomplete, null/undefined and legacy fixtures. Invalid shapes produce an error state. The historical null-slide render crash is reproduced specifically against `0bbf845`, not against the now-fixed HEAD. The historical test previously read Git HEAD, making the test itself fail after the fix was committed; it now pins its intended historical revision.

The precise production error `Cannot read properties of undefined (reading 'includes')` at `page-694b958cc7f2097a.js:1:5271` is still unclosed. The matching bundle/source map and original production data are unavailable. The null-slide reproduction is a different error. There are no `.includes()` calls in CarouselPanel; the shared character-injection helper still has an unguarded string call, but current carousel callers validate their prompts first. No evidence connects that helper to the reported deployment error. Shared Image/character behavior was not changed.

### Data flow and minimal fix

Canonical project/item identities remain owned by ProductionEngineContext. Calendar headline/body/tujuan/CTA/caption/visual direction pass through the existing ProductionContext and the item-specific narrative brief. Brand/audience/pain points/positioning/offer support that selected topic. They cannot replace it. The earlier audit's detailed field mapping remains in `carousel-production-audit-2026-11-02.md`.

The Stage 1 prompt now explicitly connects each role: the selected headline → its problem → a reframe of that problem → supported value → the selected CTA/objective. It does not impose literal matching on creative headlines. `content_goal` in the example schema is JSON-escaped so calendar objectives containing quotes/newlines do not break the example JSON.

Stage 2 continues to echo the same source_binding and narrative_signature; narrative rewrites, foreign Stage 1 output, overlay mismatch and subject/action mismatch fail validation. Final normalization retains Stage 1's narrative fields. No semantic keyword score is introduced. Unproven alignment remains unreviewed with no production candidate. Calendar changes with the same ID invalidate old source bindings; records are preserved rather than stamped with new authority.

### Carousel test results

- PASS: `npx.cmd tsx scripts/test-carousel-authority-audit.ts` — real panel server rendering, strict data boundaries, all five drift positions, cross-stage linkage, stale source/review, immutable input, translation and gate checks.
- PASS: `npx.cmd tsx scripts/test-carousel-production-path.ts` — 50 production-path cases and 11 static guards.

These are fixture/server-render checks, not proof of clicking the Carousel tab in the original installed Electron application.

### Carousel status

**PARTIALLY READY.** Local guards and review behavior are verified. The original production `.includes()` stack and creative relevance of live Gemini output remain unverified. No automatic aligned status or creative-quality guarantee is claimed.

## Video

### Root causes

The previous brief copied full calendar fields directly into narration. Scene 2 joined masalah and solusi, producing adjacent sentences rather than an authored insight. `fitVideoVoiceoverDuration` expanded scene durations to accommodate word count, while the scene builder used 5/7/6 seconds. Brief matching then rejected all dialogue paraphrases, conflating source authority with speech. Candidate and single-scene translation validation accepted arbitrary positive durations.

### Exact fix

1. The calendar `script` and caption remain a source snapshot. Literal snapshot comparison is a freshness/fact check, not a semantic test of spoken copy.
2. A separate `spokenScript` contains hook, insight and CTA. All three modes share this dialogue; only presentation changes. Scene 2 uses one authored insight. A concise explicit source solution, or the source body when appropriate, can be used without joining the two. No sentence or source field is clipped.
3. The canonical builder now emits exactly three scenes of exactly 8 seconds for all modes and funnel stages. Candidate validation requires 24 seconds total, 9:16, and 8 seconds per scene. Single-scene translation also checks timing before building motion prompts. `fitVideoVoiceoverDuration` fixes duration at 8 and throws on infeasible speech; it never extends duration.
4. The feasibility budget is 18 words per scene. Longer dialogue returns a controlled, actionable error asking for safe revision/regeneration. Word count is a planning check, not an audio measurement.
5. Creative paraphrases are parsed and retained as review-required drafts rather than rejected solely for different wording. Because deterministic code cannot prove arbitrary paraphrases factual, unproven copy receives no production candidate. New-topic and fabricated-claim dialogue is likewise blocked. A model-supplied `narrativeReview.required=false` does not bypass reassessment.
6. Automatically usable dialogue is limited to full source messages (allowing case/whitespace changes); insight can be the explicit solution or body. There is no generic CTA fallback. Missing calendar CTA must stay empty. A missing source solution does not permit an invented one.
7. The UI change is limited to error/status handling: a blocked paraphrase shows the exact proposed three dialogues and the reason. No new approval UI was added. Under this UI constraint, arbitrary paraphrases cannot be approved for production inside the Video panel; use reviewed calendar-source dialogue or revise the source and regenerate. This is a remaining workflow limit, not a claim that all correct paraphrases are automatically usable.
8. Old authoritative output lacking separated dialogue, or carrying a candidate incompatible with 8-second scenes, is blocked for regeneration. It is not silently retimed, migrated, or saved over. Source records and old clip/completion data are not edited by this audit.

### Video test results

- PASS: `npx.cmd tsx scripts/test-video-narrative-brief.ts` — actual page normalizer, all three modes, source snapshots, concise and mixed-topic paraphrases, fabricated claims blocked, model self-approval blocked, same dialogue across modes, word limit, no clipping, 8-second/24-second/9:16 candidate and motion prompts, legacy rejection, preserved input.
- PASS: `npm.cmd run verify:video-authority` — timing assertions now require 8 seconds in all mode/funnel combinations.
- PASS: `npx.cmd tsx scripts/test-video-production-gate.ts` — 36 gate cases, A–D cases, seven authority regression checks and static guards.
- PASS: `npx.cmd tsx scripts/test-video-scene-completion.ts` — completion, source signatures, input signatures and compact-hash regressions. Positive timing fixtures were updated from 3×5 to 3×8 seconds.
- PASS: `npx.cmd tsx scripts/test-execution-prompt-authority.ts` — translation and execution/package authority boundaries remain intact.

### Video status

**PARTIALLY READY.** The local 3×8-second contract and fail-closed dialogue checks are verified. No live Gemini, Google Flow generation, synthesized voiceover, or installed-app visual test was performed. Eighteen words may still exceed eight seconds for a slow speaker; actual audio pacing needs a runtime check. Arbitrary semantic equivalence and creative quality are not guaranteed. Unproven paraphrases remain blocked, consistent with the no-new-review-UI constraint.

## Changed files

| File | Reason |
|---|---|
| `app/production-studio/page.tsx` | Focused Carousel prompt correction; separated Video source/dialogue; shared speech across modes; review/legacy/error handling; accurate 24-second timelines. |
| `components/production-studio/VideoPanel.tsx` | Error/status display of blocked dialogue and its reason. |
| `lib/video-scene-contract.ts` | Shared 8-second, 24-second and 18-word checks. |
| `lib/video-narrative-brief.ts` | Source snapshot versus speech assessment; no automatic semantic certification; fixed timing with no clipping. |
| `lib/production-candidate.ts` | Video-only scene timing, insight projection and candidate validation. Image/Carousel branches unchanged. |
| `lib/prompt-translation.ts` | Video single-scene timing/word validation. Image/Carousel translation unchanged. |
| `scripts/test-video-narrative-brief.ts` | New speech, timing, review, legacy and format regressions. |
| `scripts/test-video-authority-regression.ts` | Assert exact 8-second scenes and authority only with canonical candidates. |
| `scripts/test-video-production-gate.ts` | Positive fixtures use 24-second/8-second timing. |
| `scripts/test-video-scene-completion.ts` | Positive fixtures use 24-second/8-second timing. |
| `scripts/test-carousel-authority-audit.ts` | Pin historical crash reproduction to 0bbf845 instead of moving HEAD. |
| This report | Separate Carousel/Video evidence, tests, risks and closure status. |

## Final validation

- PASS: `npm.cmd run typecheck` on the final source.
- PASS: `git diff --check`.
- PASS: AST/source comparison against a1af2fa confirms Image normalizers, Carousel normalizers/merge, and Image/Carousel translators are unchanged. Storage, license, Carousel authority/gate and Image/Carousel panel files have no diff.
- FAIL (pre-existing): `npm.cmd run lint`, exit 1. The only error is `scripts/test-license-persistence.ts:29`, `@next/next/no-assign-module-variable`; the same file is unchanged from baseline. Existing hook-dependency warnings remain in `lib/license/license-context.tsx:250,312`. No error was reported for the changed files. These license files were left untouched.
- PASS: `npm.cmd run build`, exit 0. Compilation, all seven static pages, optimization and build traces completed; `/production-studio` was generated. The existing Next configuration skips build-time lint/type validation, so this does not replace the separate typecheck and lint outcomes above.

Overall status: **PARTIALLY READY**. Correct local boundaries are frozen. Original production crash attribution, live-provider behavior, Google Flow/audio timing and the blocked-paraphrase approval workflow remain explicit limitations. No commit or push was performed.
