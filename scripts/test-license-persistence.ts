import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import ts from 'typescript';

// Runs production modules/callbacks with isolated Electron, React hooks and IO boundaries.
// This is not an installed Electron or React DOM test. Crypto tests use a test-only keypair.
const root = process.cwd();
const nativeRequire = createRequire(path.join(root, 'package.json'));
const storageModule = nativeRequire('./electron/license-storage.cjs');
const { LicenseStorageEngine, validateLicenseIpcSender } = storageModule;
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'alco-license-regression-'));
const device = 'ALCO-DEV-AAAA-BBBB-CCCC';
const payload = { licenseVersion: '1.0', licenseId: 'fixture', appId: 'alco-content-engine', deviceId: device, customerId: 'fixture', plan: 'pro', licenseType: 'lifetime', features: [], issuedAt: '2026-01-01T00:00:00Z', expiresAt: null };
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const canonical = (v: any): string => v === null || typeof v !== 'object' ? JSON.stringify(v) : Array.isArray(v) ? `[${v.map(canonical).join(',')}]` : `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
const code = `ALCO-LIC-v1.${Buffer.from(canonical(payload)).toString('base64url')}.${crypto.sign(null, Buffer.from(canonical(payload)), privateKey).toString('hex')}`;
let passed = 0;
async function test(name: string, fn: () => any) { await fn(); passed++; console.log(`PASS ${passed}: ${name}`); }
function loader(globals: any = {}, overrides: Record<string, any> = {}) {
  const cache = new Map<string, any>();
  function load(file: string): any {
    const absolute = path.resolve(root, file);
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const module = { exports: {} as any }; cache.set(absolute, module);
    const source = fs.readFileSync(absolute, 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
    const req = (name: string): any => {
      if (name in overrides) return overrides[name];
      if (name.startsWith('.')) {
        const resolved = path.resolve(path.dirname(absolute), name);
        return load([resolved, `${resolved}.ts`, `${resolved}.tsx`, `${resolved}.cjs`].find(p => fs.existsSync(p) && fs.statSync(p).isFile())!);
      }
      return nativeRequire(name);
    };
    vm.runInNewContext(js, { module, exports: module.exports, require: req, Buffer, URL, TextEncoder, console: { ...console, error() {}, warn() {} }, process, ...globals }, { filename: absolute });
    return module.exports;
  }
  return load;
}
const authority = { ALCO_APP_ID: 'alco-content-engine', ALCO_AUTHORITY_PUBLIC_KEY_SPKI: publicKey.export({ type: 'spki', format: 'pem' }) };
function environment(options: any = {}) {
  const engine = options.engine || new LicenseStorageEngine(fs.mkdtempSync(path.join(temp, 'provider-')));
  const data = new Map<string, string>(options.legacy ? [['alco_license_code_v2', options.legacy]] : []);
  let reads = 0, saves = 0;
  const bridge = { isElectron: true, getDeviceId: async () => { if (options.deviceError) throw new Error('device unavailable'); return options.device || device; }, readLicense: async () => { reads++; return options.readError ? { ok: false, status: 'error' } : engine.read(); }, saveLicense: async (c: string) => { saves++; return options.saveError ? { ok: false, error: 'write denied' } : engine.save(c); }, removeLicense: async () => options.removeError ? { ok: false, error: 'write denied' } : engine.remove() };
  const window: any = { navigator: { userAgent: options.browser ? 'Browser' : 'Electron/44.1.1' }, location: { hostname: 'preview' }, localStorage: { getItem: (k: string) => data.get(k) || null, setItem: (k: string, v: string) => data.set(k, v), removeItem: (k: string) => data.delete(k) } };
  if (!options.noBridge && !options.browser) window.alcoBridge = options.missingIpc ? { isElectron: true, getDeviceId: bridge.getDeviceId } : bridge;
  let slots: any[] = [], index = 0, effects: Function[] = [], value: any;
  const react = { createContext: () => ({ Provider: 'Provider' }), useState: (initial: any) => { const i = index++; if (!(i in slots)) slots[i] = initial; return [slots[i], (v: any) => slots[i] = typeof v === 'function' ? v(slots[i]) : v]; }, useRef: (initial: any) => { const i = index++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; }, useCallback: (f: any) => f, useMemo: (f: any) => f(), useEffect: (f: any) => effects.push(f), createElement: (_: any, props: any) => { value = props.value; return null; } };
  const load = loader({ window, fetch: options.fetch || (async () => { throw new Error('offline'); }) }, { react, './authority-key': authority, ...(options.verify ? { './verification': { verifyLicenseCode: options.verify } } : {}) });
  const provider = load('lib/license/license-context.tsx').LicenseProvider;
  const render = () => { index = 0; effects = []; provider({ children: null }); };
  const flush = async () => { await new Promise(resolve => setImmediate(resolve)); render(); };
  return { engine, data, window, load, get value() { render(); return value; }, get reads() { return reads; }, get saves() { return saves; }, async start() { slots = []; render(); effects[0](); await flush(); }, flush };
}
const active = async () => ({ valid: true, status: 'active', license: payload });
async function run() {
  await test('native file survives new engine instance without rewriting existing code', () => { const e = new LicenseStorageEngine(path.join(temp, 'persist')); assert.equal(e.save(code).ok, true); assert.equal(new LicenseStorageEngine(e.userDataPath).read().code, code); });
  await test('legacy migration executes provider verification and persists before activation', async () => { const e = environment({ legacy: code, verify: active }); await e.start(); assert.equal(e.value.state.status, 'active'); assert.equal(e.saves, 1); assert.equal(e.engine.read().code, code); assert.equal(e.data.get('alco_license_code_v2'), code); });
  await test('native license takes precedence over conflicting legacy', async () => { const e = environment({ legacy: 'bad legacy', verify: async (c: string) => { assert.equal(c, code); return active(); } }); e.engine.save(code); await e.start(); assert.equal(e.value.state.status, 'active'); assert.equal(e.saves, 0); });
  for (const raw of ['', '{ broken']) await test(`corrupt native (${raw ? 'JSON' : 'empty'}) blocks migration and preserves bytes`, async () => { const e = environment({ legacy: code, verify: active }); fs.writeFileSync(e.engine.licensePath, raw); await e.start(); assert.equal(e.value.state.status, 'invalid'); assert.equal(e.saves, 0); assert.equal(fs.readFileSync(e.engine.licensePath, 'utf8'), raw); });
  await test('native read failure blocks legacy fallback', async () => { const e = environment({ legacy: code, readError: true, verify: active }); await e.start(); assert.equal(e.value.state.status, 'invalid'); assert.equal(e.saves, 0); });
  await test('migration write failure stays invalid, including reverification', async () => { const e = environment({ legacy: code, saveError: true, verify: active }); await e.start(); assert.equal(e.value.state.status, 'invalid'); const r = await e.value.reverifyLicense(); assert.equal(r.status, 'storage_error'); assert.equal(e.value.state.status, 'invalid'); });
  await test('missing license IPC fails closed', async () => { const e = environment({ legacy: code, missingIpc: true, verify: active }); await e.start(); assert.equal(e.value.state.status, 'invalid'); assert.equal(e.saves, 0); });
  await test('failed deactivation preserves active state and persisted code', async () => { const e = environment({ removeError: true, verify: active }); e.engine.save(code); await e.start(); await e.value.deactivateLicense(); assert.equal(e.value.state.status, 'active'); assert.equal(e.engine.read().code, code); });
  await test('deactivation survives provider restart despite retained legacy and blocked localStorage cleanup', async () => { const e = environment({ legacy: code, verify: active }); await e.start(); e.window.localStorage.removeItem = () => { throw new Error('blocked'); }; await e.value.deactivateLicense(); assert.equal(e.value.state.status, 'unlicensed'); assert.equal(new LicenseStorageEngine(e.engine.userDataPath).read().status, 'deactivated'); await e.start(); assert.equal(e.value.state.status, 'unlicensed'); assert.equal(e.saves, 1); });
  await test('explicit activation replaces tombstone', async () => { const e = environment({ verify: active }); e.engine.remove(); await e.start(); assert.equal((await e.value.activateLicense(code)).valid, true); assert.equal(e.engine.read().code, code); });
  await test('native Device ID failure blocks activation without writing', async () => { const e = environment({ deviceError: true, verify: active }); await e.start(); assert.equal((await e.value.activateLicense(code)).valid, false); assert.equal(e.value.state.status, 'invalid'); assert.equal(e.saves, 0); });
  await test('entire missing Electron preload cannot use cached browser identity or license', async () => { const e = environment({ noBridge: true, legacy: code, verify: active }); e.data.set('alco_device_id_v2', device); await e.start(); assert.equal(e.value.state.status, 'invalid'); assert.equal((await e.value.activateLicense(code)).valid, false); assert.equal(e.data.get('alco_license_code_v2'), code); assert.equal(e.load('lib/license/device-fingerprint.ts').getCachedAlcoDeviceId(), ''); });
  await test('browser preview runs real provider storage/activation/restart/deactivation', async () => { const e = environment({ browser: true, verify: active }); await e.start(); assert.equal((await e.value.activateLicense(code)).valid, true); assert.equal(e.data.get('alco_license_code_v2'), code); await e.start(); assert.equal(e.value.state.status, 'active'); await e.value.deactivateLicense(); await e.start(); assert.equal(e.value.state.status, 'unlicensed'); });
  for (const port of [3102, 3000, 3004, 43719]) await test(`all IPC handlers accept trusted main frame on active port ${port}`, async () => {
    const handlers = new Map<string, Function>(); const frame = { url: `http://127.0.0.1:${port}/path` }; const wc = { mainFrame: frame }; const ctx = { getMainWindow: () => ({ isDestroyed: () => false, webContents: wc }), getActivePort: () => port };
    const isolated = loader()('electron/license-storage.cjs'); isolated.initLicenseStorage(fs.mkdtempSync(path.join(temp, 'ipc-')), { handle: (k: string, f: Function) => handlers.set(k, f) }, ctx);
    const event = { sender: wc, senderFrame: frame }; assert.equal((await handlers.get('alco:license:save')!(event, { code })).ok, true); assert.equal((await handlers.get('alco:license:read')!(event)).code, code); assert.equal((await handlers.get('alco:license:remove')!(event)).ok, true);
  });
  for (const url of ['http://127.0.0.1:9999/', 'http://127.0.0.1:3000/', 'https://127.0.0.1:3004/', 'http://localhost:3004/', 'https://untrusted.example/', 'file:///C:/bad.html', 'app://bad/', 'devtools://devtools/', 'garbage']) await test(`reject navigated main frame: ${url}`, () => { const frame = { url }; const wc = { mainFrame: frame, getURL: () => url }; assert.equal(validateLicenseIpcSender({ sender: wc, senderFrame: frame }, { getMainWindow: () => ({ isDestroyed: () => false, webContents: wc }), getActivePort: () => 3004 }), false); });
  await test('reject subframe, foreign contents, absent frame/window, destroyed window and missing port', () => {
    const frame = { url: 'http://127.0.0.1:3004/' }; const wc: any = { mainFrame: frame }; const win = { isDestroyed: () => false, webContents: wc }; const ctx = { getMainWindow: () => win, getActivePort: () => 3004 };
    assert.equal(validateLicenseIpcSender({ sender: wc, senderFrame: { ...frame } }, ctx), false);
    assert.equal(validateLicenseIpcSender({ sender: {}, senderFrame: frame }, ctx), false);
    for (const context of [{ ...ctx, getMainWindow: () => null }, { ...ctx, getMainWindow: () => ({ ...win, isDestroyed: () => true }) }, { ...ctx, getActivePort: () => null }]) assert.equal(validateLicenseIpcSender({ sender: wc, senderFrame: frame }, context), false);
    delete wc.mainFrame; assert.equal(validateLicenseIpcSender({ sender: wc, senderFrame: frame }, ctx), false);
  });
  await test('unauthorized IPC cannot read/write/remove persisted data', async () => { const handlers = new Map<string, Function>(); const isolated = loader()('electron/license-storage.cjs'); const e = isolated.initLicenseStorage(fs.mkdtempSync(path.join(temp, 'denied-')), { handle: (k: string, f: Function) => handlers.set(k, f) }, { getMainWindow: () => null }); e.save(code); for (const handler of handlers.values()) assert.equal((await handler({}, { code: 'overwrite' })).ok, false); assert.equal(e.read().code, code); });
  const verify = loader({}, { './authority-key': authority })('lib/license/verification.ts').verifyLicenseCode;
  await test('real Ed25519 signed fixture is accepted using isolated test authority', async () => { assert.equal((await verify(code, device)).status, 'active'); });
  await test('Device ID mismatch rejected by production verifier', async () => { assert.equal((await verify(code, 'ALCO-DEV-DDDD-EEEE-FFFF')).status, 'device_mismatch'); });
  await test('well-formed tampered Ed25519 signature rejected cryptographically', async () => { const parts = code.split('.'); parts[2] = (parts[2][0] === '0' ? '1' : '0') + parts[2].slice(1); assert.equal((await verify(parts.join('.'), device)).status, 'invalid_signature'); });
  await test('provider reverification catches thrown verification errors and invalidates state', async () => { let fail = false; const e = environment({ verify: async () => { if (fail) throw new Error('fixture exception'); return active(); } }); e.engine.save(code); await e.start(); fail = true; assert.equal((await e.value.reverifyLicense()).status, 'verification_error'); assert.equal(e.value.state.status, 'invalid'); assert.equal(e.engine.read().code, code); });
  await test('API offline, HTTP failure, malformed JSON and unexpected success all fail closed', async () => {
    for (const fetch of [async () => { throw new Error('offline'); }, async () => ({ ok: false }), async () => ({ ok: true, json: async () => { throw new Error('bad JSON'); } }), async () => ({ ok: true, json: async () => ({ valid: true, status: 'active' }) })]) {
      const v = loader({ window: {}, fetch }, { './authority-key': authority })('lib/license/verification.ts').verifyLicenseCode;
      assert.equal((await v(code, device)).status, 'verification_error');
    }
  });
  await test('failed atomic tombstone write retains existing native license', () => { const e = new LicenseStorageEngine(path.join(temp, 'atomic')); e.save(code); const write = fs.writeFileSync; try { fs.writeFileSync = (() => { throw new Error('write denied'); }) as any; assert.equal(e.remove().ok, false); } finally { fs.writeFileSync = write; } assert.equal(e.read().code, code); });
  await test('Windows MachineGuid formula stays stable; registry failure never falls back', () => {
    for (const fail of [false, true]) {
      const handlers = new Map<string, Function>();
      const main = loader({ process: { ...process, platform: 'win32' } }, { electron: { ipcMain: { handle: (k: string, fn: Function) => handlers.set(k, fn) } }, child_process: { execSync: () => { if (fail) throw new Error('registry denied'); return 'MachineGuid REG_SZ {ABCDEF12-3456-7890-ABCD-EF1234567890}'; } } })('electron/main.cjs');
      if (fail) assert.throws(() => main.getAlcoProductionDeviceId(), /MachineGuid unavailable/);
      else { const h = crypto.createHash('sha256').update('alco:contentengine:device::win::abcdef12-3456-7890-abcd-ef1234567890').digest('hex').slice(0, 12).toUpperCase(); assert.equal(main.getAlcoProductionDeviceId(), `ALCO-DEV-${h.slice(0,4)}-${h.slice(4,8)}-${h.slice(8,12)}`); }
      assert.ok(handlers.has('alco:get-device-id'));
    }
  });
  await test('Device ID IPC rejects absent trusted mainWindow', async () => { const handlers = new Map<string, Function>(); loader({}, { electron: { ipcMain: { handle: (k: string, fn: Function) => handlers.set(k, fn) } } })('electron/main.cjs'); await assert.rejects(handlers.get('alco:get-device-id')!({}), /Unauthorized/); });
  await test('activation storage failure cannot replace an existing native license', async () => {
    const e = environment({ saveError: true, verify: active }); e.engine.save(code); await e.start();
    assert.equal((await e.value.activateLicense('new fixture code')).status, 'storage_error');
    assert.equal(e.engine.read().code, code); assert.equal(e.value.state.status, 'invalid');
  });
  await test('concurrent activation/deactivation/reverification cannot resurrect or overwrite license', async () => {
    let release!: Function;
    let pending = false;
    const e = environment({ verify: async () => pending ? new Promise(resolve => { release = () => resolve(active()); }) : active() });
    e.engine.save(code); await e.start(); pending = true;
    const reverify = e.value.reverifyLicense(); await new Promise(resolve => setImmediate(resolve));
    assert.equal((await e.value.activateLicense('replacement')).status, 'verification_error');
    await e.value.deactivateLicense(); assert.match(e.value.state.error, /pending/);
    release(); await reverify; await e.value.deactivateLicense();
    assert.equal(e.value.state.status, 'unlicensed'); await e.start(); assert.equal(e.value.state.status, 'unlicensed');
  });
  await test('native license corruption during reverification fails closed without rewriting data', async () => {
    const e = environment({ verify: active }); e.engine.save(code); await e.start();
    fs.writeFileSync(e.engine.licensePath, '{corrupt');
    assert.equal((await e.value.reverifyLicense()).status, 'storage_error');
    assert.equal(e.value.state.status, 'invalid'); assert.equal(fs.readFileSync(e.engine.licensePath, 'utf8'), '{corrupt');
  });
  await test('atomic rename failure preserves previous record and cleans temporary files', () => {
    const e = new LicenseStorageEngine(path.join(temp, 'rename')); e.save(code); const rename = fs.renameSync;
    try { fs.renameSync = (() => { throw new Error('rename denied'); }) as any; assert.equal(e.remove().ok, false); }
    finally { fs.renameSync = rename; }
    assert.equal(e.read().code, code); assert.deepEqual(fs.readdirSync(e.licenseDir), ['license.json']);
  });
  await test('crypto infrastructure failure is not reported as invalid signature', async () => {
    const v = loader({}, { './authority-key': authority, crypto: { ...crypto, createPublicKey: () => { throw new Error('crypto unavailable'); } } })('lib/license/verification.ts').verifyLicenseCode;
    assert.equal((await v(code, device)).status, 'verification_error');
  });
  await test('malformed Windows registry identity is rejected without alternate identity', () => {
    const main = loader({ process: { ...process, platform: 'win32' } }, { electron: {}, child_process: { execSync: () => 'MachineGuid REG_SZ invalid' } })('electron/main.cjs');
    assert.throws(() => main.getAlcoProductionDeviceId(), /MachineGuid unavailable/);
  });
  await test('API route verifies signed fixtures and rejects cryptographic tampering', async () => {
    const verifyModule = loader({}, { './authority-key': authority })('lib/license/verification.ts');
    const route = loader({}, {
      'next/server': { NextResponse: { json: (body: any, options: any) => ({ body, status: options.status }) } },
      '@/lib/license/authority-key': authority,
      '@/lib/license/verification': verifyModule,
      '@/lib/license/canonical': loader()('lib/license/canonical.ts'),
    })('app/api/license/verify/route.ts');
    const good = await route.POST({ json: async () => ({ rawLicenseCode: code, expectedDeviceId: device }) });
    assert.equal(good.body.status, 'active');
    const parts = code.split('.'); parts[2] = '0'.repeat(128);
    const bad = await route.POST({ json: async () => ({ rawLicenseCode: parts.join('.'), expectedDeviceId: device }) });
    assert.equal(bad.body.status, 'invalid_signature');
    const failed = await route.POST({ json: async () => { throw new Error('sensitive fixture details'); } });
    assert.equal(failed.status, 500); assert.equal(failed.body.status, 'verification_error');
    assert.equal(failed.body.error.includes('sensitive fixture details'), false);
  });
  await test('valid API response activates through production browser verifier', async () => {
    const v = loader({ window: {}, fetch: async () => ({ ok: true, json: async () => ({ valid: true, status: 'active', license: payload }) }) }, { './authority-key': authority })('lib/license/verification.ts').verifyLicenseCode;
    assert.equal((await v(code, device)).status, 'active');
  });
  console.log(`${passed} behavioral regression tests passed. Test-only authority; no customer license or installed Electron exercised.`);
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => fs.rmSync(temp, { recursive: true, force: true }));
