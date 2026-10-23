/**
 * ALCO Content Engine v9 — Electron Dev Server Startup Detection Test Suite
 *
 * Verifies:
 * 1. Successful development server connection.
 * 2. Slow development server response (compilation delay / polling success).
 * 3. Unreachable development server (timeout/retry failure, clear diagnostics).
 * 4. No production fallback in development mode.
 */

import * as http from 'http';
const { checkDevServerDetailed, waitForDevServer } = require('../electron/main.cjs');

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ [PASS] ${message}`);
}

async function runTests() {
  console.log('====================================================');
  console.log('ALCO CONTENT ENGINE V9: ELECTRON DEV STARTUP TESTS');
  console.log('====================================================\n');

  // Test 1: Successful development connection
  {
    console.log('--- TEST 1: Successful Development Connection ---');
    const testPort = 3199;
    const server = http.createServer((req, res) => {
      if (req.url === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', app: 'alco-content-engine' }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise<void>((resolve) => server.listen(testPort, '127.0.0.1', resolve));

    try {
      const detailed = await checkDevServerDetailed(testPort, 1000);
      assert(detailed.success === true, 'checkDevServerDetailed succeeds on valid health endpoint');

      const resolvedPort = await waitForDevServer(testPort, 3000, 200);
      assert(resolvedPort === testPort, 'waitForDevServer successfully connects on first attempt');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }

  // Test 2: Slow development server response (polling success after initial delays)
  {
    console.log('\n--- TEST 2: Slow Development Server Response ---');
    const testPort = 3198;
    let attempts = 0;
    const server = http.createServer((req, res) => {
      attempts++;
      if (attempts < 3) {
        res.writeHead(503);
        res.end('Compiling...');
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', app: 'alco-content-engine' }));
      }
    });

    await new Promise<void>((resolve) => server.listen(testPort, '127.0.0.1', resolve));

    try {
      const resolvedPort = await waitForDevServer(testPort, 5000, 200);
      assert(resolvedPort === testPort, 'waitForDevServer successfully connects after slow compilation polling retries');
      assert(attempts >= 3, 'poll attempted multiple times before success');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }

  // Test 3: Unreachable development server (timeout/retry failure & diagnostics, no fallback)
  {
    console.log('\n--- TEST 3: Unreachable Development Server & No Production Fallback ---');
    const deadPort = 3197; // Nothing listening

    let thrownError: Error | null = null;
    const startTime = Date.now();
    try {
      await waitForDevServer(deadPort, 1200, 300);
    } catch (err: any) {
      thrownError = err;
    }
    const elapsed = Date.now() - startTime;

    assert(thrownError !== null, 'waitForDevServer throws error when development server is unreachable');
    assert(thrownError!.message.includes(`Development server unreachable on port ${deadPort}`), 'Error identifies target port');
    assert(thrownError!.message.includes('ETIMEDOUT') || thrownError!.message.includes('ECONNREFUSED'), 'Error includes network/HTTP error details');
    assert(elapsed >= 1000, 'Deadline and retries were respected before failing');
    console.log(`✅ [PASS] Diagnostic error successfully captured: ${thrownError!.message}`);
  }

  console.log('\n====================================================');
  console.log('ALL ELECTRON DEV STARTUP TESTS PASSED SUCCESSFULLY!');
  console.log('====================================================');
}

runTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
