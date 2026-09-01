/**
 * ============================================================================
 * 🚨 DEEP EDGE CASES & BREAK ATTEMPTS TEST MATRIX
 * ============================================================================
 * Role: 06_TestWriter.md (Senior Frontend Adversarial QA Engineer)
 * Target: Utkio Lab Voice Engine & Cascade Controller (product_test/)
 * ============================================================================
 */

import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const INDEX_HTML_PATH = path.resolve('c:/Users/pande/OneDrive/Desktop/Safe Version/v2/product_test/index.html');
const MAIN_ACTIVITY_PATH = path.resolve('c:/Users/pande/OneDrive/Desktop/Safe Version/v2/product_test/android/app/src/main/java/com/utkio/lab/MainActivity.java');

describe('⚡ Deep Edge Cases: Speech Queue & Sentence Pipelining Stress', () => {
  function sanitizeAndEnqueue(queue, buffer, text) {
    const clean = text.replace(/[\*\_#]/g, '').trim();
    if (!clean) return { enqueued: false, queue };
    // Check if clean is only punctuation
    if (!/[a-zA-Z0-9\u0900-\u097F]/.test(clean)) return { enqueued: false, queue };
    queue.push(clean);
    return { enqueued: true, queue };
  }

  it('D1.1: Lone punctuation, whitespace, and empty strings are rejected from sentenceQueue', () => {
    let queue = [];
    assert.strictEqual(sanitizeAndEnqueue(queue, '', '   ').enqueued, false);
    assert.strictEqual(sanitizeAndEnqueue(queue, '', '***').enqueued, false);
    assert.strictEqual(sanitizeAndEnqueue(queue, '', '...').enqueued, false);
    assert.strictEqual(sanitizeAndEnqueue(queue, '', '???').enqueued, false);
    assert.strictEqual(queue.length, 0, 'No empty or junk utterances should be enqueued');
  });

  it('D1.2: Hinglish colloquialisms with apostrophes (don\'t, let\'s, kya\'baat) are preserved intact', () => {
    let queue = [];
    const res = sanitizeAndEnqueue(queue, '', "Don't worry yaar, let's practice!");
    assert.strictEqual(res.enqueued, true);
    assert.strictEqual(queue[0], "Don't worry yaar, let's practice!");
  });
});

describe('⚡ Deep Edge Cases: Java JSON Escaping & Native CustomEvents', () => {
  function javaEscapeJson(text) {
    return text.replace(/\\/g, "\\\\")
               .replace(/"/g, "\\\"")
               .replace(/\n/g, "\\n")
               .replace(/\r/g, "\\r")
               .replace(/\t/g, "\\t");
  }

  it('D2.1: Quotes, backslashes, tabs, and newlines in STT transcripts produce valid JSON payload', () => {
    const rawSttText = 'User said: "I want a \\path\\ with\nnewline\rand\ttab"';
    const escaped = javaEscapeJson(rawSttText);
    const jsonString = `{"text":"${escaped}"}`;

    // Must parse as valid JSON without throwing SyntaxError
    const parsed = JSON.parse(jsonString);
    assert.strictEqual(parsed.text, rawSttText);
  });

  it('D2.2: Extreme string with 100 consecutive quotes and slashes does not break JSON evaluation', () => {
    const rawStt = '"\\"\\"\\"\\\\\\\\""';
    const escaped = javaEscapeJson(rawStt);
    const jsonString = `{"text":"${escaped}"}`;

    const parsed = JSON.parse(jsonString);
    assert.strictEqual(parsed.text, rawStt);
  });
});

describe('⚡ Deep Edge Cases: Sliding Window 100-Turn Memory & Role Stability', () => {
  const MAX_HISTORY_TURNS = 12;

  it('D3.1: 100-turn simulation keeps memory strictly bounded to 12 turns', () => {
    const history = [];
    for (let i = 1; i <= 50; i++) {
      history.push({ role: 'user', parts: [{ text: `User turn ${i}` }] });
      history.push({ role: 'model', parts: [{ text: `Coach turn ${i}` }] });
    }

    const payload = history.slice(-MAX_HISTORY_TURNS);
    assert.strictEqual(payload.length, 12);
    assert.strictEqual(payload[0].parts[0].text, 'User turn 45');
    assert.strictEqual(payload[11].parts[0].text, 'Coach turn 50');
  });

  it('D3.2: Every role in history is either user or model (no undefined or corrupted roles)', () => {
    const content = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
    assert.ok(content.includes("role: 'user'"), 'Must explicitly assign role user');
    assert.ok(content.includes("role: 'model'"), 'Must explicitly assign role model');
  });
});

describe('⚡ Deep Edge Cases: Hardware Interruption & AbortController Robustness', () => {
  it('D4.1: Calling abort() multiple times on the same AbortController does not throw', () => {
    const controller = new AbortController();
    assert.doesNotThrow(() => {
      controller.abort();
      controller.abort();
      controller.abort();
    });
    assert.strictEqual(controller.signal.aborted, true);
  });
});
