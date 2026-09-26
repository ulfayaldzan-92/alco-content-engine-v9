'use client';

import React, { useState, useEffect, useMemo } from 'react';
import ImagePanel from '@/components/production-studio/ImagePanel';
import CarouselPanel from '@/components/production-studio/CarouselPanel';
import VideoPanel from '@/components/production-studio/VideoPanel';
import ReviewPanel from '@/components/production-studio/ReviewPanel';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, Sparkles, FileText, Image as ImageIcon, Video, Layers, Users, Star, 
  Target, Zap, Check, Copy, RefreshCw, Eye, BrainCircuit, MessageSquare, Clipboard, 
  AlertCircle, AlertTriangle, CheckSquare, ListTodo, Sliders, PlayCircle, ExternalLink, Download, Loader2,
  ChevronDown, ChevronRight, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ContentItem, SharedContentContext, CharacterDNA, ProductionProgress, validateProductionGenerationContext } from '@/lib/content-contract';
import { 
  ProductionContext, 
  buildProductionContext, 
  formatProductionContextForPrompt, 
  ANTI_DRIFT_RULES 
} from '@/lib/production-context';
import { resolveProductionContentItemTarget, buildProductionEngineContext, ProductionEngineContext } from '@/lib/production-engine-context';
import { resolveVideoIntent, VideoIntentDecision, getVideoProductionModeLabel, getVideoModeOverrideKey } from '@/lib/video-intent-resolver';
import { resolveVideoProductionReadiness, VideoProductionReadiness } from '@/lib/video-production-readiness';
import { ProductAssetContext } from '@/lib/video-production-input';
import { FunnelStrategy } from '@/lib/funnel-strategy';
import {
  ImageProductionCandidate,
  CarouselProductionCandidate,
  VideoProductionCandidate,
  buildImageProductionCandidate,
  buildCarouselProductionCandidate,
  buildVideoProductionCandidate,
  buildCanonicalVideoScenePlan,
  getVideoCandidateId,
  validateProductionCandidate,
} from '@/lib/production-candidate';
import { CarouselSlideProductionPlan, VideoProductionMode, validateProductionPackage } from '@/lib/production-contract';
import { 
  buildFunnelPromptBlock, 
  getFunnelRules, 
  normalizeFunnelStage, 
  parseStrictFunnelStage,
  sanitizeCtaForFunnel, 
  getVoiceoverCtaForFunnel, 
  FUNNEL_CONTENT_RULES, 
  FunnelStage,
  countWords
} from '@/lib/funnel-rules';
import { 
  getActiveProjectId, 
  setActiveProjectId, 
  loadProjectData, 
  saveProjectData, 
  removeProjectData, 
  loadProjectSharedContextStrictForProduction,
  loadStoredProjectFunnelStrategyStrict,
  loadProjectCalendarItemsStrictForProduction,
  loadProjectSelectedItem,
  saveProjectSelectedItem,
  getProjectCharacterDNA, 
  saveProjectCharacterDNA, 
  updateItemInProject,
  getProjectSavedCharacters,
  saveProjectSavedCharacters,
  getProjectActiveCharacterId,
  saveProjectActiveCharacterId
} from '@/lib/storage';
import {
  ProductionOutputSource,
  isAuthoritativeProductionOutputSource,
} from '@/lib/production-output-source';
import { prepareProductionPackage } from '@/lib/production-package-workflow';
import {
  translateImageProductionPrompt,
  translateCarouselProductionPrompts,
  translateVideoProductionPrompts,
  ImageTranslatedPromptBundle,
  CarouselTranslatedPromptBundle,
  VideoTranslatedPromptBundle,
} from '@/lib/prompt-translation';
import { saveProductionPackage } from '@/lib/production-package-storage';
import { ProductionPackageMetadata } from '@/lib/production-engine';
import { evaluateVideoProductionGate } from '@/lib/video-production-gate';
import { injectCharacterToPrompt } from '@/lib/character-prompt';
import CharacterDNASection from '@/components/CharacterDNA';
import ProductionProgressWidget from '@/components/calendar/ProductionProgressWidget';
import { GeminiApiKeyControl } from '@/components/GeminiApiKeyControl';
import ContentEngineShell from '@/components/ContentEngineShell';
import { buildGeminiRequestHeaders, useGeminiApiKey } from '@/lib/client-gemini-key';
import {
  VideoSceneCompletionState,
  createEmptyVideoSceneCompletionState,
  validateVideoSceneCompletionState,
  setVideoSceneClipCreated,
  getVideoSceneCompletionStorageKey,
  buildVideoScenePlanSignature,
  buildVideoProductionInputSignature,
} from '@/lib/video-scene-completion';
import { resolveSelectedVideoProductionCandidate } from '@/lib/video-canonical-scene-resolver';
import {
  buildEffectiveCarouselProductionCandidate,
  buildCarouselProductionPlanSignature,
} from '@/lib/carousel-production-path';
import {
  CarouselSlideCompletionState,
  CarouselSlideCompletionExpected,
  getCarouselSlideCompletionStorageKey,
  createEmptyCarouselSlideCompletionState,
  validateCarouselSlideCompletionState,
  setCarouselSlideAssetCreated,
} from '@/lib/carousel-slide-completion';
import {
  CarouselProductionGateResult,
  evaluateCarouselProductionGate,
} from '@/lib/carousel-production-gate';
import {
  buildExecutionPromptAuthority,
  ExecutionPromptAuthority,
} from '@/lib/execution-prompt-authority';
import {
  GeneratedImageExecutionOutput,
  getGeneratedImageOutputKey,
  isGeneratedImageOutputCurrent,
} from '@/lib/image-generated-output-state';









// Helper to copy to clipboard safely
const safeCopyToClipboard = async (text: string) => {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Clipboard write failed:', error);
    return false;
  }
};

interface StrategyBrief {
  funnelStage: string;
  tujuanKonten: string;
  ideUtama: string;
  audienceContext: string;
  angle: string;
  emosiUtama: string;
  pesanVisual: string;
}

interface MessageAlignmentCheck {
  isAligned: boolean;
  issue?: string;
  fixedTextOverlay: string;
  reason: string;
}

interface ImageAngle {
  id: 'A' | 'B' | 'C';
  name: string;
  funnelStage: string;
  visualObjective: string;
  contentGoal?: string;
  targetEmotion?: string;
  visualStrategy?: string;
  hookStrategy?: string;
  colorPsychology?: string;
  layoutStrategy?: string;
  textOverlay?: string;
  captionForPost?: string;
  captionInstruction?: string;
  ctaRecommendation?: string;
  strategyBrief?: StrategyBrief;
  messageAlignmentCheck?: MessageAlignmentCheck;
  finalPrompt: string;
  productionCandidate?: ImageProductionCandidate;
}

interface ImageAnglesPackage {
  recommendedAngleId: 'A' | 'B' | 'C';
  recommendationReason: string;
  angles: ImageAngle[];
}

export type VisualFormatType = 'photography' | 'infographic' | 'hybrid';

export interface SlideCreativeStrategy {
  funnel_stage: string;
  slide_role: string;
  visual_objective: string;
  core_message: string;
  audience_emotion: string;
  visual_concept: string;
  text_overlay: string;
}

export interface SlideVisualProduction {
  subject: string;
  action: string;
  composition: string;
  layout: string;
  visual_metaphor: string;
  typography: string;
  background: string;
  color_mood: string;
  negative_space: string;
  negative_prompt: string;
}

interface CarouselSlide {
  slide: number;
  role: string;
  communication_job: string;
  headline: string;
  body: string;
  swipe_bridge: string;
  emotional_state: string;
  visual_intent: string;
  visual_type?: string;
  text_zone?: string;
  negative_space_plan?: string;
  creative_strategy: SlideCreativeStrategy;
  visual_format: VisualFormatType;
  visual_production: SlideVisualProduction;
  production_prompt: string;
  slide_image_prompt: string;
}

interface CarouselMessageAlignmentCheck {
  isAligned: boolean;
  issue?: string;
  fixApplied?: string;
}

interface CarouselPlan {
  content_goal: string;
  funnel_stage: string;
  current_belief: string;
  desired_belief: string;
  core_promise: string;
  primary_cta_type: string;
  primary_cta_text: string;
  slide_count: number;
  slide_count_reason: string;
  belief_journey_summary: string;
  messageAlignmentCheck?: CarouselMessageAlignmentCheck;
  visual_system_notes: string;
  captionForPost?: string;
  captionInstruction?: string;
  slides: CarouselSlide[];
  productionCandidate?: CarouselProductionCandidate;
}

interface VideoScript {
  hook: string;
  masalah: string;
  solusi: string;
  proof: string;
  cta: string;
}

interface VideoStyle {
  productionMode: VideoProductionMode;
  name: string;
  hookStyle: string;
  pacingStyle: string;
  audioDirection: string;
  voiceoverOutline: string;
  script: VideoScript;
  videoPrompt: string;
  visualPlan: string;
  negativeConstraints: string;
  captionForPost?: string;
  captionInstruction?: string;
  productionCandidate?: VideoProductionCandidate;
}

const getFunnelStageLabel = normalizeFunnelStage;

const tryParseJSON = (text: string) => {
  if (!text) return null;
  let cleanText = text.trim();

  // Try direct parse first
  try {
    return JSON.parse(cleanText);
  } catch (e) {
    // If direct parse fails, try cleaning up markdown blocks or extra text
  }

  // Comprehensive cleaning of markdown wrappers or backticks anywhere
  cleanText = cleanText.replace(/```json/gi, '');
  cleanText = cleanText.replace(/```/g, '');
  cleanText = cleanText.trim();

  try {
    return JSON.parse(cleanText);
  } catch (e) {
    // Try to extract pure JSON block
  }

  // Find boundaries of potential JSON array or object
  const firstBrace = cleanText.indexOf('{');
  const lastBrace = cleanText.lastIndexOf('}');
  const firstBracket = cleanText.indexOf('[');
  const lastBracket = cleanText.lastIndexOf(']');

  // Attempt 1: Extract array from first [ to last ]
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    const arrayCandidate = cleanText.substring(firstBracket, lastBracket + 1);
    try {
      return JSON.parse(arrayCandidate);
    } catch (err) {
      // Keep going
    }
  }

  // Attempt 2: Extract object from first { to last }
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const objectCandidate = cleanText.substring(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(objectCandidate);
    } catch (err) {
      // Keep going
    }
  }

  return null;
};

const getItemKey = (item?: ContentItem | null) => {
  if (!item) return '';
  if (item.content_item_id) {
    return item.content_item_id.replace(/[^a-zA-Z0-9_]/g, '_');
  }
  const no = item.no !== undefined && item.no !== null ? String(item.no) : '0';
  const tanggal = item.tanggal || '';
  const headline = item.headline || '';
  const format = item.format || '';
  const jenis = item.jenis || '';
  const rawKey = `item_${no}_${tanggal}_${headline}_${format}_${jenis}`;
  return rawKey.replace(/[^a-zA-Z0-9_]/g, '_');
};

// Helper function to validate and normalize Image Angles JSON output to canonical Funnel Content Engine format
// Extract prompt field helper for structured prompt parsing
const extractPromptField = (field: string, text: string): string => {
  const regex = new RegExp(`${field}:\\s*([^\\n]+(?:\\n(?!\\w+:)[^\\n]+)*)`, 'i');
  const match = text.match(regex);
  return match ? match[1].trim() : '';
};

// Helper to build a short, punchy image overlay without ellipsis (max 6-10 words)
const buildShortImageOverlay = (headline: string, funnelStage: string = 'TOFU'): string => {
  if (!headline || !headline.trim()) {
    if (funnelStage === 'BOFU') return 'Transformasi Nyata Melalui Keputusan Tepat';
    if (funnelStage === 'MOFU') return 'Fokus Pada Akar Masalah, Bukan Sekadar Rutinitas';
    return 'Menghadapi Kendala Yang Sama?';
  }

  // 1. Remove all ellipses
  let text = headline.replace(/\.{2,}/g, '').replace(/…/g, '').trim();

  // 2. Specific transformation for the user example:
  // "Alasan Kenapa Menulis Copy Ads Manual Perlahan Membunuh Bisnismu" -> "Copy Ads Manual Membunuh Bisnismu?"
  const lower = text.toLowerCase();
  if (lower.includes('copy ads manual') && lower.includes('membunuh bisnismu')) {
    return 'Copy Ads Manual Membunuh Bisnismu?';
  }

  // 3. Normalize common rhetoric prefixes
  text = text
    .replace(/^(alasan\s+(kenapa|mengapa)|kenapa|mengapa|rahasia\s+(di\s*balik|tentang)?|tahukah\s+(kamu|anda)\s+bahwa|fakta\s+di\s*balik|cara\s+(mudah|cepat|praktis)\s+(untuk)?|tips\s+(bagaimana)?)\s+/i, '')
    .replace(/\b(secara\s+perlahan|perlahan-lahan|perlahan)\b/gi, '')
    .replace(/^menulis\s+(copy\s+ads\s+manual)/i, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  // Clean leading/trailing symbols
  text = text.replace(/^[^a-zA-Z0-9\u00C0-\u024F"']+|[^a-zA-Z0-9\u00C0-\u024F"?!.']+$/g, '').trim();

  // Word count check (max 6-10 words)
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > 10) {
    let selectedWords = words.slice(0, 8);
    const lastWord = selectedWords[selectedWords.length - 1].toLowerCase();
    if (['yang', 'dan', 'di', 'ke', 'dari', 'untuk', 'pada', 'dengan', 'agar', 'bisa', 'saat', 'ketika', 'atau', 'karena'].includes(lastWord)) {
      selectedWords.pop();
    }
    text = selectedWords.join(' ');
    if (!/[?!.]$/.test(text)) {
      text += '?';
    }
  } else if (funnelStage === 'TOFU' && !/[?!.]$/.test(text)) {
    if (/membunuh|hancur|kaku|rusak|gagal|mentok|sulit|susah|capek|lelah|bingung|rugi|hilang|bocor/i.test(text)) {
      text += '?';
    }
  }

  // Ensure no ellipsis exists
  text = text.replace(/\.{2,}/g, '').replace(/…/g, '').trim();
  return text || 'Tinjauan Strategis & Pemecahan Masalah';
};

const buildDefaultCaptionForImage = (headline: string, funnelStage: string, angleId: string, shortOverlay: string): string => {
  const cleanHeadline = (headline || '').trim();

  if (funnelStage === 'TOFU') {
    if (angleId === 'A') {
      return cleanHeadline
        ? `Banyak yang menghadapi tantangan seputar "${cleanHeadline}". Sering kali hal ini terjadi karena belum menemukan pendekatan yang tepat. Simak ulasan berikut untuk menemukan sudut pandang baru yang lebih praktis.`
        : 'Menghadapi tantangan tanpa pemahaman yang tepat sering kali membuat proses terasa melelahkan. Simak ulasan berikut untuk menemukan pendekatan baru yang lebih praktis.';
    }
    if (angleId === 'B') {
      return cleanHeadline
        ? `Terkait "${cleanHeadline}", sering kali kita merasa sudah berusaha maksimal tapi hasilnya belum sesuai harapan. Masalahnya bukan pada niat, melainkan langkah awal yang perlu disesuaikan.`
        : 'Sering kali kita merasa sudah berusaha maksimal tapi hasilnya belum sesuai harapan. Masalahnya bukan pada niat, melainkan langkah awal yang perlu disesuaikan.';
    }
    return cleanHeadline
      ? `Satu wawasan penting mengenai "${cleanHeadline}" adalah mengevaluasi kejelasan tujuan sebelum mengambil tindakan. Luangkan waktu sejenak untuk meninjau kembali pendekatan yang digunakan.`
      : 'Satu wawasan penting adalah mengevaluasi kejelasan tujuan sebelum mengambil tindakan. Luangkan waktu sejenak untuk meninjau kembali pendekatan yang digunakan.';
  } else if (funnelStage === 'MOFU') {
    if (angleId === 'A') {
      return cleanHeadline
        ? `Terkait "${cleanHeadline}", memahami alur dan metode yang terstruktur membantu mengatasi persoalan secara lebih menyeluruh dan berkelanjutan.`
        : 'Memahami alur dan metode yang terstruktur membantu mengatasi persoalan secara lebih menyeluruh dan berkelanjutan.';
    }
    if (angleId === 'B') {
      return cleanHeadline
        ? `Pendekatan yang tepat terhadap "${cleanHeadline}" menghubungkan kebutuhan utama dengan solusi yang terbukti secara logis.`
        : 'Pendekatan yang tepat menghubungkan kebutuhan utama dengan solusi yang terbukti secara logis.';
    }
    return cleanHeadline
      ? `Berikut poin penting yang perlu diperhatikan seputar "${cleanHeadline}": pahami inti masalah, telaah opsi solusi yang ada, dan ambil langkah terarah.`
      : 'Berikut poin penting yang perlu diperhatikan: pahami inti masalah, telaah opsi solusi yang ada, dan ambil langkah terarah.';
  } else {
    // BOFU
    if (angleId === 'A') {
      return cleanHeadline
        ? `Dapatkan solusi terpercaya untuk "${cleanHeadline}". Mulai langkah terbaikmu sekarang dan rasakan kemudahan serta manfaat nyatanya.`
        : 'Dapatkan solusi terpercaya untuk kebutuhanmu. Mulai langkah terbaikmu sekarang dan rasakan kemudahan serta manfaat nyatanya.';
    }
    if (angleId === 'B') {
      return cleanHeadline
        ? `Pelajari bagaimana solusi praktis untuk "${cleanHeadline}" dapat membantu mencapai hasil optimal secara efisien.`
        : 'Pelajari bagaimana solusi praktis ini dapat membantu mencapai hasil optimal secara efisien.';
    }
    return cleanHeadline
      ? `Siap mengambil keputusan terbaik seputar "${cleanHeadline}"? Cek detail lengkapnya sekarang.`
      : 'Siap mengambil keputusan terbaik untuk kebutuhanmu? Cek detail lengkapnya sekarang.';
  }
};

const getBrandVisualRulesBlock = (ctx?: any) => {
  const brandVis = ctx?.brand_visual_context || ctx?.brandVisualContext;
  if (!brandVis || typeof brandVis !== 'object') return '';
  const vStyle = brandVis.visual_style || brandVis.visualStyle || '';
  const cPalette = brandVis.color_palette || brandVis.colorPalette;
  const tStyle = brandVis.typography_style || brandVis.typographyStyle || '';
  const iRules = brandVis.image_style_rules || brandVis.imageStyleRules;
  const dMood = brandVis.design_mood || brandVis.designMood || '';

  if (!vStyle && !cPalette && !tStyle && !iRules && !dMood) return '';

  const colorStr = Array.isArray(cPalette) ? cPalette.join(', ') : (cPalette || '-');
  const rulesStr = Array.isArray(iRules) ? iRules.join('; ') : (iRules || '-');

  return `\n\nBrand Visual Rules:\n- Visual Style: ${vStyle || '-'}\n- Color Palette: ${colorStr}\n- Typography Style: ${tStyle || '-'}\n- Image Style Rules: ${rulesStr}\n- Design Mood: ${dMood || '-'}`;
};

const sanitizeAndAlignImageAngle = (
  item: any,
  globalFunnelStage: string,
  coreHeadline: string,
  angleIndex: number,
  activeContext?: any,
  attachProductionCandidate: boolean = true
): ImageAngle | null => {
  if (!item || typeof item !== 'object') return null;

  const rawId = String(item.id || '')
    .toUpperCase()
    .trim();

  if (rawId !== 'A' && rawId !== 'B' && rawId !== 'C') {
    return null;
  }

  const id: 'A' | 'B' | 'C' = rawId as 'A' | 'B' | 'C';

  const rawStage = (['TOFU', 'MOFU', 'BOFU'].includes(globalFunnelStage) 
    ? globalFunnelStage 
    : String(item.funnelStage || item.funnel_stage || '').toUpperCase().trim());

  if (!['TOFU', 'MOFU', 'BOFU'].includes(rawStage)) {
    return null;
  }
  const funnelStage = rawStage as 'TOFU' | 'MOFU' | 'BOFU';

  let name = String(item.name || '').trim();
  if (!name) {
    if (funnelStage === 'TOFU') {
      name = id === 'A' ? 'Relatable Problem Hook' : id === 'B' ? 'Everyday Creator Struggle' : 'Curiosity Hook';
    } else if (funnelStage === 'MOFU') {
      name = id === 'A' ? 'Insight & Framework Hook' : id === 'B' ? 'Solution Comparison Hook' : 'Structured Workflow Hook';
    } else {
      name = id === 'A' ? 'Social Proof & Community Hook' : id === 'B' ? 'Product Demo & Results Hook' : 'Direct Value & Decision Hook';
    }
  }

  const rawHeadline = (coreHeadline || item.headline || item.textOverlay || '').trim();

  const bofuTriggers = [
    'beli', 'diskon', 'promo', 'order', 'checkout', 'daftar sekarang',
    'terakhir', 'bonus', 'eksklusif', 'peluang emas', 'slot terbatas',
    'harga khusus', 'klik link', 'dm sekarang', 'garansi'
  ];

  const rawVisualObjective = String(item.visualObjective || item.visual_objective || '').trim();
  const rawTextOverlay = String(item.textOverlay || item.text_overlay || '').trim();
  const rawPrompt = String(item.finalPrompt || item.final_prompt || '').trim();

  const extractedObjective = extractPromptField('Visual Objective', rawPrompt) || rawVisualObjective;
  const extractedSubject = extractPromptField('Subject', rawPrompt) || String(item.subject || '').trim();
  const extractedAction = extractPromptField('Action', rawPrompt) || String(item.action || '').trim();
  const extractedExpression = extractPromptField('Expression', rawPrompt) || String(item.expression || '').trim();
  const extractedEnvironment = extractPromptField('Environment', rawPrompt) || String(item.environment || '').trim();
  const extractedComposition = extractPromptField('Composition', rawPrompt) || String(item.composition || '').trim();
  const extractedLighting = extractPromptField('Lighting', rawPrompt) || String(item.lighting || '').trim();
  const extractedCamera = extractPromptField('Camera', rawPrompt) || String(item.camera || '').trim();
  const extractedStyle = extractPromptField('Visual Style', rawPrompt) || String(item.visualStyle || item.visual_style || '').trim();
  const extractedOverlayInPrompt = extractPromptField('Text Overlay', rawPrompt).replace(/^"|"$/g, '').trim();

  // Content-bearing fields must NOT be missing or empty
  if (!extractedObjective || !extractedSubject || !extractedAction || !extractedExpression || !extractedEnvironment) {
    return null;
  }

  const visualObjective = extractedObjective;
  const subject = extractedSubject;
  const action = extractedAction;
  const expression = extractedExpression;
  const environment = extractedEnvironment;

  // Funnel alignment check - detect conflict and FAIL CLOSED (do not repair with generic marketing content)
  if (funnelStage === 'TOFU') {
    const hasBofuObjective = /keputusan|beli|offer|demo|social proof|closing|hasil nyata/i.test(visualObjective);
    if (hasBofuObjective) return null;

    const hasBofuAction = /melihat dashboard hasil|analitik pertumbuhan|komunitas sukses|testimoni klien|siap membeli|closing/i.test(action);
    if (hasBofuAction) return null;

    const hasWrongExp = /closing|siap membeli/i.test(expression);
    if (hasWrongExp) return null;
  } else if (funnelStage === 'MOFU') {
    const isMismatched = /daftar sekarang|beli|hard selling|closing/i.test(visualObjective);
    if (isMismatched) return null;

    const hasWrongAction = /membeli sekarang|checkout|daftar sekarang/i.test(action);
    if (hasWrongAction) return null;
  } else {
    // BOFU
    const hasTofuObjective = /kesadaran awal|awareness alami|tanpa unsur jualan|frustrasi kecil/i.test(visualObjective);
    if (hasTofuObjective) return null;

    const hasTofuAction = /frustrasi kecil|ide konten mentok/i.test(action);
    if (hasTofuAction) return null;
  }

  // Text Overlay resolution (must be authoritatively present, clean, non-placeholder, non-empty)
  let textOverlay = (rawTextOverlay || extractedOverlayInPrompt || '').replace(/^"|"$/g, '').trim();
  if (!textOverlay || textOverlay.includes('...') || textOverlay.includes('…') || textOverlay.includes('[Tulis hook') || textOverlay.length < 3) {
    return null;
  }

  // Remove multi-dots/ellipsis from real text overlay
  textOverlay = textOverlay.replace(/\.{2,}/g, '').replace(/…/g, '').trim();
  if (!textOverlay) return null;

  const overlayLower = textOverlay.toLowerCase();
  if (funnelStage === 'TOFU') {
    const hasBofuOverlay = bofuTriggers.some(t => overlayLower.includes(t));
    if (hasBofuOverlay) return null;
  } else if (funnelStage === 'MOFU') {
    const hasHardBofu = ['beli sekarang', 'daftar sekarang', 'diskon 50%', 'slot terbatas', 'checkout'].some(t => overlayLower.includes(t));
    if (hasHardBofu) return null;
  } else {
    // BOFU: cannot be purely naive question without value/action
    const isTofuQuestion = /kok caption.*kaku|kenapa tulisan.*kaku|udah nulis lama.*hambar/i.test(overlayLower);
    if (isTofuQuestion) return null;
  }

  // Caption for post resolution (must be authoritatively present, non-placeholder, non-empty)
  let captionForPost = String(item.captionForPost || item.caption_for_post || '').trim();
  if (!captionForPost || captionForPost === '...' || captionForPost === '…' || captionForPost.includes('[Tulis caption') || captionForPost.includes('[Caption') || captionForPost.length < 5) {
    return null;
  }

  // Safe visual production rules fallbacks
  const composition = extractedComposition || "Subjek di kanan tengah, menyisakan ruang negatif bersih yang lapang di area kiri atas untuk headline teks, framing rule of thirds editorial.";
  const lighting = extractedLighting || "Cahaya alami lembut masuk dari jendela samping (soft warm ambient light), pencahayaan natural berdimensi.";
  const camera = extractedCamera || "50mm f/2.0 lens photography feel, eye-level, depth of field halus dengan latar belakang sedikit blur (subtle bokeh).";
  const visualStyle = extractedStyle || "Clean editorial Instagram photography, otentik bergaya dokumenter estetis, warna natural hangat, bukan poster iklan ramai atau foto stok generik.";
  const negativeConstraints = 'hard selling ads, cluttered poster, too much text, generic stock photo, unreadable text, distorted face, extra fingers, corporate cliche, overdesigned graphic.';

  // Reconstruct strict canonical finalPrompt
  const finalPrompt = `Buatkan saya image untuk konten Instagram (format 4:5 vertical editorial):

Funnel Stage: ${funnelStage}
Visual Objective: ${visualObjective}
Subject: ${subject}
Action: ${action}
Expression: ${expression}
Environment: ${environment}
Composition: ${composition}
Lighting: ${lighting}
Camera: ${camera}
Visual Style: ${visualStyle}
Typography: Headline besar 3-5 baris di kiri atas, editorial typography, high contrast, satu frasa penting boleh diberi subtle highlight, tidak ada teks kecil lain.
Text Overlay: "${textOverlay}"${getBrandVisualRulesBlock(activeContext)}
Negative Prompt: ${negativeConstraints}`;

  const messageAlignmentCheck: MessageAlignmentCheck = {
    isAligned: true,
    fixedTextOverlay: textOverlay,
    reason: `Selaras 100% dengan corong ${funnelStage}: Visual Objective, Action, Expression, dan Text Overlay terbukti sinkron tanpa konflik.`,
  };

  const rawBrief = item.strategyBrief || item.strategy_brief || {};
  const rawAudience = String(rawBrief.audienceContext || rawBrief.audience_context || '').trim();
  const contextAudience = activeContext?.audience_context?.primary_audience?.trim() || '';
  const resolvedAudience = rawAudience || contextAudience || '';

  const strategyBrief: StrategyBrief = {
    funnelStage,
    tujuanKonten: String(rawBrief.tujuanKonten || rawBrief.tujuan_konten || getFunnelRules(funnelStage).goal || '').trim(),
    ideUtama: String(rawBrief.ideUtama || rawBrief.ide_utama || coreHeadline || rawHeadline || name).trim(),
    audienceContext: resolvedAudience,
    angle: name,
    emosiUtama: String(rawBrief.emosiUtama || rawBrief.emosi_utama || (funnelStage === 'TOFU' ? 'Merasa relate, penasaran' : funnelStage === 'MOFU' ? 'Tersadar, momen Aha!' : 'Percaya, yakin, mantap')).trim(),
    pesanVisual: String(rawBrief.pesanVisual || rawBrief.pesan_visual || visualObjective).trim(),
  };

  const productionCandidate = attachProductionCandidate
    ? buildImageProductionCandidate({
        candidate_id: id,
        visualObjective,
        scene: `${action} ${expression}`.trim(),
        subject,
        composition,
        environment,
        lighting,
        camera,
        visualStyle,
        textOverlay,
        branding: '',
        negativeConstraints,
        finalPrompt,
      })
    : undefined;

  if (attachProductionCandidate && productionCandidate) {
    const candidateVal = validateProductionCandidate(productionCandidate);
    if (!candidateVal.isValid) {
      return null;
    }
  }

  return {
    id,
    name,
    funnelStage,
    visualObjective,
    contentGoal: strategyBrief.tujuanKonten,
    targetEmotion: strategyBrief.emosiUtama,
    visualStrategy: strategyBrief.pesanVisual,
    hookStrategy: String(item.hookStrategy || item.hook_strategy || `Gunakan pendekatan visual ${name} yang otentik.`).trim(),
    layoutStrategy: composition,
    textOverlay,
    captionForPost,
    captionInstruction: item.captionInstruction || item.caption_instruction || 'Paste teks ini di caption/keterangan postingan setelah gambar dibuat.',
    colorPsychology: String(item.colorPsychology || item.color_psychology || (funnelStage === 'TOFU' ? 'Warm earth tones & soft natural light' : funnelStage === 'MOFU' ? 'Refined slate & crisp teal' : 'Deep emerald & warm golden amber')).trim(),
    ctaRecommendation: String(item.ctaRecommendation || item.cta_recommendation || (funnelStage === 'BOFU' ? 'Daftar sekarang / Hubungi kami' : funnelStage === 'MOFU' ? 'Cek framework ini' : 'Simpan postingan ini')).trim(),
    strategyBrief,
    messageAlignmentCheck,
    finalPrompt,
    productionCandidate,
  };
};

const validateAndNormalizeImageAngles = (
  rawText: string,
  activeItem?: any,
  activeContext?: any,
  attachProductionCandidate: boolean = true
): string | null => {
  if (!rawText) return null;
  const parsed = tryParseJSON(rawText);
  if (!parsed) return null;

  let anglesArray: any[] = [];
  let recommendedAngleId: 'A' | 'B' | 'C' = 'A';
  let recommendationReason = '';

  if (typeof parsed === 'object' && parsed !== null) {
    if (Array.isArray((parsed as any).angles)) {
      anglesArray = (parsed as any).angles;
    } else if (Array.isArray(parsed)) {
      anglesArray = parsed as any[];
    }

    if ((parsed as any).recommendedAngleId) {
      const rawRecId = String((parsed as any).recommendedAngleId).toUpperCase().trim();
      if (rawRecId === 'A' || rawRecId === 'B' || rawRecId === 'C') {
        recommendedAngleId = rawRecId as 'A' | 'B' | 'C';
      }
    }

    if ((parsed as any).recommendationReason) {
      recommendationReason = String((parsed as any).recommendationReason).trim();
    }
  }

  // Exactly 3 angles required
  if (!Array.isArray(anglesArray) || anglesArray.length !== 3) {
    return null;
  }

  // Derive authoritative funnel stage
  const itemStage = parseStrictFunnelStage(activeItem?.jenis);
  const angleStageRaw = anglesArray[0]?.funnelStage || anglesArray[0]?.funnel_stage;
  const angleStage = parseStrictFunnelStage(
    typeof angleStageRaw === 'string' ? angleStageRaw : undefined
  );

  if (itemStage && angleStage && itemStage !== angleStage) {
    return null;
  }

  const funnelStage = itemStage || angleStage;
  if (!funnelStage) {
    return null;
  }
  const coreHeadline = String(activeItem?.headline || '').trim();

  const validAngles: ImageAngle[] = [];

  for (let i = 0; i < anglesArray.length; i++) {
    const item = anglesArray[i];
    if (!item || typeof item !== 'object') return null;

    const alignedAngle = sanitizeAndAlignImageAngle(
      item,
      funnelStage,
      coreHeadline,
      i,
      activeContext,
      attachProductionCandidate
    );
    if (!alignedAngle) {
      return null;
    }
    validAngles.push(alignedAngle);
  }

  if (validAngles.length !== 3) {
    return null;
  }

  const ids = new Set(validAngles.map(a => a.id));
  if (ids.size !== 3 || !ids.has('A') || !ids.has('B') || !ids.has('C')) {
    return null;
  }

  if (!recommendationReason) {
    recommendationReason = funnelStage === 'TOFU'
      ? "Angle Relatable Problem Hook direkomendasikan untuk membangun kesadaran awal (TOFU) secara organik tanpa resistensi audiens."
      : funnelStage === 'MOFU'
      ? "Angle Insight & Framework Hook direkomendasikan untuk membangun pemahaman dan otoritas edukatif yang kuat (MOFU)."
      : "Angle Social Proof & Value Hook direkomendasikan untuk membuktikan hasil nyata dan memvalidasi keputusan bergabung (BOFU).";
  }

  return JSON.stringify({
    recommendedAngleId,
    recommendationReason,
    angles: validAngles
  }, null, 2);
};

// Helper function for Carousel-specific strict prompt line extraction (strictly ONE line per label)
const extractCarouselPromptLine = (field: string, text: string): string => {
  const escapedField = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^[ \\t]*${escapedField}:[ \\t]*(.*)$`, 'im');
  const match = text.match(regex);
  return match ? match[1].trim() : '';
};

// Helper function to build / sanitize ready-to-use 14-field slide image prompt for image generators / designers
const sanitizeAndGenerateSlideImagePrompt = (
  rawPrompt: string | undefined,
  slideNumber: number,
  role: string,
  headline: string,
  funnelStage: string,
  visualIntent?: string,
  visualFormat?: VisualFormatType,
  activeContext?: any
): string | null => {
  // 1. Role validation - strict canonical role check
  const normRole = (role || '').toLowerCase().trim();
  const allowedRoles = ['hook', 'problem', 'reframe', 'learn', 'cta'];
  if (!allowedRoles.includes(normRole)) {
    return null;
  }

  let capitalizedRole = 'Hook';
  if (normRole === 'hook') {
    capitalizedRole = 'Hook';
  } else if (normRole === 'problem') {
    capitalizedRole = 'Problem';
  } else if (normRole === 'reframe') {
    capitalizedRole = 'Reframe';
  } else if (normRole === 'learn') {
    capitalizedRole = 'How It Works / Value';
  } else if (normRole === 'cta') {
    capitalizedRole = 'CTA';
  }

  // 2. Funnel validation - strictly TOFU | MOFU | BOFU
  const normFunnel = String(funnelStage || '').toUpperCase().trim();
  if (normFunnel !== 'TOFU' && normFunnel !== 'MOFU' && normFunnel !== 'BOFU') {
    return null;
  }

  // 3. Visual format validation - strictly photography | infographic | hybrid
  const format = String(visualFormat || '').toLowerCase().trim();
  if (format !== 'photography' && format !== 'infographic' && format !== 'hybrid') {
    return null;
  }

  // 4. Text Overlay validation - strictly authoritative headline as-is, no synthetic copies
  const textOverlay = (headline || '').trim();
  if (!textOverlay || textOverlay === '...' || textOverlay === '…' || textOverlay.includes('[Tulis') || textOverlay.length < 3) {
    return null;
  }

  // 5. Raw prompt authority requirement
  if (!rawPrompt) {
    return null;
  }
  const p = rawPrompt.trim();
  if (!p) {
    return null;
  }

  // 6. Extract and validate required authoritative semantic fields (FAIL CLOSED if any is missing or placeholder)
  const visualObjective = extractCarouselPromptLine('Visual Objective', p) || (visualIntent ? visualIntent.trim() : '');
  const subjectObject = extractCarouselPromptLine('Subject/Object', p) || extractCarouselPromptLine('Subject', p);
  const actionScene = extractCarouselPromptLine('Action/Scene', p) || extractCarouselPromptLine('Action', p);
  const expressionEmotion = extractCarouselPromptLine('Expression/Emotion', p) || extractCarouselPromptLine('Expression', p);
  const environment = extractCarouselPromptLine('Environment', p);

  if (!visualObjective || !subjectObject || !actionScene || !expressionEmotion || !environment) {
    return null;
  }

  if (
    visualObjective === '...' || visualObjective.includes('[') ||
    subjectObject === '...' || subjectObject.includes('[') ||
    actionScene === '...' || actionScene.includes('[') ||
    expressionEmotion === '...' || expressionEmotion.includes('[') ||
    environment === '...' || environment.includes('[')
  ) {
    return null;
  }

  // 7. Extract safe visual styling fields with safe mechanical fallbacks
  const extractedComposition = extractCarouselPromptLine('Composition', p);
  const extractedLighting = extractCarouselPromptLine('Lighting', p);
  const extractedCamera = extractCarouselPromptLine('Camera/Graphic Style', p) || extractCarouselPromptLine('Camera', p);
  const extractedVisualStyle = extractCarouselPromptLine('Visual Style', p);
  const extractedTypography = extractCarouselPromptLine('Typography', p);
  const extractedNegativePrompt = extractCarouselPromptLine('Negative Prompt', p);

  const composition = extractedComposition || (format === 'infographic'
    ? "Center card layout / structured split grid dengan ruang negatif 40% lapang di area atas untuk headline."
    : "Subjek di kanan tengah, ruang kosong luas di kiri atas untuk headline.");

  const lighting = extractedLighting || (format === 'infographic'
    ? "Clean flat ambient studio lighting dengan subtle soft drop shadow pada kartu grafis."
    : "Cahaya alami lembut dari jendela samping.");

  let cameraGraphicStyle = extractedCamera || (format === 'infographic'
    ? "High-resolution modern 2D graphic design / clean vector UI render / minimalist typography poster layout."
    : "50mm editorial photography, shallow depth of field.");

  const visualStyle = extractedVisualStyle || (format === 'infographic'
    ? "Clean modern editorial infographic design, minimalis, rapi, bebas dari kesan poster iklan ramai."
    : format === 'hybrid'
    ? "Clean hybrid editorial Instagram content, perpaduan foto autentik dengan kartu grafis terstruktur."
    : "Clean editorial Instagram photography, natural, otentik, tidak seperti iklan komersial kaku.");

  const typography = extractedTypography || "Headline besar 3-5 baris di kiri atas, high contrast, tidak ada teks kecil lain.";

  let negativePrompt = extractedNegativePrompt || (format === 'infographic'
    ? "photography, realistic person, complex faces, human hands, messy sketch, stock photo, blurry text, cluttered layout, hard selling ads, 3d glossy render."
    : "hard selling ads, cluttered poster, too much text, generic stock photo, unreadable typography, distorted face, extra fingers, corporate cliche, overdesigned graphic.");

  // 8. Safe infographic sanitation (styling only, no semantic data alteration)
  if (format === 'infographic') {
    if (/50mm|35mm|lens|f\/1\.|bokeh/i.test(cameraGraphicStyle)) {
      cameraGraphicStyle = "High-resolution modern 2D graphic design / clean vector UI render / minimalist typography poster layout.";
    }
    if (!negativePrompt.includes('photography')) {
      negativePrompt = "photography, realistic person, complex faces, human hands, messy sketch, stock photo, blurry text, cluttered layout, hard selling ads, 3d glossy render.";
    }
  }

  return `Buatkan saya image untuk slide carousel Instagram 4:5.

Funnel Stage: ${normFunnel}
Slide Role: ${capitalizedRole}
Visual Objective: ${visualObjective}
Subject/Object: ${subjectObject}
Action/Scene: ${actionScene}
Expression/Emotion: ${expressionEmotion}
Environment: ${environment}
Composition: ${composition}
Lighting: ${lighting}
Camera/Graphic Style: ${cameraGraphicStyle}
Visual Style: ${visualStyle}
Typography: ${typography}
Text Overlay: '${textOverlay}'${getBrandVisualRulesBlock(activeContext)}
Negative Prompt: ${negativePrompt}`;
};

// Helper function to validate and normalize Carousel Plan JSON output to canonical 1-object schema
const validateAndNormalizeCarouselPlan = (
  rawText: string,
  activeItem?: any,
  activeContext?: any,
  attachProductionCandidate: boolean = true
): string | null => {
  if (!rawText) return null;
  const parsed = tryParseJSON(rawText);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

  // Strict funnel stage validation - fail closed without permissive fallbacks
  const rawFunnel = String(parsed.funnel_stage || parsed.funnelStage || '').toUpperCase().trim();
  const funnelStage = parseStrictFunnelStage(rawFunnel);
  if (!funnelStage) return null;

  const itemStage = parseStrictFunnelStage(activeItem?.jenis);
  if (itemStage && itemStage !== funnelStage) {
    return null;
  }

  // Required top-level content facts - fail closed, no synthetic content generation
  const contentGoal = String(parsed.content_goal || parsed.contentGoal || '').trim();
  const currentBelief = String(parsed.current_belief || parsed.currentBelief || '').trim();
  const desiredBelief = String(parsed.desired_belief || parsed.desiredBelief || '').trim();
  const corePromise = String(parsed.core_promise || parsed.corePromise || '').trim();

  if (!contentGoal || !currentBelief || !desiredBelief || !corePromise) {
    return null;
  }

  // Required primary CTA fields
  const primaryCtaType = String(parsed.primary_cta_type || parsed.primaryCtaType || parsed.cta_type || parsed.ctaType || '').trim();
  const primaryCtaText = String(parsed.primary_cta_text || parsed.primaryCtaText || parsed.cta_text || parsed.ctaText || '').trim();

  if (!primaryCtaType || !primaryCtaText || primaryCtaText === '...' || primaryCtaText === '…' || primaryCtaText.includes('[Tulis CTA')) {
    return null;
  }

  // Slide count and slides array: strictly 5 slides
  if (parsed.slide_count === undefined || Number(parsed.slide_count) !== 5) {
    return null;
  }

  const rawSlides = parsed.slides;
  if (!Array.isArray(rawSlides) || rawSlides.length !== 5) {
    return null;
  }

  const expectedRoles = ['hook', 'problem', 'reframe', 'learn', 'cta'];
  const hardSellingTriggers = [
    'beli', 'diskon', 'promo', 'order', 'checkout', 'daftar sekarang',
    'terakhir', 'bonus', 'eksklusif', 'peluang emas', 'slot terbatas',
    'harga khusus', 'klik link', 'dm sekarang', 'garansi', 'buruan beli', 'kenapa harus beli'
  ];
  const validatedSlides: CarouselSlide[] = [];

  for (let i = 0; i < 5; i++) {
    const s = rawSlides[i];
    if (!s || typeof s !== 'object' || Array.isArray(s)) return null;

    const slideNumber = Number(s.slide);
    if (slideNumber !== i + 1) return null;

    const role = String(s.role || '').toLowerCase().trim();
    if (role !== expectedRoles[i]) return null;

    const communicationJob = String(s.communication_job || s.communicationJob || '').trim();
    const headline = String(s.headline || '').trim();
    const body = String(s.body || '').trim();
    const swipeBridge = String(s.swipe_bridge || s.swipeBridge || '').trim();
    const emotionalState = String(s.emotional_state || s.emotionalState || '').trim();
    const coreMessage = String(s.core_message || s.coreMessage || '').trim();
    const audienceEmotion = String(s.audience_emotion || s.audienceEmotion || '').trim();

    if (!communicationJob || !headline || !body || !swipeBridge || !emotionalState || !coreMessage || !audienceEmotion) {
      return null;
    }
    if (headline === '...' || headline.includes('[') || body === '...' || body.includes('[')) {
      return null;
    }

    // Fail-closed checks on hard-selling / unverified claims / weak cta
    const hLower = headline.toLowerCase();
    const bLower = body.toLowerCase();

    if (slideNumber === 1 && funnelStage !== 'BOFU') {
      const hasHardSelling = hardSellingTriggers.some(t => hLower.includes(t)) || /kenapa harus beli|peluang emas|buruan beli|ratusan pemilik/i.test(hLower);
      if (hasHardSelling) {
        return null;
      }
    }

    if (slideNumber === 4 || slideNumber === 5) {
      const hasUnverifiedClaims = /hasil.*melampaui\s*target|testimoni\s*terverifikasi|ratusan\s*pengguna.*sukses|omzet\s*miliaran|terbukti\s*100%/i.test(hLower) || /hasil.*melampaui\s*target|testimoni\s*terverifikasi|ratusan\s*pengguna.*sukses|omzet\s*miliaran/i.test(bLower);
      if (hasUnverifiedClaims && !activeItem?.proof_data) {
        return null;
      }
    }

    if (slideNumber === 5) {
      if (/^link\s*(di\s*)?bio!?$/i.test(hLower) || /^klik\s*link!?$/i.test(hLower) || hLower.length < 5) {
        return null;
      }
    }

    // Visual format validation
    const visualFormatRaw = String(s.visual_format || s.visualFormat || '').toLowerCase().trim();
    if (visualFormatRaw !== 'photography' && visualFormatRaw !== 'infographic' && visualFormatRaw !== 'hybrid') {
      return null;
    }
    const visualFormat: VisualFormatType = visualFormatRaw as VisualFormatType;

    // Visual fields validation
    const visualIntent = String(s.visual_intent || s.visualIntent || '').trim();
    const visualType = String(s.visual_type || s.visualType || '').trim();
    const textZone = String(s.text_zone || s.textZone || '').trim();
    const negativeSpacePlan = String(s.negative_space_plan || s.negativeSpacePlan || '').trim();
    const productionPrompt = String(s.production_prompt || s.productionPrompt || '').trim();
    const rawSlideImgPrompt = String(s.slide_image_prompt || s.slideImagePrompt || '').trim();

    if (!visualIntent || !visualType || !textZone || !negativeSpacePlan || !productionPrompt || !rawSlideImgPrompt) {
      return null;
    }

    // Visual production validation
    const vp = s.visual_production || s.visualProduction;
    if (!vp || typeof vp !== 'object' || Array.isArray(vp)) {
      return null;
    }

    const subject = String(vp.subject || '').trim();
    const action = String(vp.action || '').trim();
    const composition = String(vp.composition || '').trim();
    const layout = String(vp.layout || '').trim();
    const visualMetaphor = String(vp.visual_metaphor || vp.visualMetaphor || '').trim();
    const typography = String(vp.typography || '').trim();
    const background = String(vp.background || '').trim();
    const colorMood = String(vp.color_mood || vp.colorMood || '').trim();
    const negativeSpace = String(vp.negative_space || vp.negativeSpace || '').trim();
    const negativePrompt = String(vp.negative_prompt || vp.negativePrompt || '').trim();

    if (
      !subject || !action || !composition || !layout || !visualMetaphor ||
      !typography || !background || !colorMood || !negativeSpace || !negativePrompt
    ) {
      return null;
    }

    // Creative strategy
    const cs = s.creative_strategy || s.creativeStrategy;
    const creativeStrategy: SlideCreativeStrategy = {
      funnel_stage: funnelStage,
      slide_role: role,
      visual_objective: String(cs?.visual_objective || cs?.visualObjective || visualIntent).trim(),
      core_message: String(cs?.core_message || cs?.coreMessage || coreMessage).trim(),
      audience_emotion: String(cs?.audience_emotion || cs?.audienceEmotion || audienceEmotion).trim(),
      visual_concept: String(cs?.visual_concept || cs?.visualConcept || visualMetaphor).trim(),
      text_overlay: String(cs?.text_overlay || cs?.textOverlay || headline).trim(),
    };

    const slideImagePrompt = sanitizeAndGenerateSlideImagePrompt(
      rawSlideImgPrompt,
      slideNumber,
      role,
      headline,
      funnelStage,
      visualIntent,
      visualFormat,
      activeContext
    );

    if (!slideImagePrompt) {
      return null;
    }

    validatedSlides.push({
      slide: slideNumber,
      role,
      communication_job: communicationJob,
      headline,
      body,
      swipe_bridge: swipeBridge,
      emotional_state: emotionalState,
      visual_intent: visualIntent,
      visual_type: visualType,
      text_zone: textZone,
      negative_space_plan: negativeSpacePlan,
      creative_strategy: creativeStrategy,
      visual_format: visualFormat,
      visual_production: {
        subject,
        action,
        composition,
        layout,
        visual_metaphor: visualMetaphor,
        typography,
        background,
        color_mood: colorMood,
        negative_space: negativeSpace,
        negative_prompt: negativePrompt,
      },
      production_prompt: productionPrompt,
      slide_image_prompt: slideImagePrompt,
    });
  }

  const slideCountReason = String(
    parsed.slide_count_reason || parsed.slideCountReason || ''
  ).trim() || '5 Slide optimal untuk alur narasi Hook → Problem → Reframe → Solution → CTA.';

  const beliefJourneySummary = String(
    parsed.belief_journey_summary || parsed.beliefJourneySummary || ''
  ).trim();
  if (!beliefJourneySummary) {
    return null;
  }

  const visualSystemNotes = String(
    parsed.visual_system_notes || parsed.visualSystemNotes || ''
  ).trim();
  if (!visualSystemNotes) {
    return null;
  }

  const captionForPost = String(parsed.captionForPost || parsed.caption_for_post || '').trim();
  if (
    !captionForPost ||
    captionForPost.includes('[Tulis caption') ||
    captionForPost.includes('...') ||
    (captionForPost.startsWith('[') && captionForPost.endsWith(']')) ||
    captionForPost.toLowerCase().includes('lorem ipsum')
  ) {
    return null;
  }
  const defaultCaptionInstruction = 'Paste teks ini di caption/keterangan postingan setelah aset dibuat.';
  const captionInstruction = String(parsed.captionInstruction || parsed.caption_instruction || defaultCaptionInstruction).trim() || defaultCaptionInstruction;

  const slidePlans: CarouselSlideProductionPlan[] = validatedSlides.map((slide) => ({
    slide_number: slide.slide,
    role: slide.role,
    headline: slide.headline,
    body: slide.body,
    visual_direction: slide.visual_intent,
    layout_direction: slide.visual_production?.layout || slide.text_zone || '',
  }));

  const slidePrompts = validatedSlides.map((slide) => ({
    slide_number: slide.slide,
    prompt: slide.slide_image_prompt,
  }));

  const coverDirection =
    validatedSlides[0]?.visual_intent ||
    validatedSlides[0]?.visual_production?.composition ||
    '';

  const carouselCandidate = attachProductionCandidate
    ? buildCarouselProductionCandidate({
        candidate_id: 'carousel_plan',
        objective: contentGoal,
        slide_count: 5,
        cover_direction: coverDirection,
        slides: slidePlans,
        visual_continuity: visualSystemNotes,
        branding: '',
        negative_constraints:
          validatedSlides[0]?.visual_production?.negative_prompt ||
          'hard selling ads, cluttered poster, too much text, generic stock photo, unreadable typography, distorted face, extra fingers.',
        final_prompts: {
          master_prompt: visualSystemNotes,
          slides: slidePrompts,
        },
      })
    : undefined;

  if (attachProductionCandidate && carouselCandidate) {
    const candidateValidation = validateProductionCandidate(carouselCandidate);
    if (!candidateValidation.isValid) {
      return null;
    }
  }

  const canonicalPlan: CarouselPlan = {
    content_goal: contentGoal,
    funnel_stage: funnelStage,
    current_belief: currentBelief,
    desired_belief: desiredBelief,
    core_promise: corePromise,
    primary_cta_type: primaryCtaType,
    primary_cta_text: primaryCtaText,
    slide_count: 5,
    slide_count_reason: slideCountReason,
    belief_journey_summary: beliefJourneySummary,
    captionForPost,
    captionInstruction,
    messageAlignmentCheck: {
      isAligned: true,
      issue: undefined,
      fixApplied: `Penyelarasan pesan dan alur narasi telah divalidasi sesuai corong ${funnelStage}.`,
    },
    visual_system_notes: visualSystemNotes,
    slides: validatedSlides,
    productionCandidate: carouselCandidate,
  };

  return JSON.stringify(canonicalPlan, null, 2);
};

// Funnel-aligned caption generator for Carousel summarizing all slides
function buildFunnelAlignedCarouselCaption(
  funnelStage: string,
  item?: ContentItem | null,
  slides?: CarouselSlide[],
  ctaText?: string,
  context?: any
): string {
  const existingCaption = (item?.caption || '').trim();
  const headline = item?.headline?.trim() || (slides && slides[0]?.headline) || 'Insight Penting';
  const bodyText = item?.body?.trim() || (slides && slides[1]?.body) || '';
  const cta = ctaText || item?.cta?.trim() || (funnelStage === 'BOFU' ? 'Pelajari selengkapnya melalui tautan di profil.' : funnelStage === 'MOFU' ? 'Simpan postingan ini untuk panduan alurmu.' : 'Simpan postingan ini agar mudah dibaca kembali.');

  if (existingCaption && existingCaption.length >= 40 && !existingCaption.includes('...') && !existingCaption.toLowerCase().includes('lorem')) {
    return existingCaption;
  }

  if (funnelStage === 'TOFU') {
    return `${headline}

${bodyText ? `${bodyText}\n\n` : ''}Pernahkah Anda menyadari bahwa pendekatan yang biasa digunakan sering kali belum menyentuh akar masalah yang sebenarnya?

Geser slide di atas untuk menyimak evaluasi terstruktur yang dapat langsung diterapkan.

${cta}`;
  } else if (funnelStage === 'MOFU') {
    return `${headline}

${bodyText ? `${bodyText}\n\n` : ''}Menemukan solusi yang efektif membutuhkan kejelasan alur yang menghubungkan titik masalah dengan pemahaman metode kerja terarah.

Di carousel ini, kami mengulas tahapan utama:
1. Memahami titik hambatan utama audiens
2. Mengapa pendekatan lama belum optimal
3. Menerapkan alur terstruktur untuk hasil yang konsisten

Geser seluruh slide untuk menyimak alur lengkapnya.

${cta}`;
  } else {
    // BOFU
    return `${headline}

${bodyText ? `${bodyText}\n\n` : ''}Hasil optimal dan konsisten terwujud saat Anda memiliki pendekatan terpadu yang dapat diandalkan.

Manfaat utama:
- Alur kerja yang lebih efisien dan terukur
- Keputusan yang tepat selaras dengan tujuan jangka panjang
- Hasil yang terstandarisasi tanpa spekulasi

${cta}`;
  }
}

// Helper function to build Stage 1 Content Plan prompt for 2-stage Carousel generation
// Stage 1 ONLY outputs narrative structure (NO visual prompts, NO image generation instructions)
function buildCarouselStage1Prompt(
  funnelStage: string,
  funnelPromptBlock: string,
  formattedContext: string,
  funnelRules: any,
  activeItem: any,
  revisionDirective: string
): string {
  return `Buatkan CAROUSEL STAGE 1: CONTENT PLAN - FUNNEL ${funnelStage} (Bahasa Indonesia, profesional).

${ANTI_DRIFT_RULES}

### FUNNEL STRATEGY RULES CONTRACT:
${funnelPromptBlock}

${formattedContext}

Existing ContentItem Caption:
${activeItem?.caption?.trim() || '(tidak tersedia)'}

### CAROUSEL STAGE 1 AUTHORITY CONTRACT — STRICT

1. Semua isi naratif WAJIB diturunkan hanya dari:
   - PROJECT FACTS / ProductionContext
   - SELECTED CONTENT ITEM
   - Funnel Rules yang tercantum dalam FUNNEL STRATEGY RULES CONTRACT
   - revisionDirective jika user memberikan revisi eksplisit

2. DILARANG menciptakan fakta baru tentang:
   - audiens
   - pain point
   - kebutuhan
   - keberatan
   - produk
   - fitur
   - workflow
   - capability
   - benefit
   - proof
   - statistik
   - testimoni
   - hasil bisnis

3. current_belief:
   - hanya boleh diturunkan langsung dari pain_points, objections,
     body/headline ContentItem, atau strategic context.
   - jangan menciptakan asumsi psikologis baru.
   - jangan otomatis menyatakan audiens "salah", "gagal",
     "belum sadar", atau "menggunakan cara lama" jika authority
     tidak menyatakan hal tersebut.

4. desired_belief:
   - hanya boleh merupakan perubahan pemahaman yang masuk akal
     dari positioning, core_message, objective, main_offer,
     offer_benefits, atau ContentItem.
   - jangan menambahkan promise baru.

5. core_promise:
   - harus dibatasi oleh main_offer, USP, offer_benefits,
     positioning, core_message, dan selected ContentItem.
   - tidak boleh menjanjikan hasil yang tidak tercantum di authority.

6. PROBLEM:
   - Slide 2 hanya boleh menggunakan masalah yang tersedia
     dalam authority.
   - jika authority tidak menyediakan pain point spesifik,
     gunakan masalah yang secara eksplisit terdapat pada
     headline/body ContentItem.
   - jangan menciptakan pain point baru.

7. REFRAME / WHY CURRENT METHOD FAILS:
   - jangan otomatis menyatakan "metode lama gagal".
   - hanya boleh membahas kegagalan metode tertentu jika metode
     tersebut DAN kelemahannya memang disebut oleh authority.
   - jika tidak ada authority tentang metode lama,
     Slide 3 cukup memberikan REFRAME / sudut pandang baru
     berdasarkan core_message, positioning, atau ContentItem.

8. SOLUTION / MECHANISM / VALUE:
   - hanya gunakan solution, mechanism, feature, workflow,
     capability, USP atau benefit yang eksplisit tersedia
     di ProductionContext.
   - jangan menciptakan fitur atau workflow untuk mengisi slide.

9. PROOF:
   - proof bukan field wajib.
   - gunakan proof HANYA jika authority memiliki proof_data,
     testimonial, case study, statistic, metric, atau evidence
     eksplisit.
   - jika proof tidak tersedia, jangan menciptakan proof.
   - Slide 4 boleh berfokus pada solusi/value yang authoritative
     tanpa proof.

10. CTA:
    - CTA harus berasal dari CTA ContentItem atau selaras dengan
      main_offer dan funnel rules.
    - jangan membuat diskon, urgency, bonus, guarantee,
      scarcity, demo, trial, consultation, link, atau offer baru
      jika tidak tersedia di authority.

11. Funnel Stage hanya menentukan:
    - urutan komunikasi
    - intensitas pesan
    - kesiapan keputusan
    - gaya CTA

    Funnel Stage TIDAK BOLEH menciptakan fakta bisnis baru.

12. CAPTION (captionForPost):
    - Jika tersedia, caption ini adalah authority utama.
    - Jika tidak tersedia, captionForPost boleh dirangkum dari ProductionContext + Stage 1 tanpa menambah claim baru.
    - Caption harus grounded HANYA pada ProductionContext dan narasi Stage 1.
    - DILARANG menambah benefit, proof, result, feature, metric, urgency, atau claim baru.

### OUTPUT FORMAT DIRECTION (STAGE 1: CONTENT PLAN):
Hasilkan 1 (SATU) Content Plan Carousel yang utuh dan terstruktur untuk tahap corong ${funnelStage} dalam format JSON object canonical murni (BUKAN array, tanpa markdown pembungkus).
PENTING: Tahap 1 HANYA menghasilkan rencana naskah/narasi konten (Content Plan). JANGAN sertakan instruksi visual, prompt gambar, atau sintaks Midjourney/Flux di tahap ini.

STRUKTUR NARASI CAROUSEL WAJIB:
Hook → Problem → Reframe → Authoritative Solution / Value → CTA
"Why Current Method Fails" hanya boleh digunakan sebagai bentuk Reframe jika kegagalan metode tersebut memang didukung authority.

ATURAN STRUKTUR UNTUK 5 SLIDE (DEFAULT):
- Slide 1: Hook (Peran: "hook") - Hook spesifik sesuai pain point audiens project, BUKAN langsung hard selling atau ajakan beli.
- Slide 2: Problem (Peran: "problem") - Fokus pada SATU masalah konkret yang dihadapi target audiens.
- Slide 3: Reframe (Peran: "reframe") - Memberikan sudut pandang baru yang diturunkan dari positioning/core_message/ContentItem. Jangan menyatakan metode tertentu gagal kecuali authority secara eksplisit mendukung klaim tersebut.
- Slide 4: Authoritative Solution / Value (Peran: "learn") - Gunakan hanya solusi, mechanism, feature, workflow, capability, USP, atau benefit yang tersedia di authority. Proof hanya boleh digunakan jika evidence tersedia. Jika tidak ada proof, JANGAN membuat proof. Jika tidak ada feature/workflow spesifik, jangan menciptakannya. Gunakan value atau solusi yang memang tersedia di authority.
- Slide 5: CTA (Peran: "cta") - Ajakan bertindak berbasis value yang relevan dengan offer (bukan sekadar "Link di bio").

WAJIB KEMBALIKAN HANYA JSON OBJECT STAGE 1 (TANPA MARKDOWN, TANPA PETUNJUK VISUAL):
{
  "content_goal": "${funnelRules.goal}",
  "funnel_stage": "${funnelStage}",
  "current_belief": "[Pemahaman/kondisi awal audiens yang SECARA LANGSUNG didukung pain point, objection, headline, body, atau authority project]",
  "desired_belief": "[Pemahaman baru yang diturunkan dari positioning/core_message/objective authority tanpa menambahkan janji baru]",
  "core_promise": "[Value proposition yang dibatasi oleh main_offer/USP/offer_benefits/core_message authority]",
  "primary_cta_type": "${funnelStage === 'BOFU' ? 'direct_offer' : 'engagement_save'}",
  "primary_cta_text": "[Teks CTA utama berbasis value yang sesuai corong ${funnelStage}]",
  "slide_count": 5,
  "slide_count_reason": "5 Slide optimal untuk alur narasi Hook → Problem → Reframe → Solution → CTA.",
  "belief_journey_summary": "[Ringkasan transformasi pola pikir audiens dari slide awal hingga akhir]",
  "captionForPost": "[Caption lengkap postingan Instagram yang merangkum narasi slide 1-5, grounded HANYA pada ProductionContext + narasi Stage 1. Jika ContentItem.caption tersedia, jadikan authority utama. Dilarang menambah benefit, proof, result, feature, metric, urgency, atau claim baru]",
  "messageAlignmentCheck": {
    "isAligned": true,
    "issue": "",
    "fixApplied": "Penyelarasan pesan dan alur narasi telah divalidasi sesuai corong ${funnelStage}."
  },
  "slides": [
    {
      "slide": 1,
      "role": "hook",
      "communication_job": "Menghentikan scroll dengan relatable problem sesuai konteks project",
      "headline": "[Hook spesifik grounded pada headline/body ContentItem, pain point, objective, atau core message authority; jangan ciptakan pain point baru]",
      "body": "[1-2 kalimat pengantar yang relevan dengan topik project dan grounded pada authority]",
      "swipe_bridge": "[Kalimat jembatan untuk swipe] ➔",
      "emotional_state": "Empati & Refleksi Kritis",
      "core_message": "[Pesan inti hook slide 1]",
      "audience_emotion": "Empati & Refleksi Kritis"
    },
    {
      "slide": 2,
      "role": "problem",
      "communication_job": "Fokus pada satu masalah konkret yang dihadapi target audiens",
      "headline": "[Masalah yang eksplisit tersedia pada authority project / ContentItem]",
      "body": "[Penjelasan masalah konkret berdasarkan authority tanpa mencampur aduk isu lain atau membuat dampak/konsekuensi bisnis baru]",
      "swipe_bridge": "[Kalimat jembatan menuju reframe berdasarkan authority] ➔",
      "emotional_state": "Kesadaran Masalah Tunggal",
      "core_message": "[Pesan inti masalah slide 2]",
      "audience_emotion": "Kesadaran Masalah Tunggal"
    },
    {
      "slide": 3,
      "role": "reframe",
      "communication_job": "Menjelaskan sudut pandang baru yang diturunkan dari authority tanpa klaim kegagalan metode kecuali didukung authority",
      "headline": "[Reframe berbasis positioning/core_message/ContentItem; hanya sebut kegagalan metode jika authority mendukungnya]",
      "body": "[Penjelasan sudut pandang baru yang sistemik berdasarkan authority, tanpa mengasumsikan kegagalan cara lama kecuali eksplisit di authority]",
      "swipe_bridge": "[Kalimat jembatan menuju solusi] ➔",
      "emotional_state": "Pencerahan (Aha-Moment)",
      "core_message": "[Pesan inti reframe slide 3]",
      "audience_emotion": "Pencerahan (Aha-Moment)"
    },
    {
      "slide": 4,
      "role": "learn",
      "communication_job": "Menyajikan solusi/value yang eksplisit tersedia di authority tanpa menciptakan fitur, workflow, atau proof baru",
      "headline": "[Solusi/value/mechanism yang EKSPLISIT tersedia dalam authority; jangan menciptakan framework, feature, workflow, capability, atau proof baru]",
      "body": "[Penjelasan value/solusi berdasarkan authority yang tersedia; proof hanya jika evidence eksplisit tersedia]",
      "swipe_bridge": "[Kalimat jembatan menuju aksi penutup] ➔",
      "emotional_state": "Optimis & Paham Nilai Nyata",
      "core_message": "[Pesan inti solusi slide 4]",
      "audience_emotion": "Optimis & Paham Nilai Nyata"
    },
    {
      "slide": 5,
      "role": "cta",
      "communication_job": "Mendorong aksi penutup berbasis value yang sesuai corong ${funnelStage}",
      "headline": "[Ajakan bertindak berbasis value yang relevan dengan offer]",
      "body": "[Penjelasan langkah berikutnya menggunakan CTA/offer/value yang tersedia di authority tanpa promise baru]",
      "swipe_bridge": "[Teks CTA penutup]",
      "emotional_state": "Terdorong Bertindak Berbasis Value",
      "core_message": "[Pesan inti CTA slide 5]",
      "audience_emotion": "Dorongan Aksi Berbasis Value"
    }
  ]
}${revisionDirective}`;
}

// Helper function to build Stage 2 Visual Enrichment prompt for 2-stage Carousel generation
function buildCarouselStage2Prompt(
  funnelStage: string,
  stage1JsonString: string,
  formattedContext: string,
  batchSlideNumbers?: number[]
): string {
  const batchDirective = batchSlideNumbers && batchSlideNumbers.length > 0
    ? `\n### BATCH DIRECTIVE:
Hasilkan pengayaan visual HANYA untuk slide nomor: [${batchSlideNumbers.join(', ')}].
Jangan menghasilkan visual untuk slide di luar daftar nomor ini dalam pemanggilan ini.`
    : '';

  return `Buatkan CAROUSEL STAGE 2: VISUAL ENRICHMENT - FUNNEL ${funnelStage} (Bahasa Indonesia, profesional).

${ANTI_DRIFT_RULES}

${formattedContext}

### STAGE 1 CONTENT PLAN INPUT:
${stage1JsonString}
${batchDirective}

### CAROUSEL STAGE 2 VISUAL GROUNDING CONTRACT — STRICT

1. SUBJECT / OBJECT GROUNDING:
   - Jika CharacterDNA tersedia dalam authority/ProductionContext, subjek manusia WAJIB mengikuti CharacterDNA tersebut secara konsisten (ciri fisik, tone, konsistensi visual).
   - Jika CharacterDNA TIDAK tersedia, DILARANG mengarang/menciptakan umur spesifik, gender, profesi fiktif (seperti CEO, manajer HR, konsultan, dsb.), etnis, status bisnis, atau persona demografis sintetis.
   - Subjek manusia TIDAK WAJIB. Gunakan alternatif yang lebih aman dan terikat authority: objek produk/kemasan nyata, diagram konseptual, tangan (hand interacting naturally), setting lingkungan/arsitektur, atau visual netral/minimalis.

2. PRODUCT / UI GROUNDING:
   - DILARANG menciptakan dashboard software, app screen, feature antarmuka, workflow sistem otomatis, panel analytics, atau visual UI yang tidak eksplisit tersedia dalam authority project.
   - Jika visual capability spesifik tidak tercantum dalam authority, gunakan representasi visual abstrak, konseptual, atau netral (BUKAN UI mockup sintetis/fiktif).

3. PROOF / RESULT GROUNDING:
   - DILARANG membuat angka statistik, metrik pertumbuhan, testimonial fiktif, diagram growth chart (hockey stick), angka conversion, klaim revenue, atau klaim efisiensi yang tidak ada di Stage 1 maupun authority project.

4. STRICT MIRRORING ANTARA visual_production & slide_image_prompt:
   - slide_image_prompt HARUS MENJADI MIRROR semantik persis dari visual_production:
     * Subject/Object pada slide_image_prompt = visual_production.subject
     * Action/Scene pada slide_image_prompt = visual_production.action
   - Semantic environment atau objek tidak boleh menambahkan fakta/entitas baru di luar authority.
   - Text Overlay pada slide_image_prompt HARUS EXACTLY headline dari Stage 1 untuk slide bersangkutan (tanpa parafrase atau pengubahan kata).
   - DILARANG memperkenalkan persona baru, profesi baru, atau capability baru di dalam slide_image_prompt.

5. PURE VISUAL ENRICHMENT ONLY:
   - Stage 2 HANYA memperkaya lapisan visual. DILARANG mengubah atau menyimpang dari narasi Stage 1: headline, body, swipe_bridge, communication_job, core_message, audience_emotion, atau alur naratif Stage 1. Semua teks naratif Stage 1 adalah authoritative dan final.

6. PERTAHANKAN SAFE CREATIVE FREEDOM (ASPEK DESAIN & ARTISTIK SAJA):
   - Kebebasan berkreasi hanya berlaku pada dimensi visual/desain:
     * composition (rule of thirds, balance, visual focal point)
     * layout (alokasi vertical 4:5, headline placement, space distribution)
     * lighting (soft natural lighting, gentle rim light, warm daylight, diffused studio light)
     * camera/graphic style (50mm prime editorial photography, medium format look, clean minimalist editorial vector)
     * typography (hierarchy, weight, high contrast, clean font style)
     * background styling (clean studio background, textured architectural wall, warm neutral space)
     * color mood (palet warna brand, tone visual terarah)
     * negative space (alokasi ruang kosong minimal 35-50% untuk penempatan headline agar tidak bertabrakan dengan subjek)
     * visual metaphor (metafora visual konseptual yang memperkuat pesan slide tanpa mengklaim fakta palsu)
     * negative prompt (mencegah distorsi, clutter, hard-selling ads, generic stock look)

### OUTPUT FORMAT DIRECTION (STAGE 2: VISUAL ENRICHMENT):
Hasilkan pengayaan visual lengkap untuk slide Stage 1 Content Plan di atas dalam format JSON object canonical murni (BUKAN array, tanpa markdown pembungkus).
PENTING: DILARANG MENGUBAH NARASI/TEXT DARI STAGE 1 (headline, body, swipe_bridge, communication_job tetap utuh dari Stage 1). Tahap 2 HANYA memperkaya lapisan visual.

UNTUK SETIAP SLIDE TARGET DI "slides", BERIKAN PETUNJUK VISUAL & SLIDE IMAGE PROMPT:
1. visual_format: "photography" | "infographic" | "hybrid"
2. visual_intent: Instruksi visual konkret selaras pesan slide dan brand aesthetic (tanpa menambah fakta baru)
3. visual_type: "editorial-photo" | "comparison-split" | "minimal-diagram" | "step-framework" | "cta-card"
4. text_zone: "Upper Third / Left Aligned" | "Center / Left Aligned" | "Center Aligned"
5. negative_space_plan: Perencanaan ruang kosong (min 35-50% untuk penempatan headline)
6. visual_production: {
     subject: string; // Objek/produk/lingkungan/tangan netral atau CharacterDNA jika ada. Dilarang karang umur/profesi/UI dashboard
     action: string; // Aksi konkret atau penataan visual netral tanpa membuat alur kerja/fitur baru
     composition: string;
     layout: string;
     visual_metaphor: string;
     typography: string;
     background: string;
     color_mood: string;
     negative_space: string;
     negative_prompt: string;
   }
7. production_prompt: Prompt ringkasan tata letak
8. slide_image_prompt: Prompt 14 baris lengkap siap pakai untuk Midjourney/Flux yang MIRROR visual_production:
   Buatkan saya image untuk slide carousel Instagram 4:5.

   Funnel Stage: ${funnelStage}
   Slide Role: [Hook | Problem | Reframe | Solution | CTA]
   Visual Objective: [Tujuan visual konkret selaras pesan slide]
   Subject/Object: [MIRROR visual_production.subject — objek/produk/tangan netral atau CharacterDNA jika ada, tanpa persona/UI fiktif]
   Action/Scene: [MIRROR visual_production.action — penataan elemen atau aktivitas fisik netral]
   Expression/Emotion: [Ekspresi mikro wajah jika CharacterDNA ATAU impresi visual netral]
   Environment: [Setting latar yang relevan dengan topik project tanpa fakta baru]
   Composition: [Komposisi visual 4:5 dengan ruang negatif 40% untuk headline]
   Lighting: [Pencahayaan alami lembut / studio terarah]
   Camera/Graphic Style: [50mm editorial photography feel ATAU Clean minimalist graphic aesthetic]
   Visual Style: Clean editorial Instagram content, natural, tidak seperti iklan.
   Typography: Headline besar 3-5 baris, high contrast, tidak ada teks kecil lain.
   Text Overlay: '[EXACT Headline slide dari Stage 1]'
   Negative Prompt: hard selling ads, cluttered poster, too much text, generic stock photo, unreadable typography, distorted face, extra fingers.

WAJIB KEMBALIKAN HANYA JSON OBJECT STAGE 2 (TANPA MARKDOWN):
{
  "visual_system_notes": "Sistem visual 4:5 vertical editorial selaras corong ${funnelStage} dan identitas visual project.",
  "slides": [
    {
      "slide": ${batchSlideNumbers && batchSlideNumbers.length > 0 ? batchSlideNumbers[0] : 1},
      "visual_format": "photography",
      "visual_intent": "[Instruksi visual konkret selaras dengan pesan slide dan brand aesthetic tanpa menambah fakta baru]",
      "visual_type": "editorial-photo",
      "text_zone": "Upper Third / Left Aligned",
      "negative_space_plan": "Ruang lega 40% di area kiri atas untuk headline",
      "visual_production": {
        "subject": "[Deskripsi objek/produk/kemasan nyata/tangan netral atau CharacterDNA jika ada. Dilarang karang umur/profesi/UI dashboard]",
        "action": "[Aksi konkret atau penataan visual netral]",
        "composition": "Subjek di kanan tengah, ruang kosong lapang di kiri atas untuk headline.",
        "layout": "Format 4:5 vertical, headline dominan di kiri atas.",
        "visual_metaphor": "[Metafora visual yang memperjelas pesan tanpa klaim fiktif]",
        "typography": "Headline tebal 32pt kontras tinggi, body 16pt sans-serif.",
        "background": "[Latar belakang bersih selaras dengan brand aesthetic].",
        "color_mood": "Profesional & terarah.",
        "negative_space": "Ruang lega 40% di area kiri atas untuk headline.",
        "negative_prompt": "hard selling ads, cluttered poster, too much text, generic stock photo, unreadable typography, distorted face, extra fingers."
      },
      "production_prompt": "Layout: Format 4:5 vertical, headline dominan di atas.\\nSubject/Object Utama: [Objek/produk/lingkungan netral selaras visual_production.subject]\\nVisual Metaphor: [Metafora visual]\\nTypography Hierarchy: Headline tebal 32pt, body 16pt.\\nBackground: Neutral clean canvas.\\nColor Mood: Profesional.\\nNegative Space: 40% ruang bersih.\\nImage/Illustration Direction: Clean editorial modern aesthetic.",
      "slide_image_prompt": "Buatkan saya image untuk slide carousel Instagram 4:5.\\n\\nFunnel Stage: ${funnelStage}\\nSlide Role: [Role]\\nVisual Objective: [Tujuan visual]\\nSubject/Object: [MIRROR visual_production.subject — persis sama, tanpa persona/UI fiktif]\\nAction/Scene: [MIRROR visual_production.action — penataan elemen atau aktivitas fisik netral]\\nExpression/Emotion: [Ekspresi / impresi visual]\\nEnvironment: [Setting lingkungan tanpa fakta baru]\\nComposition: Subjek di kanan tengah, ruang kosong luas di kiri atas untuk headline.\\nLighting: Cahaya alami lembut.\\nCamera/Graphic Style: 50mm editorial photography feel.\\nVisual Style: Clean editorial Instagram content, natural, tidak seperti iklan.\\nTypography: Headline besar di area lapang, high contrast.\\nText Overlay: '[EXACT Headline slide dari Stage 1]'\\nNegative Prompt: hard selling ads, cluttered poster, too much text, generic stock photo, unreadable typography, distorted face, extra fingers."
    }
  ]
}`;
}

// Helper function to validate Carousel Stage 1 Content Plan (strictly narrative, no visual prompts)
function validateCarouselStage1ContentPlan(
  rawTextOrObj: any,
  expectedFunnelStage: FunnelStage
): any | null {
  if (!rawTextOrObj) return null;
  const parsed = typeof rawTextOrObj === 'string' ? tryParseJSON(rawTextOrObj) : rawTextOrObj;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

  // Strict funnel stage validation
  const rawFunnel = String(parsed.funnel_stage || parsed.funnelStage || '').toUpperCase().trim();
  const validFunnel: FunnelStage | null = (rawFunnel === 'TOFU' || rawFunnel === 'MOFU' || rawFunnel === 'BOFU') ? (rawFunnel as FunnelStage) : null;
  if (!validFunnel || validFunnel !== expectedFunnelStage) {
    return null;
  }

  // Required top-level non-empty fields from Stage 1 contract
  const contentGoal = String(parsed.content_goal || parsed.contentGoal || '').trim();
  const currentBelief = String(parsed.current_belief || parsed.currentBelief || '').trim();
  const desiredBelief = String(parsed.desired_belief || parsed.desiredBelief || '').trim();
  const corePromise = String(parsed.core_promise || parsed.corePromise || '').trim();
  const primaryCtaType = String(parsed.primary_cta_type || parsed.primaryCtaType || '').trim();
  const primaryCtaText = String(parsed.primary_cta_text || parsed.primaryCtaText || '').trim();

  // Require captionForPost: fail-closed on empty, placeholder, or invalid caption
  const captionForPost = String(parsed.captionForPost || parsed.caption_for_post || '').trim();
  if (
    !captionForPost ||
    captionForPost.includes('[Tulis caption') ||
    captionForPost.includes('...') ||
    (captionForPost.startsWith('[') && captionForPost.endsWith(']')) ||
    captionForPost.toLowerCase().includes('lorem ipsum')
  ) {
    return null;
  }

  if (!contentGoal || !currentBelief || !desiredBelief || !corePromise || !primaryCtaType || !primaryCtaText) {
    return null;
  }

  // Slide count and slides array: strictly 5 slides
  const rawSlides = parsed.slides;
  if (!Array.isArray(rawSlides) || rawSlides.length !== 5) {
    return null;
  }

  if (
    parsed.slide_count === undefined ||
    Number(parsed.slide_count) !== 5
  ) {
    return null;
  }

  const expectedRoles = ['hook', 'problem', 'reframe', 'learn', 'cta'];
  const validatedSlides: any[] = [];

  for (let i = 0; i < 5; i++) {
    const s = rawSlides[i];
    if (!s || typeof s !== 'object' || Array.isArray(s)) return null;

    const slideNum = Number(s.slide);
    if (slideNum !== i + 1) return null;

    const role = String(s.role || '').toLowerCase().trim();
    if (role !== expectedRoles[i]) return null;

    const communicationJob = String(s.communication_job || s.communicationJob || '').trim();
    const headline = String(s.headline || '').trim();
    const body = String(s.body || '').trim();
    const swipeBridge = String(s.swipe_bridge || s.swipeBridge || '').trim();
    const emotionalState = String(s.emotional_state || s.emotionalState || '').trim();
    const coreMessage = String(s.core_message || s.coreMessage || '').trim();
    const audienceEmotion = String(s.audience_emotion || s.audienceEmotion || '').trim();

    if (!communicationJob || !headline || !body || !swipeBridge || !emotionalState || !coreMessage || !audienceEmotion) {
      return null;
    }

    validatedSlides.push({
      slide: slideNum,
      role,
      communication_job: communicationJob,
      headline,
      body,
      swipe_bridge: swipeBridge,
      emotional_state: emotionalState,
      core_message: coreMessage,
      audience_emotion: audienceEmotion,
    });
  }

  return {
    ...parsed,
    content_goal: contentGoal,
    funnel_stage: validFunnel,
    current_belief: currentBelief,
    desired_belief: desiredBelief,
    core_promise: corePromise,
    primary_cta_type: primaryCtaType,
    primary_cta_text: primaryCtaText,
    captionForPost,
    slide_count: 5,
    slides: validatedSlides,
  };
}

// Helper function to validate Carousel Stage 2 Visual Enrichment (strictly visual layers)
function validateCarouselStage2VisualPlan(rawTextOrObj: any): any | null {
  if (!rawTextOrObj) return null;
  const parsed = typeof rawTextOrObj === 'string' ? tryParseJSON(rawTextOrObj) : rawTextOrObj;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

  const rawSlides = parsed.slides;
  if (!Array.isArray(rawSlides) || rawSlides.length !== 5) {
    return null;
  }

  const seenSlideNums = new Set<number>();
  const validatedSlides: any[] = [];

  for (const s of rawSlides) {
    if (!s || typeof s !== 'object' || Array.isArray(s)) return null;

    const slideNum = Number(s.slide);
    if (![1, 2, 3, 4, 5].includes(slideNum) || seenSlideNums.has(slideNum)) {
      return null;
    }
    seenSlideNums.add(slideNum);

    const visualFormat = String(s.visual_format || s.visualFormat || '').toLowerCase().trim();
    if (visualFormat !== 'photography' && visualFormat !== 'infographic' && visualFormat !== 'hybrid') {
      return null;
    }

    const visualIntent = String(s.visual_intent || s.visualIntent || '').trim();
    const visualType = String(s.visual_type || s.visualType || '').trim();
    const textZone = String(s.text_zone || s.textZone || '').trim();
    const negativeSpacePlan = String(s.negative_space_plan || s.negativeSpacePlan || '').trim();
    const productionPrompt = String(s.production_prompt || s.productionPrompt || '').trim();
    const slideImagePrompt = String(s.slide_image_prompt || s.slideImagePrompt || '').trim();

    if (!visualIntent || !visualType || !textZone || !negativeSpacePlan || !productionPrompt || !slideImagePrompt) {
      return null;
    }

    const vp = s.visual_production || s.visualProduction;
    if (!vp || typeof vp !== 'object' || Array.isArray(vp)) {
      return null;
    }

    const subject = String(vp.subject || '').trim();
    const action = String(vp.action || '').trim();
    const composition = String(vp.composition || '').trim();
    const layout = String(vp.layout || '').trim();
    const visualMetaphor = String(vp.visual_metaphor || vp.visualMetaphor || '').trim();
    const typography = String(vp.typography || '').trim();
    const background = String(vp.background || '').trim();
    const colorMood = String(vp.color_mood || vp.colorMood || '').trim();
    const negativeSpace = String(vp.negative_space || vp.negativeSpace || '').trim();
    const negativePrompt = String(vp.negative_prompt || vp.negativePrompt || '').trim();

    if (
      !subject || !action || !composition || !layout || !visualMetaphor ||
      !typography || !background || !colorMood || !negativeSpace || !negativePrompt
    ) {
      return null;
    }

    validatedSlides.push({
      slide: slideNum,
      visual_format: visualFormat as VisualFormatType,
      visual_intent: visualIntent,
      visual_type: visualType,
      text_zone: textZone,
      negative_space_plan: negativeSpacePlan,
      creative_strategy: s.creative_strategy,
      visual_production: {
        subject,
        action,
        composition,
        layout,
        visual_metaphor: visualMetaphor,
        typography,
        background,
        color_mood: colorMood,
        negative_space: negativeSpace,
        negative_prompt: negativePrompt,
      },
      production_prompt: productionPrompt,
      slide_image_prompt: slideImagePrompt,
    });
  }

  if (seenSlideNums.size !== 5) return null;

  validatedSlides.sort((a, b) => a.slide - b.slide);

  return {
    ...parsed,
    slides: validatedSlides,
  };
}

// Helper function to merge Stage 1 (Content Plan) and Stage 2 (Visual Enrichment) into canonical Carousel Plan JSON
// ENFORCES: Stage 2 MUST NOT rewrite narrative content from Stage 1
const mergeCarouselPlanStages = (
  stage1Raw: any,
  stage2Raw: any,
  activeItem?: any,
  activeContext?: any,
  expectedFunnelStage?: FunnelStage
): string | null => {
  const currentStage: FunnelStage = expectedFunnelStage || normalizeFunnelStage(activeItem?.jenis);
  const validStage1 = validateCarouselStage1ContentPlan(stage1Raw, currentStage);
  if (!validStage1) return null;

  const validStage2 = validateCarouselStage2VisualPlan(stage2Raw);
  if (!validStage2) return null;

  const s1Slides: any[] = validStage1.slides;
  const s2Slides: any[] = validStage2.slides;

  if (s1Slides.length !== 5 || s2Slides.length !== 5) return null;

  const mergedSlides = s1Slides.map((s1: any) => {
    const slideNum = Number(s1.slide);
    const s2 = s2Slides.find((item: any) => Number(item.slide) === slideNum);
    if (!s2) return null;

    // Narrative content is strictly protected from Stage 1:
    return {
      slide: slideNum,
      role: s1.role,
      communication_job: s1.communication_job,
      headline: s1.headline,
      body: s1.body,
      swipe_bridge: s1.swipe_bridge,
      emotional_state: s1.emotional_state,
      core_message: s1.core_message,
      audience_emotion: s1.audience_emotion,

      // Visual fields strictly from Stage 2:
      visual_format: s2.visual_format,
      visual_intent: s2.visual_intent,
      visual_type: s2.visual_type,
      text_zone: s2.text_zone,
      negative_space_plan: s2.negative_space_plan,
      creative_strategy: {
        funnel_stage: validStage1.funnel_stage,
        slide_role: s1.role,
        visual_objective: s2.creative_strategy?.visual_objective || s2.visual_intent,
        core_message: s1.core_message || s1.headline,
        audience_emotion: s1.audience_emotion || s1.emotional_state,
        visual_concept: s2.creative_strategy?.visual_concept || s2.visual_production?.visual_metaphor || '',
        text_overlay: s1.headline,
      },
      visual_production: s2.visual_production,
      production_prompt: s2.production_prompt,
      slide_image_prompt: s2.slide_image_prompt,
    };
  });

  if (mergedSlides.some((s) => s === null)) return null;

  const mergedPlan = {
    ...validStage1,
    visual_system_notes: validStage2.visual_system_notes || 'Tema visual konsisten 4:5 vertical editorial.',
    captionForPost: validStage1.captionForPost,
    captionInstruction: 'Paste teks ini di caption/keterangan postingan setelah aset dibuat.',
    slides: mergedSlides,
  };

  return validateAndNormalizeCarouselPlan(JSON.stringify(mergedPlan), activeItem, activeContext, true);
};

// Funnel-aligned caption generator for Video summarizing full video
function buildFunnelAlignedVideoCaption(
  funnelStage: string,
  item?: ContentItem | null,
  style?: VideoStyle | any,
  ctaText?: string
): string {
  const existingCaption = (item?.caption || '').trim();
  const scriptHook = style?.script?.hook || item?.headline || 'Wawasan Strategis';
  const scriptSolusi = style?.script?.solusi || '';
  const cta = ctaText || style?.script?.cta || (funnelStage === 'BOFU' ? 'Akses informasi selengkapnya melalui tautan di profil' : funnelStage === 'MOFU' ? 'Simpan video ini untuk referensi alur Anda' : 'Simpan video ini agar tidak terlewat');

  if (existingCaption && existingCaption.length >= 40 && !existingCaption.includes('...') && !existingCaption.toLowerCase().includes('lorem')) {
    return existingCaption;
  }

  if (funnelStage === 'TOFU') {
    return `${scriptHook}

Banyak yang berasumsi bahwa hasil optimal selalu membutuhkan proses yang rumit. Padahal, kuncinya terletak pada kejelasan pendekatan yang menjawab kebutuhan nyata audiens tanpa berbelit-belit.

Simak video ini untuk penjelasan selengkapnya.

${cta}`;
  } else if (funnelStage === 'MOFU') {
    return `${scriptHook}

Mengapa proses yang dijalankan kerap kali belum memberikan hasil optimal? Karena audiens membutuhkan kejelasan metode kerja yang terarah dan terbukti.

${scriptSolusi ? `${scriptSolusi}\n\n` : ''}Di video ini kami merangkum langkah-langkah praktis yang dapat langsung Anda terapkan.

${cta}`;
  } else {
    // BOFU
    return `${scriptHook}

Saatnya beralih ke pendekatan yang lebih terpadu, teruji, dan efisien.

${scriptSolusi ? `${scriptSolusi}\n\n` : ''}Dapatkan hasil yang lebih terstruktur dan siap mendukung pencapaian tujuan Anda secara konsisten.

${cta}`;
  }
}

// Phase 5B.3-B: Authority-strict video caption validator without arbitrary length restrictions
function isValidVideoCaption(caption: unknown): boolean {
  if (typeof caption !== 'string') return false;
  const trimmed = caption.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (
    trimmed.includes('...') ||
    trimmed.includes('[Tulis caption') ||
    trimmed.includes('[Caption') ||
    lower.includes('[tulis caption') ||
    lower.includes('[caption') ||
    lower.includes('lorem ipsum')
  ) {
    return false;
  }
  return true;
}

// Normalize & validate incoming Video AI output
function validateAndNormalizeVideoStyles(
  rawText: string,
  activeItem?: ContentItem | null,
  activeContext?: SharedContentContext | null,
  attachProductionCandidate: boolean = true
): string | null {
  try {
    let parsed = tryParseJSON(rawText);
    if (!parsed) return null;
    let rawList: any[] = [];
    if (Array.isArray(parsed)) {
      rawList = parsed;
    } else if (typeof parsed === 'object' && parsed !== null) {
      if (Array.isArray(parsed.styles)) rawList = parsed.styles;
      else if (Array.isArray(parsed.videos)) rawList = parsed.videos;
      else rawList = [parsed];
    }
    if (rawList.length !== 3) return null;

    const funnelStage = normalizeFunnelStage(activeItem?.jenis);
    const funnelRules = getFunnelRules(activeItem?.jenis);
    const defaultCaptionInstruction = "Paste teks ini di caption/keterangan postingan setelah aset dibuat.";

    const validModes: VideoProductionMode[] = ['human_led', 'product_demo', 'motion_explainer'];
    const normalizedStyles: VideoStyle[] = [];
    const seenModes = new Set<VideoProductionMode>();

    for (let idx = 0; idx < rawList.length; idx++) {
      const v = rawList[idx];
      if (!v || typeof v !== 'object') return null;

      // Strict semantic productionMode validation - fail closed without legacy fallback
      const rawMode = v.productionMode ?? v.production_mode;
      if (
        rawMode !== 'human_led' &&
        rawMode !== 'product_demo' &&
        rawMode !== 'motion_explainer'
      ) {
        return null;
      }
      const productionMode: VideoProductionMode = rawMode;

      if (seenModes.has(productionMode)) {
        return null; // Reject duplicate modes
      }
      seenModes.add(productionMode);

      const defaultName =
        productionMode === 'human_led'
          ? 'Human-Led Style'
          : productionMode === 'product_demo'
          ? 'Product Demo Style'
          : 'Motion Explainer Style';
      const name = String(v.name || defaultName).trim();
      const hookStyle = String(v.hookStyle || v.hook_style || 'Hook pembuka menarik').trim();
      const pacingStyle = String(v.pacingStyle || v.pacing_style || 'Dinamis').trim();
      const audioDirection = String(v.audioDirection || v.audio_direction || 'Natural voiceover & background music').trim();
      const voiceoverOutline = String(v.voiceoverOutline || v.voiceover_outline || '').trim();

      const rawScript = v.script || {};

      let scriptProof = '';
      if (typeof rawScript.proof === 'string' && rawScript.proof.trim()) {
        scriptProof = rawScript.proof.trim();
      } else if (typeof (activeItem as any)?.proof === 'string' && (activeItem as any).proof.trim()) {
        scriptProof = (activeItem as any).proof.trim();
      } else if (typeof (activeItem as any)?.proof_data === 'string' && (activeItem as any).proof_data.trim()) {
        scriptProof = (activeItem as any).proof_data.trim();
      }

      const script: VideoScript = {
        hook:
          typeof rawScript.hook === 'string'
            ? rawScript.hook.trim()
            : typeof activeItem?.headline === 'string'
            ? activeItem.headline.trim()
            : '',
        masalah:
          typeof rawScript.masalah === 'string'
            ? rawScript.masalah.trim()
            : typeof activeItem?.body === 'string'
            ? activeItem.body.trim()
            : '',
        solusi: typeof rawScript.solusi === 'string' ? rawScript.solusi.trim() : '',
        proof: scriptProof,
        cta:
          typeof rawScript.cta === 'string'
            ? rawScript.cta.trim()
            : typeof activeItem?.cta === 'string'
            ? activeItem.cta.trim()
            : '',
      };

      const videoPrompt = String(v.videoPrompt || v.video_prompt || '').trim();
      const videoNegativeConstraints = String(
        v.negative_constraints ??
        v.negativeConstraints ??
        ''
      ).trim();

      if (!videoNegativeConstraints) {
        return null;
      }
      const visualPlan = String(v.visualPlan || v.visual_plan || '').trim();

      const rawAiCaption = typeof (v.captionForPost ?? v.caption_for_post) === 'string'
        ? (v.captionForPost ?? v.caption_for_post).trim()
        : '';
      let captionForPost = '';
      if (isValidVideoCaption(rawAiCaption)) {
        captionForPost = rawAiCaption;
      } else if (isValidVideoCaption(activeItem?.caption)) {
        captionForPost = String(activeItem?.caption).trim();
      } else {
        return null;
      }

      const captionInstruction = String(v.captionInstruction || v.caption_instruction || defaultCaptionInstruction).trim() || defaultCaptionInstruction;

      const scenes = buildCanonicalVideoScenePlan(funnelStage, productionMode, script);
      const candidateId = getVideoCandidateId(productionMode);
      const productionCandidate =
        attachProductionCandidate
          ? buildVideoProductionCandidate({
              candidate_id: candidateId,
              production_mode: productionMode,
              objective: activeItem?.tujuan || funnelRules.goal || '',
              format: '9:16 Vertical Video (Reels/TikTok/Shorts)',
              hook: script.hook,
              scenes,
              motion_direction: pacingStyle,
              audio_direction: audioDirection,
              negative_constraints: videoNegativeConstraints,
              final_prompt: videoPrompt,
            })
          : undefined;

      if (productionCandidate) {
        const candidateValidation = validateProductionCandidate(productionCandidate);
        if (!candidateValidation.isValid) {
          return null;
        }
      }

      normalizedStyles.push({
        productionMode,
        name,
        hookStyle,
        pacingStyle,
        audioDirection,
        voiceoverOutline,
        script,
        videoPrompt,
        visualPlan,
        negativeConstraints: videoNegativeConstraints,
        captionForPost,
        captionInstruction,
        productionCandidate,
      });
    }

    if (normalizedStyles.length !== 3 || seenModes.size !== 3) return null;

    return JSON.stringify(normalizedStyles, null, 2);
  } catch (e) {
    return null;
  }
}

// Pure top-level function for building high-converting initial drafts for instant feedback
const getInitialDraft = (
  tab: 'review' | 'image' | 'carousel' | 'video',
  currentItem?: ContentItem | null,
  currentContext?: SharedContentContext | null
): string => {
  if (!currentItem || !currentContext || !currentContext.brand_context?.brand_name?.trim()) return '';
  const activeItem = currentItem;
  const activeContext: SharedContentContext = currentContext;

  const funnelStage = normalizeFunnelStage(activeItem.jenis);
  const funnelRules = getFunnelRules(activeItem.jenis);

  let defaultCtaFallback = 'Simpan ide ini';
  if (funnelStage === 'MOFU') {
    defaultCtaFallback = 'Cek framework ini';
  } else if (funnelStage === 'BOFU') {
    defaultCtaFallback = 'Lihat demo';
  }

  const rawCta = activeItem.cta && activeItem.cta.trim() ? activeItem.cta : defaultCtaFallback;
  const safeCta = sanitizeCtaForFunnel(rawCta, funnelStage);
  const voiceoverCta = getVoiceoverCtaForFunnel(rawCta, funnelStage);

  switch (tab) {
    case 'review':
      return `### 📊 EVALUASI KESELARASAN STRATEGI KONTEN

**Skor Penyelarasan Strategi:** 96/100 (SANGAT BAIK)

**1. Analisis Keselarasan Corong (${funnelStage}):**
- Item konten ini sangat cocok dengan tahap corong **${funnelStage}**. Tujuan utama yaitu **"${activeItem.tujuan || funnelRules.goal}"** tersampaikan secara alami tanpa terkesan memaksa.
- Pemilihan hook **"${activeItem.hookType || 'Relatable Hook'}"** sangat efektif untuk menangkap atensi segmen audiens utama: **${activeContext.audience_context?.primary_audience || 'Target Buyers'}**.

**2. Integrasi Suara Merek (Brand Voice):**
- Selaras dengan suara merek **"${activeContext.brand_context?.brand_voice || 'Profesional & Edukatif'}"**. Teks mengedukasi audiens sambil membangun otoritas di bidangnya.

**3. Rekomendasi Optimasi Kilat:**
- Pastikan kalimat pembuka (headline) menggunakan huruf tebal yang sangat mencolok secara visual.
- Gunakan CTA **"${safeCta}"** di bagian akhir teks/caption dengan penunjuk visual yang jelas agar audiens terdorong mengambil tindakan.`;

    case 'image':
      return '';

    case 'carousel': {
      if (activeItem?.carousel_plan) {
        const normalizedExisting = validateAndNormalizeCarouselPlan(JSON.stringify(activeItem.carousel_plan), activeItem, activeContext, false);
        if (normalizedExisting) return normalizedExisting;
        return JSON.stringify(activeItem.carousel_plan, null, 2);
      }
      const draftTopic = (activeItem?.headline || (activeItem as any)?.topik || (activeItem as any)?.title || '').trim();
      const draftAudience = (activeContext?.audience_context?.primary_audience || (activeItem as any)?.target_audience || '').trim();
      const draftProblem = (activeItem?.body ? activeItem.body.slice(0, 80) : '').trim();
      const explicitSolution = (activeItem as any)?.solusi ?? (activeItem as any)?.solution;
      const draftSolution = typeof explicitSolution === 'string' ? explicitSolution.trim() : '';
      const rawProof = (activeItem as any)?.proof;
      const rawProofData = (activeItem as any)?.proof_data;
      const draftProof = (
        typeof rawProof === 'string'
          ? rawProof
          : typeof rawProofData === 'string'
          ? rawProofData
          : ''
      ).trim();
      const draftHook = (activeItem?.headline || (activeItem as any)?.hook || '').trim();
      const carouselCta = (activeItem?.cta || '').trim();

      const initialPlan: CarouselPlan = {
        content_goal: (activeItem?.tujuan || '').trim(),
        funnel_stage: funnelStage,
        current_belief: (activeItem as any)?.current_belief || '',
        desired_belief: (activeItem as any)?.desired_belief || '',
        core_promise: (activeItem as any)?.core_promise || '',
        primary_cta_type: funnelStage === 'BOFU' ? 'direct_offer' : 'engagement_save',
        primary_cta_text: carouselCta,
        slide_count: 5,
        slide_count_reason: '5 Slide merupakan panjang optimal untuk alur narasi Hook → Problem → Reframe → How It Works / Value → CTA.',
        belief_journey_summary: (activeItem as any)?.belief_journey_summary || '',
        messageAlignmentCheck: {
          isAligned: true,
          issue: '',
          fixApplied: ''
        },
        visual_system_notes: 'Tema visual konsisten menggunakan format 4:5 vertical, tipografi kontras tinggi, ruang negatif lapang, dan aksen warna natural.',
        slides: [
          {
            slide: 1,
            role: 'hook',
            communication_job: 'Menghentikan scroll dengan alasan keputusan strategis / relatable problem',
            headline: draftHook,
            body: activeItem?.body || '',
            swipe_bridge: '',
            emotional_state: 'Empati & Refleksi Kritis',
            visual_intent: 'Visual editorial bersih dengan pencahayaan alami dan komposisi lapang.',
            visual_type: 'editorial-photo',
            text_zone: 'Upper Third / Left Aligned',
            negative_space_plan: 'Ruang bersih di bagian atas untuk headline besar',
            creative_strategy: {
              funnel_stage: funnelStage,
              slide_role: 'hook',
              visual_objective: 'Visual editorial bersih dengan pencahayaan alami dan komposisi lapang.',
              core_message: draftHook,
              audience_emotion: 'Empati & Refleksi Kritis',
              visual_concept: 'Editorial photographic framing dengan pencahayaan alami natural',
              text_overlay: draftHook
            },
            visual_format: 'photography',
            visual_production: {
              subject: 'Komposisi visual netral dengan fokus tajam dan ruang lapang.',
              action: 'Penataan visual tenang dan terarah.',
              composition: 'Subjek di kanan tengah, ruang kosong luas di kiri atas untuk headline.',
              layout: 'Format carousel Instagram 4:5 vertical, komposisi bersih dengan teks headline besar di kiri atas.',
              visual_metaphor: 'Fokus dan kejelasan visual.',
              typography: 'Headline tebal 34pt kontras tinggi, body copy 16pt sans-serif nyaman dibaca, label slide di pojok atas.',
              background: 'Latar netral bersih dengan pencahayaan jendela alami lembut (#F9F8F6).',
              color_mood: `Nuansa profesional hangat (${funnelStage === 'TOFU' ? 'Sage Green & Warm Cream' : funnelStage === 'MOFU' ? 'Teal & Crisp Slate' : 'Deep Emerald'}).`,
              negative_space: 'Ruang lega 40% di area kiri atas untuk headline.',
              negative_prompt: 'hard selling ads, cluttered poster, too much text, generic stock photo, unreadable typography, distorted face, extra fingers, corporate cliche, overdesigned graphic.'
            },
            production_prompt: `Layout: Format carousel Instagram 4:5 vertical, komposisi bersih dengan teks headline besar di kiri atas.
Subject/Object Utama: Komposisi visual netral dengan fokus tajam dan ruang lapang.
Visual Metaphor: Fokus dan kejelasan visual.
Typography Hierarchy: Headline tebal 34pt kontras tinggi, body copy 16pt sans-serif nyaman dibaca, label slide di pojok atas.
Background: Latar netral bersih dengan pencahayaan jendela alami lembut (#F9F8F6).
Color Mood: Nuansa profesional hangat (${funnelStage === 'TOFU' ? 'Sage Green & Warm Cream' : funnelStage === 'MOFU' ? 'Teal & Crisp Slate' : 'Deep Emerald'}).
Negative Space: Ruang lega 40% di area kiri atas untuk headline.
Image/Illustration Direction: Clean minimalist modern editorial photography.`,
            slide_image_prompt: sanitizeAndGenerateSlideImagePrompt(
              undefined,
              1,
              'hook',
              draftHook,
              funnelStage,
              'Visual editorial bersih dengan pencahayaan alami dan komposisi lapang.',
              'photography'
            ) ?? ''
          },
          {
            slide: 2,
            role: 'problem',
            communication_job: 'Fokus pada satu masalah utama yang dialami audiens saat ini',
            headline: draftProblem,
            body: draftProblem,
            swipe_bridge: '',
            emotional_state: 'Kesadaran Masalah Tunggal',
            visual_intent: 'Infografis kartu informasi masalah dengan hierarki visual terstruktur.',
            visual_type: 'infographic-card',
            text_zone: 'Center / Left Aligned',
            negative_space_plan: 'Sisi bersih untuk penataan informasi',
            creative_strategy: {
              funnel_stage: funnelStage,
              slide_role: 'problem',
              visual_objective: 'Infografis kartu informasi masalah dengan hierarki visual terstruktur.',
              core_message: draftProblem,
              audience_emotion: 'Kesadaran Masalah Tunggal',
              visual_concept: 'Kartu grafis terstruktur dengan hierarki tipografi modern bersih',
              text_overlay: draftProblem
            },
            visual_format: 'infographic',
            visual_production: {
              subject: 'Elemen grafis terstruktur dengan hierarki informasi yang jelas.',
              action: 'Penataan visual kartu informasi dengan penekanan pada titik fokus utama.',
              composition: 'Center card layout / structured split grid dengan ruang negatif 40% lapang di area atas untuk headline.',
              layout: 'Tata letak kartu informasi bersih dan terorganisir.',
              visual_metaphor: 'Kejelasan struktur dan pemetaan informasi.',
              typography: 'Headline 28pt bold, teks informasi 15pt nyaman dibaca.',
              background: 'Neutral off-white canvas (#F8F7F4).',
              color_mood: 'Nuansa analitis & informatif.',
              negative_space: 'Margin 32px di sekeliling kartu informasi.',
              negative_prompt: 'photography, realistic person, complex faces, human hands, messy sketch, stock photo, blurry text, cluttered layout, hard selling ads.'
            },
            production_prompt: `Layout: Tata letak kartu informasi bersih dan terorganisir.
Subject/Object Utama: Elemen grafis terstruktur dengan hierarki informasi yang jelas.
Visual Metaphor: Kejelasan struktur dan pemetaan informasi.
Typography Hierarchy: Headline 28pt bold, teks informasi 15pt nyaman dibaca.
Background: Neutral off-white canvas (#F8F7F4).
Color Mood: Nuansa analitis & informatif.
Negative Space: Margin 32px di sekeliling kartu informasi.
Image/Illustration Direction: Clean minimalist infographic diagram UI.`,
            slide_image_prompt: sanitizeAndGenerateSlideImagePrompt(
              undefined,
              2,
              'problem',
              draftProblem,
              funnelStage,
              'Infografis kartu informasi masalah dengan hierarki visual terstruktur.',
              'infographic'
            ) ?? ''
          },
          {
            slide: 3,
            role: 'reframe',
            communication_job: 'Menyajikan sudut pandang struktural dan pemetaan konseptual',
            headline: draftTopic || '',
            body: '',
            swipe_bridge: '',
            emotional_state: 'Pencerahan (Aha Moment)',
            visual_intent: 'Infografis diagram pilar fondasi dengan tipografi kontras tinggi.',
            visual_type: 'minimal-diagram',
            text_zone: 'Center Aligned',
            negative_space_plan: 'Latar belakang netral dengan aksen lembut',
            creative_strategy: {
              funnel_stage: funnelStage,
              slide_role: 'reframe',
              visual_objective: 'Infografis diagram fondasi konseptual dengan tipografi kontras tinggi.',
              core_message: draftTopic || '',
              audience_emotion: 'Pencerahan (Aha Moment)',
              visual_concept: 'Diagram geometris minimalis dan hierarki tipografi modern bersih',
              text_overlay: draftTopic || ''
            },
            visual_format: 'infographic',
            visual_production: {
              subject: 'Diagram pilar konseptual yang tertata secara seimbang.',
              action: 'Penataan tata letak visual bertingkat dengan hierarki jelas.',
              composition: 'Center card layout / structured split grid dengan ruang negatif 40% lapang di area atas untuk headline.',
              layout: 'Center card composition dengan diagram terstruktur.',
              visual_metaphor: 'Fondasi pemikiran yang terorganisir rapi.',
              typography: 'Headline 28pt bold, body deskripsi 16pt, nomor urut minimalis 01-02-03.',
              background: 'Warm neutral light texture (#FAF9F6).',
              color_mood: 'Pencerahan & kejelasan strategi.',
              negative_space: 'Ruang bernapas lapang di sekeliling diagram tengah.',
              negative_prompt: 'photography, realistic person, complex faces, human hands, messy sketch, stock photo, blurry text, cluttered layout, hard selling ads.'
            },
            production_prompt: `Layout: Center card composition dengan diagram terstruktur.
Subject/Object Utama: Diagram pilar konseptual yang tertata secara seimbang.
Visual Metaphor: Fondasi pemikiran yang terorganisir rapi.
Typography Hierarchy: Headline 28pt bold, body deskripsi 16pt, nomor urut minimalis 01-02-03.
Background: Warm neutral light texture (#FAF9F6).
Color Mood: Pencerahan & kejelasan strategi.
Negative Space: Ruang bernapas lapang di sekeliling diagram tengah.
Image/Illustration Direction: Modern minimalist 3D isometric or flat geometric diagram.`,
            slide_image_prompt: sanitizeAndGenerateSlideImagePrompt(
              undefined,
              3,
              'reframe',
              draftTopic || '',
              funnelStage,
              'Infografis diagram pilar fondasi dengan tipografi kontras tinggi.',
              'infographic'
            ) ?? ''
          },
          {
            slide: 4,
            role: 'learn',
            communication_job: 'Menyajikan inti solusi / pembahasan utama yang relevan',
            headline: draftSolution || '',
            body: draftSolution ? (draftProof ? `${draftSolution}. ${draftProof}` : draftSolution) : '',
            swipe_bridge: '',
            emotional_state: 'Optimisme & Kejelasan Sistem',
            visual_intent: 'Tampilan kerangka kerja visual terstruktur dengan penataan bertahap.',
            visual_type: 'step-framework',
            text_zone: 'Upper Third',
            negative_space_plan: 'Ruang lega di sekitar kerangka kerja visual',
            creative_strategy: {
              funnel_stage: funnelStage,
              slide_role: 'learn',
              visual_objective: 'Tampilan kerangka kerja visual terstruktur dengan penataan bertahap.',
              core_message: draftSolution || '',
              audience_emotion: 'Optimisme & Kejelasan Sistem',
              visual_concept: 'Kartu tata letak terstruktur dengan hierarki tipografi modern bersih',
              text_overlay: draftSolution || ''
            },
            visual_format: 'infographic',
            visual_production: {
              subject: 'Kerangka kerja visual terstruktur dengan penanda tahapan.',
              action: 'Tata letak kartu proses bertingkat dengan penanda step yang jelas dan ruang bernapas lega.',
              composition: 'Center card layout / structured split grid dengan ruang negatif 40% lapang di area atas untuk headline.',
              layout: 'Card list bertingkat yang rapi dan terarah.',
              visual_metaphor: 'Struktur bertahap yang sistematis.',
              typography: 'Headline 28pt bold, poin langkah 16pt dengan icon badge.',
              background: 'Clean light cream (#F7F6F2).',
              color_mood: 'Kepercayaan, kredibilitas, dan optimisme.',
              negative_space: 'Padding internal 24px di setiap card langkah.',
              negative_prompt: 'photography, realistic person, complex faces, human hands, messy sketch, stock photo, blurry text, cluttered layout, hard selling ads.'
            },
            production_prompt: `Layout: Card list bertingkat yang rapi dan terarah.
Subject/Object Utama: Kerangka kerja visual terstruktur dengan penanda tahapan.
Visual Metaphor: Struktur bertahap yang sistematis.
Typography Hierarchy: Headline 28pt bold, poin langkah 16pt dengan icon badge.
Background: Clean light cream (#F7F6F2).
Color Mood: Kepercayaan, kredibilitas, dan optimisme.
Negative Space: Padding internal 24px di setiap card langkah.
Image/Illustration Direction: Clean minimalist structured framework layout.`,
            slide_image_prompt: sanitizeAndGenerateSlideImagePrompt(
              undefined,
              4,
              'learn',
              draftSolution || '',
              funnelStage,
              'Tampilan kerangka kerja visual terstruktur dengan penataan bertahap.',
              'infographic'
            ) ?? ''
          },
          {
            slide: 5,
            role: 'cta',
            communication_job: 'Mendorong aksi penutup berbasis value yang sesuai dengan tahap corong',
            headline: carouselCta,
            body: '',
            swipe_bridge: carouselCta,
            emotional_state: 'Dorongan Aksi Berbasis Value',
            visual_intent: 'Visual closing card bersih dengan tombol CTA kontras tinggi dan instruksi aksi berbasis value.',
            visual_type: 'cta-card',
            text_zone: 'Center Aligned',
            negative_space_plan: 'Latar bersih dengan tombol CTA kontras tinggi di tengah',
            creative_strategy: {
              funnel_stage: funnelStage,
              slide_role: 'cta',
              visual_objective: 'Visual closing card bersih dengan tombol CTA kontras tinggi dan instruksi aksi berbasis value.',
              core_message: carouselCta,
              audience_emotion: 'Dorongan Aksi Berbasis Value',
              visual_concept: 'Kartu UI penutup dan tombol aksi kontras tinggi',
              text_overlay: carouselCta
            },
            visual_format: 'infographic',
            visual_production: {
              subject: 'Kartu ajakan tindakan berbasis value dengan tipografi headline kuat dan button CTA berbayang halus.',
              action: 'Komposisi terpusat dengan headline ajakan nilai di atas dan tombol pill CTA elegan di tengah.',
              composition: 'Center card layout / structured split grid dengan ruang negatif 40% lapang di area atas untuk headline.',
              layout: 'Clean closing card layout dengan tombol CTA pill besar yang dominan di tengah.',
              visual_metaphor: 'Arah lanjutan yang terfokus dan terarah.',
              typography: 'Headline 32pt bold, body naskah 16pt, CTA button text 18pt bold.',
              background: 'Subtle warm emerald gradient ambient (#F0FDF4 ke #FFFFFF).',
              color_mood: 'Tegas, terpercaya, dan berfokus pada value.',
              negative_space: 'Ruang lega 50% di sekitar tombol aksi utama.',
              negative_prompt: 'photography, realistic person, complex faces, human hands, messy sketch, stock photo, blurry text, cluttered layout, hard selling ads.'
            },
            production_prompt: `Layout: Clean closing card layout dengan tombol CTA pill besar yang dominan di tengah.
Subject/Object Utama: Kartu ajakan tindakan berbasis value dengan tipografi headline kuat dan button CTA berbayang halus.
Visual Metaphor: Arah lanjutan yang terfokus dan terarah.
Typography Hierarchy: Headline 32pt bold, body naskah 16pt, CTA button text 18pt bold.
Background: Subtle warm emerald gradient ambient (#F0FDF4 ke #FFFFFF).
Color Mood: Tegas, terpercaya, dan berfokus pada value.
Negative Space: Ruang lega 50% di sekitar tombol aksi utama.
Image/Illustration Direction: Clean minimalist social media closing card.`,
            slide_image_prompt: sanitizeAndGenerateSlideImagePrompt(
              undefined,
              5,
              'cta',
              carouselCta,
              funnelStage,
              'Visual closing card bersih dengan tombol CTA kontras tinggi dan instruksi aksi berbasis value.',
              'infographic'
            ) ?? ''
          }
        ],
        captionForPost: (activeItem?.caption || '').trim(),
        captionInstruction: "Paste teks ini di caption/keterangan postingan setelah aset dibuat."
      };
      return JSON.stringify(initialPlan, null, 2);
    }

    case 'video': {
      const vStyles: VideoStyle[] = [
        {
          productionMode: "human_led",
          name: `Human-Led (${funnelStage} Organic)`,
          hookStyle: "Pertanyaan spontan langsung menyentuh masalah utama",
          pacingStyle: "Natural, santai, banyak jeda natural",
          audioDirection: "Suara asli kreator (casual tone) dengan musik latar lofi santai",
          voiceoverOutline: `Menyapa audiens -> Membahas topik ${activeItem?.headline || 'strategi konten'} -> Memberikan insight ${funnelStage} -> ${voiceoverCta}`,
          script: {
            hook: `Pernah merasa konten kamu sudah dibuat maksimal tapi hasilnya stagnan?`,
            masalah: `Banyak yang asal posting tanpa memperhatikan struktur ${funnelStage}.`,
            solusi: activeContext.brand_context?.brand_name ? `Dengan ${activeContext.brand_context.brand_name}, kamu bisa menyusun alur konten ${funnelStage} secara otomatis.` : `Dengan sistem terarah, kamu bisa menyusun alur konten ${funnelStage} secara otomatis.`,
            proof: `Banyak kreator menghemat waktu dan menghasilkan narasi yang lebih terarah.`,
            cta: voiceoverCta
          },
          videoPrompt: "A friendly creator looking at their laptop screen, showing surprise and happiness, warm aesthetic home office, soft background, vertical 9:16.",
          visualPlan: `0-5s: Talent close-up penasaran. 5-15s: Tampilkan rekaman layar dasbor alur konten ${funnelStage}. 15-25s: Penjelasan visual strategi. 25-30s: Tampilan CTA ${safeCta}.`,
          negativeConstraints: "No distorted anatomy, no inconsistent face, no unreadable text, no visual artifacts.",
          captionForPost: buildFunnelAlignedVideoCaption(funnelStage, activeItem, { script: { hook: `Pernah merasa konten kamu sudah dibuat maksimal tapi hasilnya stagnan?`, solusi: activeContext.brand_context?.brand_name ? `Dengan ${activeContext.brand_context.brand_name}, kamu bisa menyusun alur konten ${funnelStage} secara otomatis.` : `Dengan sistem terarah, kamu bisa menyusun alur konten ${funnelStage} secara otomatis.`, cta: voiceoverCta } }, voiceoverCta),
          captionInstruction: "Paste teks ini di caption/keterangan postingan setelah aset dibuat."
        },
        {
          productionMode: "product_demo",
          name: "Product Demo (Workflow Walkthrough)",
          hookStyle: "Kalimat pembuka menggantung menyambung dari CTA akhir",
          pacingStyle: "Sangat cepat, transisi secepat kilat, ketukan ritmis",
          audioDirection: "Musik up-beat trend TikTok yang catchy dengan sulih suara energik",
          voiceoverOutline: `Membuka loop -> Fakta mengejutkan -> Solusi ${funnelStage} -> CTA menggantung`,
          script: {
            hook: `Inilah alasan kenapa alur konten kamu belum efektif...`,
            masalah: `Membuat konten tanpa penyesisuan tahap ${funnelStage} membuat audiens bingung.`,
            solusi: activeContext.brand_context?.brand_name ? `${activeContext.brand_context.brand_name} membantu merapikan alur ${funnelStage} secara instan.` : `Sistem ini membantu merapikan alur ${funnelStage} secara instan.`,
            proof: `Sistem ini membantu menjaga konsistensi narasi harianmu.`,
            cta: `${voiceoverCta}`
          },
          videoPrompt: "Satisfying looping motion graphic of abstract futuristic clockwork gears spinning seamlessly on a clean minimalist gray background, 3D render vertical 9:16.",
          visualPlan: "0-5s: Teks tebal kontras tinggi berkedip cepat di layar. 5-15s: Animasi transisi corong warna neon. 15-25s: Grafik panah menanjak cepat. 25-30s: Layar meredup cepat bersiap menyambung ke awal loop.",
          negativeConstraints: "No distorted UI, no unreadable interface text, no fake UI artifacts, no broken screen geometry.",
          captionForPost: buildFunnelAlignedVideoCaption(funnelStage, activeItem, { script: { hook: `Inilah alasan kenapa alur konten kamu belum efektif...`, solusi: activeContext.brand_context?.brand_name ? `${activeContext.brand_context.brand_name} membantu merapikan alur ${funnelStage} secara instan.` : `Sistem ini membantu merapikan alur ${funnelStage} secara instan.`, cta: voiceoverCta } }, voiceoverCta),
          captionInstruction: "Paste teks ini di caption/keterangan postingan setelah aset dibuat."
        },
        {
          productionMode: "motion_explainer",
          name: "Motion Explainer (Storytelling & Framework)",
          hookStyle: "Pernyataan filosofis tentang alur komunikasi",
          pacingStyle: "Lambat, dramatis, transisi halus, mengedepankan estetika visual",
          audioDirection: "Musik piano instrumental emosional dengan voiceover mendalam dan hangat",
          voiceoverOutline: `Narasi perjalanan -> Refleksi strategi -> Solusi terstruktur -> Penutup hangat`,
          script: {
            hook: `Berapa banyak waktu yang dihemat ketika strategi komunikasi tersusun rapi?`,
            masalah: `Menyampaikan pesan tanpa arah tahap ${funnelStage} membuat usaha kita terbuang.`,
            solusi: `Saat alur ${funnelStage} ditata dengan baik, pesan kamu terasa jauh lebih kuat.`,
            proof: `Otomatisasi membantu menjaga kualitas ide tanpa mengorbankan waktu.`,
            cta: `${voiceoverCta}`
          },
          videoPrompt: "Cinematic slow motion shot of a professional looking relaxed in a beautiful plant-filled cafe, soft golden hour sunlight filtering through glass windows, 8k vertical 9:16.",
          visualPlan: "0-10s: Slow motion talent menikmati minumannya dengan tenang. 10-20s: Close-up tablet menampilkan kurva grafik melesat naik. 20-30s: Teks estetik berukuran sedang muncul perlahan di layar kafe yang asri.",
          negativeConstraints: "No unreadable typography, no cluttered layout, no broken motion hierarchy, no visual artifacts.",
          captionForPost: buildFunnelAlignedVideoCaption(funnelStage, activeItem, { script: { hook: `Berapa banyak waktu yang dihemat ketika strategi komunikasi tersusun rapi?`, solusi: `Saat alur ${funnelStage} ditata dengan baik, pesan kamu terasa jauh lebih kuat.`, cta: voiceoverCta } }, voiceoverCta),
          captionInstruction: "Paste teks ini di caption/keterangan postingan setelah aset dibuat."
        }
      ];
      return JSON.stringify(vStyles, null, 2);
    }
    default:
      return '';
  }
};

const isErrorContent = (str: string | null | undefined): boolean => {
  if (!str) return false;
  const upper = str.toUpperCase();
  return upper.includes('RATE LIMIT') || upper.includes('QUOTA EXCEEDED') || upper.includes('PERMINTAAN AI SEDANG DIBATASI');
};

export default function ProductionStudioPage() {
  const router = useRouter();
  const { hasCustomKey } = useGeminiApiKey();

  // State structure for the Production Studio
  const [sourceItem, setSourceItem] = useState<ContentItem | null>(null);
  const currentContentItemIdRef = React.useRef<string | null>(sourceItem?.content_item_id ?? null);
  useEffect(() => {
    currentContentItemIdRef.current = sourceItem?.content_item_id ?? null;
  }, [sourceItem?.content_item_id]);
  const [sharedContextSnapshot, setSharedContextSnapshot] = useState<SharedContentContext | null>(null);
  const [funnelStrategySnapshot, setFunnelStrategySnapshot] = useState<FunnelStrategy | null>(null);
  const [characterDNA, setCharacterDNA] = useState<CharacterDNA | null>(null);
  const [savedCharacters, setSavedCharacters] = useState<CharacterDNA[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [canonicalProjectId, setCanonicalProjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'review' | 'image' | 'carousel' | 'video'>('review');
  const [showCharacterModal, setShowCharacterModal] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
  const [nextStepVisibleKeys, setNextStepVisibleKeys] = useState<Record<string, boolean>>({});
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Core production outputs states
  const [imageOutput, setImageOutput] = useState<string>('');
  const [carouselOutput, setCarouselOutput] = useState<string>('');
  const [videoOutput, setVideoOutput] = useState<string>('');
  const [imageOutputSource, setImageOutputSource] =
    useState<ProductionOutputSource>('none');
  const [carouselOutputSource, setCarouselOutputSource] =
    useState<ProductionOutputSource>('none');
  const [videoOutputSource, setVideoOutputSource] =
    useState<ProductionOutputSource>('none');
  const [reviewOutput, setReviewOutput] = useState<string>('');
  const [revisionNotes, setRevisionNotes] = useState<string>('');

  // Selected sub-tabs inside Production Studio
  const [selectedAngleId, setSelectedAngleId] = useState<'A' | 'B' | 'C'>('A');
  const [selectedVideoProductionMode, setSelectedVideoProductionMode] = useState<VideoProductionMode>('human_led');
  const [userSelectedVideoModeByItem, setUserSelectedVideoModeByItem] = useState<Record<string, VideoProductionMode>>({});
  const [activeSlideNumber, setActiveSlideNumber] = useState<number>(1);

  // Authoritative Production Engine Context
  const productionEngineContext = useMemo<ProductionEngineContext | null>(() => {
    if (!canonicalProjectId || !sharedContextSnapshot || !funnelStrategySnapshot || !sourceItem) {
      return null;
    }
    const result = buildProductionEngineContext(
      canonicalProjectId,
      sharedContextSnapshot,
      funnelStrategySnapshot,
      sourceItem,
      characterDNA || undefined
    );
    return result.isValid && result.context ? result.context : null;
  }, [canonicalProjectId, sharedContextSnapshot, funnelStrategySnapshot, sourceItem, characterDNA]);

  // Video Intent Decision & Recommendation
  const videoIntentDecision = useMemo<VideoIntentDecision | null>(() => {
    if (!productionEngineContext) return null;
    return resolveVideoIntent(productionEngineContext);
  }, [productionEngineContext]);

  const recommendedVideoProductionMode = videoIntentDecision?.recommended_mode || null;

  // Sync selected video production mode with recommendation when item changes, honoring project-scoped manual user override
  useEffect(() => {
    if (!sourceItem) return;
    const overrideKey = (canonicalProjectId && sourceItem.content_item_id)
      ? getVideoModeOverrideKey(canonicalProjectId, sourceItem.content_item_id)
      : null;
    const userChosen = overrideKey ? userSelectedVideoModeByItem[overrideKey] : null;
    if (userChosen) {
      setSelectedVideoProductionMode(userChosen);
    } else if (recommendedVideoProductionMode) {
      setSelectedVideoProductionMode(recommendedVideoProductionMode);
    }
  }, [canonicalProjectId, sourceItem, recommendedVideoProductionMode, userSelectedVideoModeByItem]);

  // Product Asset Context & Video Production Readiness (Phase 3D-C1C-A & 3D-C1C-B)
  const [productAssetContext, setProductAssetContext] = useState<ProductAssetContext | null>(null);

  // Reactive loading for ProductAssetContext strictly scoped to (canonicalProjectId, sourceItem?.content_item_id)
  useEffect(() => {
    if (!canonicalProjectId || !sourceItem?.content_item_id) {
      setProductAssetContext(null);
      return;
    }
    const itemKey = getItemKey(sourceItem);
    const stored = loadProjectData(
      canonicalProjectId,
      `studio_product_asset_${itemKey}`
    );
    if (stored && typeof stored === 'object') {
      setProductAssetContext(stored as ProductAssetContext);
    } else {
      setProductAssetContext(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canonicalProjectId, sourceItem?.content_item_id]);

  const videoProductionReadiness = useMemo<VideoProductionReadiness | null>(() => {
    if (!productionEngineContext) return null;
    return resolveVideoProductionReadiness({
      productionContext: productionEngineContext,
      selectedMode: selectedVideoProductionMode,
      productAssetContext,
    });
  }, [productionEngineContext, selectedVideoProductionMode, productAssetContext]);

  const handleSelectVideoProductionMode = (mode: VideoProductionMode) => {
    setSelectedVideoProductionMode(mode);
    if (canonicalProjectId && sourceItem?.content_item_id) {
      const overrideKey = getVideoModeOverrideKey(canonicalProjectId, sourceItem.content_item_id);
      if (overrideKey) {
        setUserSelectedVideoModeByItem(prev => ({
          ...prev,
          [overrideKey]: mode
        }));
      }
    }
  };

  const handleUseRecommendation = () => {
    if (recommendedVideoProductionMode) {
      // Preferred behavior: remove the manual override for this project + item so selection naturally follows recommendation
      if (canonicalProjectId && sourceItem?.content_item_id) {
        const overrideKey = getVideoModeOverrideKey(canonicalProjectId, sourceItem.content_item_id);
        if (overrideKey) {
          setUserSelectedVideoModeByItem(prev => {
            if (!(overrideKey in prev)) return prev;
            const updated = { ...prev };
            delete updated[overrideKey];
            return updated;
          });
        }
      }
      setSelectedVideoProductionMode(recommendedVideoProductionMode);
      showToast(`Beralih ke mode rekomendasi: ${getVideoProductionModeLabel(recommendedVideoProductionMode)}`);
    }
  };

  // Direct image generation state
  const [generatedImages, setGeneratedImages] = useState<Record<string, GeneratedImageExecutionOutput>>({});
  const [imageGeneratingKey, setImageGeneratingKey] = useState<string | null>(null);
  const [imageGenerateError, setImageGenerateError] = useState<string | null>(null);

  const handleGenerateImage = async (angleId: string) => {
    if (!hasCustomKey) {
      showToast('Hubungkan Gemini API Key dulu untuk menggunakan fitur generate visual.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!angleId || !!imageGeneratingKey || !canonicalProjectId) return;

    // Strict authority check (NO fallback item)
    if (!sourceItem || !sourceItem.content_item_id) {
      setImageGenerateError('Authoritative ContentItem tidak ditemukan atau tidak memiliki content_item_id. Production package diblokir.');
      showToast('Gagal: ContentItem tidak valid untuk produksi.');
      return;
    }
    if (!sharedContextSnapshot) {
      setImageGenerateError('Authoritative SharedContentContext tidak ditemukan (sharedContextSnapshot null). Production package diblokir.');
      showToast('Gagal: Context project tidak valid untuk produksi.');
      return;
    }
    if (!funnelStrategySnapshot) {
      setImageGenerateError('Authoritative FunnelStrategy tidak ditemukan (funnelStrategySnapshot null). Production package diblokir.');
      showToast('Gagal: Funnel strategy project tidak valid untuk produksi.');
      return;
    }

    // Authoritative output source check
    if (!isAuthoritativeProductionOutputSource(imageOutputSource)) {
      setImageGenerateError(`Image output source (${imageOutputSource}) bukan authoritative production output. Production package diblokir.`);
      showToast('Gagal: Output visual belum bernilai produksi authoritative.');
      return;
    }

    // Extract canonical production candidates from imageAnglesPackage
    if (!imageAnglesPackage || !Array.isArray(imageAnglesPackage.angles) || imageAnglesPackage.angles.length === 0) {
      setImageGenerateError('Image output package tidak ditemukan atau kosong. Production package diblokir.');
      showToast('Gagal: Candidate visual tidak tersedia.');
      return;
    }

    const candidates: ImageProductionCandidate[] = imageAnglesPackage.angles
      .map(a => a.productionCandidate)
      .filter((c): c is ImageProductionCandidate => Boolean(c));

    if (candidates.length === 0) {
      setImageGenerateError('Tidak ada production candidate valid di dalam Image output. Production package diblokir.');
      showToast('Gagal: Candidate visual tidak terstruktur.');
      return;
    }

    // Check explicit clicked angle candidate
    const selectedCandidate = candidates.find(c => c.candidate_id === angleId);
    if (!selectedCandidate) {
      setImageGenerateError(`Production candidate untuk angle [${angleId}] tidak ditemukan. Production package diblokir.`);
      showToast(`Gagal: Candidate angle [${angleId}] tidak ditemukan.`);
      return;
    }

    // Phase 4B-B: Resolve the current translated bundle for angleId from page-level authority (Fail-Closed)
    const translatedBundle = imageTranslatedPromptBundles?.[angleId] ?? null;
    if (!translatedBundle) {
      const transErr = imageTranslationError || `Translated prompt bundle untuk angle [${angleId}] tidak tersedia. Production package diblokir.`;
      setImageGenerateError(transErr);
      showToast(`Gagal: ${transErr}`);
      return;
    }

    // Capture Image Execution Authority BEFORE request
    const authorityResult = buildExecutionPromptAuthority(translatedBundle);
    if (!authorityResult.ok) {
      const authErr = authorityResult.error || 'Gagal membuat execution authority.';
      setImageGenerateError(authErr);
      showToast(`Gagal: ${authErr}`);
      return;
    }

    const requestExecutionAuthority = authorityResult.authority;
    if (requestExecutionAuthority.asset_type !== 'image') {
      const authErr = 'Execution authority asset_type bukan image.';
      setImageGenerateError(authErr);
      showToast(`Gagal: ${authErr}`);
      return;
    }

    if (requestExecutionAuthority.candidate_id !== selectedCandidate.candidate_id) {
      const authErr = 'Execution authority candidate_id mismatch.';
      setImageGenerateError(authErr);
      showToast(`Gagal: ${authErr}`);
      return;
    }

    // Package metadata generation in caller
    if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
      setImageGenerateError('API crypto.randomUUID tidak tersedia untuk pembuatan metadata production package.');
      showToast('Gagal: Crypto API tidak tersedia.');
      return;
    }

    const packageMetadata: ProductionPackageMetadata = {
      package_id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };

    // Prepare Production Package using exact translated bundle
    const prepResult = prepareProductionPackage({
      projectId: canonicalProjectId,
      sharedContext: sharedContextSnapshot,
      funnelStrategy: funnelStrategySnapshot,
      contentItem: sourceItem,
      characterDNA: productionEngineContext?.character_dna || undefined,
      candidates,
      selectedCandidateId: angleId,
      translatedPromptBundle: translatedBundle,
      metadata: packageMetadata,
    });

    if (!prepResult.ok || !prepResult.package) {
      const prepErr = (!prepResult.ok ? (prepResult as any).error : null) || 'Gagal menyiapkan production package.';
      setImageGenerateError(prepErr);
      showToast(`Gagal prepare package: ${prepErr}`);
      return;
    }

    const productionPackage = prepResult.package;

    // Verify asset_type is image
    if (productionPackage.asset_type !== 'image') {
      setImageGenerateError(`Production package asset_type [${productionPackage.asset_type}] bukan image.`);
      showToast('Gagal: Package type mismatch.');
      return;
    }

    // Save Production Package before external generation
    const saveResult = saveProductionPackage(canonicalProjectId, productionPackage);
    if (!saveResult.ok) {
      const saveErr = saveResult.error || 'Gagal menyimpan production package.';
      setImageGenerateError(saveErr);
      showToast(`Gagal save package: ${saveErr}`);
      return;
    }

    const requestProjectId = canonicalProjectId;
    const requestContentItemId = sourceItem.content_item_id;
    const requestCandidateId = angleId;
    const requestCanonicalKey = getGeneratedImageOutputKey(requestProjectId, requestContentItemId, requestCandidateId);

    setImageGeneratingKey(requestCanonicalKey);
    setImageGenerateError(null);

    try {
      const res = await fetch('/api/gemini/generate-image', {
        method: 'POST',
        headers: buildGeminiRequestHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          prompt: translatedBundle.execution_prompt,
          aspectRatio: '4:5',
        }),
      });

      const data = await res.json();

      // ASYNC GUARD (Verify latest/current authority signature matches)
      const currentAuthority = imageExecutionAuthoritiesRef.current?.[requestCandidateId] ?? null;
      const isAuthorityMatch =
        currentAuthority &&
        currentAuthority.asset_type === 'image' &&
        currentAuthority.candidate_id === requestCandidateId &&
        currentAuthority.contract_version === requestExecutionAuthority.contract_version &&
        currentAuthority.execution_signature === requestExecutionAuthority.execution_signature;

      if (
        getActiveProjectId() !== requestProjectId ||
        canonicalProjectId !== requestProjectId ||
        currentContentItemIdRef.current !== requestContentItemId ||
        !isAuthorityMatch
      ) {
        console.warn('[Async Guard] Discarding stale generated image response');
        return;
      }

      if (!res.ok || !data.imageDataUrl) {
        const errMsg = data.error || data.message || "Gagal generate image. Coba lagi nanti.";
        setImageGenerateError(errMsg);
      } else {
        const imageOutputData: GeneratedImageExecutionOutput = {
          project_id: requestProjectId,
          content_item_id: requestContentItemId,
          candidate_id: requestCandidateId,
          imageDataUrl: data.imageDataUrl,
          model: data.model,
          aspectRatio: data.aspectRatio,
          execution_authority: requestExecutionAuthority,
        };
        setGeneratedImages(prev => ({
          ...prev,
          [requestCanonicalKey]: imageOutputData,
        }));
      }
    } catch (err: any) {
      const currentAuthority = imageExecutionAuthoritiesRef.current?.[requestCandidateId] ?? null;
      const isAuthorityMatch =
        currentAuthority &&
        currentAuthority.asset_type === 'image' &&
        currentAuthority.candidate_id === requestCandidateId &&
        currentAuthority.contract_version === requestExecutionAuthority.contract_version &&
        currentAuthority.execution_signature === requestExecutionAuthority.execution_signature;

      if (
        getActiveProjectId() !== requestProjectId ||
        canonicalProjectId !== requestProjectId ||
        currentContentItemIdRef.current !== requestContentItemId ||
        !isAuthorityMatch
      ) {
        return;
      }
      console.error('Client Image Generation Error:', err);
      setImageGenerateError("Gagal generate image. Coba lagi nanti.");
    } finally {
      setImageGeneratingKey(null);
    }
  };

  const handleDownloadImage = (dataUrl: string, angleId: string) => {
    try {
      const itemNo = sourceItem?.no || 1;
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `alcocontent_item_${itemNo}_angle_${angleId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Download image error:', err);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Load from local storage on mount
  useEffect(() => {
    // Check URL params for active tab first
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get('tab');
      if (tabParam === 'ugc') {
        setActiveTab('video');
      } else if (tabParam === 'dna') {
        setShowCharacterModal(true);
      } else if (tabParam && ['review', 'image', 'carousel', 'video'].includes(tabParam)) {
        setActiveTab(tabParam as any);
      }
    }

    // Reset all outputs to clean state first to prevent any potential cache carry-over
    setImageOutput('');
    setImageOutputSource('none');
    setCarouselOutput('');
    setCarouselOutputSource('none');
    setVideoOutput('');
    setVideoOutputSource('none');
    setReviewOutput('');
    setRevisionNotes('');
    setSourceItem(null);
    setSharedContextSnapshot(null);
    setFunnelStrategySnapshot(null);

    try {
      let paramProjId: string | null = null;
      let paramContentItemId: string | null = null;
      let hasExplicitContentItemId = false;
      let paramItemNo: string | number | null = null;
      let hasExplicitItemNo = false;
      let tabParam: string | null = null;

      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        paramProjId = urlParams.get('projectId');
        hasExplicitContentItemId = urlParams.has('contentItemId');
        paramContentItemId = urlParams.get('contentItemId');
        hasExplicitItemNo = urlParams.has('itemNo');
        paramItemNo = urlParams.get('itemNo');
        tabParam = urlParams.get('tab');
      }

      if (tabParam === 'image' || tabParam === 'carousel' || tabParam === 'video' || tabParam === 'review') {
        setActiveTab(tabParam);
      }

      const activeProjId = getActiveProjectId();

      // Canonical Project ID Resolution:
      // Prefer explicit URL parameter from calendar routing; fallback to global active project
      // Strictly filter out 'default', 'default_project', and empty values
      let resolvedCanonicalId: string | null = null;
      if (paramProjId && paramProjId.trim() && paramProjId !== 'default' && paramProjId !== 'default_project') {
        resolvedCanonicalId = paramProjId.trim();
        // Keep active project in sync with canonical ID
        setActiveProjectId(resolvedCanonicalId);
      } else if (activeProjId && activeProjId.trim() && activeProjId !== 'default' && activeProjId !== 'default_project') {
        resolvedCanonicalId = activeProjId.trim();
      }

      if (!resolvedCanonicalId) {
        setCanonicalProjectId(null);
        setSharedContextSnapshot(null);
        setFunnelStrategySnapshot(null);
        setSourceItem(null);
        setIsLoaded(true);
        return;
      }

      setCanonicalProjectId(resolvedCanonicalId);

      // Load project-scoped shared context strictly for production (no repair, no blueprint derivation)
      const parsedContext = loadProjectSharedContextStrictForProduction(resolvedCanonicalId);
      setSharedContextSnapshot(parsedContext);

      // Load project-scoped authoritative FunnelStrategy strictly (Phase 3A: no auto-derivation)
      const parsedFunnelStrategy = loadStoredProjectFunnelStrategyStrict(resolvedCanonicalId);
      setFunnelStrategySnapshot(parsedFunnelStrategy);

      // Load project calendar items strictly for production (no ID fabrication, no mutation)
      const calendarItems = loadProjectCalendarItemsStrictForProduction(resolvedCanonicalId);
      const savedSelected = loadProjectSelectedItem(resolvedCanonicalId);

      // Strict item target resolution (fails closed on invalid/missing explicit target, no unintended fallback)
      const targetResolution = resolveProductionContentItemTarget({
        calendarItems,
        contentItemId: paramContentItemId,
        hasExplicitContentItemId,
        itemNo: paramItemNo,
        hasExplicitItemNo,
        savedSelectedItem: savedSelected,
      });

      const resolvedItem =
        targetResolution.isValid && targetResolution.item
          ? targetResolution.item
          : null;

      setSourceItem(resolvedItem);

      const charList = getProjectSavedCharacters(resolvedCanonicalId) as CharacterDNA[];
      setSavedCharacters(charList);
      const activeCharId = getProjectActiveCharacterId(resolvedCanonicalId);
      setSelectedCharacterId(activeCharId);

      if (activeCharId && charList.length > 0) {
        const found = charList.find(c => c.character_id === activeCharId);
        if (found) {
          setCharacterDNA(found);
        } else {
          const storedDNA = getProjectCharacterDNA(resolvedCanonicalId);
          if (storedDNA) setCharacterDNA(storedDNA);
        }
      } else {
        const storedDNA = getProjectCharacterDNA(resolvedCanonicalId);
        if (storedDNA) {
          setCharacterDNA(storedDNA);
          if (storedDNA.character_id) {
            setSelectedCharacterId(storedDNA.character_id);
          }
        } else if (charList.length > 0) {
          setCharacterDNA(charList[0]);
          setSelectedCharacterId(charList[0].character_id);
        }
      }

      if (resolvedItem) {
        const itemKey = getItemKey(resolvedItem);
        
        const storedImage = loadProjectData(resolvedCanonicalId, `studio_image_${itemKey}`);
        const storedCarousel = loadProjectData(resolvedCanonicalId, `studio_carousel_${itemKey}`);
        const storedVideo = loadProjectData(resolvedCanonicalId, `studio_video_${itemKey}`);
        const storedReview = loadProjectData(resolvedCanonicalId, `studio_review_${itemKey}`);
        const storedRevision = loadProjectData(resolvedCanonicalId, `studio_revision_${itemKey}`);

        if (storedImage && !isErrorContent(storedImage)) {
          setImageOutput(storedImage);
          setImageOutputSource('stored_output');
        } else {
          if (storedImage && isErrorContent(storedImage)) {
            removeProjectData(resolvedCanonicalId, `studio_image_${itemKey}`);
          }
          setImageOutput('');
          setImageOutputSource('none');
        }

        if (storedCarousel && !isErrorContent(storedCarousel)) {
          setCarouselOutput(storedCarousel);
          setCarouselOutputSource('stored_output');
        } else {
          if (storedCarousel && isErrorContent(storedCarousel)) {
            removeProjectData(resolvedCanonicalId, `studio_carousel_${itemKey}`);
          }
          setCarouselOutput(getInitialDraft('carousel', resolvedItem, parsedContext));
          setCarouselOutputSource('initial_draft');
        }

        if (storedVideo && !isErrorContent(storedVideo)) {
          setVideoOutput(storedVideo);
          setVideoOutputSource('stored_output');
        } else {
          if (storedVideo && isErrorContent(storedVideo)) {
            removeProjectData(resolvedCanonicalId, `studio_video_${itemKey}`);
          }
          setVideoOutput(getInitialDraft('video', resolvedItem, parsedContext));
          setVideoOutputSource('initial_draft');
        }

        if (storedReview && !isErrorContent(storedReview)) {
          setReviewOutput(storedReview);
        } else {
          if (storedReview && isErrorContent(storedReview)) {
            removeProjectData(resolvedCanonicalId, `studio_review_${itemKey}`);
          }
          setReviewOutput(getInitialDraft('review', resolvedItem, parsedContext));
        }

        if (storedRevision) {
          setRevisionNotes(storedRevision);
        } else {
          setRevisionNotes('');
        }
      }
    } catch (e) {
      console.error('Failed to parse storage data in Production Studio', e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save setters with local storage persistence using canonicalProjectId
  const saveImageOutput = (val: string) => {
    setImageOutput(val);
    if (sourceItem && canonicalProjectId) {
      const itemKey = getItemKey(sourceItem);
      saveProjectData(canonicalProjectId, `studio_image_${itemKey}`, val);
    }
  };
  const saveCarouselOutput = (val: string) => {
    setCarouselOutput(val);
    if (sourceItem && canonicalProjectId) {
      const itemKey = getItemKey(sourceItem);
      saveProjectData(canonicalProjectId, `studio_carousel_${itemKey}`, val);
    }
  };
  const saveVideoOutput = (val: string) => {
    setVideoOutput(val);
    if (sourceItem && canonicalProjectId) {
      const itemKey = getItemKey(sourceItem);
      saveProjectData(canonicalProjectId, `studio_video_${itemKey}`, val);
    }
  };
  const saveReviewOutput = (val: string) => {
    setReviewOutput(val);
    if (sourceItem && canonicalProjectId) {
      const itemKey = getItemKey(sourceItem);
      saveProjectData(canonicalProjectId, `studio_review_${itemKey}`, val);
    }
  };
  const saveRevisionNotes = (val: string) => {
    setRevisionNotes(val);
    if (sourceItem && canonicalProjectId) {
      const itemKey = getItemKey(sourceItem);
      saveProjectData(canonicalProjectId, `studio_revision_${itemKey}`, val);
    }
  };

  const saveProductAssetContext = (val: ProductAssetContext | null) => {
    setProductAssetContext(val);
    if (sourceItem && canonicalProjectId) {
      const itemKey = getItemKey(sourceItem);
      saveProjectData(canonicalProjectId, `studio_product_asset_${itemKey}`, val);
    }
  };

  const handleDismissNextStep = (key: string) => {
    setNextStepVisibleKeys(prev => ({ ...prev, [key]: false }));
  };

  const handleSelectCharacter = (charId: string | null) => {
    setSelectedCharacterId(charId);
    if (canonicalProjectId) {
      saveProjectActiveCharacterId(canonicalProjectId, charId);
    }
    if (!charId) {
      setCharacterDNA(null);
      showToast('Karakter dimatikan (No Character)');
    } else {
      const found = savedCharacters.find(c => c.character_id === charId);
      if (found) {
        setCharacterDNA(found);
        showToast(`Karakter "${found.identity?.display_name || 'DNA'}" aktif!`);
      }
    }
  };

  const handleCreateCharacterClick = () => {
    setShowCharacterModal(true);
  };

  const handleUpdateProgress = (newProgress: Partial<ProductionProgress>) => {
    const current = sourceItem;
    if (!current || !canonicalProjectId) return;
    const updated: ContentItem = {
      ...current,
      productionProgress: {
        ...(current.productionProgress || {
          briefReady: true,
          promptCopied: false,
          assetCreated: false,
          captionCopied: false,
          readyToPost: false,
          alreadyPosted: false,
        }),
        ...newProgress,
      },
    };
    setSourceItem(updated);
    saveProjectSelectedItem(canonicalProjectId, updated);
    updateItemInProject(canonicalProjectId, updated);
  };

  const handleCopyText = (
    key: string,
    text: string,
    actionType?: 'promptCopied' | 'captionCopied' | 'none'
  ) => {
    void (async () => {
      const success = await safeCopyToClipboard(text);
      if (success) {
        setCopiedStates(prev => ({ ...prev, [key]: true }));
        setNextStepVisibleKeys(prev => ({ ...prev, [key]: true }));
        showToast('Teks berhasil disalin ke clipboard!');

        // Update production progress ONLY when explicit actionType is provided
        if (actionType === 'captionCopied') {
          handleUpdateProgress({ captionCopied: true });
        } else if (actionType === 'promptCopied') {
          handleUpdateProgress({ promptCopied: true });
        }
        // If actionType is 'none' or omitted, do NOT modify production progress

        setTimeout(() => {
          setCopiedStates(prev => ({ ...prev, [key]: false }));
        }, 2000);
      } else {
        showToast('Gagal menyalin teks.');
      }
    })();
  };

  // Generate customized production asset using Gemini API
  const handleGenerateWithAI = async () => {
    if (!hasCustomKey) {
      showToast('Hubungkan Gemini API Key dulu untuk menggunakan fitur generate AI.');
      window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top where key control is
      return;
    }

    if (isLoadingAI) return;
    setIsLoadingAI(true);
    showToast(`Gemini AI sedang memproses naskah ${activeTab.toUpperCase()}...`);
    try {
      let promptTitle = '';
      let formatDirection = '';

      if (!sourceItem) {
        showToast('Pilih item konten terlebih dahulu.');
        return;
      }

      const prodCtxResult = buildProductionContext(
        canonicalProjectId,
        sharedContextSnapshot,
        sourceItem,
        characterDNA,
        funnelStrategySnapshot
      );
      if (!prodCtxResult.isValid || !prodCtxResult.context) {
        setGenerationError(prodCtxResult.error || 'Konteks project tidak sinkron.');
        showToast(prodCtxResult.error || 'Konteks project tidak sinkron.');
        return;
      }
      const productionContext = prodCtxResult.context;

      const requestProjectId = canonicalProjectId;
      const requestItemNo = sourceItem.no;
      const requestItemId = sourceItem.content_item_id;

      const activeItem = sourceItem;
      const activeContext: SharedContentContext = sharedContextSnapshot!;
      const funnelStage = normalizeFunnelStage(activeItem.jenis);
      const funnelRules = getFunnelRules(activeItem.jenis);
      const funnelPromptBlock = buildFunnelPromptBlock(activeItem.jenis);

      if (activeTab === 'image') {
        promptTitle = `3 IMAGE ANGLES - FUNNEL ${funnelStage} MASTER CONTROLLER (CANONICAL JSON)`;
        formatDirection = `Hasilkan 3 angle konten visual yang DIKENDALIKAN SEPENUHNYA OLEH CORONG ${funnelStage} dalam format JSON canonical murni (tanpa markdown).

### AUTHORITY GROUNDING — MANDATORY (SANGAT KETAT):
Semua fakta bisnis, subjek, produk, klaim benefit, dan pesan WAJIB bersumber HANYA dari ProductionContext yang tercantum di atas (selected ContentItem, SharedContentContext, FunnelStrategy, CharacterDNA jika tersedia, atau catatan revisi user).
1. DILARANG MENGARANG FAKTA BISNIS: Jangan menciptakan persona usia/gender/pekerjaan, dashboard analitik, metrik omzet, bukti konversi, testimoni klien, jumlah pengguna, atau klaim benefit yang tidak tercantum dalam authority.
2. ATURAN SUBJECT & CHARACTER:
   - Jika CharacterDNA tersedia: patuhi identitas dan ciri khas yang terkunci, jangan ubah atau tambahkan ciri di luar CharacterDNA.
   - Jika CharacterDNA TIDAK tersedia: JANGAN mengarang usia, gender, etnis, pekerjaan, atau persona demografis fiktif. Gunakan objek, produk, antarmuka, diagram alur, tangan, lingkungan, atau subjek netral yang relevan secara kontekstual dengan ContentItem. Subjek manusia tidak wajib dipaksakan jika tidak relevan.
3. ATURAN ENVIRONMENT & BUSINESS UI:
   - Jangan otomatis mengasumsikan workspace, kantor, laptop, dashboard analitik, secangkir kopi, atau ruang meeting kecuali memang relevan dan didukung oleh ContentItem.
   - Dilarang membuat dashboard angka palsu, grafik pertumbuhan fiktif, atau screenshot metrik rekayasa. Jika produk/interface dibahas namun data visual detail tidak tersedia, gunakan visualisasi produk atau konsep yang abstrak/bersih tanpa angka palsu.
4. ATURAN SOCIAL PROOF & HASIL:
   - Gunakan testimoni, studi kasus, statistik komunitas, atau klaim angka HANYA JIKA data tersebut secara eksplisit tercantum dalam authority.
   - Tahap BOFU TIDAK OTOMATIS mewajibkan social proof. Jika data bukti tidak tersedia dalam context, BOFU wajib fokus pada kejelasan penawaran (offer clarity), demonstrasi solusi/fitur nyata, pemahaman nilai, atau ajakan bertindak yang selaras dengan penawaran sebenarnya.
5. ATURAN TEXT OVERLAY & CAPTION:
   - Text overlay dan caption WAJIB diturunkan dari headline/body/tujuan ContentItem. Paraphrase atau kompresi diperbolehkan (maksimal 6-10 kata utuh tanpa '...'), tetapi DILARANG menambahkan klaim bisnis atau janji baru.
6. KREATIVITAS VISUAL:
   - AI bebas dan didorong berkreasi dalam komposisi, pencahayaan, framing, sudut kamera, depth of field, metafora visual, dan estetika fotografi editorial bersih, selama TIDAK mengarang fakta bisnis atau demografis.
7. FUNNEL TIDAK MENCIPTAKAN FAKTA:
   - Corong (${funnelStage}) menentukan intensitas komunikasi, tujuan pesan visual, dan kesiapan keputusan audiens, BUKAN menciptakan fakta produk, persona, atau bukti baru.

ATURAN CORONG ${funnelStage}:
${funnelStage === 'TOFU' ? `
- Visual Objective: Membangun awareness alami, relatable problem sehari-hari, dan curiosity tanpa pesan jualan.
- Action: Subjek/objek berinteraksi dengan situasi atau hambatan yang relevan dengan topik pada SELECTED CONTENT ITEM.
- Expression: (Jika ada subjek manusia) Bingung ringan, penasaran, merasa relate, senyum kecut reflektif terhadap kesulitan sehari-hari.
- Text Overlay: Pertanyaan reflektif atau hook masalah spesifik dari headline item tanpa terpotong (maksimal 6-10 kata).
- Caption For Post: Menjelaskan masalah dan insight ringan sesuai authority.
- DILARANG KERAS DI TOFU: Klaim hasil berlebih, social proof fiktif, urgency, bonus, daftar sekarang, beli sekarang, hard selling.
` : funnelStage === 'MOFU' ? `
- Visual Objective: Membangun pemahaman mendalam, framework solusi terstruktur, perbandingan metode, dan trust edukatif.
- Action: Menampilkan analisis atau perbandingan kerangka kerja, alur solusi terstruktur, atau pemahaman baru yang relevan dengan topik item.
- Expression: (Jika ada subjek manusia) Fokus, mulai paham, tatapan 'aha moment' yang tenang saat menyadari kejelasan metode baru.
- Text Overlay: Insight, kerangka alur, atau sudut pandang baru yang relevan dengan topik item tanpa terpotong (maksimal 6-10 kata).
- Caption For Post: Menjelaskan solusi/metode edukatif secara terstruktur sesuai authority.
- DILARANG KERAS DI MOFU: Hard closing, FOMO berlebihan, adegan kebingungan mentah tanpa solusi.
` : `
- Visual Objective: Membangun kejelasan nilai dan mendukung keputusan melalui offer clarity, demonstrasi solusi, authoritative benefits, atau valid evidence yang tersedia di ProductionContext.
- Action: Menampilkan kejelasan implementasi solusi, penawaran konkret, atau kesiapan langkah selanjutnya yang relevan dengan topik item.
- Expression: (Jika ada subjek manusia) Ekspresi yakin, mantap, dan percaya dengan senyum subtle puas, siap mengambil keputusan lanjutan.
- Text Overlay: Penegasan nilai, kejelasan penawaran, atau ajakan aksi terarah dari topik item tanpa terpotong (maksimal 6-10 kata).
- Caption For Post: Menguatkan trust, benefit nyata yang didukung authority, dan dorongan Call to Action.
- DILARANG KERAS DI BOFU: Adegan problem awareness TOFU tanpa penegasan solusi/penawaran; dilarang mengarang bukti/testimoni/angka yang tidak ada di context.
`}

VALIDASI INTERNAL WAJIB (messageAlignmentCheck):
Lakukan evaluasi mandiri pada 4 dimensi:
1. funnelStage vs Visual Objective
2. Headline vs Action
3. Text Overlay vs funnelStage (TIDAK BOLEH ADA KATA TERPOTONG / "...")
4. Expression vs Funnel Goal
JIKA ADA KONFLIK:
- Set "isAligned": false
- Tuliskan konfliknya di "issue"
- WAJIB PERBAIKI "fixedTextOverlay", "visualObjective", "Action", "Expression", dan "finalPrompt" agar selaras 100% dengan corong ${funnelStage} dan authority context.

STRUKTUR JSON CANONICAL WAJIB:
{
  "recommendedAngleId": "A",
  "recommendationReason": "Alasan singkat pemilihan angle rekomendasi untuk ${funnelStage}.",
  "angles": [
    {
      "id": "A",
      "name": "${funnelStage === 'BOFU' ? 'Offer Clarity & Value Hook' : funnelStage === 'MOFU' ? 'Insight & Framework Hook' : 'Relatable Problem Hook'}",
      "funnelStage": "${funnelStage}",
      "visualObjective": "[Visual objective selaras corong ${funnelStage} dan grounded pada context]",
      "textOverlay": "[Teks hook 6-10 kata utuh tanpa '...']",
      "captionForPost": "[Caption Instagram yang menjelaskan isi post/hook sesuai aturan funnel dan grounded pada context]",
      "captionInstruction": "Paste teks ini di caption/keterangan postingan setelah gambar dibuat.",
      "messageAlignmentCheck": {
        "isAligned": true,
        "issue": "",
        "fixedTextOverlay": "[Teks hook utuh tanpa '...', selaras 100% dengan corong ${funnelStage}]",
        "reason": "[Penjelasan keselarasan corong ${funnelStage}]"
      },
      "strategyBrief": {
        "funnelStage": "${funnelStage}",
        "tujuanKonten": "${funnelRules.goal}",
        "ideUtama": "${activeItem.headline || 'Topik Konten'} (TETAP UTUH TANPA TERPOTONG)",
        "audienceContext": "${funnelRules.audienceState} - ${activeContext.audience_context?.primary_audience || ''}",
        "angle": "[Nama angle visual A]",
        "emosiUtama": "[Emosi spesifik sesuai corong ${funnelStage}]",
        "pesanVisual": "[Pesan yang tersampaikan lewat adegan visual]"
      },
      "finalPrompt": "Buatkan saya image untuk konten Instagram (format 4:5 vertical editorial):\\n\\nFunnel Stage: ${funnelStage}\\nVisual Objective: [Tujuan visual konkret selaras context]\\nSubject: [Subjek visual relevan dengan ContentItem; patuhi CharacterDNA jika ada, jangan karang persona/usia fiktif jika tidak ada]\\nAction: [Aktivitas visual konkret yang merepresentasikan konten authority]\\nExpression: [Hanya jika ada subjek manusia: ekspresi mikro wajah yang selaras corong; gunakan N/A jika subjek benda/objek]\\nEnvironment: [Environment yang secara kontekstual mendukung ContentItem, jangan asumsikan kantor/laptop jika tidak relevan]\\nComposition: [Subjek di kanan tengah, ruang negatif lapang di kiri atas untuk teks headline]\\nLighting: [Cahaya alami lembut, pencahayaan natural berdimensi]\\nCamera: [50mm / 35mm lens photography, eye-level, depth of field halus (subtle bokeh)]\\nVisual Style: [Clean editorial Instagram photography, otentik dokumenter estetis, bukan poster iklan ramai atau foto stok generik]\\nTypography: Headline besar 3-5 baris di kiri atas, editorial typography, high contrast, satu frasa penting boleh diberi subtle highlight, tidak ada teks kecil lain.\\nText Overlay: \\\"[Teks hook utuh tanpa '...', maksimal 6-10 kata]\\\"\\nNegative Prompt: hard selling ads, cluttered poster, too much text, generic stock photo, unreadable text, distorted face, extra fingers, corporate cliche, overdesigned graphic."
    },
    {
      "id": "B",
      "name": "${funnelStage === 'BOFU' ? 'Product / Solution Demonstration Hook' : funnelStage === 'MOFU' ? 'Solution Comparison Hook' : 'Everyday Creator Struggle'}",
      "funnelStage": "${funnelStage}",
      "visualObjective": "[Visual objective selaras corong ${funnelStage} dan grounded pada context]",
      "textOverlay": "[Tulis hook pendek utuh 6-10 kata, tanpa ellipsis]",
      "captionForPost": "[Tulis caption Instagram yang menjawab hook image sesuai funnel dan grounded pada context]",
      "captionInstruction": "Paste teks ini di caption/keterangan postingan setelah gambar dibuat.",
      "messageAlignmentCheck": { "isAligned": true, "issue": "", "fixedTextOverlay": "[Tulis hook pendek utuh 6-10 kata, tanpa ellipsis]", "reason": "[Penjelasan keselarasan corong ${funnelStage}]" },
      "strategyBrief": { "funnelStage": "${funnelStage}", "tujuanKonten": "${funnelRules.goal}", "ideUtama": "${activeItem.headline || 'Topik Konten'}", "audienceContext": "${funnelRules.audienceState} - ${activeContext.audience_context?.primary_audience || ''}", "angle": "[Nama angle visual B]", "emosiUtama": "[Emosi spesifik]", "pesanVisual": "[Pesan visual]" },
      "finalPrompt": "Buatkan saya image untuk konten Instagram (format 4:5 vertical editorial):\\n\\nFunnel Stage: ${funnelStage}\\nVisual Objective: [Tujuan visual konkret]\\nSubject: [Subjek visual terikat context]\\nAction: [Aktivitas visual konkret]\\nExpression: [Ekspresi mikro atau N/A]\\nEnvironment: [Environment relevan]\\nComposition: [Subjek di kanan tengah, ruang negatif lapang di kiri atas]\\nLighting: [Cahaya alami lembut]\\nCamera: [50mm lens photography]\\nVisual Style: [Clean editorial Instagram photography]\\nTypography: Headline besar 3-5 baris di kiri atas, editorial typography, high contrast, satu frasa penting boleh diberi subtle highlight, tidak ada teks kecil lain.\\nText Overlay: \\\"[hook pendek utuh tanpa ellipsis]\\\"\\nNegative Prompt: hard selling ads, cluttered poster, too much text, generic stock photo, unreadable text, distorted face, extra fingers, corporate cliche, overdesigned graphic."
    },
    {
      "id": "C",
      "name": "${funnelStage === 'BOFU' ? 'Direct Value & Decision Hook' : funnelStage === 'MOFU' ? 'Structured Workflow Hook' : 'Curiosity Hook'}",
      "funnelStage": "${funnelStage}",
      "visualObjective": "[Visual objective selaras corong ${funnelStage} dan grounded pada context]",
      "textOverlay": "[Tulis hook pendek utuh 6-10 kata, tanpa ellipsis]",
      "captionForPost": "[Tulis caption Instagram yang menjawab hook image sesuai funnel dan grounded pada context]",
      "captionInstruction": "Paste teks ini di caption/keterangan postingan setelah gambar dibuat.",
      "messageAlignmentCheck": { "isAligned": true, "issue": "", "fixedTextOverlay": "[Tulis hook pendek utuh 6-10 kata, tanpa ellipsis]", "reason": "[Penjelasan keselarasan corong ${funnelStage}]" },
      "strategyBrief": { "funnelStage": "${funnelStage}", "tujuanKonten": "${funnelRules.goal}", "ideUtama": "${activeItem.headline || 'Topik Konten'}", "audienceContext": "${funnelRules.audienceState} - ${activeContext.audience_context?.primary_audience || ''}", "angle": "[Nama angle visual C]", "emosiUtama": "[Emosi spesifik]", "pesanVisual": "[Pesan visual]" },
      "finalPrompt": "Buatkan saya image untuk konten Instagram (format 4:5 vertical editorial):\\n\\nFunnel Stage: ${funnelStage}\\nVisual Objective: [Tujuan visual konkret]\\nSubject: [Subjek visual terikat context]\\nAction: [Aktivitas visual konkret]\\nExpression: [Ekspresi mikro atau N/A]\\nEnvironment: [Environment relevan]\\nComposition: [Subjek di kanan tengah, ruang negatif lapang di kiri atas]\\nLighting: [Cahaya alami lembut]\\nCamera: [50mm lens photography]\\nVisual Style: [Clean editorial Instagram photography]\\nTypography: Headline besar 3-5 baris di kiri atas, editorial typography, high contrast, satu frasa penting boleh diberi subtle highlight, tidak ada teks kecil lain.\\nText Overlay: \\\"[hook pendek utuh tanpa ellipsis]\\\"\\nNegative Prompt: hard selling ads, cluttered poster, too much text, generic stock photo, unreadable text, distorted face, extra fingers, corporate cliche, overdesigned graphic."
    }
  ]
}

URUTAN WAJIB STRUKTUR finalPrompt:
1. Funnel Stage: ${funnelStage}
2. Visual Objective: [Tujuan visual konkret yang grounded pada context]
3. Subject: [Subjek visual relevan dengan ContentItem dan ProductionContext; gunakan CharacterDNA jika ada; jangan karang persona demografis/usia jika tidak ada]
4. Action: [Aktivitas fisik/visual konkret yang merepresentasikan konten authority]
5. Expression: [Hanya jika ada subjek manusia: ekspresi mikro wajah nyata; jika objek/grafis gunakan N/A]
6. Environment: [Latar/lingkungan yang secara kontekstual mendukung ContentItem, jangan asumsikan kantor/laptop jika tidak relevan]
7. Composition: [Subjek di kanan tengah, ruang negatif lapang di kiri atas untuk teks headline]
8. Lighting: [Cahaya alami lembut masuk dari jendela samping, soft warm ambient light]
9. Camera: [50mm / 35mm lens photography, eye-level atau 45-degree angle, depth of field halus (subtle bokeh)]
10. Visual Style: [Clean editorial Instagram photography, otentik dokumenter estetis, bukan poster iklan ramai atau foto stok generik]
11. Typography: Headline besar 3-5 baris di kiri atas, editorial typography, high contrast, satu frasa penting boleh diberi subtle highlight, tidak ada teks kecil lain.
12. Text Overlay: "[Teks hook utuh tanpa '...', maksimal 6-10 kata]"
13. Negative Prompt: hard selling ads, cluttered poster, too much text, generic stock photo, unreadable text, distorted face, extra fingers, corporate cliche, overdesigned graphic.

HINDARI: ${funnelRules.avoid}
Kembalikan HANYA JSON murni tanpa markdown pembungkus tambahan di luar JSON.`;
      } else if (activeTab === 'carousel') {
        promptTitle = `CAROUSEL BLUEPRINT - FUNNEL ${funnelStage}`;
        formatDirection = `Blueprint carousel diproses melalui 2-stage architecture (Stage 1 Content Plan + Stage 2 Visual Enrichment).`;
      } else if (activeTab === 'video') {
        promptTitle = `3 VIDEO PRODUCTION STYLES - FUNNEL ${funnelStage} (JSON ARRAY)`;
        formatDirection = `### VIDEO AUTHORITY CONTRACT — STRICT:
1. SEMUA isi semantik dan klaim video HANYA boleh berasal dari:
   - ProductionContext (Project Facts, Brand, Positioning, Offering)
   - Selected ContentItem (Headline, Body, Solusi, Proof, CTA, Caption)
   - Funnel Rules (Goal, Audience State, Communication Style)
   - CharacterDNA jika tersedia
   - Catatan revisi eksplisit dari user (jika ada)

2. DILARANG KERAS MENCIPTAKAN / MENGARANG:
   - Persona atau demografi fiktif yang tidak ada dalam context
   - Fitur / kapabilitas produk yang tidak ada dalam authority
   - Klaim benefit, kemudahan, atau efisiensi yang tidak ada dalam authority
   - Proof, testimoni, statistik, angka metrik, revenue, atau conversion claim
   - Workflow produk atau antarmuka yang tidak tertera di authority
   Funnel Rules HANYA mengatur cara penyampaian dan sudut pandang, BUKAN menciptakan fakta bisnis baru.

3. VISUAL PRODUCTION MODES:
   Hasilkan exactly 3 opsi gaya video dengan semantic production mode:
   1. "human_led" (Talent/Kreator berbicara di depan kamera / talking head & relatable narrative)
      - DILARANG mengarang identitas persona atau latar belakang hidup di luar CharacterDNA/authority.
   2. "product_demo" (Demonstrasi layar kerja / alur fitur produk / walkthrough visual UI)
      - DILARANG mengarang dashboard fiktif, tombol visual ajaib, atau kapabilitas UI yang tidak ada di authority.
   3. "motion_explainer" (Animasi grafik gerak kinetik, tipografi dinamis & visual diagram terstruktur)
      - DILARANG mengarang grafik pertumbuhan, statistik persentase, atau data hasil yang tidak faktual.
   Ketiga mode boleh berbeda pada komposisi, pacing, kamera, gerak visual, tipografi, visual treatment, dan arahan audio, tetapi ketiganya TIDAK BOLEH menciptakan fakta bisnis yang berbeda.

4. CAPTION AUTHORITY:
Existing ContentItem Caption: ${JSON.stringify((activeItem?.caption || '').trim())}
   - Jika Existing ContentItem Caption tersedia (bukan kosong): jadikan sebagai otoritas utama caption Instagram. Boleh dirapikan/diparafrase tanpa menambah klaim baru.
   - Jika tidak tersedia: captionForPost boleh dirangkum HANYA dari ProductionContext dan script video ini.
   - DILARANG menambah fakta, benefit, proof, hasil, metrik, fitur, atau urgensi baru ke dalam caption.

5. SCRIPT AUTHORITY CONTRACT:
   - hook: Harus grounded pada headline / ide utama ContentItem.
   - masalah: Harus grounded pada body / pain point ContentItem.
   - solusi: Berasal HANYA dari solusi eksplisit pada authority. Jika tidak ada solusi eksplisit, gunakan string kosong: ""
   - proof: TIDAK wajib secara semantik. Jika authority tidak menyediakan proof nyata, WAJIB gunakan string kosong: "" (DILARANG mengarang studi kasus, testimoni, atau metrik).
   - cta: Berasal HANYA dari CTA eksplisit ContentItem atau authority. Jika tidak ada CTA eksplisit, gunakan string kosong: ""
   - DILARANG membuat copy marketing generik untuk mengisi field solusi, proof, atau cta yang kosong.

ATURAN FUNNEL ${funnelStage}:
- Goal: ${funnelRules.goal}
- Audience State: ${funnelRules.audienceState}
- Content Style: ${funnelRules.contentStyle}
- Visual Style: ${funnelRules.visualStyle}
- CTA Style: ${funnelRules.ctaStyle} (sesuai tahap ${funnelStage})
- HINDARI: ${funnelRules.avoid}

WAJIB kembalikan HANYA array JSON murni persis 3 item (tanpa markdown):
[
  {
    "productionMode": "human_led",
    "name": "Human-Led Creator Style",
    "hookStyle": "Relatable Problem Hook",
    "pacingStyle": "Deliberate and engaging",
    "audioDirection": "Clear voiceover with subtle background ambient",
    "voiceoverOutline": "[Garis besar alur voiceover yang grounded]",
    "script": {
      "hook": "",
      "masalah": "",
      "solusi": "",
      "proof": "",
      "cta": ""
    },
    "videoPrompt": "Prompt deskriptif 9:16 vertical video",
    "visualPlan": "[Rencana visual adegan]",
    "negative_constraints": "No distorted anatomy, no inconsistent face, no unreadable text, no visual artifacts.",
    "captionForPost": "[Caption Instagram sesuai aturan Caption Authority di atas]",
    "captionInstruction": "Paste teks ini di caption/keterangan postingan setelah aset dibuat."
  },
  {
    "productionMode": "product_demo",
    "name": "Product Workflow Demo",
    "hookStyle": "Workflow Demonstration Hook",
    "pacingStyle": "Step-by-step and structured",
    "audioDirection": "Focused voiceover with crisp UI sound cues",
    "voiceoverOutline": "[Garis besar alur walkthrough yang grounded]",
    "script": {
      "hook": "",
      "masalah": "",
      "solusi": "",
      "proof": "",
      "cta": ""
    },
    "videoPrompt": "Prompt deskriptif 9:16 vertical video",
    "visualPlan": "[Rencana visual adegan UI/produk]",
    "negative_constraints": "No distorted UI, no unreadable interface text, no fake UI artifacts, no broken screen geometry.",
    "captionForPost": "[Caption Instagram sesuai aturan Caption Authority di atas]",
    "captionInstruction": "Paste teks ini di caption/keterangan postingan setelah aset dibuat."
  },
  {
    "productionMode": "motion_explainer",
    "name": "Motion Explainer & Framework",
    "hookStyle": "Kinetic Framework Hook",
    "pacingStyle": "Dynamic kinetic motion and structured typography",
    "audioDirection": "Rhythmic background beat with precise vocal clarity",
    "voiceoverOutline": "[Garis besar alur konsep gerak yang grounded]",
    "script": {
      "hook": "",
      "masalah": "",
      "solusi": "",
      "proof": "",
      "cta": ""
    },
    "videoPrompt": "Prompt deskriptif 9:16 vertical video",
    "visualPlan": "[Rencana visual tipografi dan motion graphic]",
    "negative_constraints": "No unreadable typography, no cluttered layout, no broken motion hierarchy, no visual artifacts.",
    "captionForPost": "[Caption Instagram sesuai aturan Caption Authority di atas]",
    "captionInstruction": "Paste teks ini di caption/keterangan postingan setelah aset dibuat."
  }
]`;
      } else if (activeTab === 'review') {
        promptTitle = `STRATEGY ALIGNMENT REVIEW - FUNNEL ${funnelStage}`;
        formatDirection = `Berikan skor penyelarasan (0-100), analisis kesesuaian dengan corong ${funnelStage} (${funnelRules.goal}) & brand voice, serta 3 langkah optimasi taktis (Gunakan Markdown rapi).
Pastikan evaluasi memeriksa kepatuhan aturan funnel ${funnelStage}:
- Content Style: ${funnelRules.contentStyle}
- CTA Style: ${funnelRules.ctaStyle}
- Hal yang harus dihindari: ${funnelRules.avoid}`;
      }

      // Append revision notes if user typed any custom notes!
      const revisionDirective = revisionNotes.trim() 
        ? `\n\n### CATATAN REVISI KHUSUS DARI USER (WAJIB DIIKUTI):\n- ${revisionNotes.trim()}`
        : '';

      const formattedContext = formatProductionContextForPrompt(productionContext, { includeCharacter: true });

      // ==========================================
      // SPECIAL 2-STAGE GENERATION FOR CAROUSEL
      // ==========================================
      if (activeTab === 'carousel') {
        setGenerationError(null);
        showToast("[1/2] Gemini AI: Menghasilkan Stage 1 (Content Plan)...");

        const stage1Prompt = buildCarouselStage1Prompt(
          funnelStage,
          funnelPromptBlock,
          formattedContext,
          funnelRules,
          activeItem,
          revisionDirective
        );

        const controller1 = new AbortController();
        const timeoutId1 = setTimeout(() => controller1.abort(), 45000);

        try {
          const resp1 = await fetch('/api/gemini/recommendation', {
            method: 'POST',
            headers: buildGeminiRequestHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
              project_id: requestProjectId,
              content_item_id: requestItemId,
              item_no: requestItemNo,
              generation_type: 'carousel_stage1',
              production_context: productionContext,
              prompt: stage1Prompt,
            }),
            signal: controller1.signal,
          });

          clearTimeout(timeoutId1);

          if (!resp1.ok) {
            let errText = 'API request failed';
            let is429 = resp1.status === 429;
            try {
              const errData = await resp1.json();
              if (errData && errData.error) errText = errData.error;
              if (errData?.isRateLimit) is429 = true;
            } catch (_) {}

            if (is429 || /dibatasi|rate.*limit|quota|429/i.test(errText)) {
              setGenerationError("Permintaan AI sedang dibatasi (Rate Limit / High Demand). Coba lagi beberapa saat.");
              showToast("Permintaan AI sedang dibatasi. Coba lagi beberapa saat.");
            } else {
              setGenerationError(errText || "Gagal memproses Stage 1 Carousel. Silakan coba lagi.");
              showToast(`Gagal Stage 1: ${errText}`);
            }
            return;
          }

          const data1 = await resp1.json();

          // ASYNC GUARD check for Stage 1
          if (
            getActiveProjectId() !== requestProjectId ||
            canonicalProjectId !== requestProjectId ||
            !sourceItem ||
            (requestItemId && sourceItem.content_item_id !== requestItemId) ||
            sourceItem.no !== requestItemNo
          ) {
            console.warn('[Async Guard] Discarding stale Stage 1 Carousel response');
            return;
          }

          const stage1Text = data1.text || '';
          const stage1Parsed = validateCarouselStage1ContentPlan(stage1Text, funnelStage);

          if (!stage1Parsed) {
            setGenerationError("Format respon Stage 1 Content Plan tidak valid atau tidak memenuhi skema. Silakan coba lagi.");
            showToast("Gagal: Format Stage 1 tidak sesuai skema.");
            return;
          }

          // STAGE 2: VISUAL ENRICHMENT (MANDATORY)
          showToast("[2/2] Gemini AI: Menghasilkan Stage 2 (Visual Enrichment)...");

          const stage2Prompt = buildCarouselStage2Prompt(
            funnelStage,
            JSON.stringify(stage1Parsed),
            formattedContext
          );

          const controller2 = new AbortController();
          const timeoutId2 = setTimeout(() => controller2.abort(), 45000);

          const resp2 = await fetch('/api/gemini/recommendation', {
            method: 'POST',
            headers: buildGeminiRequestHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
              project_id: requestProjectId,
              content_item_id: requestItemId,
              item_no: requestItemNo,
              generation_type: 'carousel_stage2',
              production_context: productionContext,
              stage1_content_plan: stage1Parsed,
              prompt: stage2Prompt,
            }),
            signal: controller2.signal,
          });

          clearTimeout(timeoutId2);

          if (!resp2.ok) {
            let errText = 'Stage 2 request failed';
            let is429 = resp2.status === 429;
            try {
              const errData = await resp2.json();
              if (errData && errData.error) errText = errData.error;
              if (errData?.isRateLimit) is429 = true;
            } catch (_) {}

            if (is429 || /dibatasi|rate.*limit|quota|429/i.test(errText)) {
              setGenerationError("Permintaan AI sedang dibatasi (Rate Limit / High Demand). Coba lagi beberapa saat.");
              showToast("Permintaan AI sedang dibatasi. Coba lagi beberapa saat.");
            } else {
              setGenerationError(errText || "Gagal memproses Stage 2 Visual Enrichment. Silakan coba lagi.");
              showToast(`Gagal Stage 2: ${errText}`);
            }
            return;
          }

          const data2 = await resp2.json();

          // ASYNC GUARD check for Stage 2
          if (
            getActiveProjectId() !== requestProjectId ||
            canonicalProjectId !== requestProjectId ||
            !sourceItem ||
            (requestItemId && sourceItem.content_item_id !== requestItemId) ||
            sourceItem.no !== requestItemNo
          ) {
            console.warn('[Async Guard] Discarding stale Stage 2 Carousel response');
            return;
          }

          const stage2Text = data2.text || '';
          const mergedPlanStr = mergeCarouselPlanStages(stage1Parsed, stage2Text, activeItem, activeContext, funnelStage);

          if (!mergedPlanStr) {
            setGenerationError("Format respon Stage 2 atau hasil penggabungan Carousel tidak valid atau tidak memenuhi skema canonical. Silakan coba lagi.");
            showToast("Gagal: Format respon AI tidak sesuai skema.");
            return;
          }

          setGenerationError(null);
          saveCarouselOutput(mergedPlanStr);
          setCarouselOutputSource('generated_output');
          showToast(`Aset CAROUSEL (2-Stage Blueprint) berhasil dioptimalkan oleh Gemini AI!`);
        } catch (err: any) {
          if (err?.name === 'AbortError') {
            setGenerationError("Permintaan Carousel AI melebihi batas waktu (timeout). Silakan coba lagi.");
            showToast("Gagal: Timeout permintaan Carousel AI.");
          } else {
            setGenerationError(err?.message || "Terjadi kesalahan saat menghubungi server AI.");
            showToast("Terjadi kesalahan jaringan.");
          }
        }
        return;
      }

      // ==========================================
      // SINGLE-STAGE GENERATION FOR IMAGE, VIDEO, REVIEW
      // ==========================================
      const systemPrompt = `Buatkan ${promptTitle} (Bahasa Indonesia, profesional).

${ANTI_DRIFT_RULES}

### FUNNEL STRATEGY RULES CONTRACT:
${funnelPromptBlock}

${formattedContext}

### OUTPUT FORMAT:
${formatDirection}${revisionDirective}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);

      try {
        const response = await fetch('/api/gemini/recommendation', {
          method: 'POST',
          headers: buildGeminiRequestHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            project_id: requestProjectId,
            content_item_id: requestItemId,
            item_no: requestItemNo,
            generation_type: activeTab,
            production_context: productionContext,
            prompt: systemPrompt,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          let errText = 'API request failed';
          let is429 = response.status === 429;
          try {
            const errData = await response.json();
            if (errData && errData.error) {
              errText = errData.error;
            }
            if (errData?.isRateLimit) {
              is429 = true;
            }
          } catch (_) {}

          if (is429 || /dibatasi|rate.*limit|quota|429/i.test(errText)) {
            setGenerationError("Permintaan AI sedang dibatasi (Rate Limit / High Demand). Coba lagi beberapa saat.");
            showToast("Permintaan AI sedang dibatasi. Coba lagi beberapa saat.");
          } else {
            setGenerationError(errText || "Gagal memproses permintaan AI. Silakan coba lagi.");
            showToast(`Gagal memproses: ${errText}`);
          }
          return;
        }

        const data = await response.json();

        // ASYNC GUARD: check if user switched project or item during generation
        if (
          getActiveProjectId() !== requestProjectId ||
          canonicalProjectId !== requestProjectId ||
          !sourceItem ||
          (requestItemId && sourceItem.content_item_id !== requestItemId) ||
          sourceItem.no !== requestItemNo
        ) {
          console.warn('[Async Guard] Discarding stale production AI generation response');
          return;
        }

        const generatedText = data.text || '';
        
        if (generatedText) {
          if (activeTab === 'image') {
            const normalized = validateAndNormalizeImageAngles(generatedText, activeItem, activeContext);
            if (normalized) {
              setGenerationError(null);
              saveImageOutput(normalized);
              setImageOutputSource('generated_output');
              showToast(`Aset IMAGE (3 Angle) berhasil dioptimalkan oleh Gemini AI!`);
            } else {
              setGenerationError("Format respon AI tidak valid atau tidak memenuhi skema Image Angle canonical. Silakan coba lagi.");
              showToast("Gagal: Format respon AI tidak sesuai skema.");
              return;
            }
          } else if (activeTab === 'video') {
            const normalized = validateAndNormalizeVideoStyles(generatedText, activeItem, activeContext);
            if (normalized) {
              setGenerationError(null);
              saveVideoOutput(normalized);
              setVideoOutputSource('generated_output');
              showToast(`Aset VIDEO (3 Style) berhasil dioptimalkan oleh Gemini AI!`);
            } else {
              setGenerationError("Format respon AI tidak valid atau tidak memenuhi skema Video Style canonical. Silakan coba lagi.");
              showToast("Gagal: Format respon AI tidak sesuai skema.");
              return;
            }
          } else {
            setGenerationError(null);
            if (activeTab === 'review') saveReviewOutput(generatedText);
            showToast(`Aset ${activeTab.toUpperCase()} berhasil dioptimalkan oleh Gemini AI!`);
          }
        } else {
          setGenerationError("Tidak ada konten yang dikembalikan dari AI.");
          showToast("Gagal: Tidak ada respon dari AI.");
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        throw err;
      }
    } catch (err: any) {
      console.error(err);
      if (err.name === 'AbortError') {
        setGenerationError("Permintaan AI melebihi batas waktu (Timeout 45 detik). Silakan coba lagi.");
        showToast("Permintaan AI melebihi batas waktu (Timeout 45s).");
      } else {
        const errMsg = err.message || '';
        const isRateLimited = /dibatasi/i.test(errMsg) || /rate.*limit/i.test(errMsg) || /quota/i.test(errMsg) || /429/i.test(errMsg) || /503/i.test(errMsg) || /high.*demand/i.test(errMsg) || /unavailable/i.test(errMsg);
        if (isRateLimited) {
          setGenerationError("Permintaan AI sedang dibatasi (Rate Limit / High Demand). Coba lagi beberapa saat.");
          showToast("Permintaan AI sedang dibatasi.");
        } else {
          setGenerationError(`Gagal memproses: ${errMsg || 'Error tidak diketahui'}`);
          showToast(`Gagal memproses: ${errMsg || 'Error tidak diketahui'}`);
        }
      }
    } finally {
      setIsLoadingAI(false);
    }
  };

  // Strictly typed active content item and shared context for studio hooks and panels
  const activeItem: ContentItem = useMemo(() => {
    return sourceItem || {
      no: 1,
      tanggal: new Date().toISOString().split('T')[0],
      jenis: 'TOFU',
      tujuan: 'Awareness',
      hookType: 'Question',
      headline: 'Konten Edukasi',
      body: '',
      caption: '',
      format: 'Single',
      referensi: '',
      visual: '',
      keterangan: '',
      projectId: canonicalProjectId || '',
      project_id: canonicalProjectId || '',
      content_item_id: canonicalProjectId ? `${canonicalProjectId}_temp_1` : 'temp_1',
    };
  }, [sourceItem, canonicalProjectId]);

  const activeContext: SharedContentContext = useMemo(() => {
    return sharedContextSnapshot || {
      project_id: canonicalProjectId || '',
      project_name: '',
      source: { origin: 'manual_context' },
      system_flags: { is_complete_for_planning: false, missing_required_fields: ['brand_context', 'strategy_context'] },
      brand_context: {
        brand_name: '',
        category: '',
        brand_summary: '',
        brand_voice: '',
      },
      audience_context: {
        primary_audience: '',
        pain_points: [],
        desires: [],
        objections: [],
      },
      strategy_context: {
        positioning: '',
        usp: [],
        main_offer: '',
        offer_benefits: [],
        core_message: '',
        copy_direction: [],
        content_pillars: [],
      },
    };
  }, [sharedContextSnapshot, canonicalProjectId]);

  const currentOutputText = useMemo<string>(() => {
    if (!activeItem) return '';
    if (activeTab === 'image') return imageOutput || '';
    if (activeTab === 'carousel') return carouselOutput || '';
    if (activeTab === 'video') return videoOutput || '';
    if (activeTab === 'review') return reviewOutput || (activeContext ? getInitialDraft('review', activeItem, activeContext) : '');
    return '';
  }, [activeTab, imageOutput, carouselOutput, videoOutput, reviewOutput, activeItem, activeContext]);

  const handleUpdateOutputText = (val: string) => {
    if (activeTab === 'image') {
      saveImageOutput(val);
      setImageOutputSource('user_edited_output');
    } else if (activeTab === 'carousel') {
      saveCarouselOutput(val);
      setCarouselOutputSource('user_edited_output');
    } else if (activeTab === 'video') {
      saveVideoOutput(val);
      setVideoOutputSource('user_edited_output');
    } else if (activeTab === 'review') {
      saveReviewOutput(val);
    }
  };

  // Memoized parsed image angles package
  const imageAnglesPackage = useMemo<ImageAnglesPackage | null>(() => {
    if (!activeItem || !activeContext || !imageOutput) return null;
    const canAttachImageCandidate = isAuthoritativeProductionOutputSource(imageOutputSource);
    const normalizedJson = validateAndNormalizeImageAngles(imageOutput, activeItem, activeContext, canAttachImageCandidate);
    if (!normalizedJson) {
      return null;
    }

    return tryParseJSON(normalizedJson) as ImageAnglesPackage;
  }, [imageOutput, imageOutputSource, activeItem, activeContext]);

  // Sync selected angle when recommended angle is parsed
  useEffect(() => {
    if (imageAnglesPackage?.recommendedAngleId) {
      setSelectedAngleId(imageAnglesPackage.recommendedAngleId);
    }
  }, [imageAnglesPackage?.recommendedAngleId]);

  // Dynamic optimization button label based on active tab
  const getOptimizationButtonLabel = (tab: string, loading: boolean) => {
    if (loading) return 'Memproses...';
    switch (tab) {
      case 'review': return 'Cek Rencana';
      case 'image': return 'Buat Prompt Gambar';
      case 'carousel': return 'Buat Carousel';
      case 'video': return 'Buat Video';
      default: return 'Buat Output';
    }
  };

  // Memoized parsed carousel plan
  const carouselPlan = useMemo<CarouselPlan | null>(() => {
    if (!activeItem || !activeContext) return null;
    const attachCandidate = isAuthoritativeProductionOutputSource(carouselOutputSource);
    const textToParse = carouselOutput || getInitialDraft('carousel', activeItem, activeContext);
    const normalized = validateAndNormalizeCarouselPlan(textToParse, activeItem, activeContext, attachCandidate);
    if (normalized) {
      const parsed = tryParseJSON(normalized);
      if (parsed && typeof parsed === 'object') {
        return parsed as CarouselPlan;
      }
    }
    const parsed = tryParseJSON(carouselOutput);
    if (parsed && typeof parsed === 'object') {
      if ('slides' in parsed && Array.isArray((parsed as any).slides)) {
        return parsed as CarouselPlan;
      }
    }
    return null;
  }, [carouselOutput, carouselOutputSource, activeItem, activeContext]);

  // Phase 3D-D: Canonical Carousel Production Candidate & Signature
  const baseCarouselCandidate = carouselPlan?.productionCandidate || null;

  const effectiveCarouselCandidate = useMemo<CarouselProductionCandidate | null>(() => {
    if (!baseCarouselCandidate || !carouselPlan?.slides) return null;
    return buildEffectiveCarouselProductionCandidate(
      baseCarouselCandidate,
      carouselPlan.slides,
      characterDNA
    );
  }, [baseCarouselCandidate, carouselPlan?.slides, characterDNA]);

  const currentCarouselProductionPlanSignature = useMemo<string>(() => {
    if (!effectiveCarouselCandidate) return '';
    return buildCarouselProductionPlanSignature(effectiveCarouselCandidate);
  }, [effectiveCarouselCandidate]);

  const normalizedCarouselOutput = useMemo(() => {
    if (!activeItem || !activeContext) return carouselOutput || '';
    const attachCandidate = isAuthoritativeProductionOutputSource(carouselOutputSource);
    const textToParse = carouselOutput || getInitialDraft('carousel', activeItem, activeContext);
    return validateAndNormalizeCarouselPlan(textToParse, activeItem, activeContext, attachCandidate) || carouselOutput;
  }, [carouselOutput, carouselOutputSource, activeItem, activeContext]);

  const normalizedVideoOutput = useMemo(() => {
    if (!activeItem || !activeContext) return videoOutput || '';
    const attachCandidate = isAuthoritativeProductionOutputSource(videoOutputSource);
    const textToParse = videoOutput || getInitialDraft('video', activeItem, activeContext);
    return validateAndNormalizeVideoStyles(textToParse, activeItem, activeContext, attachCandidate) || videoOutput;
  }, [videoOutput, videoOutputSource, activeItem, activeContext]);

  // Phase 3D-C1C-D: Candidate parsing & scene plan signature derivation for completion state binding
  const canonicalVideoCandidates = useMemo<VideoProductionCandidate[]>(() => {
    if (!normalizedVideoOutput) return [];
    try {
      const parsed = tryParseJSON(normalizedVideoOutput);
      if (!Array.isArray(parsed)) return [];
      const list: VideoProductionCandidate[] = [];
      for (const item of parsed) {
        if (!item || typeof item !== 'object') continue;
        if (item.candidate_type === 'video' && item.production_details) {
          list.push(item as VideoProductionCandidate);
        } else if (item.productionCandidate && item.productionCandidate.candidate_type === 'video') {
          list.push(item.productionCandidate as VideoProductionCandidate);
        }
      }
      return list;
    } catch {
      return [];
    }
  }, [normalizedVideoOutput]);

  const activeVideoCandidate = useMemo<VideoProductionCandidate | null>(() => {
    if (!selectedVideoProductionMode || canonicalVideoCandidates.length === 0) return null;
    return resolveSelectedVideoProductionCandidate({
      candidates: canonicalVideoCandidates,
      selectedMode: selectedVideoProductionMode,
    });
  }, [canonicalVideoCandidates, selectedVideoProductionMode]);

  const currentScenePlanSignature = useMemo<string>(() => {
    return buildVideoScenePlanSignature(activeVideoCandidate);
  }, [activeVideoCandidate]);

  const currentVideoProductionInputSignature = useMemo<string>(() => {
    if (!selectedVideoProductionMode) return '';
    return buildVideoProductionInputSignature({
      production_mode: selectedVideoProductionMode,
      character_dna: selectedVideoProductionMode === 'human_led' ? productionEngineContext?.character_dna : null,
      product_asset_context: selectedVideoProductionMode === 'product_demo' ? productAssetContext : null,
    });
  }, [selectedVideoProductionMode, productionEngineContext?.character_dna, productAssetContext]);

  // Phase 4B-B: Top-level Execution Prompt Authority Translations (Requires Authoritative ProductionEngineContext)

  // 1. Image Translated Prompt Bundles (Single translation authority per candidate)
  const imageTranslationResults = useMemo<Record<string, ReturnType<typeof translateImageProductionPrompt>>>(() => {
    if (!productionEngineContext || !imageAnglesPackage?.angles) return {};
    const map: Record<string, ReturnType<typeof translateImageProductionPrompt>> = {};
    for (const angle of imageAnglesPackage.angles) {
      if (angle.productionCandidate) {
        map[angle.id] = translateImageProductionPrompt({
          candidate: angle.productionCandidate,
          characterDNA: productionEngineContext.character_dna ?? null,
        });
      }
    }
    return map;
  }, [productionEngineContext, imageAnglesPackage?.angles]);

  const imageTranslatedPromptBundles = useMemo<Record<string, ImageTranslatedPromptBundle | null>>(() => {
    const map: Record<string, ImageTranslatedPromptBundle | null> = {};
    for (const [id, res] of Object.entries(imageTranslationResults)) {
      map[id] = res.ok ? (res.bundle as ImageTranslatedPromptBundle) : null;
    }
    return map;
  }, [imageTranslationResults]);

  const imageExecutionAuthorities = useMemo<Record<string, ExecutionPromptAuthority | null>>(() => {
    const map: Record<string, ExecutionPromptAuthority | null> = {};
    for (const [id, bundle] of Object.entries(imageTranslatedPromptBundles)) {
      if (bundle) {
        const result = buildExecutionPromptAuthority(bundle);
        if (result.ok && result.authority.asset_type === 'image') {
          map[id] = result.authority;
        } else {
          map[id] = null;
        }
      } else {
        map[id] = null;
      }
    }
    return map;
  }, [imageTranslatedPromptBundles]);

  const imageExecutionAuthoritiesRef = React.useRef(imageExecutionAuthorities);
  useEffect(() => {
    imageExecutionAuthoritiesRef.current = imageExecutionAuthorities;
  }, [imageExecutionAuthorities]);

  const selectedImageTranslationResult = selectedAngleId ? (imageTranslationResults[selectedAngleId] ?? null) : null;
  const imageTranslatedPromptBundle = selectedImageTranslationResult?.ok ? (selectedImageTranslationResult.bundle as ImageTranslatedPromptBundle) : null;
  const imageTranslationError = selectedImageTranslationResult && !selectedImageTranslationResult.ok ? selectedImageTranslationResult.error : null;

  // 2. Carousel Translated Prompt Bundle (Requires Authoritative ProductionEngineContext)
  const carouselTranslationResult = useMemo(() => {
    if (!productionEngineContext || !baseCarouselCandidate || !carouselPlan?.slides) return null;
    const carouselSlideMetadata = carouselPlan.slides.map((s) => ({
      slide_number: s.slide,
      visual_format: s.visual_format,
    }));
    return translateCarouselProductionPrompts({
      candidate: baseCarouselCandidate,
      slides: carouselSlideMetadata,
      characterDNA: productionEngineContext.character_dna ?? null,
    });
  }, [productionEngineContext, baseCarouselCandidate, carouselPlan?.slides]);

  const carouselTranslatedPromptBundle = carouselTranslationResult?.ok ? (carouselTranslationResult.bundle as CarouselTranslatedPromptBundle) : null;
  const carouselTranslationError = carouselTranslationResult && !carouselTranslationResult.ok ? carouselTranslationResult.error : null;

  const currentCarouselExecutionAuthority = useMemo<ExecutionPromptAuthority | null>(() => {
    if (!carouselTranslatedPromptBundle) return null;
    const result = buildExecutionPromptAuthority(carouselTranslatedPromptBundle);
    if (result.ok && result.authority.asset_type === 'carousel') {
      return result.authority;
    }
    return null;
  }, [carouselTranslatedPromptBundle]);

  // 3. Video Translated Prompt Bundle (Requires Authoritative ProductionEngineContext)
  const videoTranslationResult = useMemo(() => {
    if (!productionEngineContext || !activeVideoCandidate || !selectedVideoProductionMode) return null;
    return translateVideoProductionPrompts({
      candidate: activeVideoCandidate,
      characterDNA:
        selectedVideoProductionMode === 'human_led'
          ? productionEngineContext.character_dna ?? null
          : null,
      productAssetContext:
        selectedVideoProductionMode === 'product_demo'
          ? productAssetContext
          : null,
    });
  }, [productionEngineContext, activeVideoCandidate, selectedVideoProductionMode, productAssetContext]);

  const videoTranslatedPromptBundle = videoTranslationResult?.ok ? (videoTranslationResult.bundle as VideoTranslatedPromptBundle) : null;
  const videoTranslationError = videoTranslationResult && !videoTranslationResult.ok ? videoTranslationResult.error : null;

  const currentVideoExecutionAuthority = useMemo<ExecutionPromptAuthority | null>(() => {
    if (!videoTranslatedPromptBundle) return null;
    const result = buildExecutionPromptAuthority(videoTranslatedPromptBundle);
    if (result.ok && result.authority.asset_type === 'video') {
      return result.authority;
    }
    return null;
  }, [videoTranslatedPromptBundle]);

  // Phase 3D-C1C-D+: Real Scene Completion State (Persistent, Isolated by Project + Item + Mode + Scene Signature + Input Signature + Execution Signature)
  const [videoSceneCompletionState, setVideoSceneCompletionState] =
    useState<VideoSceneCompletionState | null>(null);

  useEffect(() => {
    if (
      !canonicalProjectId ||
      !sourceItem?.content_item_id ||
      !selectedVideoProductionMode ||
      !currentScenePlanSignature ||
      !currentVideoProductionInputSignature ||
      !currentVideoExecutionAuthority
    ) {
      setVideoSceneCompletionState(null);
      return;
    }

    const contentItemId = sourceItem.content_item_id;
    const storageKey = getVideoSceneCompletionStorageKey(
      contentItemId,
      selectedVideoProductionMode
    );
    const stored = loadProjectData(canonicalProjectId, storageKey);
    const expected = {
      project_id: canonicalProjectId,
      content_item_id: contentItemId,
      production_mode: selectedVideoProductionMode,
      scene_plan_signature: currentScenePlanSignature,
      production_input_signature: currentVideoProductionInputSignature,
      execution_prompt_signature: currentVideoExecutionAuthority.execution_signature,
    };

    const validation = validateVideoSceneCompletionState(stored, expected);
    if (validation.isValid && stored) {
      setVideoSceneCompletionState(stored as VideoSceneCompletionState);
    } else {
      const fresh = createEmptyVideoSceneCompletionState(expected);
      setVideoSceneCompletionState(fresh);
      saveProjectData(canonicalProjectId, storageKey, fresh);
    }
  }, [
    canonicalProjectId,
    sourceItem?.content_item_id,
    selectedVideoProductionMode,
    currentScenePlanSignature,
    currentVideoProductionInputSignature,
    currentVideoExecutionAuthority,
  ]);

  const handleToggleSceneCompletion = (sceneNumber: 1 | 2 | 3, isCompleted: boolean) => {
    if (
      !canonicalProjectId ||
      !sourceItem?.content_item_id ||
      !selectedVideoProductionMode ||
      !currentScenePlanSignature ||
      !currentVideoProductionInputSignature ||
      !currentVideoExecutionAuthority
    ) {
      return;
    }
    const contentItemId = sourceItem.content_item_id;
    const expected = {
      project_id: canonicalProjectId,
      content_item_id: contentItemId,
      production_mode: selectedVideoProductionMode,
      scene_plan_signature: currentScenePlanSignature,
      production_input_signature: currentVideoProductionInputSignature,
      execution_prompt_signature: currentVideoExecutionAuthority.execution_signature,
    };

    const currentState =
      videoSceneCompletionState &&
      validateVideoSceneCompletionState(videoSceneCompletionState, expected).isValid
        ? videoSceneCompletionState
        : createEmptyVideoSceneCompletionState(expected);

    const nextState = setVideoSceneClipCreated(currentState, sceneNumber, isCompleted);
    setVideoSceneCompletionState(nextState);
    const storageKey = getVideoSceneCompletionStorageKey(
      contentItemId,
      selectedVideoProductionMode
    );
    saveProjectData(canonicalProjectId, storageKey, nextState);
    if (isCompleted) {
      showToast(`Scene ${sceneNumber} ditandai: Clip Sudah Dibuat ✓`);
    } else {
      showToast(`Tanda clip Scene ${sceneNumber} dibatalkan`);
    }
  };

  // Phase 3D-C: Video Production Gate & Package State
  const [videoProductionPackagePreparing, setVideoProductionPackagePreparing] =
    useState<boolean>(false);
  const [videoProductionPackageError, setVideoProductionPackageError] = useState<string | null>(
    null
  );
  const [videoProductionPackagePrepared, setVideoProductionPackagePrepared] =
    useState<boolean>(false);

  // Reset prepared state when any production identity affecting current video package changes
  useEffect(() => {
    setVideoProductionPackagePrepared(false);
    setVideoProductionPackageError(null);
  }, [
    canonicalProjectId,
    sourceItem?.content_item_id,
    selectedVideoProductionMode,
    activeVideoCandidate?.candidate_id,
    currentScenePlanSignature,
    currentVideoProductionInputSignature,
    currentVideoExecutionAuthority?.execution_signature,
    videoOutputSource,
  ]);

  // Video Production Gate Evaluation
  const videoProductionGate = useMemo(() => {
    return evaluateVideoProductionGate({
      production_context: productionEngineContext,
      source_item: sourceItem,
      output_source: videoOutputSource,
      selected_mode: selectedVideoProductionMode,
      selected_candidate: activeVideoCandidate,
      readiness: videoProductionReadiness,
      completion_state: videoSceneCompletionState,
      current_scene_plan_signature: currentScenePlanSignature,
      current_production_input_signature: currentVideoProductionInputSignature,
      current_execution_authority: currentVideoExecutionAuthority,
    });
  }, [
    productionEngineContext,
    sourceItem,
    videoOutputSource,
    selectedVideoProductionMode,
    activeVideoCandidate,
    videoProductionReadiness,
    videoSceneCompletionState,
    currentScenePlanSignature,
    currentVideoProductionInputSignature,
    currentVideoExecutionAuthority,
  ]);

  // Explicit Video Production Package Preparation Handler
  const handlePrepareVideoProductionPackage = () => {
    // 1. Re-evaluate gate directly to guarantee fail-closed security
    const gateCheck = evaluateVideoProductionGate({
      production_context: productionEngineContext,
      source_item: sourceItem,
      output_source: videoOutputSource,
      selected_mode: selectedVideoProductionMode,
      selected_candidate: activeVideoCandidate,
      readiness: videoProductionReadiness,
      completion_state: videoSceneCompletionState,
      current_scene_plan_signature: currentScenePlanSignature,
      current_production_input_signature: currentVideoProductionInputSignature,
      current_execution_authority: currentVideoExecutionAuthority,
    });

    if (!gateCheck.is_allowed) {
      const blockerMsg = gateCheck.blockers[0] || 'Syarat produksi video belum terpenuhi.';
      setVideoProductionPackageError(blockerMsg);
      showToast(`Gagal: ${blockerMsg}`);
      return;
    }

    // 2. Require canonical inputs
    if (
      !canonicalProjectId ||
      !sourceItem ||
      !sharedContextSnapshot ||
      !funnelStrategySnapshot ||
      !activeVideoCandidate
    ) {
      const missingMsg = 'Data proyek atau candidate video tidak lengkap.';
      setVideoProductionPackageError(missingMsg);
      showToast(`Gagal: ${missingMsg}`);
      return;
    }

    // 3. Verify sourceItem.content_item_id is authoritative
    if (!sourceItem.content_item_id || !sourceItem.content_item_id.trim()) {
      const idMsg = 'Identitas sourceItem.content_item_id tidak valid.';
      setVideoProductionPackageError(idMsg);
      showToast(`Gagal: ${idMsg}`);
      return;
    }

    // 4. Verify authoritative output source
    if (!isAuthoritativeProductionOutputSource(videoOutputSource)) {
      const srcMsg = 'Sumber output video belum otoritatif.';
      setVideoProductionPackageError(srcMsg);
      showToast(`Gagal: ${srcMsg}`);
      return;
    }

    // 5. Generate metadata ONLY AFTER gate passes
    if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
      const cryptoErr =
        'API crypto.randomUUID tidak tersedia untuk pembuatan metadata production package.';
      setVideoProductionPackageError(cryptoErr);
      showToast('Gagal: Crypto API tidak tersedia.');
      return;
    }

    // Require page-level videoTranslatedPromptBundle (Fail-Closed)
    if (!videoTranslatedPromptBundle) {
      const bundleErr =
        videoTranslationError ||
        'Translated prompt bundle video tidak tersedia. Production package diblokir.';
      setVideoProductionPackageError(bundleErr);
      showToast(`Gagal: ${bundleErr}`);
      return;
    }

    const packageMetadata: ProductionPackageMetadata = {
      package_id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };

    setVideoProductionPackagePreparing(true);
    setVideoProductionPackageError(null);

    // 6. Prepare production package using exact activeVideoCandidate.candidate_id and page-level bundle
    const prepResult = prepareProductionPackage({
      projectId: canonicalProjectId,
      sharedContext: sharedContextSnapshot,
      funnelStrategy: funnelStrategySnapshot,
      contentItem: sourceItem,
      characterDNA: productionEngineContext?.character_dna || undefined,
      candidates: canonicalVideoCandidates,
      selectedCandidateId: activeVideoCandidate.candidate_id,
      translatedPromptBundle: videoTranslatedPromptBundle,
      metadata: packageMetadata,
    });

    if (!prepResult.ok) {
      const prepErr =
        prepResult.error ||
        'Gagal menyiapkan production package video.';
      setVideoProductionPackageError(prepErr);
      setVideoProductionPackagePreparing(false);
      showToast(`Gagal prepare package: ${prepErr}`);
      return;
    }

    const productionPackage = prepResult.package;

    // 7. Verify asset_type === 'video'
    if (productionPackage.asset_type !== 'video') {
      const typeErr = `Production package asset_type [${productionPackage.asset_type}] bukan video.`;
      setVideoProductionPackageError(typeErr);
      setVideoProductionPackagePreparing(false);
      showToast(`Gagal: ${typeErr}`);
      return;
    }

    const packageValidation = validateProductionPackage(productionPackage);
    if (!packageValidation.isValid) {
      const validErr = packageValidation.error || 'Validasi production package video gagal.';
      setVideoProductionPackageError(validErr);
      setVideoProductionPackagePreparing(false);
      showToast(`Gagal: ${validErr}`);
      return;
    }

    // 8. Save using existing saveProductionPackage storage
    const saveResult = saveProductionPackage(canonicalProjectId, productionPackage);
    if (!saveResult.ok) {
      const saveErr = saveResult.error || 'Gagal menyimpan production package video.';
      setVideoProductionPackageError(saveErr);
      setVideoProductionPackagePreparing(false);
      showToast(`Gagal save package: ${saveErr}`);
      return;
    }

    setVideoProductionPackagePreparing(false);
    setVideoProductionPackagePrepared(true);
    showToast('Paket produksi video berhasil disiapkan.');
  };

  // Phase 3D-D: Carousel Slide Completion State (Persistent, Isolated by Project + Item + Candidate + Plan Signature)
  const [carouselSlideCompletionState, setCarouselSlideCompletionState] =
    useState<CarouselSlideCompletionState | null>(null);

  useEffect(() => {
    if (
      !canonicalProjectId ||
      !sourceItem?.content_item_id ||
      !effectiveCarouselCandidate ||
      !currentCarouselProductionPlanSignature ||
      !currentCarouselExecutionAuthority
    ) {
      setCarouselSlideCompletionState(null);
      return;
    }

    const contentItemId = sourceItem.content_item_id;
    const candidateId = effectiveCarouselCandidate.candidate_id;
    const slideCount = effectiveCarouselCandidate.production_details.slide_count;
    const storageKey = getCarouselSlideCompletionStorageKey(contentItemId, candidateId);

    const stored = loadProjectData(canonicalProjectId, storageKey);
    const expected: CarouselSlideCompletionExpected = {
      project_id: canonicalProjectId,
      content_item_id: contentItemId,
      candidate_id: candidateId,
      production_plan_signature: currentCarouselProductionPlanSignature,
      execution_prompt_signature: currentCarouselExecutionAuthority.execution_signature,
      slide_count: slideCount,
    };

    const validation = validateCarouselSlideCompletionState(stored, expected);
    if (validation.isValid && stored) {
      setCarouselSlideCompletionState(stored as CarouselSlideCompletionState);
    } else {
      const fresh = createEmptyCarouselSlideCompletionState(
        canonicalProjectId,
        contentItemId,
        candidateId,
        currentCarouselProductionPlanSignature,
        slideCount,
        currentCarouselExecutionAuthority.execution_signature
      );
      setCarouselSlideCompletionState(fresh);
      saveProjectData(canonicalProjectId, storageKey, fresh);
    }
  }, [
    canonicalProjectId,
    sourceItem?.content_item_id,
    effectiveCarouselCandidate,
    currentCarouselProductionPlanSignature,
    currentCarouselExecutionAuthority,
  ]);

  const handleToggleCarouselSlideCompletion = (slideNumber: number, isCompleted: boolean) => {
    if (
      !canonicalProjectId ||
      !sourceItem?.content_item_id ||
      !effectiveCarouselCandidate ||
      !currentCarouselProductionPlanSignature ||
      !currentCarouselExecutionAuthority
    ) {
      return;
    }

    const contentItemId = sourceItem.content_item_id;
    const candidateId = effectiveCarouselCandidate.candidate_id;
    const slideCount = effectiveCarouselCandidate.production_details.slide_count;
    const expected: CarouselSlideCompletionExpected = {
      project_id: canonicalProjectId,
      content_item_id: contentItemId,
      candidate_id: candidateId,
      production_plan_signature: currentCarouselProductionPlanSignature,
      execution_prompt_signature: currentCarouselExecutionAuthority.execution_signature,
      slide_count: slideCount,
    };

    const currentState =
      carouselSlideCompletionState &&
      validateCarouselSlideCompletionState(carouselSlideCompletionState, expected).isValid
        ? carouselSlideCompletionState
        : createEmptyCarouselSlideCompletionState(
            canonicalProjectId,
            contentItemId,
            candidateId,
            currentCarouselProductionPlanSignature,
            slideCount,
            currentCarouselExecutionAuthority.execution_signature
          );

    const nextState = setCarouselSlideAssetCreated(currentState, slideNumber, isCompleted);
    setCarouselSlideCompletionState(nextState);
    const storageKey = getCarouselSlideCompletionStorageKey(contentItemId, candidateId);
    saveProjectData(canonicalProjectId, storageKey, nextState);

    if (isCompleted) {
      showToast(`Slide ${slideNumber} ditandai: Selesai Dibuat ✓`);
    } else {
      showToast(`Tanda selesai Slide ${slideNumber} dibatalkan`);
    }
  };

  // Phase 3D-D: Carousel Production Gate & Package State
  const [carouselProductionPackagePreparing, setCarouselProductionPackagePreparing] =
    useState<boolean>(false);
  const [carouselProductionPackageError, setCarouselProductionPackageError] = useState<string | null>(
    null
  );
  const [carouselProductionPackagePrepared, setCarouselProductionPackagePrepared] =
    useState<boolean>(false);

  // Reset prepared state when any production identity affecting current carousel package changes
  useEffect(() => {
    setCarouselProductionPackagePrepared(false);
    setCarouselProductionPackageError(null);
  }, [
    canonicalProjectId,
    sourceItem?.content_item_id,
    effectiveCarouselCandidate?.candidate_id,
    currentCarouselProductionPlanSignature,
    currentCarouselExecutionAuthority?.execution_signature,
    carouselOutputSource,
  ]);

  // Carousel Production Gate Evaluation
  const carouselProductionGate = useMemo(() => {
    return evaluateCarouselProductionGate({
      production_context: productionEngineContext,
      source_item: sourceItem,
      output_source: carouselOutputSource,
      effective_candidate: effectiveCarouselCandidate,
      completion_state: carouselSlideCompletionState,
      current_production_plan_signature: currentCarouselProductionPlanSignature,
      current_execution_authority: currentCarouselExecutionAuthority,
    });
  }, [
    productionEngineContext,
    sourceItem,
    carouselOutputSource,
    effectiveCarouselCandidate,
    carouselSlideCompletionState,
    currentCarouselProductionPlanSignature,
    currentCarouselExecutionAuthority,
  ]);

  // Explicit Carousel Production Package Preparation Handler
  const handlePrepareCarouselProductionPackage = () => {
    // 1. Re-evaluate gate directly to guarantee fail-closed security
    const gateCheck = evaluateCarouselProductionGate({
      production_context: productionEngineContext,
      source_item: sourceItem,
      output_source: carouselOutputSource,
      effective_candidate: effectiveCarouselCandidate,
      completion_state: carouselSlideCompletionState,
      current_production_plan_signature: currentCarouselProductionPlanSignature,
      current_execution_authority: currentCarouselExecutionAuthority,
    });

    if (!gateCheck.is_allowed) {
      const blockerMsg = gateCheck.blockers[0] || 'Syarat produksi carousel belum terpenuhi.';
      setCarouselProductionPackageError(blockerMsg);
      showToast(`Gagal: ${blockerMsg}`);
      return;
    }

    // 2. Require canonical inputs
    if (
      !canonicalProjectId ||
      !sourceItem ||
      !sharedContextSnapshot ||
      !funnelStrategySnapshot ||
      !effectiveCarouselCandidate ||
      !baseCarouselCandidate ||
      !carouselPlan?.slides
    ) {
      const missingMsg = 'Data proyek atau candidate carousel tidak lengkap.';
      setCarouselProductionPackageError(missingMsg);
      showToast(`Gagal: ${missingMsg}`);
      return;
    }

    // 3. Verify sourceItem.content_item_id is authoritative
    if (!sourceItem.content_item_id || !sourceItem.content_item_id.trim()) {
      const idMsg = 'Identitas sourceItem.content_item_id tidak valid.';
      setCarouselProductionPackageError(idMsg);
      showToast(`Gagal: ${idMsg}`);
      return;
    }

    // 4. Verify authoritative output source
    if (!isAuthoritativeProductionOutputSource(carouselOutputSource)) {
      const srcMsg = 'Sumber output carousel belum otoritatif.';
      setCarouselProductionPackageError(srcMsg);
      showToast(`Gagal: ${srcMsg}`);
      return;
    }

    // 5. Generate metadata ONLY AFTER gate passes
    if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
      const cryptoErr =
        'API crypto.randomUUID tidak tersedia untuk pembuatan metadata production package.';
      setCarouselProductionPackageError(cryptoErr);
      showToast('Gagal: Crypto API tidak tersedia.');
      return;
    }

    // Require page-level carouselTranslatedPromptBundle (Fail-Closed)
    if (!carouselTranslatedPromptBundle) {
      const bundleErr =
        carouselTranslationError ||
        'Translated prompt bundle carousel tidak tersedia. Production package diblokir.';
      setCarouselProductionPackageError(bundleErr);
      showToast(`Gagal: ${bundleErr}`);
      return;
    }

    const packageMetadata: ProductionPackageMetadata = {
      package_id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };

    setCarouselProductionPackagePreparing(true);
    setCarouselProductionPackageError(null);

    // 6. Prepare production package using canonical base candidate and page-level bundle
    const prepResult = prepareProductionPackage({
      projectId: canonicalProjectId,
      sharedContext: sharedContextSnapshot,
      funnelStrategy: funnelStrategySnapshot,
      contentItem: sourceItem,
      characterDNA: productionEngineContext?.character_dna || undefined,
      candidates: [baseCarouselCandidate],
      selectedCandidateId: baseCarouselCandidate.candidate_id,
      translatedPromptBundle: carouselTranslatedPromptBundle,
      metadata: packageMetadata,
    });

    if (!prepResult.ok) {
      const prepErr =
        prepResult.error ||
        'Gagal menyiapkan production package carousel.';
      setCarouselProductionPackageError(prepErr);
      setCarouselProductionPackagePreparing(false);
      showToast(`Gagal prepare package: ${prepErr}`);
      return;
    }

    const productionPackage = prepResult.package;

    // 7. Verify asset_type === 'carousel'
    if (productionPackage.asset_type !== 'carousel') {
      const typeErr = `Production package asset_type [${productionPackage.asset_type}] bukan carousel.`;
      setCarouselProductionPackageError(typeErr);
      setCarouselProductionPackagePreparing(false);
      showToast(`Gagal: ${typeErr}`);
      return;
    }

    const packageValidation = validateProductionPackage(productionPackage);
    if (!packageValidation.isValid) {
      const validErr = packageValidation.error || 'Validasi production package carousel gagal.';
      setCarouselProductionPackageError(validErr);
      setCarouselProductionPackagePreparing(false);
      showToast(`Gagal: ${validErr}`);
      return;
    }

    // 8. Save using existing saveProductionPackage storage
    const saveResult = saveProductionPackage(canonicalProjectId, productionPackage);
    if (!saveResult.ok) {
      const saveErr = saveResult.error || 'Gagal menyimpan production package carousel.';
      setCarouselProductionPackageError(saveErr);
      setCarouselProductionPackagePreparing(false);
      showToast(`Gagal save package: ${saveErr}`);
      return;
    }

    setCarouselProductionPackagePreparing(false);
    setCarouselProductionPackagePrepared(true);
    showToast('Paket produksi carousel berhasil disiapkan.');
  };

  // Render content of active tab dynamically with premium workshop components
  const renderTabContent = () => {
    const funnelRules = getFunnelRules(normalizeFunnelStage(activeItem?.jenis || ""));
    const commonProps = {
      activeItem, activeContext, imageAnglesPackage, selectedAngleId, setSelectedAngleId,
      generatedImages, imageGeneratingKey, handleCopyText, copiedStates, handleGenerateImage,
      nextStepVisibleKeys, setNextStepVisibleKeys, handleDismissNextStep,
      imageOutput, getInitialDraft, funnelRules,
      activeSlideNumber, setActiveSlideNumber, 
      carouselOutput: normalizedCarouselOutput, carouselPlan, videoOutput: normalizedVideoOutput, tryParseJSON, normalizeFunnelStage, getFunnelRules,
      selectedVideoProductionMode, handleSelectVideoProductionMode, showToast,
      recommendedVideoProductionMode, videoIntentDecision, handleUseRecommendation,
      sourceItem,
      handleDownloadImage, imageGenerateError,
      characterDNA, setActiveTab,
      savedCharacters, selectedCharacterId, handleSelectCharacter, handleCreateCharacterClick,
      productAssetContext, setProductAssetContext: saveProductAssetContext, videoProductionReadiness,
      videoSceneCompletionState, handleToggleSceneCompletion,
      videoProductionGate,
      handlePrepareVideoProductionPackage,
      videoProductionPackagePreparing,
      videoProductionPackageError,
      videoProductionPackagePrepared,
      carouselSlideCompletionState,
      handleToggleCarouselSlideCompletion,
      carouselProductionGate,
      handlePrepareCarouselProductionPackage,
      carouselProductionPackagePreparing,
      carouselProductionPackageError,
      carouselProductionPackagePrepared,
      imageTranslatedPromptBundle,
      imageTranslatedPromptBundles,
      imageExecutionAuthorities,
      imageTranslationError,
      carouselTranslatedPromptBundle,
      carouselTranslationError,
      currentCarouselExecutionAuthority,
      videoTranslatedPromptBundle,
      videoTranslationError,
      currentVideoExecutionAuthority,
    };

    if (activeTab === 'image') return <ImagePanel {...commonProps} canonicalProjectId={canonicalProjectId} />;
    if (activeTab === 'carousel') return (
      <CarouselPanel
        {...commonProps}
        carouselOutputSource={carouselOutputSource}
        isCarouselOutputAuthoritative={isAuthoritativeProductionOutputSource(carouselOutputSource)}
      />
    );
    if (activeTab === 'video') return <VideoPanel {...commonProps} />;

    return (
      <div className="whitespace-pre-wrap font-sans text-stone-800 text-xs leading-relaxed">
        {currentOutputText}
      </div>
    );
  };

 // Calculate readiness metrics
  const readinessChecklist = useMemo(() => {
    const checks = [
      { id: 'source', label: 'Source Item Tersedia', status: !!sourceItem },
      { id: 'context', label: 'Strategy Context Tersedia', status: !!sharedContextSnapshot },
      { id: 'headline', label: 'Headline Tersedia', status: !!activeItem?.headline },
      { id: 'objective', label: 'Objective / Tujuan Tersedia', status: !!activeItem?.tujuan },
      { id: 'cta', label: 'Call to Action (CTA) Tersedia', status: !!activeItem?.cta },
      { id: 'visual', label: 'Visual Direction Tersedia', status: !!activeItem?.visual }
    ];
    const passedCount = checks.filter(c => c.status).length;
    const percentage = Math.round((passedCount / checks.length) * 100);
    return { checks, passedCount, total: checks.length, percentage };
  }, [sourceItem, sharedContextSnapshot, activeItem]);

  if (!isLoaded) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans items-center justify-center">
        <div className="relative flex flex-col items-center">
          <div className="w-12 h-12 rounded-full border-2 border-purple-500/20 border-t-purple-500 animate-spin" />
          <BrainCircuit size={20} className="text-purple-400 absolute top-3.5 animate-pulse" />
          <p className="mt-4 text-xs font-bold text-zinc-400 uppercase tracking-widest animate-pulse">Memuat Production Studio...</p>
        </div>
      </main>
    );
  }

  if (isLoaded && !sourceItem) {
    return (
      <ContentEngineShell
        title="ALCO Production Studio"
        subtitle="Pusat produksi dan penyelarasan aset konten"
        eyebrow="Studio Workspace"
        actions={(
          <button
            onClick={() => router.push('/')}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-bold text-primary-foreground shadow-sm transition hover:bg-primary/95"
          >
            <ArrowLeft size={13} />
            Kembali ke Kalender
          </button>
        )}
        mobileActions={(
          <button
            onClick={() => router.push('/')}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground shadow-sm"
          >
            <ArrowLeft size={13} />
            Kalender
          </button>
        )}
        footer={(
          <footer className="shrink-0 border-t border-border bg-card px-6 py-4 text-center text-xs text-muted-foreground">
            ALCO Production Studio - Memproduksi Konten Bernilai Konversi Tinggi
          </footer>
        )}
      >
        <div className="flex items-center justify-between border-b border-border bg-card/80 px-4 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-sm transition hover:bg-muted hover:text-foreground"
              title="Kembali ke Kalender Konten"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                <BrainCircuit size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-black text-foreground">ALCO PRODUCTION STUDIO</h1>
                  <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    Studio Workspace
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Pusat Produksi & Penyelarasan Strategi Aset Konten</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#fffdf8] border border-[#e7e0d4] rounded-2xl p-8 text-center space-y-5 shadow-sm">
            <div className="w-16 h-16 mx-auto rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <AlertCircle size={32} />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-[#1f2933]">Data Konten Project Tidak Ditemukan</h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Item konten untuk project <span className="font-semibold text-stone-800 font-mono">[{canonicalProjectId || 'Belum Dipilih'}]</span> tidak ditemukan atau belum dipilih.
                Silakan kembali ke Kalender Utama dan klik <span className="text-primary font-semibold">Buka Production Studio</span> pada item kalender aktif.
              </p>
            </div>
            <button
              onClick={() => router.push('/')}
              className="w-full py-2.5 bg-primary hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm flex items-center justify-center gap-1.5"
            >
              <ArrowLeft size={13} />
              Kembali ke Kalender Utama
            </button>
          </div>
        </div>
      </ContentEngineShell>
    );
  }

  return (
    <ContentEngineShell
      title="ALCO Production Studio"
      subtitle="Workspace produksi aset dari kalender Content Engine"
      eyebrow={activeContext?.brand_context?.brand_name || 'Studio'}
      actions={(
        <>
          <GeminiApiKeyControl onToast={showToast} variant="compact" />
          <button
            onClick={() => router.push('/')}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-bold text-primary-foreground shadow-sm transition hover:bg-primary/95"
          >
            <ArrowLeft size={13} />
            Kembali ke Kalender
          </button>
        </>
      )}
      mobileActions={(
        <button
          onClick={() => router.push('/')}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground shadow-sm"
        >
          <ArrowLeft size={13} />
          Kalender
        </button>
      )}
    >
      {/* Toast Alert */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 right-4 z-[9999] bg-primary text-white font-bold px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs border border-primary/40"
          >
            <Sparkles size={14} className="animate-pulse" />
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Project Status Info Strip */}
      {canonicalProjectId && (
        <div className="bg-stone-50 border-b border-stone-200 px-4 md:px-8 py-2 flex items-center justify-between gap-3 text-xs text-stone-600">
          <div className="flex items-center gap-2">
            <span className="font-medium">Project ID:</span>
            <span className="font-mono text-stone-800 font-semibold bg-stone-200/70 px-2 py-0.5 rounded">{canonicalProjectId}</span>
            {sharedContextSnapshot?.brand_context?.brand_name && (
              <span className="text-stone-500">({sharedContextSnapshot.brand_context.brand_name})</span>
            )}
          </div>
        </div>
      )}

      {/* Content Production Context Strip */}
      <div className="border-b border-[#e7e0d4] bg-[#fffdf8] px-4 md:px-8 py-3">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase shrink-0 ${
              (activeItem.jenis || '').includes('TOFU') ? 'bg-sky-100 text-sky-800 border border-sky-200' :
              (activeItem.jenis || '').includes('MOFU') ? 'bg-amber-100 text-amber-800 border border-amber-200' :
              'bg-primary/10 text-primary border border-primary/20'
            }`}>
              {activeItem.jenis || 'KONTEN'}
            </span>
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-bold text-stone-400 shrink-0">#{activeItem.no || '1'}</span>
              <span className="font-bold text-stone-900 truncate">{activeItem.headline}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-stone-500 text-[11px] hidden sm:inline">Format Terjadwal:</span>
            <span className="px-2.5 py-1 bg-[#f6f3ee] text-stone-800 font-bold rounded-lg border border-[#e7e0d4] text-[11px]">
              {activeItem.format || 'Semua Format'}
            </span>
            <span className="text-stone-300">|</span>
            {/* Supporting Character Context Quick Trigger */}
            <button
              onClick={() => setShowCharacterModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-[#f6f3ee] hover:bg-stone-200 text-stone-700 font-semibold rounded-lg border border-[#e7e0d4] text-[11px] transition cursor-pointer"
              title="Kelola DNA Karakter & Profil Talent"
            >
              <BrainCircuit size={12} className={selectedCharacterId ? 'text-primary' : 'text-stone-400'} />
              <span>Karakter:</span>
              <span className="font-bold text-stone-900">
                {savedCharacters.find(c => c.character_id === selectedCharacterId)?.identity?.display_name || 'No Character'}
              </span>
            </button>
            <span className="text-stone-300">|</span>
            <span className="text-stone-500 text-[11px] hidden sm:inline">Mode Aktif:</span>
            <span className="px-2.5 py-1 bg-cyan-500/10 text-cyan-800 dark:text-cyan-200 font-bold rounded-lg border border-cyan-500/20 text-[11px] uppercase">
              {activeTab}
            </span>
          </div>
        </div>
      </div>

      {/* Main Studio Workspace Grid */}
      <div className="flex-1 p-4 md:p-6 max-w-[1600px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* LEFT COLUMN: ACTIVE CALENDAR ITEM & BRAND SUMMARY (lg:col-span-4) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Production Progress Checklist (Compact & Expandable) */}
          <ProductionProgressWidget
            item={sourceItem || activeItem}
            onUpdateProgress={handleUpdateProgress}
            variant="expandable"
          />
          
          {/* Quick Context Reference Card - Compact on mobile, detailed on desktop */}
          <div className="bg-[#fffdf8] border border-[#e7e0d4] rounded-2xl p-4.5 space-y-3.5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#e7e0d4]">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border ${
                  (activeItem.jenis || '').includes('TOFU') ? 'bg-sky-100 text-sky-800 border-sky-200' :
                  (activeItem.jenis || '').includes('MOFU') ? 'bg-amber-100 text-amber-800 border-amber-200' :
                  'bg-primary/10 text-primary border-primary/25'
                }`}>
                  #{activeItem.no || '1'}
                </div>
                <div>
                  <h2 className="text-xs font-bold text-[#1f2933]">Rencana Konten</h2>
                  <p className="text-[11px] text-stone-500">{activeItem.tanggal}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                  (activeItem.jenis || '').includes('TOFU') ? 'bg-sky-100 text-sky-800 border border-sky-200' :
                  (activeItem.jenis || '').includes('MOFU') ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                  'bg-primary/10 text-primary border border-primary/20'
                }`}>
                  {activeItem.jenis}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 border border-[#e7e0d4] text-[11px] font-medium hidden sm:inline-block">
                  {activeItem.format}
                </span>
              </div>
            </div>

            {/* Always visible: Headline and primary summary */}
            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-stone-600 flex items-center gap-1">
                <Zap size={13} className="text-primary" /> Headline Konten
              </div>
              <div className="bg-[#f6f3ee] border border-[#e7e0d4] p-3 rounded-xl text-[#1f2933] font-bold text-xs leading-relaxed">
                {activeItem.headline}
              </div>
            </div>

            {/* Desktop Detailed View */}
            <div className="hidden lg:block space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#f6f3ee] p-3 rounded-xl border border-[#e7e0d4]">
                  <div className="text-[11px] font-semibold text-stone-500 mb-0.5">Tujuan (Objective)</div>
                  <p className="text-xs text-stone-800 font-medium leading-snug">{activeItem.tujuan}</p>
                </div>
                <div className="bg-[#f6f3ee] p-3 rounded-xl border border-[#e7e0d4]">
                  <div className="text-[11px] font-semibold text-stone-500 mb-0.5">Format Konten</div>
                  <p className="text-xs text-stone-800 font-medium">{activeItem.format}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#f6f3ee] p-3 rounded-xl border border-[#e7e0d4]">
                  <div className="text-[11px] font-semibold text-stone-500 mb-0.5">Tipe Hook</div>
                  <p className="text-xs text-stone-800 font-medium">{activeItem.hookType}</p>
                </div>
                <div className="bg-[#f6f3ee] p-3 rounded-xl border border-[#e7e0d4]">
                  <div className="text-[11px] font-semibold text-stone-500 mb-0.5">Call to Action (CTA)</div>
                  <p className="text-xs text-primary font-bold">{activeItem.cta}</p>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-stone-600 flex items-center gap-1">
                  <FileText size={13} /> Naskah Kasar / Body
                </div>
                <div className="bg-[#f6f3ee] border border-[#e7e0d4] p-3 rounded-xl text-stone-800 leading-relaxed max-h-24 overflow-y-auto custom-scrollbar whitespace-pre-wrap text-xs">
                  {activeItem.body}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-stone-600 flex items-center gap-1">
                  <MessageSquare size={13} /> Visual Direction
                </div>
                <div className="bg-[#f6f3ee] border border-[#e7e0d4] p-3 rounded-xl text-stone-800 leading-relaxed text-xs">
                  {activeItem.visual}
                </div>
              </div>
            </div>

            {/* Mobile Collapsible Details Accordion */}
            <details className="lg:hidden group border-t border-[#e7e0d4] pt-2 text-xs">
              <summary className="font-bold text-stone-700 cursor-pointer flex items-center justify-between text-xs py-1.5 list-none select-none">
                <span className="flex items-center gap-1.5 text-primary">
                  <Sliders size={13} />
                  <span>Detail Rencana Konten &amp; Strategi</span>
                </span>
                <ChevronDown size={14} className="group-open:rotate-180 transition-transform text-stone-500" />
              </summary>
              <div className="pt-3 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-[#f6f3ee] p-2.5 rounded-xl border border-[#e7e0d4]">
                    <div className="text-[10px] font-semibold text-stone-500 mb-0.5">Tujuan</div>
                    <p className="text-xs text-stone-800 font-medium leading-snug">{activeItem.tujuan}</p>
                  </div>
                  <div className="bg-[#f6f3ee] p-2.5 rounded-xl border border-[#e7e0d4]">
                    <div className="text-[10px] font-semibold text-stone-500 mb-0.5">CTA</div>
                    <p className="text-xs text-primary font-bold">{activeItem.cta}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] font-semibold text-stone-600">Naskah Kasar / Body</div>
                  <div className="bg-[#f6f3ee] border border-[#e7e0d4] p-2.5 rounded-xl text-stone-800 leading-relaxed whitespace-pre-wrap text-xs">
                    {activeItem.body}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] font-semibold text-stone-600">Visual Direction</div>
                  <div className="bg-[#f6f3ee] border border-[#e7e0d4] p-2.5 rounded-xl text-stone-800 leading-relaxed text-xs">
                    {activeItem.visual}
                  </div>
                </div>

                <div className="bg-[#f6f3ee] p-2.5 rounded-xl border border-[#e7e0d4] space-y-1.5">
                  <div className="text-[10px] font-bold text-stone-600">Suara Brand: {activeContext.brand_context?.brand_name}</div>
                  <p className="text-[11px] text-stone-700">{activeContext.brand_context?.brand_voice || '-'}</p>
                </div>
              </div>
            </details>
          </div>

          {/* Quick Brand Metadata Context Card (Collapsible for Progressive Disclosure) */}
          <details className="hidden lg:block group bg-[#fffdf8] border border-[#e7e0d4] rounded-2xl overflow-hidden shadow-xs">
            <summary className="p-4 flex items-center justify-between font-bold text-xs text-stone-800 hover:text-primary cursor-pointer select-none">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                  <Target size={13} />
                </div>
                <h3 className="text-xs font-bold text-[#1f2933]">Informasi Brand &amp; Audiens</h3>
              </div>
              <ChevronDown size={14} className="text-stone-400 group-open:rotate-180 transition-transform" />
            </summary>

            <div className="p-4 pt-0 border-t border-[#e7e0d4]/60 space-y-3.5 text-xs mt-2.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-0.5">
                  <div className="text-[11px] font-semibold text-stone-500">Nama Brand</div>
                  <p className="text-xs text-[#1f2933] font-bold">{activeContext.brand_context?.brand_name || '-'}</p>
                </div>
                <div className="space-y-0.5">
                  <div className="text-[11px] font-semibold text-stone-500">Suara Brand</div>
                  <p className="text-xs text-stone-700 font-medium line-clamp-1">{activeContext.brand_context?.brand_voice || '-'}</p>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-stone-600 flex items-center gap-1">
                  <Users size={12} className="text-primary" /> Audiens Utama
                </div>
                <p className="text-xs text-stone-800 font-medium leading-relaxed bg-[#f6f3ee] p-2.5 rounded-xl border border-[#e7e0d4]">
                  {activeContext.audience_context?.primary_audience}
                </p>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-stone-600">Pain Points Utama</div>
                <div className="flex flex-wrap gap-1.5">
                  {activeContext.audience_context?.pain_points?.map((p, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                      {p}
                    </span>
                  )) || <span className="text-stone-400">-</span>}
                </div>
              </div>
            </div>
          </details>
        </div>

        {/* RIGHT COLUMN: WORKSPACE TAB NAVIGATION & DYNAMIC WORKSHOP CONTENT (lg:col-span-8) */}
        <div className="lg:col-span-8 flex flex-col space-y-4">
          
          {/* URUTAN KERJA (Collapsible Workflow Guide) */}
          <details className="group bg-[#fffdf8] border border-[#e7e0d4] rounded-2xl overflow-hidden shadow-xs">
            <summary className="p-3 flex items-center justify-between font-bold text-xs text-stone-800 hover:text-primary cursor-pointer select-none">
              <div className="flex items-center gap-2">
                <ListTodo size={15} className="text-primary" />
                <h3 className="text-xs font-bold text-[#1f2933]">Panduan Alur Kerja Produksi</h3>
                <span className="text-[10px] text-stone-500 font-normal hidden sm:inline">(5 Langkah Praktis Menuju Aset Siap Pakai)</span>
              </div>
              <ChevronDown size={14} className="text-stone-400 group-open:rotate-180 transition-transform" />
            </summary>
            <div className="p-3 pt-0 border-t border-[#e7e0d4]/60 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs mt-2.5">
              <div className="bg-[#f6f3ee] border border-[#e7e0d4] rounded-xl p-2.5 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/15 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">1</span>
                <span className="text-stone-700 font-medium text-[11px] leading-tight">Pilih format</span>
              </div>
              <div className="bg-[#f6f3ee] border border-[#e7e0d4] rounded-xl p-2.5 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/15 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">2</span>
                <span className="text-stone-700 font-medium text-[11px] leading-tight">Klik Buat</span>
              </div>
              <div className="bg-[#f6f3ee] border border-[#e7e0d4] rounded-xl p-2.5 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/15 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">3</span>
                <span className="text-stone-700 font-medium text-[11px] leading-tight">Salin prompt/output</span>
              </div>
              <div className="bg-[#f6f3ee] border border-[#e7e0d4] rounded-xl p-2.5 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/15 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">4</span>
                <span className="text-stone-700 font-medium text-[11px] leading-tight">Buka tool eksternal</span>
              </div>
              <div className="bg-[#f6f3ee] border border-[#e7e0d4] rounded-xl p-2.5 flex items-center gap-2 col-span-2 sm:col-span-1">
                <span className="w-5 h-5 rounded-full bg-primary/15 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">5</span>
                <span className="text-stone-700 font-medium text-[11px] leading-tight">Paste &amp; eksekusi</span>
              </div>
            </div>
          </details>

          {generationError && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-2xl flex items-start justify-between gap-3 text-xs shadow-xs">
              <div className="flex items-start gap-2.5">
                <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-amber-800">Pemberitahuan Sistem AI</span>
                  <p className="text-xs leading-relaxed text-amber-900 mt-0.5">{generationError}</p>
                </div>
              </div>
              <button 
                onClick={() => setGenerationError(null)}
                className="text-amber-800 hover:text-stone-900 text-xs font-bold px-2.5 py-1 bg-amber-100 hover:bg-amber-200 rounded-lg transition shrink-0 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          )}

          {/* Tab Selection Header with Dynamic Single Optimization Button */}
          <div className="bg-[#fffdf8] border border-[#e7e0d4] p-2 rounded-2xl flex flex-wrap items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
              {[
                { id: 'review', label: 'Cek Rencana', icon: Eye, formatMatch: [] },
                { id: 'image', label: 'Gambar', icon: ImageIcon, formatMatch: ['gambar', 'single', 'image', 'feed', 'poster'] },
                { id: 'carousel', label: 'Carousel', icon: Layers, formatMatch: ['carousel'] },
                { id: 'video', label: 'Video', icon: Video, formatMatch: ['video', 'reels', 'tiktok', 'shorts'] },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                const isMatch = tab.formatMatch.some((m: string) => (activeItem.format || '').toLowerCase().includes(m));
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as any);
                      setIsEditingMode(false);
                    }}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      isActive 
                        ? 'bg-primary text-white shadow-xs' 
                        : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                    }`}
                  >
                    <Icon size={14} />
                    <span>{tab.label}</span>
                    {isMatch && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-tight ${
                        isActive ? 'bg-white/25 text-white' : 'bg-primary/10 text-primary'
                      }`}>
                        Target
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Single Dynamic Optimization Button */}
            <button
              onClick={handleGenerateWithAI}
              disabled={isLoadingAI}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all disabled:opacity-50 min-w-max shadow-xs cursor-pointer"
            >
              <RefreshCw size={13} className={`${isLoadingAI ? 'animate-spin' : ''}`} />
              <span>{getOptimizationButtonLabel(activeTab, isLoadingAI)}</span>
            </button>
          </div>

          {/* DYNAMIC STUDIO WORKSPACE */}
          <div className="flex-1 bg-[#fffdf8] border border-[#e7e0d4] rounded-2xl p-5 md:p-6 flex flex-col justify-between shadow-xs min-h-[550px]">
            
            {/* TAB CONTENT: REVIEW */}
            {activeTab === 'review' ? (
              <ReviewPanel 
                activeItem={activeItem} 
                activeContext={activeContext} 
                funnelRules={getFunnelRules(normalizeFunnelStage(activeItem?.jenis || ""))} 
                readinessChecklist={readinessChecklist} 
                isEditingMode={isEditingMode}
                setIsEditingMode={setIsEditingMode}
                reviewOutput={reviewOutput}
                getInitialDraft={getInitialDraft}
                saveReviewOutput={saveReviewOutput} handleCopyText={handleCopyText} copiedStates={copiedStates}
                setActiveTab={setActiveTab}
              />
            ) : (
              // TAB CONTENT: IMAGE, CAROUSEL, VIDEO WORKSHOPS
              <div className="space-y-4 flex-1 flex flex-col justify-between">
                {/* Workshop Header & Mode Toggle */}
                <div className="flex items-center justify-between pb-3 border-b border-[#e7e0d4]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                    <div>
                      <h3 className="text-xs font-bold text-[#1f2933]">
                        Hasil Produksi: <span className="text-primary font-bold">{activeTab.toUpperCase()}</span>
                      </h3>
                      <p className="text-[11px] text-stone-500">Anda dapat beralih ke Mode Edit untuk menyesuaikan copywriting secara manual</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="bg-[#f6f3ee] p-1 rounded-xl border border-[#e7e0d4] flex items-center gap-1 text-xs">
                      <button
                        onClick={() => setIsEditingMode(false)}
                        className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                          !isEditingMode 
                            ? 'bg-primary text-white' 
                            : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        Pratinjau
                      </button>
                      <button
                        onClick={() => setIsEditingMode(true)}
                        className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                          isEditingMode 
                            ? 'bg-primary text-white' 
                            : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        Edit Naskah
                      </button>
                    </div>

                    {!(activeTab === 'image' && !currentOutputText.trim()) && (
                      <button
                        onClick={() => handleCopyText(activeTab, currentOutputText || '', 'none')}
                        className="p-2 hover:bg-stone-100 text-stone-600 hover:text-stone-900 rounded-xl border border-[#e7e0d4] bg-[#fffdf8] transition-all shadow-xs cursor-pointer"
                        title="Salin Naskah"
                      >
                        {copiedStates[activeTab] ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Primary Content Editor / Preview Stage */}
                <div className="relative rounded-2xl bg-[#fffdf8] border border-[#e7e0d4] flex-1 flex flex-col min-h-[340px] overflow-hidden shadow-xs">
                  
                  {/* Loader overlay during AI execution */}
                  <AnimatePresence mode="wait">
                    {isLoadingAI ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-[#fffdf8]/90 backdrop-blur-sm z-20 flex flex-col items-center justify-center space-y-3.5"
                      >
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                          <Sparkles size={16} className="text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                        </div>
                        <div className="text-center space-y-1 px-4">
                          <p className="text-xs font-bold text-[#1f2933]">Gemini AI Membaca Strategi Anda...</p>
                          <p className="text-xs text-stone-500 max-w-xs leading-relaxed">
                            Menerjemahkan pilar bisnis, headline, dan target pemosisian menjadi aset konten siap pakai berkonversi tinggi...
                          </p>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>

                  {/* Body Content Renderer */}
                  {isEditingMode ? (
                    <textarea
                      value={currentOutputText}
                      onChange={(e) => handleUpdateOutputText(e.target.value)}
                      className="w-full flex-1 p-4 bg-[#f6f3ee] text-stone-900 text-xs font-sans leading-relaxed resize-none focus:outline-none focus:border-primary custom-scrollbar"
                      placeholder="Tuliskan atau sesuaikan draf produksi naskah di sini secara bebas..."
                    />
                  ) : (
                    <div className="flex-1 p-4 overflow-y-auto custom-scrollbar text-stone-800 text-xs leading-relaxed space-y-3 font-sans">
                      {renderTabContent()}
                    </div>
                  )}

                  {/* Bottom Stats inside Editor - Advanced Collapsible */}
                  <details className="text-[11px] text-stone-500 bg-[#f6f3ee] border-t border-[#e7e0d4] px-3 py-1.5 group select-none">
                    <summary className="cursor-pointer font-medium hover:text-stone-700 flex items-center justify-between list-none">
                      <span className="flex items-center gap-1">
                        <Sliders size={11} className="text-stone-400" />
                        <span>Advanced: Info Teknis Editor</span>
                      </span>
                      <ChevronDown size={12} className="group-open:rotate-180 transition-transform text-stone-400" />
                    </summary>
                    <div className="pt-1.5 pb-1 flex items-center justify-between text-[11px] text-stone-600 border-t border-[#e7e0d4]/50 mt-1">
                      <span>Panjang Karakter: {currentOutputText?.length || 0}</span>
                      <span>Mode: {isEditingMode ? 'Edit Langsung' : 'Pratinjau Terstruktur'}</span>
                    </div>
                  </details>
                </div>

                {/* REVISION NOTES INPUT BOX (Clean input without redundant second button) */}
                <div className="bg-[#fffdf8] p-4 rounded-2xl border border-[#e7e0d4] space-y-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-stone-700 flex items-center gap-1.5">
                      <Sparkles size={13} className="text-primary" />
                      Instruksi Khusus / Catatan Revisi
                    </label>
                    <span className="text-[11px] text-stone-400">Opsional</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={revisionNotes}
                      onChange={(e) => saveRevisionNotes(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleGenerateWithAI();
                        }
                      }}
                      placeholder="Contoh: 'Buat gaya naskah lebih kasual', 'Fokuskan pada USP menghemat waktu' (Tekan Enter untuk optimasi)..."
                      className="flex-1 px-3.5 py-2 bg-[#f6f3ee] border border-[#e7e0d4] rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

              </div>
            )}

            {/* Bottom Controls */}
            <div className="mt-5 pt-4 border-t border-[#e7e0d4] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500">
              <div className="flex items-center gap-1.5">
                <AlertCircle size={13} className="text-stone-400 shrink-0" />
                <span>Naskah siap eksekusi. Silakan salin prompt/naskah untuk platform desain atau produksi.</span>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* CHARACTER DNA ASSET MODAL / DRAWER (Context & Reusable Asset Layer) */}
      <AnimatePresence>
        {showCharacterModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-stone-950/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18 }}
              className="bg-[#fffdf8] border border-[#e7e0d4] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden my-auto"
            >
              {/* Modal Header */}
              <div className="p-4 sm:px-6 py-3.5 border-b border-[#e7e0d4] bg-[#f6f3ee] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                    <BrainCircuit size={17} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-stone-900">DNA Karakter &amp; Talent Profil</h2>
                    <p className="text-[11px] text-stone-500">Konteks konsistensi talent &amp; visual persona untuk prompt produksi</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCharacterModal(false)}
                  className="p-1.5 rounded-xl text-stone-500 hover:text-stone-900 hover:bg-stone-200 transition cursor-pointer"
                  title="Tutup Modal DNA Karakter"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body: Complete CharacterDNASection with full functionality */}
              <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1">
                <CharacterDNASection 
                  projectId={canonicalProjectId || ''}
                  activeCharacterId={selectedCharacterId}
                  onSelectCharacter={handleSelectCharacter}
                  onDNAUpdate={(dna) => {
                    setCharacterDNA(dna);
                    if (canonicalProjectId) {
                      const refreshed = getProjectSavedCharacters(canonicalProjectId);
                      setSavedCharacters(refreshed);
                      if (dna?.character_id) {
                        setSelectedCharacterId(dna.character_id);
                        saveProjectActiveCharacterId(canonicalProjectId, dna.character_id);
                      }
                    }
                    showToast('DNA Karakter berhasil disimpan & diperbarui!');
                  }} 
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modern Footer */}
      <footer className="border-t border-[#e7e0d4] bg-[#fffdf8] py-4 px-6 flex justify-between items-center text-xs text-stone-500">
        <div>ALCO Production Studio - Memproduksi Konten Bernilai Konversi Tinggi</div>
        <div className="flex gap-4">
          <span>Funnel Stage: {activeItem.jenis}</span>
          <span>Access Level: Full Enterprise</span>
        </div>
      </footer>
    </ContentEngineShell>
  );
}
