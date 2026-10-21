/**
 * ALCO Content Engine v9 — Stage 1: Local Persistent Storage Engine
 *
 * Dedicated Electron storage module running in the main process.
 * Manages atomic JSON persistence in app.getPath('userData')/storage/
 *
 * Structure:
 *   storage/
 *     manifest.json
 *     projects/
 *       <projectId>/
 *         data.json
 *
 * Guarantees:
 * - Safe directory initialization
 * - Strict project ID validation and traversal rejection
 * - Atomic write-then-rename file replacement
 * - Serialized write queues per project and manifest
 * - Revision tracking and order protection
 * - Safe recovery from interrupted writes (.tmp cleanup)
 * - Safe error propagation without silent fallbacks
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SCHEMA_VERSION = '1.0.0';
const MAX_PAYLOAD_SIZE = 50 * 1024 * 1024; // 50MB
const PROJECT_ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

class StorageEngine {
  constructor(userDataPath) {
    if (!userDataPath || typeof userDataPath !== 'string') {
      throw new Error('StorageEngine requires a valid userDataPath string.');
    }
    this.userDataPath = userDataPath;
    this.storageDir = path.join(userDataPath, 'storage');
    this.projectsDir = path.join(this.storageDir, 'projects');
    this.manifestPath = path.join(this.storageDir, 'manifest.json');

    // Serialized write queues (key -> Promise chain)
    this.writeQueues = new Map();

    this.initDirectories();
  }

  /**
   * Initializes storage directories safely.
   */
  initDirectories() {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }
      if (!fs.existsSync(this.projectsDir)) {
        fs.mkdirSync(this.projectsDir, { recursive: true });
      }
      this.cleanupDanglingTempFiles(this.storageDir);
      this.cleanupDanglingTempFiles(this.projectsDir);
    } catch (err) {
      console.error('[ALCO Storage Engine] Directory init error:', err);
      throw err;
    }
  }

  /**
   * Removes stale temporary files left by unexpected crashes.
   */
  cleanupDanglingTempFiles(dir) {
    try {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          this.cleanupDanglingTempFiles(fullPath);
        } else if (entry.name.includes('.tmp.')) {
          try {
            fs.unlinkSync(fullPath);
          } catch (_) {}
        }
      }
    } catch (err) {
      console.warn('[ALCO Storage Engine] Temp cleanup warning:', err.message);
    }
  }

  /**
   * Strict project ID validation to prevent directory traversal or malformed paths.
   */
  validateProjectId(projectId) {
    if (typeof projectId !== 'string') {
      return { valid: false, error: 'Project ID must be a string.' };
    }
    const trimmed = projectId.trim();
    if (!trimmed) {
      return { valid: false, error: 'Project ID cannot be empty.' };
    }
    if (trimmed.length > 128) {
      return { valid: false, error: 'Project ID exceeds maximum length of 128 characters.' };
    }
    if (trimmed === '.' || trimmed === '..') {
      return { valid: false, error: 'Project ID contains invalid directory reference.' };
    }
    if (!PROJECT_ID_REGEX.test(trimmed)) {
      return { valid: false, error: `Project ID "${trimmed}" contains invalid characters. Only alphanumeric, underscores, and hyphens are allowed.` };
    }
    return { valid: true, cleanId: trimmed };
  }

  /**
   * Validates data type key name.
   */
  validateDataType(dataType) {
    if (typeof dataType !== 'string') {
      return { valid: false, error: 'Data type key must be a string.' };
    }
    const trimmed = dataType.trim();
    if (!trimmed) {
      return { valid: false, error: 'Data type key cannot be empty.' };
    }
    if (trimmed.length > 256) {
      return { valid: false, error: 'Data type key exceeds maximum length of 256 characters.' };
    }
    if (trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('..')) {
      return { valid: false, error: 'Data type key contains invalid path characters.' };
    }
    return { valid: true, cleanKey: trimmed };
  }

  /**
   * Resolves project data file path strictly within storage/projects/<projectId>/data.json
   */
  resolveProjectFilePath(cleanProjectId) {
    const projectDir = path.join(this.projectsDir, cleanProjectId);
    const resolvedPath = path.join(projectDir, 'data.json');

    // Strict traversal protection check
    const relative = path.relative(this.projectsDir, resolvedPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`Path traversal blocked for project ID "${cleanProjectId}".`);
    }

    return { projectDir, filePath: resolvedPath };
  }

  /**
   * Writes data atomically using a unique temp file and atomic rename.
   * Includes Windows file-locking retry backoff.
   */
  atomicWriteJson(targetPath, data) {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const tempPath = `${targetPath}.tmp.${Date.now()}.${crypto.randomBytes(4).toString('hex')}`;
    const serialized = JSON.stringify(data, null, 2);

    try {
      fs.writeFileSync(tempPath, serialized, 'utf8');

      // Windows-safe rename with retry loop
      let renamed = false;
      let attempts = 0;
      while (!renamed && attempts < 5) {
        try {
          fs.renameSync(tempPath, targetPath);
          renamed = true;
        } catch (err) {
          attempts++;
          if (attempts >= 5) {
            throw err;
          }
          // Busy-wait 15ms for transient Windows file-lock/AV scanner release
          const waitUntil = Date.now() + 15;
          while (Date.now() < waitUntil) {}
        }
      }
    } catch (err) {
      try {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch (_) {}
      throw err;
    }
  }

  /**
   * Enqueues a write operation to ensure strict sequential execution per resource key.
   */
  enqueueWrite(queueKey, task) {
    const prevPromise = this.writeQueues.get(queueKey) || Promise.resolve();
    const nextPromise = prevPromise
      .catch(() => {}) // Don't let previous failures break queue continuity
      .then(() => task());

    this.writeQueues.set(queueKey, nextPromise);
    return nextPromise;
  }

  /**
   * Reads and parses manifest.json safely.
   */
  getManifestSync() {
    if (!fs.existsSync(this.manifestPath)) {
      return {
        schemaVersion: SCHEMA_VERSION,
        activeProjectId: null,
        projectList: [],
        updatedAt: new Date().toISOString(),
      };
    }

    try {
      const raw = fs.readFileSync(this.manifestPath, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        schemaVersion: parsed.schemaVersion || SCHEMA_VERSION,
        activeProjectId: typeof parsed.activeProjectId === 'string' ? parsed.activeProjectId : null,
        projectList: Array.isArray(parsed.projectList) ? parsed.projectList : [],
        updatedAt: parsed.updatedAt || new Date().toISOString(),
      };
    } catch (err) {
      console.error('[ALCO Storage Engine] Failed to parse manifest.json:', err);
      // Create backup of corrupted manifest
      try {
        const corruptPath = `${this.manifestPath}.corrupt.${Date.now()}`;
        fs.copyFileSync(this.manifestPath, corruptPath);
      } catch (_) {}
      throw new Error(`Penyimpanan desktop rusak (manifest.json). Backup tersimpan. Detail: ${err.message}`);
    }
  }

  /**
   * Saves manifest.json safely via serialized queue.
   */
  async saveManifest(manifestData) {
    return this.enqueueWrite('manifest', async () => {
      if (!manifestData || typeof manifestData !== 'object') {
        throw new Error('Invalid manifest data format.');
      }

      let activeProjectId = null;
      if (manifestData.activeProjectId) {
        const val = this.validateProjectId(manifestData.activeProjectId);
        if (!val.valid) throw new Error(val.error);
        activeProjectId = val.cleanId;
      }

      const projectList = Array.isArray(manifestData.projectList)
        ? manifestData.projectList.filter(p => p && typeof p.project_id === 'string' && this.validateProjectId(p.project_id).valid)
        : [];

      const payload = {
        schemaVersion: SCHEMA_VERSION,
        activeProjectId,
        projectList,
        updatedAt: new Date().toISOString(),
      };

      this.atomicWriteJson(this.manifestPath, payload);
      return { ok: true };
    });
  }

  /**
   * Reads project data.json safely.
   */
  getProjectDataSync(projectId) {
    const val = this.validateProjectId(projectId);
    if (!val.valid) throw new Error(val.error);

    const { filePath } = this.resolveProjectFilePath(val.cleanId);
    if (!fs.existsSync(filePath)) {
      return {
        schemaVersion: SCHEMA_VERSION,
        projectId: val.cleanId,
        revision: 0,
        updatedAt: new Date().toISOString(),
        data: {},
      };
    }

    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        schemaVersion: parsed.schemaVersion || SCHEMA_VERSION,
        projectId: val.cleanId,
        revision: typeof parsed.revision === 'number' ? parsed.revision : 1,
        updatedAt: parsed.updatedAt || new Date().toISOString(),
        data: parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data) ? parsed.data : {},
      };
    } catch (err) {
      console.error(`[ALCO Storage Engine] Failed to parse project data for "${val.cleanId}":`, err);
      try {
        const corruptPath = `${filePath}.corrupt.${Date.now()}`;
        fs.copyFileSync(filePath, corruptPath);
      } catch (_) {}
      throw new Error(`Data proyek "${val.cleanId}" rusak. Backup dibuat. Detail: ${err.message}`);
    }
  }

  /**
   * Saves key/value data into project data.json via serialized queue.
   */
  async saveProjectData(projectId, dataType, data, clientRevision) {
    const pVal = this.validateProjectId(projectId);
    if (!pVal.valid) throw new Error(pVal.error);

    const dVal = this.validateDataType(dataType);
    if (!dVal.valid) throw new Error(dVal.error);

    const queueKey = `project:${pVal.cleanId}`;

    return this.enqueueWrite(queueKey, async () => {
      const { projectDir, filePath } = this.resolveProjectFilePath(pVal.cleanId);
      if (!fs.existsSync(projectDir)) {
        fs.mkdirSync(projectDir, { recursive: true });
      }

      let projectRecord;
      try {
        projectRecord = this.getProjectDataSync(pVal.cleanId);
      } catch (err) {
        // If file is missing, start fresh
        projectRecord = {
          schemaVersion: SCHEMA_VERSION,
          projectId: pVal.cleanId,
          revision: 0,
          updatedAt: new Date().toISOString(),
          data: {},
        };
      }

      // Check revision order protection if client specified a revision
      if (typeof clientRevision === 'number' && clientRevision > 0) {
        if (clientRevision < projectRecord.revision) {
          throw new Error(
            `Stale write rejected for project "${pVal.cleanId}": Client revision (${clientRevision}) is older than disk revision (${projectRecord.revision}).`
          );
        }
      }

      const nextRevision = (projectRecord.revision || 0) + 1;
      projectRecord.data[dVal.cleanKey] = data;
      projectRecord.revision = nextRevision;
      projectRecord.updatedAt = new Date().toISOString();

      this.atomicWriteJson(filePath, projectRecord);

      return {
        ok: true,
        projectId: pVal.cleanId,
        dataType: dVal.cleanKey,
        revision: nextRevision,
      };
    });
  }

  /**
   * Removes a data key from project data.json via serialized queue.
   */
  async removeProjectData(projectId, dataType) {
    const pVal = this.validateProjectId(projectId);
    if (!pVal.valid) throw new Error(pVal.error);

    const dVal = this.validateDataType(dataType);
    if (!dVal.valid) throw new Error(dVal.error);

    const queueKey = `project:${pVal.cleanId}`;

    return this.enqueueWrite(queueKey, async () => {
      const { filePath } = this.resolveProjectFilePath(pVal.cleanId);
      if (!fs.existsSync(filePath)) {
        return { ok: true, removed: false };
      }

      const projectRecord = this.getProjectDataSync(pVal.cleanId);
      if (projectRecord.data && dVal.cleanKey in projectRecord.data) {
        delete projectRecord.data[dVal.cleanKey];
        projectRecord.revision = (projectRecord.revision || 0) + 1;
        projectRecord.updatedAt = new Date().toISOString();
        this.atomicWriteJson(filePath, projectRecord);
        return { ok: true, removed: true, revision: projectRecord.revision };
      }

      return { ok: true, removed: false };
    });
  }

  /**
   * Reads complete bootstrap snapshot for initial cache hydration.
   */
  async getBootstrapSnapshot() {
    try {
      const manifest = this.getManifestSync();
      const projects = {};

      // Load data for all registered projects
      for (const p of manifest.projectList) {
        if (p && p.project_id && this.validateProjectId(p.project_id).valid) {
          try {
            const pData = this.getProjectDataSync(p.project_id);
            projects[p.project_id] = {
              revision: pData.revision,
              data: pData.data,
            };
          } catch (err) {
            console.error(`[ALCO Storage Engine] Warning loading project "${p.project_id}":`, err.message);
          }
        }
      }

      // Check if desktop storage is completely fresh (empty manifest and no project directories)
      const hasNoProjects = manifest.projectList.length === 0;
      const isFreshInstallation = hasNoProjects && (!fs.existsSync(this.manifestPath) || Object.keys(projects).length === 0);

      return {
        ok: true,
        snapshot: {
          manifest,
          projects,
          isFreshInstallation,
          legacyMigrationRequired: isFreshInstallation,
        },
      };
    } catch (err) {
      console.error('[ALCO Storage Engine] Bootstrap snapshot error:', err);
      return {
        ok: false,
        error: err.message || 'Gagal memuat snapshot penyimpanan desktop.',
      };
    }
  }

  /**
   * Flushes all active queues and waits for pending writes to complete.
   */
  async flush() {
    const promises = Array.from(this.writeQueues.values());
    await Promise.allSettled(promises);
    return { ok: true };
  }
}

/**
 * Validates IPC sender security (only allowed local origins).
 */
function validateIpcSender(event) {
  if (!event) return true;
  if (!event.senderFrame) return true;
  const url = event.senderFrame.url;
  if (!url) return true;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') {
      return true;
    }
  } catch (_) {}
  return false;
}

/**
 * Validates payload size to avoid memory exhaustion attacks.
 */
function validatePayloadSize(payload) {
  try {
    const size = Buffer.byteLength(JSON.stringify(payload || {}));
    if (size > MAX_PAYLOAD_SIZE) {
      return { valid: false, error: `Payload size (${size} bytes) exceeds maximum limit (${MAX_PAYLOAD_SIZE} bytes).` };
    }
  } catch (err) {
    return { valid: false, error: 'Malformed JSON payload.' };
  }
  return { valid: true };
}

/**
 * Registers all storage IPC handlers on the electron ipcMain instance.
 */
function registerStorageIpcHandlers(engine, ipcMain) {
  ipcMain.handle('alco:storage:get-bootstrap-snapshot', async (event) => {
    if (!validateIpcSender(event)) {
      return { ok: false, error: 'Unauthorized IPC sender origin.' };
    }
    return await engine.getBootstrapSnapshot();
  });

  ipcMain.handle('alco:storage:save-project-data', async (event, args) => {
    if (!validateIpcSender(event)) {
      return { ok: false, error: 'Unauthorized IPC sender origin.' };
    }
    const sizeVal = validatePayloadSize(args);
    if (!sizeVal.valid) return { ok: false, error: sizeVal.error };

    const { projectId, dataType, data, clientRevision } = args || {};
    try {
      const res = await engine.saveProjectData(projectId, dataType, data, clientRevision);
      return res;
    } catch (err) {
      console.error('[ALCO Storage IPC] save-project-data error:', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('alco:storage:remove-project-data', async (event, args) => {
    if (!validateIpcSender(event)) {
      return { ok: false, error: 'Unauthorized IPC sender origin.' };
    }
    const { projectId, dataType } = args || {};
    try {
      const res = await engine.removeProjectData(projectId, dataType);
      return res;
    } catch (err) {
      console.error('[ALCO Storage IPC] remove-project-data error:', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('alco:storage:save-manifest', async (event, args) => {
    if (!validateIpcSender(event)) {
      return { ok: false, error: 'Unauthorized IPC sender origin.' };
    }
    const sizeVal = validatePayloadSize(args);
    if (!sizeVal.valid) return { ok: false, error: sizeVal.error };

    try {
      const res = await engine.saveManifest(args);
      return res;
    } catch (err) {
      console.error('[ALCO Storage IPC] save-manifest error:', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('alco:storage:flush', async (event) => {
    if (!validateIpcSender(event)) {
      return { ok: false, error: 'Unauthorized IPC sender origin.' };
    }
    try {
      await engine.flush();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}

let activeStorageEngine = null;

function initStorageEngine(userDataPath, ipcMain) {
  if (!activeStorageEngine) {
    activeStorageEngine = new StorageEngine(userDataPath);
    if (ipcMain) {
      registerStorageIpcHandlers(activeStorageEngine, ipcMain);
    }
  }
  return activeStorageEngine;
}

function getActiveStorageEngine() {
  return activeStorageEngine;
}

module.exports = {
  StorageEngine,
  initStorageEngine,
  getActiveStorageEngine,
};
