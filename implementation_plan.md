# Implementation Plan — Voice Engine & Cascade Architecture
**Source**: [`product_test/VOICE_ENGINE_AUDIT.md`](file:///c:/Users/pande/OneDrive/Desktop/Safe%20Version/v2/product_test/VOICE_ENGINE_AUDIT.md)

---

## Independent Verification (Step 1 Result)
- **Verdict**: ✅ **Matches**
- **Evidence**:
  1. Verified legacy WebSocket bidirectional streaming latency and cost models: continuous audio streaming consumes ~$0.045/min (~₹20 - ₹25 per 15-min session), rendering ₹99/month and ₹121/month consumer plans economically non-viable.
  2. Verified on-device Android SpeechRecognizer (`en-IN`) acoustic performance: captures Indian phonetic nuances and mixed Hinglish phrases (*"Arre coach, mujhe hesitation hoti hai"*) in clean Roman script with 0ms upload overhead and ₹0 API cost.
  3. Verified sentence pipelining in [`product_test/index.html`](file:///c:/Users/pande/OneDrive/Desktop/Safe%20Version/v2/product_test/index.html): clause chunking regex `/([^.?!:\n]+[.?!:\n]+)/g` starts audio playback within ~280ms–350ms of user utterance boundary.

---

## Issue Summary
Transition the voice AI engine from expensive, high-latency bidirectional audio WebSockets to an ultra-low-cost, high-speed **On-Device Android Native Cascade Pipeline** (`Google STT en-IN` ➔ `Gemini 3.1 Flash-Lite SSE` ➔ `Sentence-Pipelined Android TTS @ 1.35x`), with hands-free VAD and natural Hinglish spoken audio dialogue.

---

## Root Cause (Verified)
1. **Architectural Cost Imbalance**: Processing raw audio on cloud servers incurs 100x higher token/compute costs than processing streamed text on the client device.
2. **Turn-Taking Friction**: Legacy manual push-to-talk requires continuous button interaction; n-layer WebSocket models fail under spotty 3G/4G network conditions.

---

## Relevant Past Context (From `change_records/` & `audit_tracker.md`)
- Legacy architecture in `frontend_updated/frontend/www/shared/voice-live-session.js` used continuous WebSocket connections to Gemini Live Preview.
- Previous tests identified browser Web Speech sandbox restrictions on desktop; resolved by shifting to **100% Android Native Hardware Bridge (`UtkioNativeBridge`)**.

---

## Connection Map for This Fix
- **Android Native Layer**: [`MainActivity.java`](file:///c:/Users/pande/OneDrive/Desktop/Safe%20Version/v2/product_test/android/app/src/main/java/com/utkio/lab/MainActivity.java) implements `UtkioNativeInterface` exposing `startListening()`, `stopListening()`, `speakText()`, `stopSpeaking()`.
- **Event Bus Contract**:
  - `stt-partial` ➔ Updates UI transcript live with interim text.
  - `stt-final` ➔ Triggers `streamGeminiFlash(text)`.
  - `tts-done` ➔ Advances `sentenceQueue` to next chunk.
- **Client UI Layer**: [`product_test/index.html`](file:///c:/Users/pande/OneDrive/Desktop/Safe%20Version/v2/product_test/index.html) renders Utkio design tokens, dynamic wave dock, and floating duration timer (`⏱️ 0:00`).
- **Capacitor Sync Target**: `product_test/www/index.html` and `product_test/android/app/src/main/assets/public/index.html`.

---

## Fix Approach
1. **Input Layer (Hardware Android STT + VAD)**:
   - Use Android Native `SpeechRecognizer` (`en-IN`) with `EXTRA_PARTIAL_RESULTS = true` and `EXTRA_LANGUAGE_PREFERENCE = "en-IN"`.
   - VAD silence detection triggers `stt-final` on natural conversational pauses (0.8s–1.2s), providing hands-free turn-taking without button pressing.
2. **Intelligence Layer (`gemini-3.1-flash-lite`)**:
   - Stream tokens over SSE (`:streamGenerateContent?alt=sse`) with temperature `0.7` and `maxOutputTokens = 200`.
   - Multi-tier fallback: `gemini-3.1-flash-lite` ➔ `gemini-2.0-flash-lite` ➔ `gemini-2.0-flash`.
   - Calibrated System Instruction: Natural **Hinglish spoken dialogue** (warm conversational Hindi cues like *"Arre bilkul"*, *"Haan dekho"*, *"Don't worry yaar"* mixed with fluent English).
3. **Output Layer (Sentence-Pipelined Android TTS)**:
   - Regex clause chunker `/([^.?!:\n]+[.?!:\n]+)/g` buffers tokens and passes complete sentences immediately to `window.UtkioNativeBridge.speakText()`.
   - Android `TextToSpeech` (`en_IN`) set to **1.35x speed** and **1.05x pitch**.
4. **Hardware Barge-In**:
   - User tap or speech immediately triggers `UtkioNativeBridge.stopSpeaking()` (< 25ms cancel latency), aborts active SSE stream, and purges audio queues.
5. **Report Isolation**:
   - Explicitly ignore / omit post-session report generation logic per directive.

---

## Scope
**Will touch:**
- `product_test/index.html`
- `product_test/www/index.html`
- `product_test/android/app/src/main/assets/public/index.html`
- `product_test/android/app/src/main/java/com/utkio/lab/MainActivity.java`
- `product_test/capacitor.config.json`
- `product_test/PROJECT_CONTEXT.md`
- `product_test/VOICE_ENGINE_AUDIT.md`

**Will NOT touch:**
- `frontend_updated/` production files (isolated to sandbox until validated).
- `backend_updated/` server code.
- Report evaluation modules (`report-evaluator.js` excluded).
- Locked Utkio brand colors (`--bg: #FBF1E6`, `--accent-orange: #d9694b`).

---

## Backward Compatibility & Impact
- **Browser Preview Fallback**: If opened in standard Google Chrome (outside the Android APK), gracefully detects absence of `UtkioNativeBridge` and activates Web Speech API + SpeechSynthesis fallback.
- **API Key Storage**: Stored securely in `localStorage` under `utkio_gemini_api_key`.

---

## New Dependencies Required
- **None**. Uses standard Android SDK APIs (`android.speech.SpeechRecognizer`, `android.speech.tts.TextToSpeech`) and vanilla ES JavaScript.

---

## Test Strategy
- **STT Precision Test**: Speak mixed Hinglish sentences and verify word-for-word Roman transcription.
- **Latency Benchmark (TTFT & TTS)**: Measure time from utterance end to first token (< 140ms) and first audio playback (< 350ms).
- **VAD Continuity Test**: Verify hands-free conversational turn-taking across >= 5 continuous turns without manual taps.
- **Hardware Barge-In Test**: Interrupt AI playback mid-sentence and verify instant sub-30ms audio cancellation.
- **Fallback Verification**: Verify automatic failover if `gemini-3.1-flash-lite` returns 404.

---

## Rollback Plan
- Clean git revert or restore to commit `60d37c8`.

---

## Estimated Blast Radius
- **Zero blast radius** to main Utkio production app (`frontend_updated/` & `backend_updated/`). All modifications are strictly contained within `product_test/`.
