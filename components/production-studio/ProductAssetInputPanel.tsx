'use client';

import React, { useState, useRef } from 'react';
import { ProductAssetContext, ProductAssetReference } from '@/lib/video-production-input';
import { VideoProductionReadiness } from '@/lib/video-production-readiness';
import { Package, Image as ImageIcon, Plus, Trash2, Layers, CheckCircle2, AlertCircle, Upload } from 'lucide-react';

export interface ProductAssetInputPanelProps {
  value: ProductAssetContext | null;
  onChange: (value: ProductAssetContext) => void;
  videoProductionReadiness?: VideoProductionReadiness | null;
  className?: string;
}

const SUPPORTED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export default function ProductAssetInputPanel({
  value,
  onChange,
  videoProductionReadiness,
  className = '',
}: ProductAssetInputPanelProps) {
  const currentContext: ProductAssetContext = value || {
    product_name: '',
    product_type: 'Software / Digital Product',
    screenshots: [],
    feature_focus: [],
    demo_steps: [],
    logo_reference: null,
    screen_recording_reference: null,
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [featureInput, setFeatureInput] = useState('');
  const [stepInput, setStepInput] = useState('');

  const updateContext = (patch: Partial<ProductAssetContext>) => {
    onChange({
      ...currentContext,
      ...patch,
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validFiles: File[] = [];
    let hasUnsupported = false;

    for (const f of files) {
      if (SUPPORTED_MIME_TYPES.includes(f.type)) {
        validFiles.push(f);
      } else {
        hasUnsupported = true;
      }
    }

    if (hasUnsupported) {
      setFileError('Format screenshot harus PNG, JPG, atau WebP.');
    } else {
      setFileError(null);
    }

    if (validFiles.length > 0) {
      const newRefs: ProductAssetReference[] = validFiles.map((file, idx) => ({
        id: `shot_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        kind: 'screenshot',
      }));
      updateContext({
        screenshots: [...currentContext.screenshots, ...newRefs],
      });
    }

    // Reset input value so identical files can be selected again if needed
    e.target.value = '';
  };

  const handleRemoveScreenshot = (id: string) => {
    updateContext({
      screenshots: currentContext.screenshots.filter((s) => s.id !== id),
    });
  };

  const handleAddFeature = () => {
    const trimmed = featureInput.trim();
    if (!trimmed) return;
    updateContext({
      feature_focus: [...currentContext.feature_focus, trimmed],
    });
    setFeatureInput('');
  };

  const handleRemoveFeature = (index: number) => {
    updateContext({
      feature_focus: currentContext.feature_focus.filter((_, i) => i !== index),
    });
  };

  const handleAddStep = () => {
    const trimmed = stepInput.trim();
    if (!trimmed) return;
    updateContext({
      demo_steps: [...currentContext.demo_steps, trimmed],
    });
    setStepInput('');
  };

  const handleRemoveStep = (index: number) => {
    updateContext({
      demo_steps: currentContext.demo_steps.filter((_, i) => i !== index),
    });
  };

  const hasValidName = currentContext.product_name.trim().length > 0;
  const validScreenshots = currentContext.screenshots.filter(
    (s) => s && s.kind === 'screenshot' && s.id?.trim() && s.name?.trim()
  );
  const hasValidScreenshot = validScreenshots.length > 0;

  // Canonical readiness is the single source of truth for the final readiness status badge (fail-closed)
  const isReady = videoProductionReadiness?.is_ready === true;

  return (
    <div className={`bg-[#fffdf8] border border-[#e7e0d4] rounded-2xl p-4 sm:p-5 space-y-5 shadow-xs ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#e7e0d4]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
            <Package size={16} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-stone-900">Input Aset Produk (Product Demo)</h3>
            <p className="text-[11px] text-stone-500">
              Wajib: Nama Produk &amp; minimal 1 Screenshot untuk memandu visual antarmuka/fitur.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
              !videoProductionReadiness
                ? 'bg-stone-100 text-stone-700 border border-stone-200'
                : videoProductionReadiness.is_ready
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : 'bg-amber-100 text-amber-800 border border-amber-200'
            }`}
          >
            {!videoProductionReadiness ? (
              <>
                <AlertCircle size={11} />
                <span>Menunggu Validasi Produksi</span>
              </>
            ) : videoProductionReadiness.is_ready ? (
              <>
                <CheckCircle2 size={11} />
                <span>Input Lengkap</span>
              </>
            ) : (
              <>
                <AlertCircle size={11} />
                <span>Butuh Input Wajib</span>
              </>
            )}
          </span>
        </div>
      </div>

      {/* Grid: Required Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Field 1: Product Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-stone-800 flex items-center justify-between">
            <span>
              Nama Produk <span className="text-rose-600 font-bold">*</span>
            </span>
            <span className={`text-[10px] ${hasValidName ? 'text-emerald-700 font-semibold' : 'text-stone-400'}`}>
              {hasValidName ? '✓ Terisi' : 'Wajib'}
            </span>
          </label>
          <input
            type="text"
            value={currentContext.product_name}
            onChange={(e) => updateContext({ product_name: e.target.value })}
            placeholder="Contoh: ALCO Content Engine / CRM SaaS"
            className="w-full px-3.5 py-2 bg-[#f6f3ee] border border-[#e7e0d4] rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-primary"
          />
        </div>

        {/* Field 2: Product Type */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-stone-800 flex items-center justify-between">
            <span>Tipe Produk</span>
            <span className="text-[10px] text-stone-400">Opsional</span>
          </label>
          <input
            type="text"
            value={currentContext.product_type}
            onChange={(e) => updateContext({ product_type: e.target.value })}
            placeholder="Contoh: SaaS / Web App / Mobile App / E-commerce"
            className="w-full px-3.5 py-2 bg-[#f6f3ee] border border-[#e7e0d4] rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Field 3: Product Screenshots (Required at least 1) */}
      <div className="space-y-2 pt-1 border-t border-[#e7e0d4]/60">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
            <ImageIcon size={13} className="text-primary" />
            <span>
              Tangkapan Layar (Screenshots) Produk <span className="text-rose-600 font-bold">*</span>
            </span>
          </label>
          <span className={`text-[10px] ${hasValidScreenshot ? 'text-emerald-700 font-semibold' : 'text-rose-600 font-semibold'}`}>
            {hasValidScreenshot ? `✓ ${validScreenshots.length} screenshot terdaftar` : 'Wajib minimal 1 screenshot'}
          </span>
        </div>

        {/* Real File Picker Trigger */}
        <div className="space-y-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
          />
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 bg-primary hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition shadow-2xs flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Upload size={13} />
              <span>Pilih Screenshot (PNG/JPG/WebP)</span>
            </button>
            <span className="text-[11px] text-stone-500">
              Format didukung: PNG, JPG, JPEG, WebP. Pilih satu atau beberapa file.
            </span>
          </div>

          {fileError && (
            <p className="text-xs text-rose-600 font-medium flex items-center gap-1">
              <AlertCircle size={12} />
              <span>{fileError}</span>
            </p>
          )}
        </div>

        {/* Screenshot List */}
        {currentContext.screenshots.length > 0 ? (
          <div className="space-y-1.5 pt-1">
            {currentContext.screenshots.map((shot, idx) => (
              <div
                key={shot.id || idx}
                className="flex items-center justify-between p-2.5 bg-[#f6f3ee] border border-[#e7e0d4] rounded-xl text-xs text-stone-800"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="w-5 h-5 rounded-md bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                    {idx + 1}
                  </span>
                  <ImageIcon size={13} className="text-stone-400 shrink-0" />
                  <span className="font-semibold truncate">{shot.name}</span>
                  <span className="text-[10px] font-mono text-stone-400 bg-stone-200/60 px-1.5 py-0.2 rounded shrink-0">
                    {shot.kind}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveScreenshot(shot.id)}
                  className="p-1 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-stone-200/60 transition cursor-pointer shrink-0"
                  title="Hapus Screenshot"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-3 bg-[#f6f3ee] border border-dashed border-[#e7e0d4] rounded-xl text-center text-xs text-stone-500">
            Belum ada screenshot produk. Klik tombol &ldquo;Pilih Screenshot&rdquo; di atas untuk memilih file tangkapan layar produk Anda.
          </div>
        )}
      </div>

      {/* Optional: Feature Focus & Demo Steps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[#e7e0d4]/60">
        {/* Feature Focus */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-stone-800 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Layers size={13} className="text-stone-500" />
              <span>Fokus Fitur Utama</span>
            </span>
            <span className="text-[10px] text-stone-400">Opsional</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={featureInput}
              onChange={(e) => setFeatureInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddFeature();
                }
              }}
              placeholder="Contoh: Auto-generation kalender..."
              className="flex-1 px-3 py-1.5 bg-[#f6f3ee] border border-[#e7e0d4] rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={handleAddFeature}
              className="px-2.5 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold rounded-xl text-xs transition cursor-pointer"
            >
              <Plus size={13} />
            </button>
          </div>
          {currentContext.feature_focus.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {currentContext.feature_focus.map((feat, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded-lg bg-[#f6f3ee] border border-[#e7e0d4] text-xs text-stone-800 flex items-center gap-1.5 font-medium"
                >
                  <span>{feat}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFeature(i)}
                    className="text-stone-400 hover:text-rose-600 cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Demo Steps */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-stone-800 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Layers size={13} className="text-stone-500" />
              <span>Langkah Demonstrasi (Workflow)</span>
            </span>
            <span className="text-[10px] text-stone-400">Opsional</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={stepInput}
              onChange={(e) => setStepInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddStep();
                }
              }}
              placeholder="Contoh: 1. Masukkan ide -> 2. Klik generate..."
              className="flex-1 px-3 py-1.5 bg-[#f6f3ee] border border-[#e7e0d4] rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={handleAddStep}
              className="px-2.5 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold rounded-xl text-xs transition cursor-pointer"
            >
              <Plus size={13} />
            </button>
          </div>
          {currentContext.demo_steps.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {currentContext.demo_steps.map((step, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded-lg bg-[#f6f3ee] border border-[#e7e0d4] text-xs text-stone-800 flex items-center gap-1.5 font-medium"
                >
                  <span>{step}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveStep(i)}
                    className="text-stone-400 hover:text-rose-600 cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

