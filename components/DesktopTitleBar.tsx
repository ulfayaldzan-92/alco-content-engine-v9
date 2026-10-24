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
      className="w-full h-8 shrink-0 flex items-center justify-between px-3 bg-background border-b border-border/60 text-foreground text-xs select-none app-drag-region z-50 relative"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      aria-label="Desktop Window Title Bar"
    >
      {/* Left: ALCO Branding & App Name */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary text-primary-foreground shadow-2xs">
          <Zap size={12} className="fill-current" />
        </div>
        <span className="font-bold text-[12px] tracking-tight text-foreground truncate">
          ALCO Content Engine
        </span>
        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded uppercase tracking-wider bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20">
          Desktop
        </span>
      </div>

      {/* Middle: Draggable window space */}
      <div className="flex-1 h-full app-drag-region" />

      {/* Right: Reserved space for native Windows Window Controls Overlay (min, max, close) */}
      <div
        className="shrink-0 h-full pointer-events-none app-no-drag"
        style={{
          width: 'calc(100vw - env(titlebar-area-width, calc(100vw - 140px)))',
          minWidth: '138px',
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties}
        aria-hidden="true"
      />
    </header>
  );
}

export default DesktopTitleBar;
