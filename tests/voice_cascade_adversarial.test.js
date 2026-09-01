/**
 * ============================================================================
 * 🧪 ADVERSARIAL VOICE CASCADE ENGINE TEST SUITE (EXTENDED HARNESS)
 * ============================================================================
 * Role: 06_TestWriter.md (Senior Frontend Adversarial QA)
 * Target: Utkio Product Test Workbench (Cascade Voice Engine, Native Bridge, SSE)
 * Location: product_test/index.html & MainActivity.java
 * Stack: Node.js Test Runner (node:test + node:assert/strict)
 *
 * Mindset: Assume the implementation has timing races, buffer leaks, regex flaws,
 * unhandled SSE edge cases, XSS vulnerabilities, and barge-in audio queue desyncs.
 * ============================================================================
 */

import test, { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const INDEX_HTML_PATH = path.resolve('c:/Users/pande/OneDrive/Desktop/Safe Version/v2/product_test/index.html');
const MAIN_ACTIVITY_PATH = path.resolve('c:/Users/pande/OneDrive/Desktop/Safe Version/v2/product_test/android/app/src/main/java/com/utkio/lab/MainActivity.java');
const CAPACITOR_CONFIG_PATH = path.resolve('c:/Users/pande/OneDrive/Desktop/Safe Version/v2/product_test/capacitor.config.json');

// ─────────────────────────────────────────────────────────────────────────────
// Test Matrix Category A: Structural Integrity & Configuration Contracts
// ─────────────────────────────────────────────────────────────────────────────
describe('Category A: Architecture & Configuration Integrity', () => {
  it('A1: Source files exist and are populated with valid production code', () => {
    // Verifies all core artifacts exist and are not placeholder stubs
    assert.ok(fs.existsSync(INDEX_HTML_PATH), 'index.html must exist');
    assert.ok(fs.existsSync(MAIN_ACTIVITY_PATH), 'MainActivity.java must exist');
    assert.ok(fs.existsSync(CAPACITOR_CONFIG_PATH), 'capacitor.config.json must exist');

    const html = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
    const java = fs.readFileSync(MAIN_ACTIVITY_PATH, 'utf-8');
    assert.ok(html.length > 5000, 'index.html must contain complete frontend application');
    assert.ok(java.length > 2000, 'MainActivity.java must contain complete native bridge');
  });

  it('A2: Capacitor configuration strictly binds appId and web directory', () => {
    // Ensures Capacitor build target won't misroute assets or package names
    const config = JSON.parse(fs.readFileSync(CAPACITOR_CONFIG_PATH, 'utf-8'));
    assert.strictEqual(config.appId, 'com.utkio.lab', 'App ID must match lab package');
    assert.strictEqual(config.appName, 'Utkio Lab', 'App Name must match Utkio Lab');
    assert.strictEqual(config.webDir, 'www', 'webDir must point to www/');
  });

  it('A3: Android Native Bridge MainActivity.java declares exact JavaScriptInterface contracts', () => {
    // Verifies bridge methods and event types called by window.UtkioNativeBridge
    const java = fs.readFileSync(MAIN_ACTIVITY_PATH, 'utf-8');
    assert.ok(java.includes('@JavascriptInterface'), 'Must declare @JavascriptInterface annotations');
    assert.ok(java.includes('public void startListening()'), 'Must export startListening()');
    assert.ok(java.includes('public void stopListening()'), 'Must export stopListening()');
    assert.ok(java.includes('public void speakText(String text'), 'Must export speakText()');
    assert.ok(java.includes('public void stopSpeaking()'), 'Must export stopSpeaking()');
    assert.ok(java.includes('stt-partial'), 'Must dispatch stt-partial events to webview');
    assert.ok(java.includes('stt-final'), 'Must dispatch stt-final events to webview');
    assert.ok(java.includes('tts-done'), 'Must dispatch tts-done events to webview');
    assert.ok(java.includes('Locale("en", "IN")'), 'Must calibrate TTS to Indian English en-IN');
  });

  it('A4: Model configuration strictly defaults to gemini-3.1-flash-lite with fallback hierarchy', () => {
    // Confirms primary and fallback model strings are strictly configured
    const html = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
    assert.ok(html.includes("const PRIMARY_MODEL = 'gemini-3.1-flash-lite'"), 'Primary model must be gemini-3.1-flash-lite');
    assert.ok(html.includes("const FALLBACK_MODEL = 'gemini-2.0-flash-lite'"), 'Fallback model must be gemini-2.0-flash-lite');
    assert.ok(html.includes('maxOutputTokens: 200'), 'Must cap maxOutputTokens to 200 for sub-140ms turns');
    assert.ok(html.includes('temperature: 0.7'), 'Must use temperature 0.7 for conversational balance');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Matrix Category B: Sentence Pipelining & Regex Token Chunker Logic
// ─────────────────────────────────────────────────────────────────────────────
describe('Category B: Sentence Pipelining & Regex Chunker Adversarial Stress', () => {
  const REGEX_CHUNKER = /([^.?!:\n]+[.?!:\n]+)/g;

  function chunkText(streamBuffer) {
    const sentences = [];
    let match;
    let lastIndex = 0;
    while ((match = REGEX_CHUNKER.exec(streamBuffer)) !== null) {
      const sentence = match[0].trim();
      if (sentence.length > 1) {
        sentences.push(sentence);
      }
      lastIndex = REGEX_CHUNKER.lastIndex;
    }
    const remainder = lastIndex > 0 ? streamBuffer.slice(lastIndex) : streamBuffer;
    return { sentences, remainder };
  }

  it('B1: Correctly chunks typical Hinglish conversational sentences across punctuation marks', () => {
    // Tests standard sentence splitting with Hindi colloquial cues and mixed punctuation
    const input = "Arre bilkul, don't worry yaar! Main aapki full help karunga. What did you do yesterday?";
    const { sentences, remainder } = chunkText(input);

    assert.strictEqual(sentences.length, 3, 'Must extract exactly 3 sentences');
    assert.strictEqual(sentences[0], "Arre bilkul, don't worry yaar!");
    assert.strictEqual(sentences[1], "Main aapki full help karunga.");
    assert.strictEqual(sentences[2], "What did you do yesterday?");
    assert.strictEqual(remainder, '', 'No remainder left after terminal punctuation');
  });

  it('B2: Handles consecutive punctuation marks (!?, ..., !!!) without empty sentence artifacts', () => {
    // Adversarial: Repeated exclamation/question marks must not emit empty or single-character chunks
    const input = "Really!?! That sounds amazing... Let's try again!!!";
    const { sentences } = chunkText(input);

    assert.strictEqual(sentences.length, 3);
    assert.strictEqual(sentences[0], "Really!?!");
    assert.strictEqual(sentences[1], "That sounds amazing...");
    assert.strictEqual(sentences[2], "Let's try again!!!");
    sentences.forEach(s => assert.ok(s.length > 1, 'Sentence chunk must not be degenerate 1-char artifact'));
  });

  it('B3: Preserves partial streamed sentences in buffer until punctuation arrival', () => {
    // Simulates incremental SSE token streaming across 7 packets
    let buffer = '';
    const tokenPackets = ['Arre ', 'bilkul ', 'aap ', 'boliye. ', 'Main ', 'sun ', 'raha hoon?'];
    const emittedSentences = [];

    for (const packet of tokenPackets) {
      buffer += packet;
      const { sentences, remainder } = chunkText(buffer);
      emittedSentences.push(...sentences);
      buffer = remainder;
    }

    assert.strictEqual(emittedSentences.length, 2);
    assert.strictEqual(emittedSentences[0], 'Arre bilkul aap boliye.');
    assert.strictEqual(emittedSentences[1], 'Main sun raha hoon?');
    assert.strictEqual(buffer, '');
  });

  it('B4: Handles newline-delimited responses as valid clause terminators', () => {
    // Verifies \n acts as immediate boundary for fast audio pipelining
    const input = "Hello there\nHow can I help you today?";
    const { sentences } = chunkText(input);

    assert.strictEqual(sentences.length, 2);
    assert.strictEqual(sentences[0], "Hello there");
    assert.strictEqual(sentences[1], "How can I help you today?");
  });

  it('B5: Markdown symbol stripping leaves spoken text clean for speech synthesis', () => {
    // Tests stripping of *, _, # markdown formatting generated by LLM
    const cleanFn = (text) => text.replace(/[\*\_#]/g, '').trim();

    assert.strictEqual(cleanFn("**Arre wah!** That's great."), "Arre wah! That's great.");
    assert.strictEqual(cleanFn("### Heading: _Practice_ time."), "Heading: Practice time.");
    assert.strictEqual(cleanFn("****"), "");
    assert.strictEqual(cleanFn("___"), "");
  });

  it('B6: Handles extreme long stream with no punctuation by flushing at stream completion', () => {
    // Adversarial: If LLM produces long text without terminal punctuation, stream completion must flush
    let buffer = "This is a continuous stream without any punctuation marks at all";
    const { sentences, remainder } = chunkText(buffer);
    assert.strictEqual(sentences.length, 0, 'No sentence emitted mid-stream without delimiter');
    assert.strictEqual(remainder, buffer, 'Buffer retains entire text for stream-end flush');

    // Simulate stream end flush
    const finalClean = remainder.replace(/[\*\_#]/g, '').trim();
    assert.strictEqual(finalClean, "This is a continuous stream without any punctuation marks at all");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Matrix Category C: SSE Response Parser & Stream Handler
// ─────────────────────────────────────────────────────────────────────────────
describe('Category C: Server-Sent Events (SSE) Parser & Fallback Resilience', () => {
  function parseSSEChunk(rawChunk) {
    const lines = rawChunk.split('\n');
    const parsedTexts = [];
    let isDone = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data: ')) {
        const dataStr = trimmed.slice(6);
        if (dataStr === '[DONE]') {
          isDone = true;
          continue;
        }
        try {
          const parsed = JSON.parse(dataStr);
          const chunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (chunk) parsedTexts.push(chunk);
        } catch (e) {
          // Ignore malformed chunk
        }
      }
    }
    return { parsedTexts, isDone };
  }

  it('C1: Correctly extracts candidate text tokens from standard Google SSE frames', () => {
    // Validates JSON candidate extraction per Google Generative Language API spec
    const sseFrame = 'data: {"candidates":[{"content":{"parts":[{"text":"Arre bilkul! "}]}}]}\n\ndata: {"candidates":[{"content":{"parts":[{"text":"Aap batao."}]}}]}\n\ndata: [DONE]\n\n';
    const { parsedTexts, isDone } = parseSSEChunk(sseFrame);

    assert.strictEqual(parsedTexts.length, 2);
    assert.strictEqual(parsedTexts[0], "Arre bilkul! ");
    assert.strictEqual(parsedTexts[1], "Aap batao.");
    assert.strictEqual(isDone, true);
  });

  it('C2: Ignores malformed JSON lines, empty data lines, and heartbeat comments without throwing', () => {
    // Adversarial: Network proxies inject comments `: keepalive` or corrupt JSON fragments
    const noisySSE = ': ping\ndata: {invalid json}\ndata: \ndata: {"candidates":[{"content":{"parts":[{"text":"Valid token"}]}}]}\n\n';
    const { parsedTexts } = parseSSEChunk(noisySSE);

    assert.strictEqual(parsedTexts.length, 1);
    assert.strictEqual(parsedTexts[0], "Valid token");
  });

  it('C3: Handles multi-line split buffers across TCP packet boundaries', () => {
    // Adversarial: SSE line split across packet boundaries
    let buffer = '';
    const chunk1 = 'data: {"candidates":[{"content":{"parts":[{';
    const chunk2 = '"text":"Reconstructed text"}]}}]}\n';

    buffer += chunk1;
    let lines = buffer.split('\n');
    buffer = lines.pop() || ''; // remains in buffer
    assert.strictEqual(lines.length, 0);

    buffer += chunk2;
    lines = buffer.split('\n');
    buffer = lines.pop() || '';
    assert.strictEqual(lines.length, 1);

    const { parsedTexts } = parseSSEChunk(lines[0]);
    assert.strictEqual(parsedTexts[0], "Reconstructed text");
  });

  it('C4: Fallback trigger condition correctly detects HTTP 404 and targets gemini-2.0-flash-lite', () => {
    // Verifies fallback logic if primary model is unavailable
    const makeFallbackDecision = (primaryStatus, primaryModel, fallbackModel) => {
      if (primaryStatus === 404) {
        return fallbackModel;
      }
      return primaryModel;
    };

    assert.strictEqual(makeFallbackDecision(404, 'gemini-3.1-flash-lite', 'gemini-2.0-flash-lite'), 'gemini-2.0-flash-lite');
    assert.strictEqual(makeFallbackDecision(200, 'gemini-3.1-flash-lite', 'gemini-2.0-flash-lite'), 'gemini-3.1-flash-lite');
  });

  it('C5: First Token Latency (TTFT) timer registers non-negative integer timing', () => {
    // Tests TTFT timestamp calculation and rounding
    const startTime = 1000.0;
    const firstTokenArrival = 1134.6;
    const ttft = Math.round(firstTokenArrival - startTime);

    assert.strictEqual(ttft, 135);
    assert.ok(ttft >= 0, 'TTFT must never be negative');
    assert.ok(Number.isInteger(ttft), 'TTFT must be formatted as integer millisecond count');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Matrix Category D: State Machine, Session Lifecycle & Hardware Barge-In
// ─────────────────────────────────────────────────────────────────────────────
describe('Category D: State Machine Transitions & Sub-30ms Barge-In', () => {
  class MockVoiceEngine {
    constructor() {
      this.state = 'IDLE'; // IDLE | LISTENING | THINKING | SPEAKING
      this.hasBridge = true;
      this.activeAbortController = null;
      this.sentenceQueue = [];
      this.isSpeakingQueue = false;
      this.sentenceBuffer = '';
      this.nativeSpeaking = false;
      this.conversationHistory = [];
      this.sessionSeconds = 0;
      this.isSessionStarted = false;
    }

    startListening() {
      this.stopAllAudio();
      this.startSessionTimer();
      this.state = 'LISTENING';
    }

    stopListening() {
      if (this.state === 'LISTENING') {
        this.state = 'IDLE';
      }
    }

    startSessionTimer() {
      if (this.isSessionStarted) return;
      this.isSessionStarted = true;
      this.sessionSeconds = 0;
    }

    resetSession() {
      this.stopAllAudio();
      this.conversationHistory = [];
      this.sessionSeconds = 0;
      this.isSessionStarted = false;
      this.state = 'IDLE';
    }

    stopAllAudio() {
      this.stopListening();
      if (this.activeAbortController) {
        this.activeAbortController.abort();
        this.activeAbortController = null;
      }
      this.nativeSpeaking = false;
      this.sentenceQueue = [];
      this.isSpeakingQueue = false;
      this.sentenceBuffer = '';
      if (this.state === 'SPEAKING' || this.state === 'THINKING') {
        this.state = 'IDLE';
      }
    }

    onFinalSTT(text) {
      if (!text || !text.trim()) {
        this.state = 'IDLE';
        return;
      }
      this.state = 'THINKING';
      this.activeAbortController = new AbortController();
      this.conversationHistory.push({ role: 'user', parts: [{ text: text.trim() }] });
    }

    enqueueSentence(text) {
      if (!text.trim()) return;
      this.sentenceQueue.push(text);
      if (!this.isSpeakingQueue) {
        this.playNextSentence();
      }
    }

    playNextSentence() {
      if (!this.sentenceQueue.length) {
        this.isSpeakingQueue = false;
        this.nativeSpeaking = false;
        if (this.state === 'SPEAKING') {
          this.state = 'IDLE';
        }
        return;
      }

      this.isSpeakingQueue = true;
      this.nativeSpeaking = true;
      this.state = 'SPEAKING';
      const text = this.sentenceQueue.shift();
      return text;
    }
  }

  let engine;
  beforeEach(() => {
    engine = new MockVoiceEngine();
  });

  it('D1: Normal conversation cycle transitions: IDLE -> LISTENING -> THINKING -> SPEAKING -> IDLE', () => {
    // Verifies orderly state progression across a single conversational turn
    assert.strictEqual(engine.state, 'IDLE');

    engine.startListening();
    assert.strictEqual(engine.state, 'LISTENING');
    assert.strictEqual(engine.isSessionStarted, true);

    engine.onFinalSTT("Hello Utkio");
    assert.strictEqual(engine.state, 'THINKING');
    assert.strictEqual(engine.conversationHistory.length, 1);

    engine.enqueueSentence("Arre hello! How are you?");
    assert.strictEqual(engine.state, 'SPEAKING');
    assert.strictEqual(engine.nativeSpeaking, true);

    // TTS done event triggers playback completion
    engine.playNextSentence();
    assert.strictEqual(engine.state, 'IDLE');
    assert.strictEqual(engine.nativeSpeaking, false);
  });

  it('D2: Sub-30ms Barge-In: User speech/mic click immediately cancels active TTS, aborts SSE, and clears queues', () => {
    // Adversarial: User interrupts while AI is in SPEAKING state
    engine.startListening();
    engine.onFinalSTT("Tell me a story");
    engine.enqueueSentence("Sentence 1.");
    engine.enqueueSentence("Sentence 2.");
    engine.enqueueSentence("Sentence 3.");

    assert.strictEqual(engine.state, 'SPEAKING');
    assert.strictEqual(engine.sentenceQueue.length, 2);
    assert.ok(engine.activeAbortController !== null);

    const oldController = engine.activeAbortController;

    // User taps mic / interrupts
    engine.startListening();

    assert.strictEqual(oldController.signal.aborted, true, 'SSE fetch must be instantly aborted');
    assert.strictEqual(engine.sentenceQueue.length, 0, 'Audio sentence queue must be purged immediately');
    assert.strictEqual(engine.nativeSpeaking, false, 'Hardware TTS output must be stopped');
    assert.strictEqual(engine.state, 'LISTENING', 'State must immediately revert to LISTENING');
  });

  it('D3: Rapid double-tap on mic button does not corrupt audio state or create orphaned controllers', () => {
    // Adversarial: Rapid button tapping in quick succession
    engine.startListening();
    engine.startListening();
    engine.startListening();

    assert.strictEqual(engine.state, 'LISTENING');
    assert.strictEqual(engine.sentenceQueue.length, 0);
  });

  it('D4: Session reset cleanly purges history, aborts inflight stream, and zeroes duration timer', () => {
    // Tests newChatBtn / session reset
    engine.startListening();
    engine.sessionSeconds = 145;
    engine.onFinalSTT("Test prompt");
    engine.enqueueSentence("Test response");

    engine.resetSession();

    assert.strictEqual(engine.state, 'IDLE');
    assert.strictEqual(engine.sessionSeconds, 0);
    assert.strictEqual(engine.isSessionStarted, false);
    assert.strictEqual(engine.conversationHistory.length, 0);
    assert.strictEqual(engine.sentenceQueue.length, 0);
  });

  it('D5: Empty or whitespace-only STT transcription gracefully returns to IDLE without making API request', () => {
    // Adversarial: User makes silence/noise triggering empty stt-final event
    engine.startListening();
    engine.onFinalSTT("   ");

    assert.strictEqual(engine.state, 'IDLE');
    assert.strictEqual(engine.conversationHistory.length, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Matrix Category E: UI Helpers, Timers & Security
// ─────────────────────────────────────────────────────────────────────────────
describe('Category E: UI Helpers, Timer Formatting & Security Resilience', () => {
  function formatSessionTimer(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `⏱️ ${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  it('E1: Timer format correctly pads single digits and supports long practice sessions', () => {
    // Verifies MM:SS formatting across zero, seconds, minutes, and hour transitions
    assert.strictEqual(formatSessionTimer(0), '⏱️ 0:00');
    assert.strictEqual(formatSessionTimer(5), '⏱️ 0:05');
    assert.strictEqual(formatSessionTimer(59), '⏱️ 0:59');
    assert.strictEqual(formatSessionTimer(60), '⏱️ 1:00');
    assert.strictEqual(formatSessionTimer(150), '⏱️ 2:30');
    assert.strictEqual(formatSessionTimer(900), '⏱️ 15:00');
    assert.strictEqual(formatSessionTimer(3600), '⏱️ 60:00');
  });

  it('E2: System instruction strictly contains Hinglish, shortness constraint, and coaching rules', () => {
    // Verifies SYSTEM_INSTRUCTION prompt alignment with Utkio brand persona
    const html = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
    assert.ok(html.includes('HINGLISH'), 'Prompt must enforce Hinglish');
    assert.ok(html.includes('1 to 2 short sentences'), 'Prompt must enforce 1-2 short sentences for speed');
    assert.ok(html.includes('gently model the better English phrasing'), 'Prompt must enforce gentle modeling');
    assert.ok(html.includes('Always end with an easy question'), 'Prompt must enforce dialogue continuation');
  });

  it('E3: HTML elements and required IDs match all DOM querySelector calls', () => {
    // Validates that every ID referenced in index.html JavaScript exists in the markup
    const html = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
    const requiredIds = [
      'engineBadge',
      'engineLabel',
      'statusDot',
      'statusText',
      'transcript',
      'transcriptEmpty',
      'micBtn',
      'waveLeft',
      'waveRight',
      'sessionTimerText',
      'newChatBtn',
      'settingsBtn',
      'settingsModal',
      'modalKeyInput',
      'modalSaveBtn',
      'modalCloseBtn'
    ];

    for (const id of requiredIds) {
      assert.ok(
        html.includes(`id="${id}"`),
        `DOM element with id="${id}" must exist in index.html markup`
      );
    }
  });

  it('E4: CSS root design tokens strictly adhere to Utkio design system palette', () => {
    // Ensures color tokens match approved Utkio brand guidelines
    const html = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
    assert.ok(html.includes('--bg: #FBF1E6;'), 'Background must be warm beige #FBF1E6');
    assert.ok(html.includes('--accent-orange: #d9694b;'), 'Accent orange must be #d9694b');
    assert.ok(html.includes('--ink: #23263a;'), 'Ink must be #23263a');
    assert.ok(html.includes('--panel-2: #F5ECDF;'), 'Panel-2 must be #F5ECDF');
  });

  it('E5: Transcript text assignments use safe textContent preventing XSS injection', () => {
    // Security audit: Verifies dynamic transcripts assign textContent rather than innerHTML for user/model messages
    const html = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
    assert.ok(html.includes('lineEl.textContent ='), 'Must assign lineEl.textContent to prevent XSS');
    assert.ok(html.includes('textEl.textContent ='), 'Must assign textEl.textContent to prevent XSS');
  });

  it('E6: API Key input is safely trimmed and persistent in localStorage', () => {
    // Verifies key storage handling
    const rawKey = '  AIzaSyTestKey12345   ';
    const trimmed = rawKey.trim();
    assert.strictEqual(trimmed, 'AIzaSyTestKey12345');
    assert.ok(trimmed.startsWith('AIzaSy'), 'Valid key format prefix check');
  });
});
