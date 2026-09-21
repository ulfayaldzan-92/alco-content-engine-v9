'use client';
import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Copy,
  Check,
  Video,
  Sliders,
  ExternalLink,
  PlayCircle,
  MessageSquare,
  ChevronDown,
  Image as ImageIcon,
  FileText,
  Layers,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Info,
  Package,
  UserCheck,
  Type,
  Camera,
  Film,
  CheckSquare,
  RotateCcw,
} from 'lucide-react';
import { PromptNextStepLinks } from './PromptNextStepLinks';
import CharacterSelector from './CharacterSelector';
import ProductAssetInputPanel from './ProductAssetInputPanel';
import { countWords } from '@/lib/funnel-rules';
import { getVideoProductionModeLabel } from '@/lib/video-intent-resolver';
import { VideoProductionReadiness } from '@/lib/video-production-readiness';
import { ProductAssetContext } from '@/lib/video-production-input';
import {
  VideoProductionCandidate,
  VideoSceneProductionPlan,
  VideoProductionMode,
} from '@/lib/production-candidate';
import {
  resolveSelectedVideoProductionCandidate,
  getSceneTypeLabel,
  getRequiredAssetLabel,
  buildCanonicalSceneProductionInstructions,
} from '@/lib/video-canonical-scene-resolver';
import { CharacterDNA } from '@/lib/content-contract';
import {
  VideoSceneCompletionState,
  getCompletedVideoSceneCount,
  areAllVideoScenesCreated,
} from '@/lib/video-scene-completion';
import { VideoProductionGateResult } from '@/lib/video-production-gate';

interface VideoPanelProps {
  activeItem?: any;
  activeContext?: any;
  handleCopyText?: (key: string, text: string, feedbackType?: any) => void;
  copiedStates?: Record<string, boolean>;
  nextStepVisibleKeys?: Record<string, boolean>;
  handleDismissNextStep?: (key: string) => void;
  getInitialDraft?: (tab: any, item?: any, context?: any) => string;
  videoOutput?: string;
  tryParseJSON?: (jsonStr: string) => any;
  selectedVideoProductionMode?: VideoProductionMode;
  handleSelectVideoProductionMode?: (mode: VideoProductionMode) => void;
  recommendedVideoProductionMode?: VideoProductionMode | null;
  videoIntentDecision?: any;
  handleUseRecommendation?: () => void;
  characterDNA?: CharacterDNA | null;
  savedCharacters?: any[];
  selectedCharacterId?: string | null;
  handleSelectCharacter?: (id: string | null) => void;
  handleCreateCharacterClick?: () => void;
  productAssetContext?: ProductAssetContext | null;
  setProductAssetContext?: (ctx: ProductAssetContext) => void;
  videoProductionReadiness?: VideoProductionReadiness | null;
  videoSceneCompletionState?: VideoSceneCompletionState | null;
  handleToggleSceneCompletion?: (sceneNumber: 1 | 2 | 3, isCompleted: boolean) => void;
  videoProductionGate?: VideoProductionGateResult | null;
  handlePrepareVideoProductionPackage?: () => void;
  videoProductionPackagePreparing?: boolean;
  videoProductionPackageError?: string | null;
  videoProductionPackagePrepared?: boolean;
}

export default function VideoPanel(props: VideoPanelProps) {
  const {
    activeItem,
    activeContext,
    handleCopyText = () => {},
    copiedStates = {},
    nextStepVisibleKeys = {},
    handleDismissNextStep = () => {},
    getInitialDraft,
    videoOutput,
    tryParseJSON = JSON.parse,
    selectedVideoProductionMode,
    handleSelectVideoProductionMode,
    recommendedVideoProductionMode,
    videoIntentDecision,
    handleUseRecommendation,
    characterDNA,
    savedCharacters,
    selectedCharacterId,
    handleSelectCharacter,
    handleCreateCharacterClick,
    productAssetContext,
    setProductAssetContext,
    videoProductionReadiness,
    videoSceneCompletionState,
    handleToggleSceneCompletion,
    videoProductionGate,
    handlePrepareVideoProductionPackage,
    videoProductionPackagePreparing,
    videoProductionPackageError,
    videoProductionPackagePrepared,
  } = props;

  // Single active scene state for focused progressive workspace
  const [activeSceneNumber, setActiveSceneNumber] = useState<number>(1);

  // Reset active scene to Scene 1 whenever content item or selected mode changes
  useEffect(() => {
    setActiveSceneNumber(1);
  }, [
    activeItem?.content_item_id,
    selectedVideoProductionMode,
  ]);

  const effectiveVideoOutput =
    videoOutput || (getInitialDraft ? getInitialDraft('video', activeItem, activeContext) : '');

  let rawVideoStyles: any[] | null = null;
  try {
    const parsed = tryParseJSON(effectiveVideoOutput);
    if (Array.isArray(parsed) && parsed.length > 0) {
      rawVideoStyles = parsed as any[];
    }
  } catch {
    rawVideoStyles = null;
  }

  if (!rawVideoStyles) {
    return (
      <div className="whitespace-pre-wrap font-sans text-stone-800 text-xs leading-relaxed">
        {effectiveVideoOutput}
      </div>
    );
  }

  // Strictly fail closed if selectedVideoProductionMode is missing or not a valid canonical mode
  const validModes: VideoProductionMode[] = ['human_led', 'product_demo', 'motion_explainer'];
  const isValidSelectedMode = Boolean(
    selectedVideoProductionMode && validModes.includes(selectedVideoProductionMode)
  );

  if (!isValidSelectedMode || !selectedVideoProductionMode) {
    return (
      <div className="p-8 text-center bg-[#fffdf8] border border-amber-200 rounded-2xl text-amber-900 text-sm font-medium font-sans">
        Mode produksi video belum dipilih.
      </div>
    );
  }

  // Strictly consume canonical candidates that already exist (NO reconstruction from legacy scripts)
  const candidatesToResolve: VideoProductionCandidate[] = [];
  for (const style of rawVideoStyles) {
    if (!style || typeof style !== 'object') continue;

    if (style.candidate_type === 'video' && style.production_details) {
      candidatesToResolve.push(style as VideoProductionCandidate);
    } else if (style.productionCandidate && style.productionCandidate.candidate_type === 'video') {
      candidatesToResolve.push(style.productionCandidate as VideoProductionCandidate);
    }
  }

  // Exact resolution of candidate matching selected mode (Strictly NO fallback to candidate[0] or human_led)
  const activeCandidate = resolveSelectedVideoProductionCandidate({
    candidates: candidatesToResolve,
    selectedMode: selectedVideoProductionMode,
  });

  const activeVideo = rawVideoStyles.find(
    (v) => (v.productionMode ?? v.production_mode) === selectedVideoProductionMode
  );
  const activeVideoStyle = activeVideo;

  const activeStyleKey = activeVideo
    ? (activeVideo.productionMode ?? activeVideo.production_mode)
    : selectedVideoProductionMode;
  // activeStyleKey = activeVideo.productionMode semantic mapping
  const isWorkspaceReady = videoProductionReadiness?.is_ready === true;

  return (
    <div className="space-y-4 font-sans">
      {/* 0. INTENT RECOMMENDATION CARD */}
      {videoIntentDecision && (
        <div className="bg-[#fffdf8] border border-[#e7e0d4] p-3.5 sm:p-4 rounded-2xl shadow-xs space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                Rekomendasi Video ALCO
              </span>
              <span className="text-xs font-bold text-stone-900">
                {getVideoProductionModeLabel(videoIntentDecision.recommended_mode)}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                Direkomendasikan
              </span>
            </div>
            {selectedVideoProductionMode !== videoIntentDecision.recommended_mode && (
              <button
                type="button"
                onClick={() => {
                  if (handleUseRecommendation) {
                    handleUseRecommendation();
                  } else if (handleSelectVideoProductionMode) {
                    handleSelectVideoProductionMode(videoIntentDecision.recommended_mode);
                  }
                }}
                className="px-3 py-1 bg-primary hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles size={12} />
                <span>Gunakan Rekomendasi</span>
              </button>
            )}
          </div>
          <p className="text-xs text-stone-600 leading-relaxed">
            {videoIntentDecision.recommendation_reason}
          </p>
        </div>
      )}

      {/* 1. SELECTOR TOOLBAR: STYLE & WORKFLOW */}
      <div className="bg-[#fffdf8] border border-[#e7e0d4] p-3 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xs">
        {/* Video Mode Selector */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider mr-1 hidden sm:inline">
            Mode:
          </span>
          {rawVideoStyles.map((style, idx) => {
            const mode = (style.productionMode ?? style.production_mode) as VideoProductionMode;
            const isSelected = selectedVideoProductionMode === mode;
            const isRecommended =
              (recommendedVideoProductionMode || videoIntentDecision?.recommended_mode) === mode;
            const modeLabel = style.name || getVideoProductionModeLabel(mode);
            return (
              <button
                key={mode || idx}
                onClick={() => handleSelectVideoProductionMode?.(mode)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-[#f6f3ee] text-stone-700 hover:text-stone-900 hover:bg-[#e7e0d4]/60 border border-[#e7e0d4]'
                }`}
              >
                <span>{modeLabel}</span>
                {isRecommended && (
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase tracking-tight ${
                      isSelected
                        ? 'bg-white/25 text-white'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    Rekomendasi
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Mode-specific context badge & Workflow Info */}
        <div className="flex items-center gap-2 flex-wrap">
          {selectedVideoProductionMode === 'human_led' ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f6f3ee] rounded-xl border border-[#e7e0d4] text-xs font-semibold text-stone-700">
              <UserCheck size={13} className="text-primary" />
              <span>
                Karakter:{' '}
                {characterDNA?.identity?.display_name ||
                  characterDNA?.character_id ||
                  'Belum Dipilih'}
              </span>
            </div>
          ) : selectedVideoProductionMode === 'product_demo' ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f6f3ee] rounded-xl border border-[#e7e0d4] text-xs font-semibold text-stone-700">
              <Package size={13} className="text-primary" />
              <span>
                Aset Produk:{' '}
                {productAssetContext?.product_name
                  ? productAssetContext.product_name
                  : 'Belum Diisi'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f6f3ee] rounded-xl border border-[#e7e0d4] text-xs font-semibold text-stone-700">
              <Layers size={13} className="text-primary" />
              <span>Motion Graphics Mandiri</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f6f3ee] rounded-xl border border-[#e7e0d4] text-xs font-bold text-primary">
            <Film size={13} className="text-primary" />
            <span>Canonical 3-Scene Guided Studio</span>
          </div>
        </div>
      </div>

      {/* 2. CANONICAL VIDEO READINESS STATUS CARD (Phase 3D-C1C-B) */}
      {videoProductionReadiness && (
        <div
          className={`border rounded-2xl p-4 transition-all shadow-xs space-y-2.5 ${
            videoProductionReadiness.is_ready
              ? 'bg-emerald-50/40 border-emerald-200'
              : 'bg-amber-50/40 border-amber-200'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                  videoProductionReadiness.is_ready
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                    : 'bg-amber-100 text-amber-700 border border-amber-300'
                }`}
              >
                {videoProductionReadiness.is_ready ? (
                  <ShieldCheck size={16} />
                ) : (
                  <AlertTriangle size={16} />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-stone-900">
                    Status Kesiapan Produksi (
                    {getVideoProductionModeLabel(videoProductionReadiness.mode)})
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                      videoProductionReadiness.is_ready
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}
                  >
                    {videoProductionReadiness.is_ready ? 'Siap Produksi' : 'Menunggu Input Wajib'}
                  </span>
                </div>
                <p className="text-[11px] text-stone-600">
                  {videoProductionReadiness.is_ready
                    ? 'Seluruh input wajib untuk mode video ini telah terpenuhi.'
                    : `Terdapat ${videoProductionReadiness.missing_required_inputs.length} input wajib yang belum lengkap.`}
                </p>
              </div>
            </div>
          </div>

          {/* Missing Required Inputs & Warnings */}
          {!videoProductionReadiness.is_ready && (
            <div className="space-y-1.5 pt-2 border-t border-amber-200/60">
              {videoProductionReadiness.missing_required_inputs.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                  <span className="font-bold text-amber-900">Input wajib belum terisi:</span>
                  {videoProductionReadiness.missing_required_inputs.map((inp: string) => (
                    <span
                      key={inp}
                      className="px-2 py-0.5 rounded bg-amber-100/80 border border-amber-300 text-amber-900 font-semibold uppercase text-[10px]"
                    >
                      {inp.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}
              {videoProductionReadiness.warnings.length > 0 && (
                <div className="space-y-1">
                  {videoProductionReadiness.warnings.map((warn: string, i: number) => (
                    <p key={i} className="text-xs text-amber-800 flex items-start gap-1.5">
                      <span className="text-amber-600 font-bold shrink-0">&bull;</span>
                      <span>{warn}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. MODE-SPECIFIC INPUT UX (Phase 3D-C1C-B) */}
      {selectedVideoProductionMode === 'human_led' && (
        <div className="bg-[#fffdf8] border border-[#e7e0d4] rounded-2xl p-4 sm:p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-[#e7e0d4]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                <UserCheck size={16} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-stone-900">
                  Konfigurasi Talent Karakter (Human-Led)
                </h3>
                <p className="text-[11px] text-stone-500">
                  Mode ini mewajibkan pemilihan Karakter (CharacterDNA) aktif untuk menjaga konsistensi talent visual.
                </p>
              </div>
            </div>
            {characterDNA ? (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                Karakter Aktif: {characterDNA.identity?.display_name || characterDNA.character_id}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
                Karakter Wajib Dipilih
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <CharacterSelector
              savedCharacters={savedCharacters || []}
              selectedCharacterId={selectedCharacterId || null}
              onSelectCharacter={handleSelectCharacter || (() => {})}
              onCreateCharacter={handleCreateCharacterClick}
            />
            {handleCreateCharacterClick && (
              <button
                type="button"
                onClick={handleCreateCharacterClick}
                className="px-3 py-1.5 rounded-xl border border-[#e7e0d4] bg-[#f6f3ee] hover:bg-stone-200 text-stone-800 text-xs font-semibold transition cursor-pointer"
              >
                + Kelola DNA Karakter
              </button>
            )}
          </div>
        </div>
      )}

      {selectedVideoProductionMode === 'product_demo' && (
        <ProductAssetInputPanel
          value={productAssetContext || null}
          videoProductionReadiness={videoProductionReadiness}
          onChange={(newContext) => {
            if (setProductAssetContext) {
              setProductAssetContext(newContext);
            }
          }}
        />
      )}

      {selectedVideoProductionMode === 'motion_explainer' && (
        <div className="bg-[#fffdf8] border border-[#e7e0d4] rounded-2xl p-4 sm:p-5 space-y-2.5 shadow-xs">
          <div className="flex items-center gap-2 pb-2 border-b border-[#e7e0d4]">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
              <Layers size={16} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-stone-900">Alur Produksi Motion Explainer</h3>
              <p className="text-[11px] text-stone-500">
                Animasi grafis, diagram alur konsep, dan visual data points diproduksi tanpa perlu upload aset fisik eksternal.
              </p>
            </div>
          </div>
          <div className="p-3 bg-[#f6f3ee] border border-[#e7e0d4] rounded-xl flex items-start gap-2.5 text-xs text-stone-700">
            <Info size={16} className="text-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-stone-900">
                Mode Motion Explainer siap diproduksi secara langsung!
              </p>
              <p className="leading-relaxed">
                Mode ini mengandalkan narasi konsep, data callouts, dan motion visual cue dari naskah strategi yang telah disusun. Tidak diperlukan file tangkapan layar atau pemilihan karakter talent.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4. CANONICAL SCENE GUIDED UX WORKSPACE (Phase 3D-C1C-C) */}
      {!activeCandidate ? (
        <div className="p-8 text-center bg-[#fcfbf9] border border-[#e7e0d4] rounded-2xl text-muted-foreground text-sm font-medium font-sans">
          Rencana scene canonical untuk mode ini tidak tersedia.
        </div>
      ) : !isWorkspaceReady ? (
        <div className="bg-[#fffdf8] border border-amber-200 rounded-2xl p-6 text-center space-y-2 shadow-xs">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto border border-amber-300">
            <AlertTriangle size={20} />
          </div>
          <h4 className="text-xs font-bold text-stone-900">
            Workspace Produksi {getVideoProductionModeLabel(selectedVideoProductionMode)} Belum Siap
          </h4>
          <p className="text-xs text-stone-600 max-w-lg mx-auto leading-relaxed">
            {selectedVideoProductionMode === 'human_led'
              ? 'Lengkapi CharacterDNA terlebih dahulu sebelum membuka workspace produksi Human-Led.'
              : selectedVideoProductionMode === 'product_demo'
              ? 'Lengkapi Nama Produk dan minimal 1 Tangkapan Layar pada panel aset produk di atas sebelum membuka workspace produksi Product Demo.'
              : 'Lengkapi konfigurasi wajib untuk mode produksi video ini.'}
          </p>
        </div>
      ) : (
        <WorkspaceCanonicalSceneView
          activeCandidate={activeCandidate}
          activeSceneNumber={activeSceneNumber}
          setActiveSceneNumber={setActiveSceneNumber}
          selectedVideoProductionMode={selectedVideoProductionMode}
          activeStyleKey={activeStyleKey}
          characterDNA={characterDNA}
          productAssetContext={productAssetContext}
          handleCopyText={handleCopyText}
          copiedStates={copiedStates}
          nextStepVisibleKeys={nextStepVisibleKeys}
          handleDismissNextStep={handleDismissNextStep}
          videoSceneCompletionState={videoSceneCompletionState}
          handleToggleSceneCompletion={handleToggleSceneCompletion}
          videoProductionGate={videoProductionGate}
          handlePrepareVideoProductionPackage={handlePrepareVideoProductionPackage}
          videoProductionPackagePreparing={videoProductionPackagePreparing}
          videoProductionPackageError={videoProductionPackageError}
          videoProductionPackagePrepared={videoProductionPackagePrepared}
        />
      )}

      {/* 5. CAPTION SECTION (Siap Posting) */}
      {activeVideoStyle && (activeVideoStyle.captionForPost || activeItem?.caption) && (
        <div className="bg-[#fffdf8] border border-[#e7e0d4] p-4.5 rounded-2xl space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-primary" />
              <span className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                Caption Postingan Video (Siap Posting)
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                handleCopyText(
                  `video_caption_${activeStyleKey}`,
                  activeVideoStyle.captionForPost || activeItem?.caption,
                  'captionCopied'
                )
              }
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f6f3ee] hover:bg-[#e7e0d4] text-[#1f2933] text-xs font-bold rounded-xl transition cursor-pointer border border-[#e7e0d4]"
            >
              {copiedStates[`video_caption_${activeStyleKey}`] ? (
                <>
                  <Check size={13} className="text-primary" />
                  <span className="text-primary">Caption Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span>Salin Caption</span>
                </>
              )}
            </button>
          </div>
          <div className="text-[11px] text-stone-500 font-medium">
            {activeVideoStyle.captionInstruction ||
              'Paste teks ini di caption/keterangan postingan setelah aset video selesai dibuat.'}
          </div>
          <div className="p-3.5 bg-[#f6f3ee] border border-[#e7e0d4] rounded-xl text-stone-900 font-sans text-xs leading-relaxed select-all whitespace-pre-wrap">
            {activeVideoStyle.captionForPost || activeItem?.caption}
          </div>
        </div>
      )}

      {/* 6. PROGRESSIVE DISCLOSURE: DETAIL PENDUKUNG & STRATEGI */}
      {activeVideoStyle && (
        <div className="space-y-2.5 pt-1">
          {/* Naskah Alur Cerita Utuh (5-Step Monolog) */}
          <details className="group border border-[#e7e0d4] bg-[#fffdf8] rounded-2xl overflow-hidden shadow-xs transition-all">
            <summary className="p-3.5 flex items-center justify-between font-bold text-xs text-stone-800 hover:text-primary cursor-pointer select-none">
              <div className="flex items-center gap-2">
                <PlayCircle size={14} className="text-primary" />
                <span>
                  Struktur Naskah Cerita Utuh (Hook &rarr; Masalah &rarr; Solusi &rarr; Proof &rarr; CTA)
                </span>
              </div>
              <ChevronDown size={14} className="text-stone-400 group-open:rotate-180 transition-transform" />
            </summary>
            <div className="p-4 pt-2 border-t border-[#e7e0d4]/60 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
              <div className="p-3 bg-[#f6f3ee] border border-[#e7e0d4] rounded-xl space-y-1">
                <span className="px-2 py-0.5 rounded bg-rose-100 border border-rose-200 text-[9px] font-bold text-rose-800 uppercase block w-fit">
                  1. Hook
                </span>
                <p className="text-stone-900 italic text-[11px] leading-relaxed">
                  &ldquo;{activeVideoStyle.script?.hook}&rdquo;
                </p>
              </div>
              <div className="p-3 bg-[#f6f3ee] border border-[#e7e0d4] rounded-xl space-y-1">
                <span className="px-2 py-0.5 rounded bg-amber-100 border border-amber-200 text-[9px] font-bold text-amber-800 uppercase block w-fit">
                  2. Masalah
                </span>
                <p className="text-stone-800 text-[11px] leading-relaxed">
                  &ldquo;{activeVideoStyle.script?.masalah}&rdquo;
                </p>
              </div>
              <div className="p-3 bg-[#f6f3ee] border border-[#e7e0d4] rounded-xl space-y-1">
                <span className="px-2 py-0.5 rounded bg-emerald-100 border border-emerald-200 text-[9px] font-bold text-emerald-800 uppercase block w-fit">
                  3. Solusi
                </span>
                <p className="text-stone-800 text-[11px] leading-relaxed">
                  &ldquo;{activeVideoStyle.script?.solusi}&rdquo;
                </p>
              </div>
              <div className="p-3 bg-[#f6f3ee] border border-[#e7e0d4] rounded-xl space-y-1">
                <span className="px-2 py-0.5 rounded bg-blue-100 border border-blue-200 text-[9px] font-bold text-blue-800 uppercase block w-fit">
                  4. Proof
                </span>
                <p className="text-stone-800 text-[11px] leading-relaxed">
                  &ldquo;{activeVideoStyle.script?.proof}&rdquo;
                </p>
              </div>
              <div className="p-3 bg-[#f6f3ee] border border-[#e7e0d4] rounded-xl space-y-1">
                <span className="px-2 py-0.5 rounded bg-purple-100 border border-purple-200 text-[9px] font-bold text-purple-800 uppercase block w-fit">
                  5. CTA
                </span>
                <p className="text-stone-900 font-bold text-[11px] leading-relaxed">
                  &ldquo;{activeVideoStyle.script?.cta}&rdquo;
                </p>
              </div>
            </div>
          </details>

          {/* Detail Strategi & Teknis Video */}
          <details className="group border border-[#e7e0d4] bg-[#fffdf8] rounded-2xl overflow-hidden shadow-xs transition-all">
            <summary className="p-3.5 flex items-center justify-between font-bold text-xs text-stone-800 hover:text-primary cursor-pointer select-none">
              <div className="flex items-center gap-2">
                <Sliders size={14} className="text-primary" />
                <span>Detail Strategi, Arah Audio &amp; Konfigurasi Produksi</span>
              </div>
              <ChevronDown size={14} className="text-stone-400 group-open:rotate-180 transition-transform" />
            </summary>
            <div className="p-4 pt-2 border-t border-[#e7e0d4]/60 space-y-3.5 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 bg-[#f6f3ee] border border-[#e7e0d4] rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-stone-500 uppercase block">
                    Hook &amp; Pacing
                  </span>
                  <p className="text-stone-800 font-semibold">{activeVideoStyle.hookStyle || '-'}</p>
                  <p className="text-stone-500 text-[11px]">
                    Pacing: {activeVideoStyle.pacingStyle || '-'}
                  </p>
                </div>
                <div className="p-3 bg-[#f6f3ee] border border-[#e7e0d4] rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-stone-500 uppercase block">
                    Arah Audio &amp; Voiceover
                  </span>
                  <p className="text-stone-800 leading-snug">
                    {activeVideoStyle.audioDirection || '-'}
                  </p>
                </div>
                <div className="p-3 bg-[#f6f3ee] border border-[#e7e0d4] rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-stone-500 uppercase block">
                    Visual Direction Utama
                  </span>
                  <p className="text-stone-800 leading-snug line-clamp-3">
                    {activeVideoStyle.visualPlan || activeItem?.visual || '-'}
                  </p>
                </div>
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

/**
 * Dedicated Canonical Scene View component for rendering the active scene card,
 * instructions, copy actions, and scene navigation.
 */
function WorkspaceCanonicalSceneView({
  activeCandidate,
  activeSceneNumber,
  setActiveSceneNumber,
  selectedVideoProductionMode,
  activeStyleKey,
  characterDNA,
  productAssetContext,
  handleCopyText,
  copiedStates,
  nextStepVisibleKeys,
  handleDismissNextStep,
  videoSceneCompletionState,
  handleToggleSceneCompletion,
  videoProductionGate,
  handlePrepareVideoProductionPackage,
  videoProductionPackagePreparing,
  videoProductionPackageError,
  videoProductionPackagePrepared,
}: {
  activeCandidate: VideoProductionCandidate;
  activeSceneNumber: number;
  setActiveSceneNumber: (n: number) => void;
  selectedVideoProductionMode: VideoProductionMode;
  activeStyleKey: string;
  characterDNA?: CharacterDNA | null;
  productAssetContext?: ProductAssetContext | null;
  handleCopyText: (key: string, text: string, feedbackType?: string) => void;
  copiedStates: Record<string, boolean>;
  nextStepVisibleKeys: Record<string, boolean>;
  handleDismissNextStep: (key: string) => void;
  videoSceneCompletionState?: VideoSceneCompletionState | null;
  handleToggleSceneCompletion?: (sceneNumber: 1 | 2 | 3, isCompleted: boolean) => void;
  videoProductionGate?: VideoProductionGateResult | null;
  handlePrepareVideoProductionPackage?: () => void;
  videoProductionPackagePreparing?: boolean;
  videoProductionPackageError?: string | null;
  videoProductionPackagePrepared?: boolean;
}) {
  const canonicalScenes = activeCandidate.production_details.scenes;
  const activeScene: VideoSceneProductionPlan =
    canonicalScenes.find((s: VideoSceneProductionPlan) => s.scene_number === activeSceneNumber) || canonicalScenes[0];

  const instructionResult = buildCanonicalSceneProductionInstructions({
    scene: activeScene,
    productionMode: selectedVideoProductionMode,
    characterDNA,
    productAssetContext,
  });

  const completedScenesCount = getCompletedVideoSceneCount(videoSceneCompletionState);
  const allScenesCreated = areAllVideoScenesCreated(videoSceneCompletionState);
  const currentSceneEntry = videoSceneCompletionState?.scenes?.find(
    (s) => s.scene_number === activeScene.scene_number
  );
  const isCurrentSceneCompleted = Boolean(currentSceneEntry?.clip_created);

  if (!instructionResult.isValid || !instructionResult.instructions) {
    return (
      <div className="bg-[#fffdf8] border border-amber-200 rounded-2xl p-6 text-center space-y-2 shadow-xs">
        <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto border border-amber-300">
          <AlertTriangle size={20} />
        </div>
        <h4 className="text-xs font-bold text-stone-900">
          Instruksi produksi scene tidak tersedia.
        </h4>
        {instructionResult.error && (
          <p className="text-xs text-stone-600 max-w-lg mx-auto leading-relaxed">
            {instructionResult.error}
          </p>
        )}
      </div>
    );
  }

  const instructions = instructionResult.instructions;

  const imgCopyKey = `canonical_img_${activeScene.scene_number}_${activeStyleKey}`;
  const promptCopyKey = `canonical_prompt_${activeScene.scene_number}_${activeStyleKey}`;
  const dialogueCopyKey = `canonical_dialogue_${activeScene.scene_number}_${activeStyleKey}`;
  const overlayCopyKey = `canonical_overlay_${activeScene.scene_number}_${activeStyleKey}`;

  const isImgCopied = Boolean(copiedStates[imgCopyKey]);
  const isPromptCopied = Boolean(copiedStates[promptCopyKey]);
  const isDialogueCopied = Boolean(copiedStates[dialogueCopyKey]);
  const isOverlayCopied = Boolean(copiedStates[overlayCopyKey]);

  return (
    <div className="space-y-4">
      {/* Scene Navigation Bar: Exactly 3 Scenes & Progress Summary */}
      <div className="bg-[#f6f3ee] border border-[#e7e0d4] p-2.5 rounded-2xl flex flex-wrap items-center justify-between gap-2.5 shadow-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          {canonicalScenes.map((scene: VideoSceneProductionPlan) => {
            const isActive = activeScene.scene_number === scene.scene_number;
            const sceneCompletion = videoSceneCompletionState?.scenes?.find(
              (s) => s.scene_number === scene.scene_number
            );
            const isSceneCompleted = Boolean(sceneCompletion?.clip_created);
            return (
              <button
                key={scene.scene_number}
                type="button"
                onClick={() => setActiveSceneNumber(scene.scene_number)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  isActive
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-[#fffdf8] text-stone-700 hover:bg-white border border-[#e7e0d4]'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${
                    isActive ? 'bg-white/25 text-white' : 'bg-primary/15 text-primary'
                  }`}
                >
                  {scene.scene_number}
                </span>
                <span>Scene {scene.scene_number}</span>
                {isSceneCompleted && (
                  <Check
                    size={13}
                    className={isActive ? 'text-emerald-200' : 'text-emerald-600'}
                  />
                )}
                <span
                  className={`text-[10px] opacity-75 font-mono ${
                    isActive ? 'text-white' : 'text-stone-500'
                  }`}
                >
                  ({scene.duration_seconds}s)
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Progress Summary: 0/3 - 3/3 */}
          <div
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border shadow-2xs ${
              allScenesCreated
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : completedScenesCount > 0
                ? 'bg-amber-50 border-amber-300 text-amber-800'
                : 'bg-stone-100 border-stone-200 text-stone-700'
            }`}
          >
            {allScenesCreated ? (
              <CheckSquare size={13} className="text-emerald-700" />
            ) : (
              <Video size={13} className="text-stone-600" />
            )}
            <span>{completedScenesCount}/3 Clip Dibuat</span>
          </div>

          <a
            href="https://labs.google/fx/tools/flow"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 bg-[#fffdf8] hover:bg-stone-50 border border-[#e7e0d4] text-primary rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
          >
            <ExternalLink size={13} />
            <span>Buka Google Flow</span>
          </a>
        </div>
      </div>

      {allScenesCreated && (
        <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-900 font-medium">
          <CheckSquare size={14} className="text-emerald-700 shrink-0" />
          <span>Semua clip scene telah ditandai dibuat (3/3 clip tersedia).</span>
        </div>
      )}

      {/* ACTIVE SCENE WORKSPACE CARD */}
      <div className="bg-[#fffdf8] border border-[#e7e0d4] rounded-2xl p-5 space-y-4 shadow-xs">
        {/* Scene Header & Metadata */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#e7e0d4]">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
              Scene {activeScene.scene_number} &bull; {activeScene.duration_seconds} detik
            </span>
            <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-stone-100 text-stone-800 border border-stone-200">
              {getSceneTypeLabel(activeScene.scene_type)}
            </span>
            <h4 className="text-sm font-bold text-[#1f2933]">{activeScene.purpose || '—'}</h4>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {activeScene.required_assets.map((asset: string) => (
              <span
                key={asset}
                className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/20"
              >
                {getRequiredAssetLabel(asset)}
              </span>
            ))}
          </div>
        </div>

        {/* CANONICAL SCENE STRATEGIC GUIDANCE BOX */}
        <div className="bg-[#f6f3ee] border border-[#e7e0d4] rounded-xl p-4 space-y-2.5 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-stone-500 uppercase flex items-center gap-1">
                <Sparkles size={11} className="text-primary" />
                Tujuan Scene (Purpose):
              </span>
              <p className="text-stone-900 font-semibold">{activeScene.purpose || '—'}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-stone-500 uppercase flex items-center gap-1">
                <Camera size={11} className="text-primary" />
                Kamera &amp; Framing:
              </span>
              <p className="text-stone-800">{activeScene.camera || '—'}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-stone-500 uppercase flex items-center gap-1">
                <Film size={11} className="text-primary" />
                Arah Visual (Visual Direction):
              </span>
              <p className="text-stone-800 leading-relaxed">{activeScene.visual_direction || '—'}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-stone-500 uppercase flex items-center gap-1">
                <Sliders size={11} className="text-primary" />
                Aksi &amp; Gerakan (Action):
              </span>
              <p className="text-stone-800 leading-relaxed">{activeScene.action || '—'}</p>
            </div>
          </div>

          {/* Mode-specific context integration */}
          {selectedVideoProductionMode === 'product_demo' &&
            productAssetContext?.screenshots &&
            productAssetContext.screenshots.length > 0 && (
              <div className="pt-2 border-t border-[#e7e0d4]/80 flex items-center gap-2 flex-wrap text-[11px]">
                <span className="font-bold text-stone-700 flex items-center gap-1">
                  <Package size={12} className="text-primary" />
                  Tangkapan Layar Produk Tersedia:
                </span>
                {productAssetContext.screenshots.map((s, idx) => (
                  <span
                    key={s.id || idx}
                    className="px-2 py-0.5 rounded bg-white border border-[#e7e0d4] text-stone-700 font-medium"
                  >
                    #{idx + 1} {s.name}
                  </span>
                ))}
              </div>
            )}

          {selectedVideoProductionMode === 'human_led' && characterDNA && (
            <div className="pt-2 border-t border-[#e7e0d4]/80 flex items-center gap-2 flex-wrap text-[11px]">
              <span className="font-bold text-stone-700 flex items-center gap-1">
                <UserCheck size={12} className="text-primary" />
                Talent Karakter Aktif:
              </span>
              <span className="px-2 py-0.5 rounded bg-white border border-[#e7e0d4] text-stone-800 font-semibold">
                {characterDNA.identity?.display_name || characterDNA.character_id}
              </span>
            </div>
          )}
        </div>

        {/* DIALOGUE & VOICEOVER BLOCK */}
        <div className="bg-[#f6f3ee] border border-[#e7e0d4] rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2 text-[11px]">
            <span className="font-semibold text-stone-600 flex items-center gap-1.5">
              <MessageSquare size={13} className="text-primary" />
              Naskah Dialog Audio / Voiceover (Bahasa Indonesia):
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-2 py-0.5 rounded bg-stone-200 text-stone-700 font-mono font-medium">
                {countWords(activeScene.voiceover)} kata &bull; ~{activeScene.duration_seconds} detik
              </span>
              {activeScene.voiceover && (
                <button
                  type="button"
                  onClick={() => handleCopyText(dialogueCopyKey, activeScene.voiceover, 'none')}
                  className="text-[11px] font-bold text-primary hover:underline cursor-pointer flex items-center gap-1"
                >
                  {isDialogueCopied ? <Check size={12} /> : <Copy size={12} />}
                  <span>{isDialogueCopied ? 'Tersalin' : 'Salin Dialog'}</span>
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-stone-900 font-medium leading-relaxed italic bg-[#fffdf8] p-2.5 rounded-lg border border-[#e7e0d4]">
            {activeScene.voiceover ? `“${activeScene.voiceover}”` : '—'}
          </p>
        </div>

        {/* ON-SCREEN TEXT BLOCK */}
        {activeScene.on_screen_text && (
          <div className="bg-[#f6f3ee] border border-[#e7e0d4] rounded-xl p-3.5 space-y-1.5">
            <div className="flex items-center justify-between flex-wrap gap-2 text-[11px]">
              <span className="font-semibold text-stone-600 flex items-center gap-1.5">
                <Type size={13} className="text-primary" />
                Teks Layar (On-Screen Text):
              </span>
              <button
                type="button"
                onClick={() =>
                  handleCopyText(overlayCopyKey, activeScene.on_screen_text, 'none')
                }
                className="text-[11px] font-bold text-primary hover:underline cursor-pointer flex items-center gap-1"
              >
                {isOverlayCopied ? <Check size={12} /> : <Copy size={12} />}
                <span>{isOverlayCopied ? 'Tersalin' : 'Salin Teks'}</span>
              </button>
            </div>
            <p className="text-xs text-stone-900 font-semibold bg-[#fffdf8] p-2.5 rounded-lg border border-[#e7e0d4]">
              {activeScene.on_screen_text}
            </p>
          </div>
        )}

        {/* STEP-BY-STEP PRODUCTION ACTIONS (Primary Actions) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
          {/* STEP 1: Start Frame Image Prompt */}
          <div className="p-4 bg-[#f6f3ee]/60 border border-[#e7e0d4] rounded-xl flex flex-col justify-between space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-sky-900 uppercase tracking-wider flex items-center gap-1.5">
                  <ImageIcon size={13} className="text-sky-600" />
                  Langkah 1: Start Frame Image Prompt
                </span>
                <span className="text-[10px] text-stone-500 font-mono">Format 9:16</span>
              </div>
              <div className="p-3 bg-[#fffdf8] border border-[#e7e0d4] rounded-xl min-h-[85px] max-h-[140px] overflow-y-auto custom-scrollbar">
                <p className="text-stone-800 font-mono text-[11px] leading-relaxed select-all">
                  {instructions.imagePrompt}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                handleCopyText(imgCopyKey, instructions.imagePrompt, 'promptCopied')
              }
              className={`w-full py-2.5 px-3.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer border ${
                isImgCopied
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-[#fffdf8] hover:bg-sky-50 border-sky-200 text-sky-800 hover:border-sky-300'
              }`}
            >
              {isImgCopied ? (
                <>
                  <Check size={14} className="text-emerald-600" />
                  <span>Prompt Visual Scene {activeScene.scene_number} Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>1. Salin Prompt Visual Scene {activeScene.scene_number}</span>
                </>
              )}
            </button>
          </div>

          {/* STEP 2: Video Motion Prompt */}
          <div className="p-4 bg-[#f6f3ee]/60 border border-[#e7e0d4] rounded-xl flex flex-col justify-between space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={13} className="text-primary" />
                  Langkah 2: Video Motion Prompt (FX Studio / Veo)
                </span>
                <span className="text-[10px] text-stone-500 font-mono">Camera &amp; Motion</span>
              </div>
              <div className="p-3 bg-[#fffdf8] border border-[#e7e0d4] rounded-xl min-h-[85px] max-h-[140px] overflow-y-auto custom-scrollbar">
                <p className="text-stone-800 font-mono text-[11px] leading-relaxed select-all">
                  {instructions.motionPrompt}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                handleCopyText(promptCopyKey, instructions.motionPrompt, 'promptCopied')
              }
              className={`w-full py-2.5 px-3.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer border ${
                isPromptCopied
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-primary hover:bg-blue-700 border-primary text-white'
              }`}
            >
              {isPromptCopied ? (
                <>
                  <Check size={14} className="text-emerald-600" />
                  <span>Prompt Video Scene {activeScene.scene_number} Tersalin!</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>2. Salin Prompt Video Scene {activeScene.scene_number}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Next step links when prompt is copied */}
        <PromptNextStepLinks
          show={Boolean(nextStepVisibleKeys?.[imgCopyKey] || nextStepVisibleKeys?.[promptCopyKey])}
          onDismiss={() => {
            handleDismissNextStep?.(imgCopyKey);
            handleDismissNextStep?.(promptCopyKey);
          }}
          title="Langkah berikutnya: Google Flow"
          description="Prompt video sudah tersalin. Buka Google Flow FX Studio, lalu tempel prompt untuk render scene."
          links={[
            {
              label: 'Buka Google Flow',
              url: 'https://labs.google/fx/tools/flow',
              primary: true,
            },
          ]}
          className="mt-1"
        />

        {/* PHASE 3D-C1C-D: MANUAL SCENE CLIP COMPLETION ACTION */}
        <div className="pt-2">
          {!isCurrentSceneCompleted ? (
            <div className="p-4 bg-[#f6f3ee] border border-[#e7e0d4] rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                  <Video size={14} className="text-primary" />
                  <span>Konfirmasi Produksi Clip Scene {activeScene.scene_number}</span>
                </div>
                <p className="text-[11px] text-stone-600 leading-relaxed max-w-xl">
                  Gunakan tombol ini setelah clip scene benar-benar selesai dibuat di Google Flow atau tool eksternal.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleToggleSceneCompletion?.(activeScene.scene_number as 1 | 2 | 3, true)
                }
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-2 cursor-pointer shrink-0"
              >
                <Check size={14} />
                <span>Tandai Clip Sudah Dibuat</span>
              </button>
            </div>
          ) : (
            <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <CheckSquare size={14} className="text-emerald-700" />
                  <span>Clip Sudah Dibuat ✓</span>
                </div>
                <p className="text-[11px] text-emerald-700 leading-relaxed max-w-xl">
                  Clip Scene {activeScene.scene_number} telah dikonfirmasi selesai dibuat di tool eksternal
                  {currentSceneEntry?.marked_at ? ` (${new Date(currentSceneEntry.marked_at).toLocaleTimeString()})` : ''}.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleToggleSceneCompletion?.(activeScene.scene_number as 1 | 2 | 3, false)
                }
                className="px-3.5 py-2 bg-white hover:bg-stone-50 border border-emerald-300 text-stone-700 font-semibold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <RotateCcw size={12} className="text-stone-500" />
                <span>Batalkan Tanda</span>
              </button>
            </div>
          )}
        </div>

        {/* SCENE NAVIGATION ACTION */}
        {activeScene.scene_number < canonicalScenes.length ? (
          <div className="pt-3 border-t border-[#e7e0d4] flex items-center justify-between flex-wrap gap-2">
            <div className="text-xs text-stone-500">
              Gunakan panduan dan prompt di atas untuk mengeksekusi Scene {activeScene.scene_number}.
            </div>
            <button
              type="button"
              onClick={() => setActiveSceneNumber(activeScene.scene_number + 1)}
              className="px-4 py-2 bg-primary hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer ml-auto"
            >
              <span>Lanjut ke Scene {activeScene.scene_number + 1}</span>
              <ArrowRight size={13} />
            </button>
          </div>
        ) : (
          <div className="pt-3 border-t border-[#e7e0d4]">
            <div className="flex items-center justify-between flex-wrap gap-3 bg-[#f6f3ee] p-3.5 rounded-xl border border-[#e7e0d4]">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                  3
                </div>
                <div>
                  <div className="text-xs font-bold text-stone-900">
                    Scene 3 Aktif (Penutup Video)
                  </div>
                  <div className="text-[11px] text-stone-600">
                    Setelah ketiga klip scene diproduksi, gabungkan rangkaian video di video editor pilihan Anda.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveSceneNumber(1)}
                  className="px-3 py-1.5 bg-white hover:bg-stone-50 text-stone-700 font-semibold text-xs rounded-lg border border-stone-200 transition cursor-pointer"
                >
                  Kembali ke Scene 1
                </button>
                <a
                  href="https://labs.google/fx/tools/flow"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-1.5 bg-primary hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  <ExternalLink size={12} />
                  <span>Buka Google Flow</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* VIDEO PRODUCTION GATE AREA (Phase 3D-C) */}
      <div
        className={`p-4.5 rounded-2xl border transition-all ${
          videoProductionGate?.is_allowed
            ? 'bg-emerald-50/60 border-emerald-200 shadow-xs'
            : 'bg-[#f6f3ee] border-[#e7e0d4]'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Package
                size={16}
                className={videoProductionGate?.is_allowed ? 'text-emerald-700' : 'text-stone-600'}
              />
              <span className="text-xs font-bold text-stone-900">
                Gerbang Produksi Video (Video Production Gate)
              </span>
              {videoProductionPackagePrepared && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-[10px] font-bold text-emerald-800 flex items-center gap-1">
                  <Check size={11} className="text-emerald-700" />
                  <span>Paket Produksi Siap ✓</span>
                </span>
              )}
            </div>

            {videoProductionGate?.is_allowed ? (
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                  <Check size={13} className="text-emerald-600 shrink-0" />
                  <span>3/3 Clip Dibuat ✓ &mdash; Semua syarat produksi video terpenuhi.</span>
                </p>
                <p className="text-[11px] text-stone-600">
                  Klik tombol di samping untuk menyiapkan dan menyimpan paket produksi video kanonikal.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-stone-700">
                  Belum Siap Menyiapkan Paket Produksi
                </p>
                {videoProductionGate?.blockers && videoProductionGate.blockers.length > 0 && (
                  <div className="space-y-0.5">
                    {videoProductionGate.blockers.slice(0, 2).map((blocker, idx) => (
                      <p key={idx} className="text-[11px] text-amber-800 flex items-start gap-1 leading-tight">
                        <AlertTriangle size={12} className="shrink-0 text-amber-600 mt-0.5" />
                        <span>{blocker}</span>
                      </p>
                    ))}
                    {videoProductionGate.blockers.length > 2 && (
                      <p className="text-[10px] text-stone-500 italic pl-4">
                        +{videoProductionGate.blockers.length - 2} syarat lainnya belum terpenuhi.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {videoProductionPackageError && (
              <p className="text-xs text-rose-600 font-semibold flex items-center gap-1">
                <AlertTriangle size={12} className="shrink-0 text-rose-600" />
                <span>{videoProductionPackageError}</span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={!videoProductionGate?.is_allowed || videoProductionPackagePreparing}
              onClick={handlePrepareVideoProductionPackage}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-xs flex items-center gap-2 ${
                videoProductionGate?.is_allowed && !videoProductionPackagePreparing
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                  : 'bg-stone-200 text-stone-400 cursor-not-allowed border border-stone-300'
              }`}
            >
              {videoProductionPackagePreparing ? (
                <>
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                  <span>Menyiapkan Paket...</span>
                </>
              ) : (
                <>
                  <Package size={14} />
                  <span>Siapkan Paket Produksi Video</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
