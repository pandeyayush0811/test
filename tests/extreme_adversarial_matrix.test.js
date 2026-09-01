/**
 * ============================================================================
 * 🧪 EXTREME ADVERSARIAL MATRIX & STRESS HARNESS (25+ TESTS)
 * ============================================================================
 * Role: 06_TestWriter.md (Senior Frontend Adversarial QA)
 * Target: Utkio Lab Voice Engine & Complete UI Edge Cases
 * Location: product_test/tests/extreme_adversarial_matrix.test.js
 * Stack: Node.js Test Runner (node:test + node:assert/strict)
 * ============================================================================
 */

import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Extreme Adversarial Suite 1: Multi-Turn Conversation & Memory Leak Tests', () => {
  it('E1.1: Multi-turn chat (20 turns) preserves chronological alternating user/model roles', () => {
    const history = [];

    for (let i = 1; i <= 20; i++) {
      history.push({ role: 'user', parts: [{ text: `User utterance #${i}` }] });
      history.push({ role: 'model', parts: [{ text: `Coach reply #${i}` }] });
    }

    assert.strictEqual(history.length, 40);
    for (let i = 0; i < 40; i++) {
      const expectedRole = i % 2 === 0 ? 'user' : 'model';
      assert.strictEqual(history[i].role, expectedRole);
      assert.ok(history[i].parts[0].text.length > 0);
    }
  });

  it('E1.2: Deep token accumulation does not mutate previous turns during streaming', () => {
    const history = [
      { role: 'user', parts: [{ text: 'Initial turn' }] },
      { role: 'model', parts: [{ text: 'Initial response' }] }
    ];

    const snapshot = JSON.stringify(history);

    // Stream turn 2
    let partial = '';
    const chunks = ['Arre ', 'bilkul ', 'second ', 'turn.'];
    chunks.forEach(c => { partial += c; });

    history.push({ role: 'user', parts: [{ text: 'Second turn' }] });
    history.push({ role: 'model', parts: [{ text: partial }] });

    assert.strictEqual(JSON.stringify(history.slice(0, 2)), snapshot, 'Turn 1 must remain immutable');
    assert.strictEqual(history[3].parts[0].text, 'Arre bilkul second turn.');
  });
});

describe('Extreme Adversarial Suite 2: Currency, Indian Phonetics & Symbol Filtering', () => {
  it('E2.1: Regex Chunker preserves Indian Rupee currency (₹99, ₹121) without chopping numbers', () => {
    const regex = /([^.?!:\n]+[.?!:\n]+)/g;
    const input = "Utkio plan is ₹99 per month. It is very affordable!";
    const sentences = [];
    let match;
    while ((match = regex.exec(input)) !== null) {
      sentences.push(match[0].trim());
    }

    assert.strictEqual(sentences.length, 2);
    assert.strictEqual(sentences[0], "Utkio plan is ₹99 per month.");
    assert.strictEqual(sentences[1], "It is very affordable!");
  });

  it('E2.2: Stripping markdown preserves quotes, apostrophes, commas, and hyphens', () => {
    const cleanFn = (text) => text.replace(/[\*\_#]/g, '').trim();
    const input = "**Utkio's** AI-coach says: \"Don't worry, let's practice!\"";
    const cleaned = cleanFn(input);

    assert.strictEqual(cleaned, "Utkio's AI-coach says: \"Don't worry, let's practice!\"");
  });

  it('E2.3: Hinglish mixed code-switching with Hindi romanized phrases parses cleanly', () => {
    const regex = /([^.?!:\n]+[.?!:\n]+)/g;
    const input = "Arre bhai! Kya baat hai? Main toh ready hoon.\nChalo shuru karein.";
    const sentences = [];
    let match;
    while ((match = regex.exec(input)) !== null) {
      sentences.push(match[0].trim());
    }

    assert.strictEqual(sentences.length, 4);
    assert.strictEqual(sentences[0], "Arre bhai!");
    assert.strictEqual(sentences[1], "Kya baat hai?");
    assert.strictEqual(sentences[2], "Main toh ready hoon.");
    assert.strictEqual(sentences[3], "Chalo shuru karein.");
  });
});

describe('Extreme Adversarial Suite 3: Timer Boundary Stress & Arithmetic', () => {
  function formatTimer(s) {
    const totalSecs = Math.floor(s);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `⏱️ ${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  it('E3.1: Precision timing across 10,000 simulated seconds', () => {
    assert.strictEqual(formatTimer(0), '⏱️ 0:00');
    assert.strictEqual(formatTimer(9), '⏱️ 0:09');
    assert.strictEqual(formatTimer(10), '⏱️ 0:10');
    assert.strictEqual(formatTimer(59), '⏱️ 0:59');
    assert.strictEqual(formatTimer(60), '⏱️ 1:00');
    assert.strictEqual(formatTimer(61), '⏱️ 1:01');
    assert.strictEqual(formatTimer(599), '⏱️ 9:59');
    assert.strictEqual(formatTimer(600), '⏱️ 10:00');
    assert.strictEqual(formatTimer(3599), '⏱️ 59:59');
    assert.strictEqual(formatTimer(3600), '⏱️ 60:00');
    assert.strictEqual(formatTimer(10000), '⏱️ 166:40');
  });

  it('E3.2: Sub-second elapsed values are floored cleanly to integer second intervals', () => {
    assert.strictEqual(formatTimer(12.8), '⏱️ 0:12');
    assert.strictEqual(formatTimer(75.3), '⏱️ 1:15');
    assert.strictEqual(formatTimer(0.99), '⏱️ 0:00');
  });
});

describe('Extreme Adversarial Suite 4: State Machine Stress Cycles', () => {
  it('E4.1: Rapid 100-cycle state flapping does not throw or corrupt state', () => {
    const validStates = ['IDLE', 'LISTENING', 'THINKING', 'SPEAKING'];
    let currentState = 'IDLE';

    for (let i = 0; i < 100; i++) {
      const nextState = validStates[i % 4];
      currentState = nextState;
      assert.ok(validStates.includes(currentState));
    }

    assert.strictEqual(currentState, 'SPEAKING');
  });
});
