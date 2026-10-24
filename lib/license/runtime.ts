/** Detect desktop independently of preload availability, so preload failures fail closed. */
export function isElectronDesktopRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const bridge = window.alcoBridge || window.electronAPI;
  return /Electron\//i.test(window.navigator?.userAgent || '') || !!(bridge && (
    bridge.isElectron === true || typeof bridge.getDeviceId === 'function' ||
    typeof bridge.readLicense === 'function' || typeof bridge.license?.readLicense === 'function'
  ));
}
