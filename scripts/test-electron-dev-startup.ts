import assert from 'node:assert/strict';
import * as http from 'node:http';
import fs from 'node:fs';
const { checkDevServerDetailed, waitForDevServer, connectDevelopmentServer } = require('../electron/main.cjs');

const healthy = { status: 'ok', app: 'alco-content-engine' };
let passed = 0;
async function test(name: string, fn: () => Promise<void> | void) {
  await fn();
  console.log(`PASS ${++passed}: ${name}`);
}
async function withServer(handler: http.RequestListener, run: (port: number) => Promise<void>) {
  const server = http.createServer(handler);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await run((server.address() as { port: number }).port); }
  finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
}
async function run() {
  await test('valid application responds to GET /api/health only', async () => {
    const requests: string[] = [];
    await withServer((req, res) => { requests.push(`${req.method} ${req.url}`); res.end(JSON.stringify(healthy)); }, async port => {
      assert.equal((await checkDevServerDetailed(port, 1000)).success, true);
      assert.equal(await waitForDevServer(port, 1000, 20), port);
    });
    assert.deepEqual(requests, ['GET /api/health', 'GET /api/health']);
  });
  await test('cold compilation longer than old 2-second request limit completes in one request', async () => {
    let count = 0;
    await withServer((req, res) => {
      count++; assert.equal(req.method, 'GET'); assert.equal(req.url, '/api/health');
      const timer = setTimeout(() => res.end(JSON.stringify(healthy)), 2400);
      res.on('close', () => clearTimeout(timer));
    }, async port => { assert.equal(await waitForDevServer(port, 5000, 20), port); });
    assert.equal(count, 1);
  });
  await test('503 compilation retry uses serial capped backoff without overlapping requests', async () => {
    let count = 0, active = 0, maxActive = 0;
    const times: number[] = [];
    await withServer((_req, res) => {
      count++; times.push(Date.now()); active++; maxActive = Math.max(maxActive, active);
      res.on('close', () => { active--; });
      const attempt = count;
      setTimeout(() => { res.statusCode = attempt < 3 ? 503 : 200; res.end(JSON.stringify(healthy)); }, 40);
    }, async port => { assert.equal(await waitForDevServer(port, 2000, 60), port); });
    assert.equal(count, 3); assert.equal(maxActive, 1);
    assert.ok(times[1] - times[0] >= 80); assert.ok(times[2] - times[1] >= 140);
  });
  for (const [body, status, error] of [
    [JSON.stringify({ status: 'ok', app: 'another-app' }), 200, 'Invalid app identity'],
    ['not json', 200, 'Non-JSON'],
    [JSON.stringify(healthy), 503, 'HTTP status 503'],
    [JSON.stringify(healthy), 302, 'HTTP status 302'],
  ] as const) await test(`reject incorrect health response: ${error}`, async () => {
    await withServer((_req, res) => { res.statusCode = status; res.end(body); }, async port => {
      const result = await checkDevServerDetailed(port, 1000);
      assert.equal(result.success, false); assert.ok(result.error.includes(error));
    });
  });
  await test('unresponsive server respects total deadline with no extra request or full retry sleep', async () => {
    let count = 0;
    await withServer(() => { count++; }, async port => {
      const started = Date.now();
      await assert.rejects(waitForDevServer(port, 180, 1000), /ETIMEDOUT/);
      const elapsed = Date.now() - started;
      assert.ok(elapsed >= 150 && elapsed < 1000, `elapsed=${elapsed}`);
    });
    assert.equal(count, 1);
  });
  await test('trickle response cannot extend absolute health deadline', async () => {
    await withServer((_req, res) => {
      res.writeHead(200); const timer = setInterval(() => res.write(' '), 20);
      res.on('close', () => clearInterval(timer));
    }, async port => {
      const started = Date.now();
      assert.equal((await checkDevServerDetailed(port, 180)).error, 'ETIMEDOUT');
      assert.ok(Date.now() - started < 1000);
    });
  });
  await test('aborted response returns controlled failure rather than hanging', async () => {
    await withServer((_req, res) => { res.writeHead(200); res.write('{'); setTimeout(() => res.destroy(), 20); }, async port => {
      const result = await checkDevServerDetailed(port, 1000);
      assert.equal(result.success, false); assert.match(result.error, /aborted|stream/i);
    });
  });
  await test('unreachable port reports target and last network error within bounded deadline', async () => {
    let closedPort = 0;
    await withServer((_req, res) => res.end(), async port => { closedPort = port; });
    const started = Date.now();
    await assert.rejects(waitForDevServer(closedPort, 220, 40), (err: Error) => {
      assert.ok(err.message.includes(`port ${closedPort}`)); assert.match(err.message, /ECONNREFUSED/); return true;
    });
    assert.ok(Date.now() - started < 1000);
  });
  await test('configured development port is used explicitly', async () => {
    const previous = process.env.ALCO_DEV_PORT;
    try {
      await withServer((_req, res) => res.end(JSON.stringify(healthy)), async port => {
        process.env.ALCO_DEV_PORT = String(port);
        assert.equal(await connectDevelopmentServer(), port);
      });
      process.env.ALCO_DEV_PORT = 'invalid';
      await assert.rejects(connectDevelopmentServer(), /ALCO_DEV_PORT/);
    } finally { if (previous === undefined) delete process.env.ALCO_DEV_PORT; else process.env.ALCO_DEV_PORT = previous; }
  });
  await test('infinite or nonpositive readiness budgets are rejected', async () => {
    for (const timeout of [Infinity, 0, -1, NaN]) await assert.rejects(waitForDevServer(3102, timeout, 20), /finite and positive/);
  });
  // Configuration/source checks are separate from the HTTP behavior tests above.
  await test('launch configuration has one readiness owner and production remains separate (source check)', () => {
    const command = JSON.parse(fs.readFileSync('package.json', 'utf8')).scripts['desktop:dev'];
    assert.ok(!command.includes('wait-on')); assert.ok(command.includes('ALCO_DEV_PORT=3102'));
    assert.ok(command.includes('--kill-others'));
    const source = fs.readFileSync('electron/main.cjs', 'utf8');
    assert.match(source, /if \(isDev\) \{[\s\S]*?port = await connectDevelopmentServer\(\);[\s\S]*?\} else \{\s*port = await startProductionServer\(\);/);
    assert.ok(!source.includes('Trying port 3000'));
  });
  await test('theme IPC rejects invalid senders/payloads before mutating native theme', async () => {
    const vm = require('node:vm');
    const handlers = new Map<string, Function>();
    let changes = 0;
    const nativeTheme = { shouldUseDarkColors: false, on() {}, set themeSource(_value: string) { changes++; } };
    const sandboxModule = { exports: {} as any };
    const source = fs.readFileSync('electron/main.cjs', 'utf8');
    vm.runInNewContext(source + '\nmodule.exports.setTestContext = (win, port) => { mainWindow = win; activePort = port; };', {
      module: sandboxModule, require: (name: string) => name === 'electron' ? { nativeTheme, ipcMain: { handle: (key: string, fn: Function) => handlers.set(key, fn) } }
        : name.startsWith('./') ? require('../electron/' + name.slice(2)) : require(name),
      __dirname: require('node:path').resolve('electron'), process, console, URL, setTimeout, clearTimeout,
    });
    const handler = handlers.get('alco:set-theme')!;
    const frame = { url: 'http://127.0.0.1:3102/' };
    const contents = { mainFrame: frame };
    const win = { isDestroyed: () => false, webContents: contents, setTitleBarOverlay() {} };
    const event = { sender: contents, senderFrame: frame };
    for (const context of [null, { ...win, isDestroyed: () => true }]) {
      sandboxModule.exports.setTestContext(context, 3102);
      assert.equal((await handler(event, { theme: 'dark' })).ok, false);
    }
    sandboxModule.exports.setTestContext(win, 3102);
    for (const sender of [{}, { ...event, sender: {} }, { ...event, senderFrame: { ...frame } }]) {
      assert.equal((await handler(sender, { theme: 'dark' })).ok, false);
    }
    frame.url = 'https://untrusted.example/';
    assert.equal((await handler(event, { theme: 'dark' })).ok, false);
    frame.url = 'http://127.0.0.1:3102/';
    for (const args of [undefined, null, 'dark', [], {}, { theme: 'invalid' }, { theme: null }, { theme: 'dark', extra: true }]) {
      assert.equal((await handler(event, args)).ok, false);
    }
    assert.equal(changes, 0);
    for (const theme of ['light', 'dark', 'system']) assert.equal((await handler(event, { theme })).ok, true);
    assert.equal(changes, 3);
  });
  console.log(`${passed} startup checks passed (loopback HTTP fixtures and explicit source checks; no installed Electron launch).`);
}
run().catch(error => { console.error(error); process.exitCode = 1; });
