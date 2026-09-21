import { ContentItem, SharedContentContext, FunnelStage } from './content-contract';
import { FunnelStrategy } from './funnel-strategy';
import { VideoProductionMode } from './production-contract';
import { ProductionEngineContext } from './production-engine-context';

export interface VideoIntentDecision {
  recommended_mode: VideoProductionMode;
  recommendation_reason: string;
  required_inputs: string[];
  optional_inputs: string[];
}

/**
 * Returns project-scoped and content-item-scoped manual override key.
 * Strictly requires both non-empty projectId and contentItemId.
 * Fails safely by returning null if either is missing or invalid.
 * Never fabricates identity from item.no.
 */
export function getVideoModeOverrideKey(
  projectId: string | null | undefined,
  contentItemId: string | null | undefined
): string | null {
  if (!projectId || typeof projectId !== 'string' || !projectId.trim()) {
    return null;
  }
  if (!contentItemId || typeof contentItemId !== 'string' || !contentItemId.trim()) {
    return null;
  }
  return `${projectId.trim()}:${contentItemId.trim()}`;
}

export function getVideoProductionModeLabel(mode: VideoProductionMode): string {
  switch (mode) {
    case 'human_led':
      return 'Video dengan Talent';
    case 'product_demo':
      return 'Demo Produk / Aplikasi';
    case 'motion_explainer':
      return 'Video Penjelasan Visual';
  }
}

export function getVideoProductionModeDescription(mode: VideoProductionMode): string {
  switch (mode) {
    case 'human_led':
      return 'Talent menjelaskan pesan langsung ke audiens. Cocok untuk trust, edukasi, dan komunikasi personal.';
    case 'product_demo':
      return 'Menunjukkan produk, aplikasi, fitur, atau workflow secara langsung.';
    case 'motion_explainer':
      return 'Menjelaskan konsep, langkah, framework, data, atau checklist melalui visual dan motion.';
  }
}

/**
 * Resolves video production mode recommendation deterministically from authoritative context.
 *
 * CANONICAL AUTHORITY:
 * Accepts ONLY ProductionEngineContext.
 *
 * AUTHORITY ORDER:
 * 1. ContentItem — PRIMARY AUTHORITY (editorial headline, purpose, body, angle, and visual directions)
 * 2. FunnelStrategy — SUPPORTING EVIDENCE (contextual weighting only, never hardcoding stage to mode)
 * 3. SharedContentContext — SUBJECT/BUSINESS CONTEXT ONLY (brand/product identity, NEVER dictates mode alone)
 *
 * FAIL-CLOSED:
 * Rejects any non-canonical or permissive call outside ProductionEngineContext.
 * Rejects missing project_id, shared_context, funnel_strategy, content_item, or canonical_funnel_stage.
 * Never performs silent fallback or hallucinates replacement business facts.
 *
 * PRIORITY & TIE-BREAKING:
 * 1. Explicit actual-screen/UI execution intent (e.g. open app, click buttons, walk through active UI) -> product_demo
 * 2. Structured framework / sequential steps / comparison without screen execution requirement -> motion_explainer
 * 3. Relatable problem / fear / personal observation / empathy / objection handling -> human_led
 * 4. In case both structured framework and explicit screen execution are present, explicit UI execution takes precedence (product_demo)
 * 5. Deterministic semantic default fallback (when no strong product_demo or motion_explainer is present) -> human_led
 */
export function resolveVideoIntent(
  input: ProductionEngineContext
): VideoIntentDecision {
  // 0. FAIL-CLOSED AUTHORITY VALIDATION
  if (!input || typeof input !== 'object') {
    throw new Error('resolveVideoIntent: Authoritative ProductionEngineContext is required (FAIL CLOSED). Missing input.');
  }

  const rawInput = input as any;

  // Reject permissive non-canonical structures (e.g. direct raw { contentItem: ... })
  if ('contentItem' in rawInput || !('content_item' in rawInput)) {
    throw new Error('resolveVideoIntent: Raw non-canonical input rejected. ProductionEngineContext is required (FAIL CLOSED).');
  }

  const projectId = rawInput.project_id;
  if (!projectId || typeof projectId !== 'string' || !projectId.trim()) {
    throw new Error('resolveVideoIntent: ProductionEngineContext must contain a non-empty project_id (FAIL CLOSED).');
  }

  const sharedContext = rawInput.shared_context;
  if (!sharedContext || typeof sharedContext !== 'object') {
    throw new Error('resolveVideoIntent: ProductionEngineContext must contain a valid shared_context (FAIL CLOSED).');
  }

  const funnelStrategy = rawInput.funnel_strategy;
  if (!funnelStrategy || typeof funnelStrategy !== 'object') {
    throw new Error('resolveVideoIntent: ProductionEngineContext must contain a valid funnel_strategy (FAIL CLOSED).');
  }

  const contentItem = rawInput.content_item;
  if (!contentItem || typeof contentItem !== 'object') {
    throw new Error('resolveVideoIntent: ProductionEngineContext must contain a valid content_item (FAIL CLOSED).');
  }

  const canonicalStage = rawInput.canonical_funnel_stage;
  if (
    typeof canonicalStage !== 'string' ||
    !['TOFU', 'MOFU', 'BOFU'].includes(canonicalStage)
  ) {
    throw new Error(
      'resolveVideoIntent: ProductionEngineContext must contain an exact canonical_funnel_stage: TOFU, MOFU, or BOFU (FAIL CLOSED).'
    );
  }

  // Extract ContentItem textual fields (Primary authoritative source)
  const itemHeadline = (contentItem.headline || '').trim();
  const itemJudul = (contentItem.judul || '').trim();
  const itemTujuan = (contentItem.tujuan || '').trim();
  const itemBody = (contentItem.body || '').trim();
  const itemVisual = (contentItem.visual || '').trim();
  const itemKeterangan = (contentItem.keterangan || '').trim();
  const itemCta = (contentItem.cta || '').trim();
  const itemSudutPandang = (contentItem.sudut_pandang || '').trim();
  const itemFormat = (contentItem.format || '').trim();
  const itemAssetReason = (contentItem.assetTypeReason || '').trim();
  const itemPrimaryAsset = (contentItem.primaryAssetType || '').trim();

  const hasContentText = Boolean(
    itemHeadline ||
    itemJudul ||
    itemTujuan ||
    itemBody ||
    itemVisual ||
    itemKeterangan ||
    itemCta ||
    itemSudutPandang ||
    itemAssetReason
  );

  if (!hasContentText) {
    throw new Error('resolveVideoIntent: ContentItem must contain valid textual content (FAIL CLOSED).');
  }

  // Isolate ContentItem text strictly without combining SharedContentContext.
  // SharedContentContext is subject context only and must never inflate production mode scores.
  const editorialText = `${itemHeadline} ${itemJudul} ${itemTujuan} ${itemBody} ${itemSudutPandang} ${itemKeterangan}`.toLowerCase();
  const directionText = `${itemVisual} ${itemCta} ${itemFormat} ${itemAssetReason} ${itemPrimaryAsset}`.toLowerCase();
  const itemFullText = `${editorialText} ${directionText}`;

  // 1. EVALUATE PRODUCT DEMO (Strict execution / hands-on demonstration required)
  // Generic business words (aplikasi, software, website, produk, dashboard) alone do NOT qualify.
  let productDemoScore = 0;
  let hasExplicitProductExecution = false;

  // Strong execution patterns: active screen demonstration, UI walkthrough, interactive steps
  const explicitExecutionPatterns = [
    /\b(screen recording|rekaman layar|screencast|walkthrough|live demo)\b/i,
    /\b(buka dashboard|buka aplikasi|login ke dashboard|masuk ke dashboard)\b.*\b(klik|pilih|menu|tombol|analisis|lihat)\b/i,
    /\b(buka dashboard|buka aplikasi|login ke dashboard)\b/i,
    /\bklik\s+([a-z0-9_\-\s]+)?(tombol|menu|analisis|tab|opsi|fitur|button)\b/i,
    /\bupload\s+.*(lalu|sampai|hingga)\s+(lihat|muncul|rekomendasi|hasil)/i,
    /\b(lihat|tonton)\s+bagaimana\s+fitur\s+.*bekerja/i,
    /\bfitur\s+.*bekerja\s+(dari|secara|sebelum|langsung|nyata)/i,
    /\b(cara kerja fitur|fitur bekerja|workflow produk|workflow aplikasi|tampilan aplikasi)\b/i,
    /\b(lihat cara|lihat proses|lihat fitur)\b/i,
    /\b(cara menggunakan|langkah penggunaan|step penggunaan)\s+(fitur|dashboard|aplikasi|tools|software)/i,
    /\b(actual product screen|layar produk aktual|rekaman ui|tampilan antarmuka aktual)\b/i,
    /\b(before\s*\/?\s*after\s+penggunaan\s+produk|sebelum\s+dan\s+sesudah\s+(menggunakan|memakai)\s+(aplikasi|software|produk))\b/i,
    /\b(setup campaign langsung di layar ui|demonstrasi alur kerja otomatis|menunjukkan langkah.*di layar)\b/i,
  ];

  for (const pattern of explicitExecutionPatterns) {
    if (pattern.test(itemFullText)) {
      hasExplicitProductExecution = true;
      productDemoScore += 12;
      break;
    }
  }

  // Supporting visual/asset metadata for screen demonstration
  if (/\b(rekaman layar|screen recording|screencast|walkthrough ui|tangkapan layar|product_screen)\b/i.test(directionText)) {
    productDemoScore += 3;
    hasExplicitProductExecution = true;
  }

  // 2. EVALUATE MOTION EXPLAINER (Structured Framework / Steps / Comparison / Diagram)
  let motionExplainerScore = 0;
  let hasNumberedFramework = false;
  let hasComparisonOrWorkflow = false;

  // Numbered listicle / steps / framework
  const numberedFrameworkPattern = /\b(\d+|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh)\s+(langkah|tahap|tahapan|step|alur|cara|kesalahan|poin|pilar|tips|strategi|prinsip|kategori|rumus|formula|metode|hal|alasan)\b/i;
  if (numberedFrameworkPattern.test(itemFullText)) {
    hasNumberedFramework = true;
    motionExplainerScore += 10;
  }

  // Comparison & structured workflows
  const comparisonPattern = /\b(perbandingan|komparasi|vs|versus|perbedaan alur|bandingkan\s+(cara|metode|alur|workflow)?.*(dengan|versus|vs)|workflow terstruktur|alur kerja terstruktur|alur sistem terstruktur)\b/i;
  if (comparisonPattern.test(itemFullText)) {
    hasComparisonOrWorkflow = true;
    motionExplainerScore += 10;
  }

  // General structured concepts & diagrammatic visual cues
  const structuredVisualPattern = /\b(framework|diagram|checklist|matriks|matrix|formula|infografis|grafik|flowchart|peta konsep|anatomi|fondasi alur|klasifikasi|breakdown visual|timeline|langkah-langkah|step-by-step)\b/i;
  if (structuredVisualPattern.test(itemFullText)) {
    motionExplainerScore += 8;
  }

  if (/\b(diagram|alur visual|infografis|grafik|animasi teks|motion graphic|graphic_motion)\b/i.test(directionText)) {
    motionExplainerScore += 3;
  }

  // 3. EVALUATE HUMAN-LED (Empathy / Personal Perspective / Relatable Problem / Trust / Objection)
  let humanLedScore = 0;
  let hasPersonalObservation = false;
  let hasFearOrRelatableProblem = false;

  // Personal perspective & storytelling observation
  const personalPerspectivePattern = /\b(saya sering melihat|pengalaman saya|cerita saya|kisah nyata|curhat|opini saya|perspektif personal|blak-blakan|saya\s+(sering|pernah|melihat|merasa|pikir|temui|alami)|storytelling personal|dari founder)\b/i;
  if (personalPerspectivePattern.test(itemFullText)) {
    hasPersonalObservation = true;
    humanLedScore += 10;
  }

  // Psychological friction, fear, misconception, relatable emotional confusion
  const emotionalProblemPattern = /\b(kenapa|mengapa)\s+.*(takut|ragu|bingung|khawatir|frustrasi|mentok|gagal|susah|berat|sulit)\b/i;
  const relatableConfusionPattern = /\b(kenapa banyak orang bingung|kenapa pemula sering takut|mengapa kita ragu|masalah audiens)\b/i;
  const emotionalKeywordsPattern = /\b(takut|ketakutan|khawatir|bingung|kebingungan|ragu|keraguan|objection|hambatan mental|trauma|frustrasi)\b/i;

  if (emotionalProblemPattern.test(itemFullText) || relatableConfusionPattern.test(itemFullText)) {
    hasFearOrRelatableProblem = true;
    humanLedScore += 10;
  } else if (emotionalKeywordsPattern.test(itemFullText)) {
    hasFearOrRelatableProblem = true;
    humanLedScore += 8;
  }

  // Direct talent communication & trust
  const directTalentPattern = /\b(apakah|beneran|benar-benar|mitos|myth|misconception|fakta vs mitos|realita|menjawab keraguan|bicara langsung|ngobrol|monolog|tatap kamera|wajah|ekspresi|interaksi personal|talking head|instruktur|tanya saya di kolom komentar|simpan postingan ini jika kamu merasakannya)\b/i;
  if (directTalentPattern.test(itemFullText)) {
    humanLedScore += 8;
  }

  // 4. FUNNEL STRATEGY AS SUPPORTING EVIDENCE (Contextual weighting only)
  // Use authoritative canonical_funnel_stage directly from ProductionEngineContext
  const resolvedStage: FunnelStage = canonicalStage as FunnelStage;

  if (funnelStrategy && resolvedStage) {
    if (resolvedStage === 'TOFU') {
      humanLedScore += 1.5;
      motionExplainerScore += 0.5;
    } else if (resolvedStage === 'MOFU') {
      motionExplainerScore += 1.5;
      if (productDemoScore > 0) {
        productDemoScore += 0.5;
      }
    } else if (resolvedStage === 'BOFU') {
      if (productDemoScore > 0) {
        productDemoScore += 1.5;
      }
      if (humanLedScore > 0) {
        humanLedScore += 1.5;
      }
    }
  }

  // 5. DETERMINISTIC DECISION & TIE-BREAKING
  // PRIORITY RULE (Case 10):
  // When explicit interactive UI screen execution is present (e.g. open app, click buttons, walk through active UI),
  // product_demo takes precedence even if structured framework terms ("3 langkah", "tahap") are mentioned.
  if (hasExplicitProductExecution && productDemoScore >= 8) {
    let reason = 'Konten secara eksplisit menunjukkan demonstrasi fitur dan alur kerja aplikasi di layar.';
    if (/\b(buka dashboard|klik|upload.*lalu|navigasi)/i.test(itemFullText)) {
      reason = 'Konten memuat instruksi interaksi antarmuka langsung (seperti membuka dashboard atau klik fitur), sehingga format demo produk paling sesuai.';
    } else if (hasNumberedFramework) {
      reason = 'Meskipun memuat langkah terstruktur, konten secara eksplisit mengarahkan alur kerja pada tampilan layar aktual sehingga format demo produk diutamakan.';
    } else if (/\b(fitur.*bekerja|cara kerja fitur|lihat bagaimana)/i.test(itemFullText)) {
      reason = 'Konten berfokus memperlihatkan cara kerja fitur dari awal hingga hasil di antarmuka produk secara nyata.';
    }

    return {
      recommended_mode: 'product_demo',
      recommendation_reason: reason,
      required_inputs: ['product_screenshot'],
      optional_inputs: ['screen_recording', 'brand_logo']
    };
  }

  // PRIORITY RULE: Structured framework / process / comparison without screen execution
  if (motionExplainerScore >= 8 && motionExplainerScore >= humanLedScore) {
    let reason = 'Konten berfokus pada visualisasi langkah terstruktur dan framework konseptual.';
    if (hasNumberedFramework) {
      reason = 'Konten menjelaskan poin atau tahapan terstruktur secara sistematis, sehingga lebih jelas disampaikan melalui animasi visual diagram dan motion explainer.';
    } else if (hasComparisonOrWorkflow) {
      reason = 'Konten membandingkan alur kerja atau metode, sehingga format visual perbandingan diagram motion explainer memberikan kejelasan optimal.';
    }

    return {
      recommended_mode: 'motion_explainer',
      recommendation_reason: reason,
      required_inputs: [],
      optional_inputs: ['diagram_framework', 'brand_visual', 'data_points']
    };
  }

  // PRIORITY RULE: Human-led relatable problem, personal observation, or direct connection
  if (humanLedScore >= 8 && humanLedScore > productDemoScore && humanLedScore > motionExplainerScore) {
    let reason = 'Konten berfokus pada komunikasi pesan langsung oleh talent untuk membangun kedekatan dan kepercayaan audiens.';
    if (hasPersonalObservation) {
      reason = 'Konten menyampaikan observasi personal dan refleksi pengalaman secara langsung, sehingga format talent berbicara ke kamera memberikan koneksi dan kepercayaan terbaik.';
    } else if (hasFearOrRelatableProblem) {
      reason = 'Konten membahas ketakutan, keraguan, atau masalah relatable audiens secara mendalam, sehingga pendekatan tatap kamera oleh talent paling tepat untuk membangun empati dan trust.';
    }

    return {
      recommended_mode: 'human_led',
      recommendation_reason: reason,
      required_inputs: ['character'],
      optional_inputs: ['b_roll_visual']
    };
  }

  // Tie-breaker: compare remaining positive scores
  if (productDemoScore > motionExplainerScore && productDemoScore > humanLedScore) {
    return {
      recommended_mode: 'product_demo',
      recommendation_reason: 'Konten menekankan demonstrasi penggunaan fitur produk di layar, sehingga format demo produk direkomendasikan.',
      required_inputs: ['product_screenshot'],
      optional_inputs: ['screen_recording', 'brand_logo']
    };
  }

  if (motionExplainerScore > productDemoScore && motionExplainerScore >= humanLedScore) {
    return {
      recommended_mode: 'motion_explainer',
      recommendation_reason: 'Konten berfokus pada penyampaian konsep terstruktur melalui visual dan animasi motion.',
      required_inputs: [],
      optional_inputs: ['diagram_framework', 'brand_visual', 'data_points']
    };
  }

  // DETERMINISTIC SEMANTIC DEFAULT FALLBACK (human_led)
  // When no strong product demo or structured explainer intent exists (e.g. passive mentions or general statements)
  return {
    recommended_mode: 'human_led',
    recommendation_reason: 'Konten berfokus pada pesan komunikasi langsung tanpa instruksi demonstrasi layar interaktif maupun diagram framework khusus, sehingga format talent direkomendasikan.',
    required_inputs: ['character'],
    optional_inputs: ['b_roll_visual']
  };
}

