'use client';

import React, { useEffect, useState } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const bridge = (window as any).alcoBridge || (window as any).electronAPI;
      if (bridge?.isElectron || typeof bridge?.getDeviceId === 'function') {
        setIsElectron(true);
      }
    }
  }, []);

  return (
    <html lang="id">
      <body className="bg-zinc-950 text-zinc-100 antialiased min-h-screen flex flex-col">
        {isElectron && (
          <header
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
            className="w-full h-8 shrink-0 flex items-center justify-between px-3 bg-zinc-900 border-b border-zinc-800 text-zinc-300 select-none text-xs"
          >
            <div className="flex items-center gap-2 font-medium">
              <span className="font-bold text-zinc-100">ALCO Content Engine</span>
              <span className="text-[10px] text-rose-400 font-mono font-semibold uppercase px-1.5 py-0.2 rounded bg-rose-950/60 border border-rose-800/50">
                System Error
              </span>
            </div>
            {/* Native Window Controls Overlay reserve spacer */}
            <div
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              className="w-[140px] shrink-0 pointer-events-none"
            />
          </header>
        )}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4 text-center">
            <h2 className="text-lg font-bold text-rose-400">Terjadi Kesalahan Sistem Global</h2>
            <p className="text-xs text-zinc-400 font-mono break-words bg-zinc-950 p-3 rounded-xl border border-zinc-800">
              {error?.message || 'Aplikasi mengalami kendala yang tidak terduga.'}
            </p>
            <button
              type="button"
              onClick={() => reset()}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-xl transition shadow-md cursor-pointer"
            >
              Muat Ulang Aplikasi
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
