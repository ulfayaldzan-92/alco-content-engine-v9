/**
 * ALCO Content Engine v9 — Stage 3C: Final Hardened License Persistence Storage Engine
 * Manages atomic JSON license persistence in app.getPath('userData')/license/license.json
 * with precise status classification (missing, valid, corrupt, error) and strict IPC authorization.
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

  /**
   * Reads and classifies storage outcomes with explicit distinction:
   * - missing: file does not exist
   * - valid: valid JSON structure containing a nonempty license code
   * - corrupt: empty file, invalid JSON, missing code, or invalid structure
   * - error: file permission or filesystem failure
   */
  read() {
    try {
      if (!fs.existsSync(this.licensePath)) {
        return { status: 'missing', ok: true, code: null };
      }
      const raw = fs.readFileSync(this.licensePath, 'utf8');
      if (!raw || !raw.trim()) {
        return { status: 'corrupt', ok: false, error: 'License file is empty.' };
      }
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && typeof parsed.code === 'string' && parsed.code.trim()) {
          return { status: 'valid', ok: true, code: parsed.code.trim() };
        }
        return { status: 'corrupt', ok: false, error: 'Malformed license storage record: missing or invalid code field.' };
      } catch (parseErr) {
        return { status: 'corrupt', ok: false, error: `Corrupt license storage file (JSON parse error): ${parseErr.message}` };
      }
    } catch (err) {
      return { status: 'error', ok: false, error: err.message };
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
 * Validates IPC sender identity against the trusted main application window and strict origin whitelist.
 */
function validateLicenseIpcSender(event, mainWindow) {
  if (!event || !event.senderFrame || !event.sender) return false;

  // Compare sender with trusted main application window webContents if available
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (event.sender !== mainWindow.webContents) {
      return false;
    }
  }

  const url = event.senderFrame.url;
  if (!url) return false;

  try {
    const parsed = new URL(url);
    const origin = parsed.origin;

    const isPackaged = typeof app !== 'undefined' && app.isPackaged;
    if (isPackaged || parsed.protocol === 'file:' || parsed.protocol === 'app:') {
      if (parsed.protocol === 'devtools:' || parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return false;
      }
      return true;
    }

    // Strict development mode whitelist (only exact application ports)
    const allowedDevOrigins = [
      'http://127.0.0.1:3102',
      'http://localhost:3102',
      'http://127.0.0.1:3000',
      'http://localhost:3000',
    ];

    if (allowedDevOrigins.includes(origin)) {
      return true;
    }
  } catch (_) {}

  return false;
}

let activeLicenseStorage = null;

function initLicenseStorage(userDataPath, ipcMain, getMainWindow) {
  if (!activeLicenseStorage) {
    activeLicenseStorage = new LicenseStorageEngine(userDataPath);
    if (ipcMain) {
      registerLicenseIpcHandlers(activeLicenseStorage, ipcMain, getMainWindow);
    }
  }
  return activeLicenseStorage;
}

function getActiveLicenseStorage() {
  return activeLicenseStorage;
}

function registerLicenseIpcHandlers(engine, ipcMain, getMainWindow) {
  ipcMain.handle('alco:license:read', async (event) => {
    const mainWindow = typeof getMainWindow === 'function' ? getMainWindow() : null;
    if (!validateLicenseIpcSender(event, mainWindow)) {
      return { ok: false, error: 'Unauthorized IPC sender origin.' };
    }
    return engine.read();
  });

  ipcMain.handle('alco:license:save', async (event, args) => {
    const mainWindow = typeof getMainWindow === 'function' ? getMainWindow() : null;
    if (!validateLicenseIpcSender(event, mainWindow)) {
      return { ok: false, error: 'Unauthorized IPC sender origin.' };
    }
    const { code } = args || {};
    return engine.save(code);
  });

  ipcMain.handle('alco:license:remove', async (event) => {
    const mainWindow = typeof getMainWindow === 'function' ? getMainWindow() : null;
    if (!validateLicenseIpcSender(event, mainWindow)) {
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
