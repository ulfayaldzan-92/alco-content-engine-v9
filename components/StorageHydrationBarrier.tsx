'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { initializeStorage, isStorageHydrated } from '@/lib/storage-adapter';
import { AlertCircle, RefreshCw, HardDrive } from 'lucide-react';

interface StorageHydrationBarrierProps {
  children: React.ReactNode;
}

/**
 * StorageHydrationBarrier
 *
 * Strict initialization barrier for ALCO Content Engine v9.
 * Ensures desktop persistent storage is fully hydrated and validated
 * before any storage-dependent business UI mounts or executes effects.
 *
 * Guarantees:
 * - Completely prevents destructive writes during unhydrated states
 * - Renders a recoverable error UI on desktop storage failure
 * - Never silently falls back to browser localStorage inside Electron
 */
export function StorageHydrationBarrier({ children }: StorageHydrationBarrierProps) {
  const [status, setStatus] = useState<'hydrating' | 'ready' | 'error'>('hydrating');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const init = useCallback(async () => {
    setStatus('hydrating');
    setErrorMessage(null);

    try {
      const res = await initializeStorage();
      if (res.ok) {
        setStatus('ready');
      } else {
        setStatus('error');
        setErrorMessage(
          res.error || 'Penyimpanan desktop tidak dapat diinisialisasi atau snapshot tidak valid.'
        );
      }
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(
        err?.message || 'Terjadi kesalahan sistem saat menghubungkan penyimpanan desktop.'
      );
    }
  }, []);

  useEffect(() => {
    init();
  }, [init]);

  if (status === 'hydrating') {
    return (
      <div className="min-h-screen bg-[#faf8f5] text-stone-800 flex flex-col font-sans items-center justify-center p-6 select-none">
        <div className="bg-[#fffdf8] border border-[#e7e0d4] rounded-2xl p-8 max-w-md w-full shadow-lg text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto border border-primary/20 animate-pulse">
            <HardDrive size={28} />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-sm font-bold text-stone-900 tracking-tight">
              Menghubungkan Penyimpanan Desktop
            </h3>
            <p className="text-xs text-stone-500 leading-relaxed">
              Memuat data proyek persisten dan memverifikasi snapshot otoritatif ALCO...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#faf8f5] text-stone-800 flex flex-col font-sans items-center justify-center p-6">
        <div className="bg-[#fffdf8] border border-red-200 rounded-2xl p-8 max-w-lg w-full shadow-lg text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto border border-red-200">
            <AlertCircle size={28} />
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-bold text-stone-900">
              Gagal Membuka Penyimpanan Desktop
            </h3>
            <div className="p-3 bg-red-50/80 rounded-xl border border-red-200 text-left font-mono text-xs text-red-900 leading-relaxed overflow-x-auto">
              {errorMessage}
            </div>
            <p className="text-xs text-stone-500 leading-relaxed">
              Untuk melindungi integritas data proyek Anda, operasi tulis dinonaktifkan dan data kosong pengganti tidak dibuat. Silakan coba muat ulang.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={init}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-xs font-bold rounded-xl shadow-xs hover:opacity-90 transition cursor-pointer"
            >
              <RefreshCw size={14} />
              <span>Coba Hubungkan Ulang</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
export default StorageHydrationBarrier;
