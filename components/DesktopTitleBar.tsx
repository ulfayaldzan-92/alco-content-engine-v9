'use client';

import React, { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';

/**
 * DesktopTitleBar
 *
 * Dedicated Electron Window Controls Overlay (WCO) title bar.
 * Designed for native desktop window management on Windows/macOS/Linux.
 *
 * Key guarantees:
 * - Completely omitted (returns null) on browser/web preview, causing 0 layout shift or SSR errors.
 * - Leaves reserved space for native OS minimize, maximize/restore, and close overlay buttons.
 * - Enables native window drag, double-click to maximize/restore, and Windows Snap.
 * - Does NOT implement custom frameless buttons or custom window controls IPC.
 */
export function DesktopTitleBar() {
  const [isElectron, setIsElectron] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const bridge = window.alcoBridge || window.electronAPI;
      const isEl = Boolean(bridge?.isElectron || typeof bridge?.getDeviceId === 'function');
      if (isEl) {
        setIsElectron(true);
        document.documentElement.classList.add('is-electron');
        return () => document.documentElement.classList.remove('is-electron');
      }
    }
  }, []);

  // Strict boundary: Never render on web / browser preview
  if (!isElectron) {
    return null;
  }

  return (
    <header
      id="alco-desktop-titlebar"
      className="w-full shrink-0 bg-background border-b border-border/60 text-foreground text-xs select-none z-50 relative"
      aria-label="Desktop Window Title Bar"
    >
      {/* Native geometry excludes window controls on either side of the window. */}
      <div className="absolute flex items-center gap-2 min-w-0 px-3 app-drag-region overflow-hidden"
        style={{
          left: 'env(titlebar-area-x, 0px)',
          top: 'env(titlebar-area-y, 0px)',
          width: 'env(titlebar-area-width, 100%)',
          height: 'env(titlebar-area-height, 32px)',
          WebkitAppRegion: 'drag',
        } as React.CSSProperties}>
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary text-primary-foreground shadow-2xs">
          <Zap size={12} className="fill-current" />
        </div>
        <span className="font-bold text-[12px] tracking-tight text-foreground truncate">
          ALCO Content Engine
        </span>
        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded uppercase tracking-wider bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20">
          Desktop
        </span>
        <div className="flex-1 h-full" />
      </div>
    </header>
  );
}

export default DesktopTitleBar;
