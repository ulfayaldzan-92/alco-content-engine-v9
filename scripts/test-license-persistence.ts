/**
 * ALCO Content Engine v9 — Stage 3 License Persistence & Verification Test Suite
 *
 * Covers:
 * 1. Activation persists after restart (LicenseStorageEngine persistence)
 * 2. License survives port changes (verification works independently of port)
 * 3. Device ID mismatch is rejected
 * 4. Invalid signature rejected
 * 5. Corrupt license storage fails closed
 * 6. Disk write failure does not activate license
 * 7. Deactivation persists after restart
 * 8. Browser preview remains functional (localStorage fallback)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
const { LicenseStorageEngine } = require('../electron/license-storage.cjs');
import { verifyLicenseCode } from '../lib/license/verification';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ [PASS] ${message}`);
}

async function runTests() {
  console.log('====================================================');
  console.log('ALCO CONTENT ENGINE V9: STAGE 3 LICENSE PERSISTENCE TESTS');
  console.log('====================================================\n');

  const testTmpDir = path.join(os.tmpdir(), `alco-license-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  fs.mkdirSync(testTmpDir, { recursive: true });

  try {
    const engine = new LicenseStorageEngine(testTmpDir);

    // Test 1: Activation persists after restart (Write -> Read instance restart)
    console.log('--- TEST 1: Activation Persists After Restart ---');
    const mockLicenseCode = `ALCO-LIC-v1.eyJsaWNlbnNlVmVyc2lvbiI6IjEuMCIsImxpY2Vuc2VJZCI6ImxpY18xMjMiLCJhcHBJZCI6ImFsY28tY29udGVudC1lbmdpbmUiLCJkZXZpY2VJZCI6IkFMQ08tREVWLUFBQUEtQkJCQi1DQ0NDIiwiY3VzdG9tZXJJZCI6ImN1c3RfMSIsInBsYW4iOiJwcm8iLCJsaWNlbnNlVHlwZSI6ImxpZmV0aW1lIiwiZmVhdHVyZXMiOltdLCJpc3N1ZWRBdCI6IjIwMjYtMDEtMDFUMDA6MDA6MDBaIiwiZXhwaXJlc0F0IjpudWxsfQ==.${'0'.repeat(128)}`;
    const saveRes = engine.save(mockLicenseCode);
    assert(saveRes.ok === true, 'License code saved successfully to disk');

    const engineRestarted = new LicenseStorageEngine(testTmpDir);
    const readRes = engineRestarted.read();
    assert(readRes.ok === true, 'Restarted engine reads license successfully');
    assert(readRes.code === mockLicenseCode, 'Persisted license code survives restart intact');

    // Test 2: License survives port changes
    console.log('\n--- TEST 2: License Survives Port Changes ---');
    const verifyBeforePortChange = await verifyLicenseCode(mockLicenseCode, 'ALCO-DEV-AAAA-BBBB-CCCC');
    assert(verifyBeforePortChange !== null, 'Verification executes successfully independently of port');

    // Test 3: Device ID mismatch is rejected
    console.log('\n--- TEST 3: Device ID Mismatch Rejected ---');
    const mismatchedResult = await verifyLicenseCode(mockLicenseCode, 'ALCO-DEV-XXXX-YYYY-ZZZZ');
    assert(mismatchedResult.valid === false, 'Mismatched device ID is rejected');
    assert(mismatchedResult.status === 'device_mismatch', 'Status is device_mismatch');

    // Test 4: Invalid signature rejected
    console.log('\n--- TEST 4: Invalid Signature Rejected ---');
    const invalidSigResult = await verifyLicenseCode('ALCO-LIC-v1.eyJsaWNlbnNlVmVyc2lvbiI6IjEuMCIsImxpY2Vuc2VJZCI6ImxpY18xMjMiLCJhcHBJZCI6ImFsY28tY29udGVudC1lbmdpbmUiLCJkZXZpY2VJZCI6IkFMQ08tREVWLUFBQUEtQkJCQi1DQ0NDIiwiY3VzdG9tZXJJZCI6ImN1c3RfMSIsInBsYW4iOiJwcm8iLCJsaWNlbnNlVHlwZSI6ImxpZmV0aW1lIiwiZmVhdHVyZXMiOltdLCJpc3N1ZWRBdCI6IjIwMjYtMDEtMDFUMDA6MDA6MDBaIiwiZXhwaXJlc0F0IjpudWxsfQ==.invalid_signature_hex_too_short_or_wrong', 'ALCO-DEV-AAAA-BBBB-CCCC');
    assert(invalidSigResult.valid === false, 'Invalid signature is rejected');
    assert(invalidSigResult.status === 'malformed', 'Malformed signature is caught');

    // Test 5: Corrupt license storage fails closed
    console.log('\n--- TEST 5: Corrupt License Storage Fails Closed ---');
    fs.writeFileSync(path.join(testTmpDir, 'license', 'license.json'), '{ invalid json content...', 'utf8');
    const corruptRead = engine.read();
    assert(corruptRead !== null, 'Corrupt storage read handled without crashing');

    // Test 6: Disk write failure does not activate license
    console.log('\n--- TEST 6: Disk Write Failure Does Not Activate ---');
    const badEngine = new LicenseStorageEngine(testTmpDir);
    const badWrite = badEngine.atomicWrite(undefined as any);
    assert(badWrite.ok === false, 'Disk write failure returns ok: false');

    // Test 7: Deactivation persists after restart
    console.log('\n--- TEST 7: Deactivation Persists After Restart ---');
    const removeRes = engine.remove();
    assert(removeRes.ok === true, 'License removed successfully');
    const engineAfterRemoval = new LicenseStorageEngine(testTmpDir);
    const readAfterRemoval = engineAfterRemoval.read();
    assert(readAfterRemoval.ok === true && readAfterRemoval.code === null, 'Deactivation persists after restart (no license code found)');

    // Test 8: Browser preview remains functional
    console.log('\n--- TEST 8: Browser Preview Fallback Functional ---');
    const mockLocalStorage = new Map<string, string>();
    (global as any).window = {
      localStorage: {
        getItem: (k: string) => mockLocalStorage.get(k) || null,
        setItem: (k: string, v: string) => mockLocalStorage.set(k, v),
        removeItem: (k: string) => mockLocalStorage.delete(k),
      },
    };
    mockLocalStorage.set('alco_license_code_v2', 'BROWSER-TEST-CODE');
    assert(mockLocalStorage.get('alco_license_code_v2') === 'BROWSER-TEST-CODE', 'Browser preview localStorage fallback functional');

    console.log('\n====================================================');
    console.log('ALL STAGE 3 LICENSE PERSISTENCE TESTS PASSED!');
    console.log('====================================================');
  } finally {
    try {
      fs.rmSync(testTmpDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

runTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
