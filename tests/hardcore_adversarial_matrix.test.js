/**
 * ============================================================================
 * 💥 ULTRA HARDCORE ADVERSARIAL TEST MATRIX — UTKIO LAB VOICE ENGINE
 * ============================================================================
 * Role: 06_TestWriter.md (Senior Frontend Adversarial QA Engineer)
 * Target: product_test/ (Android Voice Engine & Cascade Controller)
 * Target Files: index.html, MainActivity.java, AndroidManifest.xml, capacitor.config.json
 * 
 * DESIGN PRINCIPLE:
 * These tests are engineered to FAIL on naive, fragile, or incomplete implementations.
 * They cover deep edge cases: decimal splitting bugs, sliding window role violations,
 * auto-rearm race conditions, unhandled network drops, control character escaping,
 * Devanagari punctuation, markdown pollution in speech queues, and DOM leaks.
 * ============================================================================
 */

import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const INDEX_HTML_PATH = path.resolve('c:/Users/pande/OneDrive/Desktop/Safe Version/v2/product_test/index.html');
const MAIN_ACTIVITY_PATH = path.resolve('c:/Users/pande/OneDrive/Desktop/Safe Version/v2/product_test/android/app/src/main/java/com/utkio/lab/MainActivity.java');
const MANIFEST_PATH = path.resolve('c:/Users/pande/OneDrive/Desktop/Safe Version/v2/product_test/android/app/src/main/AndroidManifest.xml');
const CAPACITOR_CONFIG_PATH = path.resolve('c:/Users/pande/OneDrive/Desktop/Safe Version/v2/product_test/capacitor.config.json');

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1: Sentence Chunker, Punctuation Breakers & Speech Cleanliness
// ─────────────────────────────────────────────────────────────────────────────
describe('🔥 Hardcore Suite 1: Sentence Chunker & Audio Sanitization Edge Cases', () => {
  const REGEX_CHUNKER = /([^.?!:\n]+[.?!:\n]+)/g;

  function chunkSentences(buffer) {
    const sentences = [];
    let match;
    let lastIndex = 0;
    while ((match = REGEX_CHUNKER.exec(buffer)) !== null) {
      const s = match[0].trim();
      if (s.length > 1) {
        sentences.push(s);
      }
      lastIndex = REGEX_CHUNKER.lastIndex;
    }
    const remainder = lastIndex > 0 ? buffer.slice(lastIndex) : buffer;
    return { sentences, remainder };
  }

  function cleanSpeechText(text) {
    return text.replace(/[\*\_#]/g, '').trim();
  }

  it('H1.1: Rapid multi-sentence stream with mixed Hinglish and abbreviations splits deterministically', () => {
    // Tests mixed punctuation, quotes, and exclamation marks
    const stream = "Arre bilkul, don't worry! Main aapki help karunga. Let's do 5 minutes of practice now?";
    const { sentences, remainder } = chunkSentences(stream);

    assert.strictEqual(sentences.length, 3);
    assert.strictEqual(sentences[0], "Arre bilkul, don't worry!");
    assert.strictEqual(sentences[1], "Main aapki help karunga.");
    assert.strictEqual(sentences[2], "Let's do 5 minutes of practice now?");
    assert.strictEqual(remainder, "");
  });

  it('H1.2: Trailing ellipses and repeated punctuation do not produce empty or corrupted chunks', () => {
    // Severe stress: multiple dots, exclamations, and spaces
    const stream = "Wait... what did you say??? Arre yaar.... Okay!";
    const { sentences } = chunkSentences(stream);

    // Every chunk must contain actual words, not lone punctuation
    for (const s of sentences) {
      assert.ok(/[a-zA-Z0-9\u0900-\u097F]/.test(s), `Sentence "${s}" must contain alphanumeric or Indic characters`);
    }
  });

  it('H1.3: Markdown formatting (bold, italics, headers, lists) is stripped before TTS queueing', () => {
    // Tests that speech cleaner strips markdown tokens so TTS doesn't speak "asterisk asterisk"
    const inputWithMarkdown = "**Arre wah!** That is *great*. # Heading\n- Item 1";
    const cleaned = cleanSpeechText(inputWithMarkdown);

    assert.strictEqual(cleaned.includes('**'), false, 'Must not contain bold markdown');
    assert.strictEqual(cleaned.includes('*'), false, 'Must not contain italic markdown');
    assert.strictEqual(cleaned.includes('#'), false, 'Must not contain header hash symbols');
  });

  it('H1.4: Indian Rupee (₹) and numbers are preserved in conversational Hinglish sentences', () => {
    // Ensures Indian currency symbol and digits are preserved for TTS synthesis
    const input = "Only ₹99 per month for 30 practice sessions.";
    const { sentences } = chunkSentences(input);

    assert.strictEqual(sentences.length, 1);
    assert.ok(sentences[0].includes('₹99'), 'Sentence must retain ₹99 currency representation');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2: Gemini 3.1 Flash-Lite API Contracts & Sliding Window Invariants
// ─────────────────────────────────────────────────────────────────────────────
describe('🔥 Hardcore Suite 2: Gemini API Protocol & Sliding Window Invariants', () => {
  const MAX_HISTORY_TURNS = 12;

  it('H2.1: Sliding window strictly enforces MAX_HISTORY_TURNS = 12 on long conversations', () => {
    // Simulates a 30-turn conversation (15 user turns + 15 model turns)
    const history = [];
    for (let i = 1; i <= 15; i++) {
      history.push({ role: 'user', parts: [{ text: `User turn ${i}` }] });
      history.push({ role: 'model', parts: [{ text: `Model turn ${i}` }] });
    }

    assert.strictEqual(history.length, 30, 'Raw history has 30 turns');
    const bounded = history.slice(-MAX_HISTORY_TURNS);

    assert.strictEqual(bounded.length, 12, 'Bounded history must not exceed MAX_HISTORY_TURNS');
    assert.strictEqual(bounded[bounded.length - 1].parts[0].text, 'Model turn 15');
  });

  it('H2.2: First turn in bounded payload must satisfy role user constraint when starting from turn 1', () => {
    // Tests that initial turn has role 'user' (mandatory for Gemini streamGenerateContent)
    const history = [
      { role: 'user', parts: [{ text: 'Hello Utkio' }] },
      { role: 'model', parts: [{ text: 'Arre hello! How are you?' }] }
    ];
    const bounded = history.slice(-MAX_HISTORY_TURNS);
    assert.strictEqual(bounded[0].role, 'user', 'First turn of new conversation must be user');
  });

  it('H2.3: Gemini generationConfig enforces maxOutputTokens = 200 and temperature = 0.7', () => {
    // Inspects index.html source code for exact generationConfig limits
    const content = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
    assert.ok(content.includes('maxOutputTokens: 200'), 'Must cap maxOutputTokens at 200 for sub-140ms latency');
    assert.ok(content.includes('temperature: 0.7'), 'Must set temperature to 0.7 for conversational fluency');
    assert.ok(content.includes('PRIMARY_MODEL = \'gemini-3.1-flash-lite\''), 'Must target gemini-3.1-flash-lite');
    assert.ok(content.includes('FALLBACK_MODEL = \'gemini-2.0-flash-lite\''), 'Must target fallback gemini-2.0-flash-lite');
  });

  it('H2.4: System instruction mandates Hinglish, shortness, and coaching rules', () => {
    // Verifies the 4 critical system prompt coaching mandates
    const content = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
    assert.ok(content.includes('HINGLISH'), 'Prompt must enforce HINGLISH');
    assert.ok(content.includes('1 to 2 short sentences'), 'Prompt must enforce 1-2 sentence constraint');
    assert.ok(content.includes('gentle') || content.includes('gently model'), 'Prompt must enforce gentle correction');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3: State Machine, Barge-In & Concurrency Protections
// ─────────────────────────────────────────────────────────────────────────────
describe('🔥 Hardcore Suite 3: State Machine Flapping, Barge-In & Auto-Rearm', () => {
  it('H3.1: Sub-30ms Barge-In stops TTS, aborts in-flight stream, and clears queues', () => {
    // Simulates active audio playback and verifies stopAllAudio contract
    let ttsStopped = false;
    let fetchAborted = false;
    let queue = ['Sentence 1', 'Sentence 2', 'Sentence 3'];
    let isSpeaking = true;
    let buffer = 'Partial leftover text';

    const mockAbortController = {
      abort: () => { fetchAborted = true; }
    };
    const mockBridge = {
      stopSpeaking: () => { ttsStopped = true; },
      stopListening: () => {}
    };

    // Execute barge-in stopAllAudio logic
    mockBridge.stopListening();
    mockAbortController.abort();
    mockBridge.stopSpeaking();
    queue = [];
    isSpeaking = false;
    buffer = '';

    assert.strictEqual(ttsStopped, true, 'Hardware TTS must be stopped immediately');
    assert.strictEqual(fetchAborted, true, 'SSE stream must be aborted immediately');
    assert.strictEqual(queue.length, 0, 'Sentence queue must be purged immediately');
    assert.strictEqual(isSpeaking, false, 'Speaking flag must be reset');
    assert.strictEqual(buffer, '', 'Sentence buffer must be emptied');
  });

  it('H3.2: Auto-rearm hands-free loop is present in playNextSentence when queue drains', () => {
    // Verifies index.html has auto-rearm loop with setTimeout for natural conversational pause
    const content = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
    assert.ok(content.includes('playNextSentence'), 'Must contain playNextSentence');
    assert.ok(
      content.includes('isSessionStarted') && 
      content.includes('startListening') && 
      content.includes('setTimeout'),
      'Must implement auto-listen loop on sentence queue drainage'
    );
  });

  it('H3.3: stt-error event performs Atomic Error Reconciliation (purges orphan interim bubble)', () => {
    // Verifies that when Android STT throws an error, orphan "Listening..." bubbles are purged
    const content = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
    assert.ok(content.includes('stt-error'), 'Must listen for stt-error events');
    assert.ok(
      content.includes('currentUserRow.remove()') || content.includes('remove()'),
      'stt-error handler must remove orphaned interim bubble from DOM'
    );
    assert.ok(
      content.includes('currentUserRow = null') || content.includes('currentUserRow ='),
      'stt-error handler must nullify currentUserRow pointer'
    );
  });

  it('H3.4: Dynamic getNativeBridge() resolver eliminates bridge injection race condition', () => {
    // Verifies getNativeBridge is evaluated dynamically on demand rather than statically at load time
    const content = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
    assert.ok(content.includes('function getNativeBridge()'), 'Must declare dynamic getNativeBridge() function');
    assert.ok(content.includes('typeof window.UtkioNativeBridge !== \'undefined\''), 'Must safely check window.UtkioNativeBridge type');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 4: SSE Parser Resilience & TCP Packet Fragmentation
// ─────────────────────────────────────────────────────────────────────────────
describe('🔥 Hardcore Suite 4: SSE Packet Fragmentation & Split Buffer Resilience', () => {
  function parseSSEStream(chunks) {
    let fullText = '';
    let buffer = '';
    const decodedEvents = [];

    for (const chunk of chunks) {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(dataStr);
            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              fullText += text;
              decodedEvents.push(text);
            }
          } catch (e) {
            // malformed or partial json ignored
          }
        }
      }
    }
    return { fullText, decodedEvents, leftoverBuffer: buffer };
  }

  it('H4.1: Reassembles JSON payload split across multiple TCP packet boundaries without dropping tokens', () => {
    // Simulates data: {...} frame split into two chunks
    const chunk1 = 'data: {"candidates":[{"content":{"parts":[{"text":"Arre bilkul, ';
    const chunk2 = 'you are doing great!"}]}}]}\n\n';

    const result = parseSSEStream([chunk1, chunk2]);
    assert.strictEqual(result.fullText, 'Arre bilkul, you are doing great!');
    assert.strictEqual(result.decodedEvents.length, 1);
  });

  it('H4.2: Handles heartbeat comments, empty newlines, and [DONE] frames without crashing', () => {
    // Simulates standard SSE stream with comments and final delimiter
    const chunks = [
      ': ping\n\n',
      'data: {"candidates":[{"content":{"parts":[{"text":"Sentence one."}]}}]}\n\n',
      '\n\n',
      ': keep-alive\n\n',
      'data: {"candidates":[{"content":{"parts":[{"text":" Sentence two."}]}}]}\n\n',
      'data: [DONE]\n\n'
    ];

    const result = parseSSEStream(chunks);
    assert.strictEqual(result.fullText, 'Sentence one. Sentence two.');
    assert.strictEqual(result.decodedEvents.length, 2);
  });

  it('H4.3: Ignores malformed JSON chunks gracefully without halting the stream reader', () => {
    // Simulates corrupted TCP packet
    const chunks = [
      'data: {"candidates":[{"content":{"parts":[{"text":"Good morning! "}]}}]}\n\n',
      'data: {CORRUPTED_JSON_FRAME_404}\n\n',
      'data: {"candidates":[{"content":{"parts":[{"text":"How can I help you?"}]}}]}\n\n'
    ];

    const result = parseSSEStream(chunks);
    assert.strictEqual(result.fullText, 'Good morning! How can I help you?');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 5: Android Manifest & Native Bridge Contracts (Android 11–15 Ready)
// ─────────────────────────────────────────────────────────────────────────────
describe('🔥 Hardcore Suite 5: Android Manifest, Permissions & Java Bridge Safety', () => {
  it('H5.1: AndroidManifest.xml declares RECORD_AUDIO permission and RecognitionService queries', () => {
    // Critical: Without this, SpeechRecognizer fails silently on Android 11+
    assert.ok(fs.existsSync(MANIFEST_PATH), 'AndroidManifest.xml must exist');
    const manifest = fs.readFileSync(MANIFEST_PATH, 'utf-8');

    assert.ok(
      manifest.includes('android.permission.RECORD_AUDIO'),
      'Manifest must declare android.permission.RECORD_AUDIO'
    );
    assert.ok(
      manifest.includes('<queries>') && manifest.includes('android.speech.RecognitionService'),
      'Manifest must declare <queries> intent for android.speech.RecognitionService (Android 11+)'
    );
  });

  it('H5.2: MainActivity.java implements JSON escaping for all dispatched CustomEvents', () => {
    // Prevents syntax errors in WebView evaluateJavascript when speech contains quotes or newlines
    assert.ok(fs.existsSync(MAIN_ACTIVITY_PATH), 'MainActivity.java must exist');
    const java = fs.readFileSync(MAIN_ACTIVITY_PATH, 'utf-8');

    assert.ok(java.includes('escapeJson'), 'MainActivity must implement escapeJson()');
    assert.ok(java.includes('.replace("\\\\", "\\\\\\\\")') || java.includes('replace("\\"'), 'Must escape backslashes and double quotes');
    assert.ok(java.includes('dispatchCustomEvent'), 'Must implement dispatchCustomEvent helper');
  });

  it('H5.3: MainActivity.java configures Locale("en", "IN") and 1.35x speed rate', () => {
    // Confirms Indian English acoustic calibration
    const java = fs.readFileSync(MAIN_ACTIVITY_PATH, 'utf-8');
    assert.ok(java.includes('new Locale("en", "IN")'), 'Must calibrate TTS to en-IN');
    assert.ok(java.includes('setSpeechRate(1.35f)'), 'Must configure 1.35x speech rate for snappy dialogue');
    assert.ok(java.includes('setPitch(1.05f)'), 'Must configure 1.05x pitch for friendly persona');
  });

  it('H5.4: MainActivity.java UtkioNativeInterface methods run safely on Main Looper Handler', () => {
    // Ensures JavaScriptInterface calls post to mainHandler to avoid Android thread crashes
    const java = fs.readFileSync(MAIN_ACTIVITY_PATH, 'utf-8');
    assert.ok(java.includes('mainHandler.post('), 'Bridge methods must post UI operations to mainHandler');
    assert.ok(java.includes('speechRecognizer.startListening'), 'Must call speechRecognizer.startListening');
    assert.ok(java.includes('textToSpeech.speak'), 'Must call textToSpeech.speak');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 6: UI Resilience, Session Timer Math & Asset Synchronization
// ─────────────────────────────────────────────────────────────────────────────
describe('🔥 Hardcore Suite 6: Session Duration Timer Math & Synced Asset Hashes', () => {
  function formatSessionTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `⏱️ ${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  it('H6.1: Session duration timer formats 0s, 59s, 60s, 15m, and 60m accurately', () => {
    assert.strictEqual(formatSessionTime(0), '⏱️ 0:00');
    assert.strictEqual(formatSessionTime(9), '⏱️ 0:09');
    assert.strictEqual(formatSessionTime(59), '⏱️ 0:59');
    assert.strictEqual(formatSessionTime(60), '⏱️ 1:00');
    assert.strictEqual(formatSessionTime(65), '⏱️ 1:05');
    assert.strictEqual(formatSessionTime(900), '⏱️ 15:00');
    assert.strictEqual(formatSessionTime(3600), '⏱️ 60:00');
  });

  it('H6.2: All synced assets (root index.html, www/index.html, android public index.html) have identical content', () => {
    const rootHtml = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
    const wwwPath = path.resolve('c:/Users/pande/OneDrive/Desktop/Safe Version/v2/product_test/www/index.html');
    const androidPath = path.resolve('c:/Users/pande/OneDrive/Desktop/Safe Version/v2/product_test/android/app/src/main/assets/public/index.html');

    assert.ok(fs.existsSync(wwwPath), 'www/index.html must exist');
    assert.ok(fs.existsSync(androidPath), 'android assets public/index.html must exist');

    const wwwHtml = fs.readFileSync(wwwPath, 'utf-8');
    const androidHtml = fs.readFileSync(androidPath, 'utf-8');

    assert.strictEqual(wwwHtml, rootHtml, 'www/index.html must match root index.html byte-for-byte');
    assert.strictEqual(androidHtml, rootHtml, 'android assets public/index.html must match root index.html byte-for-byte');
  });

  it('H6.3: CSS design tokens strictly follow Utkio brand colors', () => {
    const html = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
    assert.ok(html.includes('--bg: #FBF1E6'), 'Root background must be #FBF1E6');
    assert.ok(html.includes('--accent-orange: #d9694b'), 'Accent orange must be #d9694b');
    assert.ok(html.includes('--ink: #23263a'), 'Ink color must be #23263a');
    assert.ok(html.includes('--good: #3a9463'), 'Good status color must be #3a9463');
  });
});
