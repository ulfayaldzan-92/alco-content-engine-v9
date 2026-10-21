/**
 * ALCO Content Engine v9 — Stage 1: Storage Adapter
 *
 * Provides transparent dual-mode storage:
 * - Electron Desktop: In-memory cache for synchronous reads + validated async IPC persistence to userData/storage/
 * - Web Browser / AI Studio: Direct synchronous localStorage access
 *
 * Guarantees:
 * - Preserves existing synchronous read signatures (loadProjectData, getProjectList, getActiveProjectId)
 * - Immediate in-memory consistency on writes
 * - Fail-closed barrier before hydration
 * - No silent fallback to browser localStorage inside Electron
 * - Stale write rejection and IPC error tracking
 */

export interface ProjectMeta {
  project_id: string;
  project_name: string;
  updated_at: string;
}

export interface StorageSnapshot {
  manifest: {
    schemaVersion?: string;
    activeProjectId: string | null;
    projectList: ProjectMeta[];
    updatedAt?: string;
  };
  projects: Record<
    string,
    {
      revision: number;
      data: Record<string, any>;
    }
  >;
  isFreshInstallation?: boolean;
  legacyMigrationRequired?: boolean;
}

export interface StorageInitResult {
  ok: boolean;
  error?: string;
  legacyMigrationAvailable?: boolean;
}

export interface SaveOperationResult {
  ok: boolean;
  error?: string;
  revision?: number;
}

interface CachedProject {
  revision: number;
  data: Map<string, any>;
  keyVersions: Map<string, number>;
}

class DesktopStorageAdapter {
  private isHydrated: boolean = false;
  private hydrationError: string | null = null;
  private legacyMigrationAvailable: boolean = false;

  // In-memory cache for Electron desktop mode
  private cachedManifest: {
    activeProjectId: string | null;
    projectList: ProjectMeta[];
  } = {
    activeProjectId: null,
    projectList: [],
  };

  private cachedProjects: Map<string, CachedProject> = new Map();

  // Pending writes tracking for durability guarantees
  private pendingWrites: Set<Promise<any>> = new Set();
  private lastPersistError: Error | null = null;

  // Strict sequential mutation queue per project for end-to-end order & revision serialization
  private projectMutationQueues: Map<string, Promise<any>> = new Map();

  /**
   * Detects if the current environment is running inside Electron Desktop with the storage bridge available.
   */
  public isDesktopElectron(): boolean {
    return (
      typeof window !== 'undefined' &&
      Boolean(
        (window as any).alcoBridge?.isElectron &&
          (window as any).alcoBridge?.storage
      )
    );
  }

  /**
   * Initializes the storage adapter before business components become active.
   * - In browser mode: marks hydrated immediately.
   * - In Electron mode: calls IPC getBootstrapSnapshot, populates in-memory cache, and verifies integrity.
   */
  public async initializeStorage(): Promise<StorageInitResult> {
    if (typeof window === 'undefined') {
      return { ok: true };
    }

    if (!this.isDesktopElectron()) {
      // Browser mode (AI Studio): localStorage is authoritative
      this.isHydrated = true;
      this.hydrationError = null;
      return { ok: true };
    }

    try {
      const bridge = (window as any).alcoBridge.storage;
      const res = await bridge.getBootstrapSnapshot();

      if (!res || !res.ok) {
        const errorMsg = res?.error || 'Gagal memuat snapshot penyimpanan desktop.';
        this.isHydrated = false;
        this.hydrationError = errorMsg;
        console.error('[ALCO Storage Adapter] Bootstrap failed:', errorMsg);
        return { ok: false, error: errorMsg };
      }

      const snapshot: StorageSnapshot = res.snapshot;
      const manifest = snapshot?.manifest || {
        activeProjectId: null,
        projectList: [],
      };

      this.cachedManifest = {
        activeProjectId: manifest.activeProjectId || null,
        projectList: Array.isArray(manifest.projectList) ? manifest.projectList : [],
      };

      this.cachedProjects.clear();
      if (snapshot?.projects && typeof snapshot.projects === 'object') {
        for (const [pid, pRec] of Object.entries(snapshot.projects)) {
          if (!pid || typeof pRec !== 'object') continue;
          const dataMap = new Map<string, any>();
          if (pRec.data && typeof pRec.data === 'object') {
            for (const [k, v] of Object.entries(pRec.data)) {
              dataMap.set(k, v);
            }
          }
          this.cachedProjects.set(pid, {
            revision: typeof pRec.revision === 'number' ? pRec.revision : 1,
            data: dataMap,
            keyVersions: new Map(),
          });
        }
      }

      // Check if desktop storage is empty and legacy localStorage data exists (Stage 1 non-destructive detection)
      if (
        snapshot?.isFreshInstallation &&
        typeof localStorage !== 'undefined'
      ) {
        try {
          const legacyList = localStorage.getItem('alco_project_list');
          if (legacyList && legacyList !== '[]') {
            this.legacyMigrationAvailable = true;
          }
        } catch (_) {}
      }

      this.isHydrated = true;
      this.hydrationError = null;
      return {
        ok: true,
        legacyMigrationAvailable: this.legacyMigrationAvailable,
      };
    } catch (err: any) {
      const errorMsg = err?.message || 'Penyimpanan desktop tidak dapat diinisialisasi.';
      this.isHydrated = false;
      this.hydrationError = errorMsg;
      console.error('[ALCO Storage Adapter] Critical initialization error:', err);
      return { ok: false, error: errorMsg };
    }
  }

  public isStorageHydrated(): boolean {
    if (!this.isDesktopElectron()) return true;
    return this.isHydrated;
  }

  public getStorageHydrationError(): string | null {
    return this.hydrationError;
  }

  public isLegacyMigrationAvailable(): boolean {
    return this.legacyMigrationAvailable;
  }

  public getLastStorageError(): Error | null {
    return this.lastPersistError;
  }

  /**
   * Synchronously reads active project ID.
   */
  public getActiveProjectId(): string | null {
    if (typeof window === 'undefined') return null;

    if (!this.isDesktopElectron()) {
      return (
        localStorage.getItem('alco_active_project_id') ||
        localStorage.getItem('alco_selected_project_id') ||
        null
      );
    }

    return this.cachedManifest.activeProjectId;
  }

  /**
   * Updates active project ID.
   */
  public setActiveProjectId(projectId: string | null): void {
    if (typeof window === 'undefined') return;

    if (!this.isDesktopElectron()) {
      if (projectId) {
        localStorage.setItem('alco_active_project_id', projectId);
        localStorage.setItem('alco_selected_project_id', projectId);
      } else {
        localStorage.removeItem('alco_active_project_id');
        localStorage.removeItem('alco_selected_project_id');
      }
      return;
    }

    if (!this.isHydrated) {
      console.error(
        '[ALCO Storage Adapter] Cannot setActiveProjectId before storage is hydrated.'
      );
      return;
    }

    this.cachedManifest.activeProjectId = projectId;
    this.dispatchManifestSave();
  }

  /**
   * Synchronously reads project list.
   */
  public getProjectList(): ProjectMeta[] {
    if (typeof window === 'undefined') return [];

    if (!this.isDesktopElectron()) {
      try {
        const raw = localStorage.getItem('alco_project_list');
        return raw ? JSON.parse(raw) : [];
      } catch (err) {
        return [];
      }
    }

    return [...this.cachedManifest.projectList];
  }

  /**
   * Updates project list.
   */
  public saveProjectList(list: ProjectMeta[]): void {
    if (typeof window === 'undefined') return;

    if (!this.isDesktopElectron()) {
      try {
        localStorage.setItem('alco_project_list', JSON.stringify(list));
      } catch (err) {
        console.error('Failed to save project list to localStorage', err);
      }
      return;
    }

    if (!this.isHydrated) {
      console.error(
        '[ALCO Storage Adapter] Cannot saveProjectList before storage is hydrated.'
      );
      return;
    }

    // Ensure all projects in list exist in cachedProjects
    for (const p of list) {
      if (!p || !p.project_id) continue;
      if (!this.cachedProjects.has(p.project_id)) {
        this.cachedProjects.set(p.project_id, {
          revision: 0,
          data: new Map(),
          keyVersions: new Map(),
        });
      }
    }

    this.cachedManifest.projectList = Array.isArray(list) ? list : [];
    this.dispatchManifestSave();
  }

  /**
   * Initializes a new project record and ensures its durable data.json file exists on disk
   * before registering it in manifest.json.
   */
  public async createProject(
    projectId: string,
    projectName: string = 'Project Baru'
  ): Promise<{ ok: boolean; error?: string }> {
    if (typeof window === 'undefined') return { ok: true };

    if (!this.isHydrated) {
      return {
        ok: false,
        error: 'Cannot create project before storage is hydrated.',
      };
    }

    // Initialize in-memory cache
    let pRec = this.cachedProjects.get(projectId);
    if (!pRec) {
      pRec = { revision: 0, data: new Map(), keyVersions: new Map() };
      this.cachedProjects.set(projectId, pRec);
    }

    if (this.isDesktopElectron()) {
      try {
        const bridge = (window as any).alcoBridge?.storage;
        if (bridge?.initProject) {
          const res = await bridge.initProject(projectId);
          if (!res || !res.ok) {
            return {
              ok: false,
              error: res?.error || 'Failed to initialize project file on disk.',
            };
          }
        }
      } catch (err: any) {
        return { ok: false, error: err?.message || 'Error initializing project file.' };
      }
    }

    // Safely register in projectList and save manifest
    const list = this.getProjectList();
    const index = list.findIndex((p) => p.project_id === projectId);
    if (index >= 0) {
      list[index].project_name = projectName;
      list[index].updated_at = new Date().toISOString();
    } else {
      list.push({
        project_id: projectId,
        project_name: projectName,
        updated_at: new Date().toISOString(),
      });
    }
    this.saveProjectList(list);

    return { ok: true };
  }

  /**
   * Synchronously loads project-scoped data key.
   */
  public loadProjectData(
    projectId: string,
    dataType: string,
    defaultValue: any = null
  ): any {
    if (typeof window === 'undefined' || !projectId || !dataType) {
      return defaultValue;
    }

    if (!this.isDesktopElectron()) {
      try {
        const key = `alco_project_${projectId}_${dataType}`;
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : defaultValue;
      } catch (err) {
        return defaultValue;
      }
    }

    if (!this.isHydrated) {
      console.warn(
        `[ALCO Storage Adapter] loadProjectData called for "${projectId}.${dataType}" before storage is hydrated.`
      );
      return defaultValue;
    }

    const pRec = this.cachedProjects.get(projectId);
    if (!pRec || !pRec.data) {
      return defaultValue;
    }

    const val = pRec.data.get(dataType);
    return val !== undefined ? val : defaultValue;
  }

  /**
   * Saves project-scoped data key:
   * - Updates in-memory cache immediately for synchronous consistency
   * - Asynchronously dispatches IPC to Electron storage engine with revision check
   * - Returns per-operation disk acknowledgment promise independent of global errors
   */
  public saveProjectData(
    projectId: string,
    dataType: string,
    data: any
  ): { persisted: Promise<SaveOperationResult> } {
    if (typeof window === 'undefined' || !projectId || !dataType) {
      return { persisted: Promise.resolve({ ok: true }) };
    }

    if (!this.isDesktopElectron()) {
      try {
        const key = `alco_project_${projectId}_${dataType}`;
        localStorage.setItem(key, JSON.stringify(data));
      } catch (err) {
        console.error('Failed to save project data to localStorage:', err);
      }
      return { persisted: Promise.resolve({ ok: true }) };
    }

    if (!this.isHydrated) {
      const err = new Error(
        `[ALCO Storage Adapter] Destructive write blocked: Cannot save "${dataType}" for project "${projectId}" because desktop storage is not hydrated.`
      );
      this.lastPersistError = err;
      console.error(err.message);
      return { persisted: Promise.resolve({ ok: false, error: err.message }) };
    }

    let pRec = this.cachedProjects.get(projectId);
    if (!pRec) {
      pRec = { revision: 0, data: new Map(), keyVersions: new Map() };
      this.cachedProjects.set(projectId, pRec);
    }

    // Increment per-key mutation version
    const nextKeyVer = (pRec.keyVersions.get(dataType) || 0) + 1;
    pRec.keyVersions.set(dataType, nextKeyVer);

    // Immediate in-memory consistency for synchronous readers
    pRec.data.set(dataType, data);

    let operationResolve!: (val: SaveOperationResult) => void;
    const perOperationPromise = new Promise<SaveOperationResult>((resolve) => {
      operationResolve = resolve;
    });

    // Serialize mutations per project end-to-end to ensure correct revision order
    const prevQueue = this.projectMutationQueues.get(projectId) || Promise.resolve();

    const writeTask = prevQueue
      .catch(() => {}) // Ensure previous failed writes don't break queue continuity
      .then(async () => {
        // Read the exact revision at execution time to ensure rapid consecutive writes
        // use the updated revision from the immediately preceding write
        const clientRevision = pRec.revision;
        const bridge = (window as any).alcoBridge.storage;
        const res = await bridge.saveProjectData(projectId, dataType, data, clientRevision);

        if (!res || !res.ok) {
          const errMsg = res?.error || 'IPC saveProjectData failed';
          const err = new Error(`Disk write failed for "${projectId}.${dataType}": ${errMsg}`);
          this.lastPersistError = err;
          console.error('[ALCO Storage Adapter] Persistence error:', err);
          operationResolve({ ok: false, error: errMsg });
          throw err;
        }

        if (typeof res.revision === 'number') {
          pRec.revision = res.revision;
        }
        operationResolve({ ok: true, revision: res.revision });
        return res;
      })
      .catch((err: any) => {
        this.lastPersistError = err;
        console.error('[ALCO Storage Adapter] IPC error saving project data:', err);
        operationResolve({ ok: false, error: err?.message || 'IPC error saving project data' });
      });

    this.projectMutationQueues.set(projectId, writeTask);
    this.pendingWrites.add(writeTask);
    writeTask.finally(() => {
      this.pendingWrites.delete(writeTask);
    });

    return {
      persisted: perOperationPromise,
    };
  }

  /**
   * Removes project-scoped data key.
   * Ensures failed removals cannot leave cache and disk silently inconsistent (safe rollback).
   * Uses per-key mutation versions so newer cache mutations are never overwritten by rollback.
   */
  public removeProjectData(projectId: string, dataType: string): void {
    if (typeof window === 'undefined' || !projectId || !dataType) {
      return;
    }

    if (!this.isDesktopElectron()) {
      try {
        const key = `alco_project_${projectId}_${dataType}`;
        localStorage.removeItem(key);
      } catch (err) {
        console.error('Failed to remove project data from localStorage:', err);
      }
      return;
    }

    if (!this.isHydrated) {
      console.warn(
        `[ALCO Storage Adapter] removeProjectData called for "${projectId}.${dataType}" before storage is hydrated.`
      );
      return;
    }

    const pRec = this.cachedProjects.get(projectId);
    if (!pRec || !pRec.data) {
      return;
    }

    const hadKey = pRec.data.has(dataType);
    const previousValue = pRec.data.get(dataType);

    // Track per-key mutation identity/version for this specific removal
    const removalMutationVersion = (pRec.keyVersions.get(dataType) || 0) + 1;
    pRec.keyVersions.set(dataType, removalMutationVersion);

    // Optimistic cache removal
    pRec.data.delete(dataType);

    // Serialize in project mutation queue
    const prevQueue = this.projectMutationQueues.get(projectId) || Promise.resolve();

    const removeTask = prevQueue
      .catch(() => {})
      .then(async () => {
        const bridge = (window as any).alcoBridge.storage;
        const res = await bridge.removeProjectData(projectId, dataType);

        if (!res || !res.ok) {
          // Safe recovery: rollback cache ONLY if no newer mutation has occurred for this key!
          const currentKeyVersion = pRec.keyVersions.get(dataType);
          if (hadKey && currentKeyVersion === removalMutationVersion) {
            pRec.data.set(dataType, previousValue);
          }
          const errMsg = res?.error || 'IPC removeProjectData failed';
          const err = new Error(`Disk removal failed for "${projectId}.${dataType}": ${errMsg}`);
          this.lastPersistError = err;
          console.error('[ALCO Storage Adapter] Remove error:', err);
          throw err;
        }

        if (typeof res.revision === 'number') {
          pRec.revision = res.revision;
        }
        return res;
      })
      .catch((err: any) => {
        // Safe recovery fallback on error/rejection: verify version before rollback
        const currentKeyVersion = pRec.keyVersions.get(dataType);
        if (hadKey && currentKeyVersion === removalMutationVersion) {
          pRec.data.set(dataType, previousValue);
        }
        this.lastPersistError = err;
        console.error('[ALCO Storage Adapter] IPC error removing project data:', err);
      });

    this.projectMutationQueues.set(projectId, removeTask);
    this.pendingWrites.add(removeTask);
    removeTask.finally(() => {
      this.pendingWrites.delete(removeTask);
    });
  }

  /**
   * Dispatches manifest save to Electron main process via IPC.
   */
  private dispatchManifestSave(): void {
    if (!this.isDesktopElectron() || !this.isHydrated) return;

    const bridge = (window as any).alcoBridge.storage;
    const manifestPayload = {
      activeProjectId: this.cachedManifest.activeProjectId,
      projectList: this.cachedManifest.projectList,
    };

    const manifestPromise = bridge
      .saveManifest(manifestPayload)
      .then((res: any) => {
        if (!res || !res.ok) {
          const errMsg = res?.error || 'IPC saveManifest failed';
          this.lastPersistError = new Error(errMsg);
          console.error('[ALCO Storage Adapter] Manifest persistence error:', errMsg);
        }
      })
      .catch((err: any) => {
        this.lastPersistError = err;
        console.error('[ALCO Storage Adapter] Manifest IPC error:', err);
      })
      .finally(() => {
        this.pendingWrites.delete(manifestPromise);
      });

    this.pendingWrites.add(manifestPromise);
  }

  /**
   * Explicitly waits until all pending disk writes have been confirmed by IPC.
   */
  public async waitForStoragePersistence(): Promise<boolean> {
    if (this.pendingWrites.size > 0) {
      await Promise.allSettled(Array.from(this.pendingWrites));
    }
    return !this.lastPersistError;
  }
}

// Singleton adapter instance
export const desktopStorageAdapter = new DesktopStorageAdapter();

// Re-export convenience helpers
export const initializeStorage = () => desktopStorageAdapter.initializeStorage();
export const isStorageHydrated = () => desktopStorageAdapter.isStorageHydrated();
export const getStorageHydrationError = () => desktopStorageAdapter.getStorageHydrationError();
export const isLegacyMigrationAvailable = () => desktopStorageAdapter.isLegacyMigrationAvailable();
export const waitForStoragePersistence = () => desktopStorageAdapter.waitForStoragePersistence();
export const getLastStorageError = () => desktopStorageAdapter.getLastStorageError();
export const isDesktopElectron = () => desktopStorageAdapter.isDesktopElectron();
export const createProject = (projectId: string, projectName?: string) =>
  desktopStorageAdapter.createProject(projectId, projectName);
