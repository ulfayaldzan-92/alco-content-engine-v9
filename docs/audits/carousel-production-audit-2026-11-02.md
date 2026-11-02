# Carousel Production Studio audit — 2 November 2026

Checkout: `D:\Repository Github\percobaan 1\alco-content-engine-v9`.
Origin verified as `https://github.com/ulfayaldzan-92/alco-content-engine-v9.git`.
Baseline inspected: `0bbf845`. Existing package.json/package-lock.json edits were left intact.
No commit, push, dependency addition, data migration, or real project-data write was performed.

## 1. Root causes and proof boundaries

### Crash

Proven defect: the `carouselPlan` memo previously returned parsed raw stored JSON when canonical normalization failed. `getInitialDraft('carousel')` similarly returned an unvalidated `ContentItem.carousel_plan`. `CarouselPanel` only checked whether slides existed and had a nonzero length, then immediately used `s.slide` in `findIndex`.

The new regression executes the baseline panel from Git HEAD with a legacy `{slides:[null]}` fixture through React's real server renderer. It throws a TypeError on access to `slide`. The changed panel renders an error state for that fixture and for empty, incomplete, undefined/null and malformed data boundaries. Valid pending-review and reviewed plans render successfully.

The exact reported error, `Cannot read properties of undefined (reading 'includes')` at `page-694b958cc7f2097a.js:1:5271`, is NOT yet mapped or reproduced through the current Carousel route. That bundle and its source map were not present in the checkout. The pre-audit local production bundle had a different name (`page-ec8b124933df4c5e.js`). This audit must not equate the reproduced legacy-slide crash with the reported production stack.

Relevant `.includes()` audit: CarouselPanel contains none. The current carousel normalizer's calls operate on checked/extracted strings. The shared `injectCharacterToPrompt` helper has an unguarded `basePrompt.includes` at `lib/character-prompt.ts:171`, but current carousel translation/effective-candidate paths validate prompt strings first. There is no evidence that this helper received undefined in the reported deployment. It was not changed, preserving Image/Video behavior.

An additional stored-data boundary was unsafe: carousel loading called `isErrorContent` before checking the stored value's type, and removed matching error outputs. It now checks the type, preserves the stored record, and displays an error for invalid output.

### Narrative drift

Stage 1 validation previously proved field presence, roles and funnel only. A coherent but unrelated five-slide narrative could pass. Final normalization then unconditionally set `messageAlignmentCheck.isAligned = true` and generated a production candidate. The initial carousel draft also claimed alignment without semantic evidence.

The Stage 1 example `content_goal` used the generic funnel goal instead of the calendar item's `tujuan`. Project-wide positioning/offers and generic funnel instructions therefore had more influence than an explicitly shared, item-specific narrative brief. This is an application-contract weakness; it does not prove what any particular Gemini response contained.

The final normalizer also dropped top-level slide `core_message` and `audience_emotion` while retaining derived creative-strategy fields. These narrative fields now survive normalization.

### Visual drift

Merge already protected headline/body from Stage 2, but Stage 2 had no deterministic binding to the exact Stage 1 or selected calendar source. Nonempty visual fields were accepted without checking Subject/Object and Action/Scene against `visual_production`, or the raw Text Overlay against Stage 1's final headline. Conflicting creative-strategy core messages and overlays could survive direct normalization.

### Stale data and cache

Stored carousel output was indexed by project and item key. Keeping the same item ID while changing its headline/body/CTA did not invalidate it. The raw fallback further bypassed failed validation. Existing plan/execution signatures bound output and completion, but did not prove that output still matched current calendar contents.

The recommendation API caches by SHA-256 of the prompt for ten minutes. No evidence established that the cache caused the reported drift. It was not changed. The updated prompts include the source binding, so a relevant calendar or project-context change changes the prompt/cache key.

## 2. Field mapping: calendar through final output

| Source | ProductionContext / prompt | Stage 1 and final projection | Validation and limitations |
|---|---|---|---|
| Canonical project ID | Request `project_id`; context identity | `source_binding.project_id` | Existing engine/request identity gates retained; no new IDs fabricated. |
| Canonical ContentItem ID | Request `content_item_id`; context identity | `source_binding.content_item_id` | Exact selected-item binding; no fallback to another item. |
| `headline` | `content.headline`; selected-item block; new narrative brief | Slide 1 hook, supporting topic for Slides 2–5 | Creative rewriting remains allowed; meaning requires explicit review. |
| `body` | `content.body`; Core Body / Idea; brief | Problem and context for reframe/value | No heuristic claims of semantic verification. |
| `tujuan` | `content.objective`; Strategic Objective; brief | Stage 1 `content_goal` example now uses this item value | Funnel describes delivery; it cannot replace the topic. |
| `cta` | `content.cta`; CTA block; brief | `primary_cta_text`, Slide 5 | Relevant paraphrases require review; no automatic generic CTA approval. |
| `caption` | `content.caption`; calendar caption block; brief | Stage 1 `captionForPost`; merge preserves Stage 1 ownership | Model-authored caption is not automatically certified factual. |
| `visual` | `content.visual_direction`; Visual Direction; brief | Stage 2 subject/action/environment/composition/style | Source fingerprint changes when direction changes. |
| Explicit solution/proof | Existing context fields and new selected-item brief | Supported Slide 4 value; proof only when supplied | Missing facts do not authorize invented claims. Sparse invalid output fails closed. |
| Brand, audience, pain points | Project Facts block | Supporting context for selected topic | Included in source fingerprint; cannot become an unrelated topic. |
| Positioning, offer, benefits, core message | Project Facts block | Supporting value/reframe/CTA | Changes invalidate previous source binding/review. |
| Stage 1 headline/body/core message | Exact validated Stage 1 JSON sent to Stage 2 | Merge copies narrative from Stage 1; final normalizer preserves it | Stage 2 attempts to alter narrative or reuse another Stage 1 are rejected. |
| Stage 2 visual layers | `visual_production`, layout/image prompts | Canonical slide prompts → candidate → translator | Overlay equals final headline; subject/action must mirror structured visual fields. Creative relevance still requires review. |

Identity selection and requests are in `app/production-studio/page.tsx` around the production engine context build and `requestProjectId`/`requestItemId` capture. Context mapping is in `lib/production-context.ts:213–223`. Both Gemini calls use `/api/gemini/recommendation` and the existing `gemini-3.5-flash` configuration. No model was changed.

Actual active-project IDs and actual historic Gemini payloads were not available from a running user session. Test IDs `project-documents` / `calendar-17` are synthetic, not claimed to be the user's active project. Gemini request/response behavior is verified with deterministic fixtures and actual application functions, not a live provider call.

## 3. Implemented fixes and changed files

| File | Change |
|---|---|
| `lib/carousel-authority.ts` | Strict narrative/visual field-type boundaries; project/item/source fingerprints; exact Stage 1 linkage; overlay and subject/action checks; review stamps bound to sources, narrative, visuals and character. Fingerprints prove freshness, not semantics or security. |
| `app/production-studio/page.tsx` | Item-specific narrative brief; strict Stage 1/2 linkage; preserve narrative fields; remove raw-plan fallbacks; preserve invalid stored data; same-ID async source-change checks; pending-review output; production candidate only after explicit review. |
| `components/production-studio/CarouselPanel.tsx` | Reject malformed plans before render; honest alignment labels; preview canonical image prompts for review; one explicit user-review action. Existing slide workspace retained. |
| `lib/carousel-production-gate.ts` | Require review evidence matching current source fingerprint and current candidate signature in addition to all existing authority/completion checks. |
| `scripts/test-carousel-authority-audit.ts` | Actual normalizers/builders, React rendering, baseline crash reproduction, drift/linkage/stale-data/review/translation/gate regressions. |
| `scripts/test-carousel-production-path.ts` | Existing synthetic gate fixtures explicitly provide review evidence; previous 50 production-path tests and 11 guards remain active. New tests separately exercise missing/stale review evidence against the raw gate. |
| This report | Evidence, field mapping, limitations and closure status. |

The two-stage architecture remains Stage 1 narrative authority → Stage 2 visual enrichment. Neither provider output can self-approve review. Generated plans always start unreviewed. Models can still produce bad creative copy; such output may be previewed but has no authoritative candidate and cannot pass production until reviewed.

Review is an explicit user assertion, not a machine semantic score. Any relevant calendar/brand/audience/strategy/visual change invalidates source binding. Narrative/visual/character changes invalidate the review stamp. Normalization and render perform no storage writes. Opening old output does not stamp, repair, migrate or promote it.

## 4. Validation results

- PASS: `npx.cmd tsx scripts/test-carousel-authority-audit.ts`.
- PASS: `npx.cmd tsx scripts/test-carousel-production-path.ts` — 50 cases and 11 static guards.
- PASS: `npm.cmd run typecheck` after the implementation and fixture correction.
- PASS: source comparison with Git HEAD confirms Video normalizer/draft and Image normalizers are unchanged.
- PASS: `git diff --check`.
- PASS: targeted ESLint on all six changed/new implementation and test files, exit 0.
- FAIL (pre-existing, outside scope): `npm.cmd run lint`, exit 1. `scripts/test-license-persistence.ts:29` declares `module`, triggering `@next/next/no-assign-module-variable`. The same declaration exists in Git HEAD and that file was not changed. Two existing hook-dependency warnings remain at `lib/license/license-context.tsx:250,312`. No Carousel lint error remains.
- PASS: final `npm.cmd run build`, exit 0; compilation succeeded in 69 seconds, all seven static pages generated and build traces completed. `/production-studio` built successfully. Next's existing configuration skips type/lint checks during build; the separately executed typecheck and lint results above remain authoritative.

New regression coverage includes null/malformed/legacy plans; genuine baseline React render crash; pending and reviewed valid rendering; all five narrative drift positions, including mutually consistent off-topic Stage 1/2 output; Stage 2 narrative rewrites; conflicting overlay/core message; subject/action mismatch; source and Stage 1 mismatches; calendar changes with the same ID; project/offer changes; stale review after copy/visual/character edits; missing/stale review evidence at an otherwise ready production gate; unchanged source records; and translated 4:5 prompts retaining final slide headlines.

## 5. Remaining risks and final status

**PARTIALLY READY.** Local canonical boundaries, stale-data handling and authority regressions are verified. The exact original production `includes` crash is not closed without the matching bundle/source map or reproduction using the original deployment/data. No real user storage, installed Electron UI, live Gemini response, image generation result or browser layout was tested.

Creative paraphrases and visual metaphors remain possible, so semantic review is intentionally mandatory. Keyword similarity is not used as proof. Passing a review means the user explicitly accepted that exact output; it does not guarantee creative quality or factual correctness. The new provider linkage fields still need one live two-stage smoke test before deployment.

Legacy records without source binding are preserved and blocked rather than silently assigned to the current calendar. They require regeneration. Sparse authority that cannot satisfy the existing five-slide contract is blocked instead of filled with invented facts. New generation, editing, or explicit review continues to use the existing storage workflow; there is no automatic data cleanup or migration.

Implementation is frozen within Carousel scope. No commit or push was performed.
