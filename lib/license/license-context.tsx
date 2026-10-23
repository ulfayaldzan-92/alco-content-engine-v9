'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { AlcoLicensePayload, AlcoLicenseStoreState, AlcoVerificationResult } from './types';
import { getAlcoDeviceId, getCachedAlcoDeviceId } from './device-fingerprint';
import { verifyLicenseCode } from './verification';
import { generateRequestCodeV2 } from './request-code';

const LICENSE_STORAGE_KEY = 'alco_license_code_v2';
const LAST_STATE_KEY = 'alco_license_last_state_v2';

interface LicenseContextValue {
  state: AlcoLicenseStoreState;
  deviceId: string;
  isLoading: boolean;
  activateLicense: (rawCode: string) => Promise<AlcoVerificationResult>;
  deactivateLicense: () => Promise<void>;
  reverifyLicense: () => Promise<AlcoVerificationResult>;
  generateRequestCode: (params: { name: string; email: string; notes?: string }) => string;
}

const LicenseContext = createContext<LicenseContextValue | null>(null);

export const LicenseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [deviceId, setDeviceId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [state, setState] = useState<AlcoLicenseStoreState>({
    status: 'unlicensed',
    license: null,
    rawCode: null,
    deviceId: '',
    lastVerifiedAt: null,
  });

  const isElectronEnv = useCallback((): boolean => {
    if (typeof window === 'undefined') return false;
    const bridge = window.alcoBridge || window.electronAPI;
    return !!(bridge && (bridge.isElectron || typeof bridge.readLicense === 'function' || typeof bridge.license?.readLicense === 'function'));
  }, []);

  const readStoredLicenseCode = async (): Promise<{ ok: boolean; code?: string | null; error?: string }> => {
    if (isElectronEnv()) {
      try {
        const bridge = window.alcoBridge || window.electronAPI;
        const reader = bridge?.license?.readLicense || bridge?.readLicense || bridge?.license?.read;
        if (typeof reader === 'function') {
          const res = await reader();
          if (res && res.ok) {
            return { ok: true, code: res.code };
          }
          return { ok: false, error: res?.error || 'Failed to read license from desktop disk' };
        }
      } catch (err: any) {
        return { ok: false, error: err.message || 'Desktop license read exception' };
      }
    }

    // Browser preview fallback: localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const code = window.localStorage.getItem(LICENSE_STORAGE_KEY);
        return { ok: true, code: code ? code.trim() : null };
      } catch (err: any) {
        return { ok: false, error: err.message };
      }
    }
    return { ok: true, code: null };
  };

  const saveStoredLicenseCode = async (rawCode: string): Promise<{ ok: boolean; error?: string }> => {
    const trimmed = rawCode.trim();
    if (isElectronEnv()) {
      try {
        const bridge = window.alcoBridge || window.electronAPI;
        const saver = bridge?.license?.saveLicense || bridge?.saveLicense || bridge?.license?.save;
        if (typeof saver === 'function') {
          const res = await saver(trimmed);
          if (res && res.ok) {
            return { ok: true };
          }
          return { ok: false, error: res?.error || 'Desktop disk write failed' };
        }
      } catch (err: any) {
        return { ok: false, error: err.message || 'Desktop license save exception' };
      }
    }

    // Browser preview fallback: localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(LICENSE_STORAGE_KEY, trimmed);
        return { ok: true };
      } catch (err: any) {
        return { ok: false, error: err.message };
      }
    }
    return { ok: false, error: 'Environment does not support storage' };
  };

  const removeStoredLicenseCode = async (): Promise<{ ok: boolean; error?: string }> => {
    if (isElectronEnv()) {
      try {
        const bridge = window.alcoBridge || window.electronAPI;
        const remover = bridge?.license?.removeLicense || bridge?.removeLicense || bridge?.license?.remove;
        if (typeof remover === 'function') {
          const res = await remover();
          if (res && res.ok) {
            return { ok: true };
          }
          return { ok: false, error: res?.error || 'Desktop disk removal failed' };
        }
      } catch (err: any) {
        return { ok: false, error: err.message || 'Desktop license removal exception' };
      }
    }

    // Browser preview fallback: localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(LICENSE_STORAGE_KEY);
        window.localStorage.removeItem(LAST_STATE_KEY);
        return { ok: true };
      } catch (err: any) {
        return { ok: false, error: err.message };
      }
    }
    return { ok: true };
  };

  // Load and verify license on startup
  const initLicense = useCallback(async () => {
    setIsLoading(true);
    try {
      const devId = await getAlcoDeviceId();
      setDeviceId(devId);

      const readRes = await readStoredLicenseCode();
      if (!readRes.ok) {
        setState({
          status: 'invalid',
          license: null,
          rawCode: null,
          deviceId: devId,
          lastVerifiedAt: new Date().toISOString(),
          error: `Disk storage read error: ${readRes.error}`,
        });
        setIsLoading(false);
        return;
      }

      const savedCode = readRes.code;
      if (!savedCode) {
        setState({
          status: 'unlicensed',
          license: null,
          rawCode: null,
          deviceId: devId,
          lastVerifiedAt: new Date().toISOString(),
        });
        setIsLoading(false);
        return;
      }

      // Re-verify stored license
      const result = await verifyLicenseCode(savedCode, devId);

      if (result.valid && result.license) {
        setState({
          status: 'active',
          license: result.license,
          rawCode: savedCode,
          deviceId: devId,
          lastVerifiedAt: new Date().toISOString(),
        });
      } else {
        setState({
          status: result.status === 'expired' ? 'expired' : 'invalid',
          license: result.license || null,
          rawCode: savedCode,
          deviceId: devId,
          lastVerifiedAt: new Date().toISOString(),
          error: result.error,
        });
      }
    } catch (err: any) {
      console.error('Failed to initialize license:', err);
      setState((prev) => ({
        ...prev,
        status: 'unlicensed',
        error: err.message || 'Gagal menginisialisasi verifikasi lisensi',
      }));
    } finally {
      setIsLoading(false);
    }
  }, [isElectronEnv]);

  useEffect(() => {
    // Read cached device ID safely after client mount to prevent SSR hydration mismatch
    const cached = getCachedAlcoDeviceId();
    if (cached) {
      setDeviceId(cached);
    }
    initLicense();
  }, [initLicense]);

  const activateLicense = useCallback(
    async (rawCode: string): Promise<AlcoVerificationResult> => {
      setIsLoading(true);
      try {
        const currentDevId = deviceId || (await getAlcoDeviceId());
        const result = await verifyLicenseCode(rawCode, currentDevId);

        if (result.valid && result.license) {
          // Wait for durable save before reporting successful activation!
          const saveRes = await saveStoredLicenseCode(rawCode);
          if (!saveRes.ok) {
            const diskError = `Disk write failure: ${saveRes.error || 'Gagal menyimpan lisensi ke disk'}`;
            setState((prev) => ({
              ...prev,
              status: 'invalid',
              error: diskError,
            }));
            return {
              valid: false,
              status: 'invalid_signature',
              error: diskError,
            };
          }

          setState({
            status: 'active',
            license: result.license,
            rawCode: rawCode.trim(),
            deviceId: currentDevId,
            lastVerifiedAt: new Date().toISOString(),
          });
        } else {
          setState((prev) => ({
            ...prev,
            status: result.status === 'expired' ? 'expired' : 'invalid',
            error: result.error,
          }));
        }

        return result;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          valid: false,
          status: 'invalid_signature',
          error: `Gagal mengaktifkan lisensi: ${msg}`,
        };
      } finally {
        setIsLoading(false);
      }
    },
    [deviceId, isElectronEnv]
  );

  const deactivateLicense = useCallback(async () => {
    await removeStoredLicenseCode();
    setState({
      status: 'unlicensed',
      license: null,
      rawCode: null,
      deviceId,
      lastVerifiedAt: new Date().toISOString(),
    });
  }, [deviceId, isElectronEnv]);

  const reverifyLicense = useCallback(async (): Promise<AlcoVerificationResult> => {
    if (!state.rawCode) {
      return { valid: false, status: 'unlicensed', error: 'Belum ada lisensi terpasang' };
    }
    return activateLicense(state.rawCode);
  }, [state.rawCode, activateLicense]);

  const generateRequestCode = useCallback(
    (params: { name: string; email: string; notes?: string }): string => {
      return generateRequestCodeV2({
        name: params.name,
        email: params.email,
        notes: params.notes,
        deviceId,
      });
    },
    [deviceId]
  );

  const contextValue = useMemo<LicenseContextValue>(
    () => ({
      state,
      deviceId,
      isLoading,
      activateLicense,
      deactivateLicense,
      reverifyLicense,
      generateRequestCode,
    }),
    [state, deviceId, isLoading, activateLicense, deactivateLicense, reverifyLicense, generateRequestCode]
  );

  return <LicenseContext.Provider value={contextValue}>{children}</LicenseContext.Provider>;
};

export function useLicense(): LicenseContextValue {
  const context = useContext(LicenseContext);
  if (!context) {
    throw new Error('useLicense must be used within a LicenseProvider');
  }
  return context;
}
