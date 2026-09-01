/**
 * ============================================================================
 * 🚀 UTKIO LAB MASTER ADVERSARIAL TEST RUNNER
 * ============================================================================
 * Runs all adversarial and UI test suites sequentially and provides a unified
 * pass/fail audit summary for the 06_TestWriter role.
 * ============================================================================
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const testFiles = [
  path.join(__dirname, 'production_readiness_failures.test.js'),
  path.join(__dirname, 'voice_cascade_engine.test.js'),
  path.join(__dirname, 'voice_cascade_adversarial.test.js'),
  path.join(__dirname, 'exhaustive_ui_adversarial.test.js'),
  path.join(__dirname, 'extreme_adversarial_matrix.test.js'),
  path.join(__dirname, 'hardcore_adversarial_matrix.test.js'),
  path.join(__dirname, 'deep_edge_cases_and_break_attempts.test.js')
];

const nodeBinary = process.execPath;

console.log('================================================================');
console.log('🧪 RUNNING UTKIO LAB COMPLETE ADVERSARIAL TEST MATRIX (60+ TESTS)');
console.log('================================================================\n');

async function runTest(file) {
  return new Promise((resolve) => {
    const relativeName = path.relative(path.resolve(__dirname, '..'), file);
    console.log(`▶ Executing: ${relativeName}`);
    const proc = spawn(nodeBinary, [file], { stdio: 'inherit' });
    proc.on('close', (code) => {
      resolve({ file: relativeName, code });
    });
  });
}

async function main() {
  const results = [];
  for (const f of testFiles) {
    const res = await runTest(f);
    results.push(res);
    console.log('');
  }

  console.log('================================================================');
  console.log('📊 TEST EXECUTION SUMMARY:');
  console.log('================================================================');
  let allPassed = true;
  for (const r of results) {
    const status = r.code === 0 ? '✅ PASS' : '🔴 FAIL';
    if (r.code !== 0) allPassed = false;
    console.log(`  ${status} — ${r.file}`);
  }
  console.log('================================================================');
  if (allPassed) {
    console.log('🎉 ALL ADVERSARIAL & UI TESTS PASSED CLEANLY (100% SUCCESS)');
  } else {
    console.log('❌ SOME TESTS FAILED. CHECK LOGS ABOVE.');
    process.exit(1);
  }
}

main();
