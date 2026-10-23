/**
 * ALCO Content Engine v9 — Stage 3B: Hardened License Persistence Storage Engine
 * Manages atomic JSON license persistence in app.getPath('userData')/license/license.json
 * with robust error handling and hardened IPC security validation.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class LicenseStorageEngine {
  constructor(userDataPath) {
    if (!userDataPath || typeof userDataPath !== 'string') {
      throw new Error('LicenseStorageEngine requires a valid userDataPath string.');
    }
    this.userDataPath = userDataPath;
    this.licenseDir = path.join(userDataPath, 'license');
    this.licensePath = path.join(this.licenseDir, 'license.json');
    this.initDirectory();
  }

  initDirectory() {
    try {
      if (!fs.existsSync(this.licenseDir)) {
        fs.mkdirSync(this.licenseDir, { recursive: true });
      }
      this.cleanupDanglingTempFiles(this.licenseDir);
    } catch (err) {
      console.error('[ALCO License Storage] Directory init error:', err);
      throw err;
    }
  }

  cleanupDanglingTempFiles(dir) {
    try {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.name.includes('.tmp.')) {
          try { fs.unlinkSync(fullPath); } catch (_) {}
        }
      }
    } catch (err) {
      console.warn('[ALCO License Storage] Temp cleanup warning:', err.message);
    }
  }

  atomicWrite(data) {
    const dir = path.dirname(this.licensePath);
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (err) {
      return { ok: false, error: err.message };
    }

    const tempPath = `${this.licensePath}.tmp.${Date.now()}.${crypto.randomBytes(4).toString('hex')}`;
    const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

    try {
      fs.writeFileSync(tempPath, content, 'utf8');

      let renamed = false;
      let attempts = 0;
      while (!renamed && attempts < 5) {
        try {
          fs.renameSync(tempPath, this.licensePath);
          renamed = true;
        } catch (err) {
          attempts++;
          if (attempts >= 5) throw err;
          const waitUntil = Date.now() + 15;
          while (Date.now() < waitUntil) {}
        }
      }
      return { ok: true };
    } catch (err) {
      try {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch (_) {}
      return { ok: false, error: err.message };
    }
  }

  read() {
    try {
      if (!fs.existsSync(this.licensePath)) {
        return { ok: true, code: null };
      }
      const raw = fs.readFileSync(this.licensePath, 'utf8');
      if (!raw || !raw.trim()) {
        return { ok: true, code: null };
      }
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && typeof parsed.code === 'string' && parsed.code.trim()) {
          return { ok: true, code: parsed.code.trim() };
        }
        return { ok: false, error: 'Malformed license storage record: missing or invalid code field.' };
      } catch (parseErr) {
        return { ok: false, error: `Corrupt license storage file (JSON parse error): ${parseErr.message}` };
      }
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  save(code) {
    if (!code || typeof code !== 'string' || !code.trim()) {
      return { ok: false, error: 'Invalid license code for saving.' };
    }
    const trimmed = code.trim();
    const payload = { code: trimmed, updatedAt: new Date().toISOString() };
    return this.atomicWrite(payload);
  }

  remove() {
    try {
      if (fs.existsSync(this.licensePath)) {
        fs.unlinkSync(this.licensePath);
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
}

/**
 * Hardened IPC sender validation for license storage.
 * Authorizes only legitimate application renderer expected origins.
 */
function validateLicenseIpcSender(event) {
  if (!event || !event.senderFrame) return false;
  const url = event.senderFrame.url;
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'file:' || parsed.protocol === 'app:' || parsed.protocol === 'devtools:') {
      return true;
    }
    if (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') {
      const port = parsed.port ? parseInt(parsed.port, 10) : 80;
      if (port === 3000 || port === 3102 || (port >= 3000 && port <= 3150)) {
        return true;
      }
    }
  } catch (_) {}
  return false;
}

let activeLicenseStorage = null;

function initLicenseStorage(userDataPath, ipcMain) {
  if (!activeLicenseStorage) {
    activeLicenseStorage = new LicenseStorageEngine(userDataPath);
    if (ipcMain) {
      registerLicenseIpcHandlers(activeLicenseStorage, ipcMain);
    }
  }
  return activeLicenseStorage;
}

function getActiveLicenseStorage() {
  return activeLicenseStorage;
}

function registerLicenseIpcHandlers(engine, ipcMain) {
  ipcMain.handle('alco:license:read', async (event) => {
    if (!validateLicenseIpcSender(event)) {
      return { ok: false, error: 'Unauthorized IPC sender origin.' };
    }
    return engine.read();
  });

  ipcMain.handle('alco:license:save', async (event, args) => {
    if (!validateLicenseIpcSender(event)) {
      return { ok: false, error: 'Unauthorized IPC sender origin.' };
    }
    const { code } = args || {};
    return engine.save(code);
  });

  ipcMain.handle('alco:license:remove', async (event) => {
    if (!validateLicenseIpcSender(event)) {
      return { ok: false, error: 'Unauthorized IPC sender origin.' };
    }
    return engine.remove();
  });
}

module.exports = {
  LicenseStorageEngine,
  initLicenseStorage,
  getActiveLicenseStorage,
  validateLicenseIpcSender,
};
