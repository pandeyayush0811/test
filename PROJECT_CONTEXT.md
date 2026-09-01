# 🚀 Utkio Android Voice Engine & Cascade Architecture
## In-Depth Technical Specification & System Blueprint

**Last Updated:** September 1, 2026  
**Module Directory:** `v2/product_test/`  
**Status:** Active Laboratory / R&D Validated Blueprint  
**Core Target:** 100% Android-First Ultra-Low Cost (< ₹0.05/session) Real-Time Voice AI

---

## 1. Executive Summary & Objective

`product_test/` is the dedicated research, benchmarking, and architectural proving ground for **Utkio's next-generation conversational voice pipeline**.

### The Core Problem Solved:
Previous bidirectional audio WebSocket streaming architectures (e.g. Gemini Live / OpenAI Realtime) cost **₹20 - ₹25 per 15-minute practice session**, making ₹99/month and ₹121/month subscription tiers economically unviable.

### The Solution:
The **On-Device Hybrid Cascade Voice Architecture**:
1. **Input:** Free on-device Google Android SpeechRecognizer (`en-IN`) with hardware Voice Activity Detection (VAD).
2. **Intelligence:** Direct SSE Text Streaming to Google's ultra-low-cost conversational model **`gemini-3.1-flash-lite`** (TTFT ~120ms).
3. **Output:** Free on-device Android Native `TextToSpeech` (`en_IN` @ 1.35x speed) with **Sentence-Level Pipelining** (speaking sentence #1 in ~300ms).
4. **Hands-Free Turn-Taking:** Automatic VAD re-arming after AI completes speech + sub-30ms hardware barge-in/interruption.

---

## 2. Comprehensive Architectural Stack

```mermaid
flowchart TD
    subgraph ClientHardware["📱 Android Client Hardware (On-Device · ₹0 Cost)"]
        A["🎙️ User Voice Input"] --> B["⚡ On-Device VAD Engine"]
        B --> C["🇮🇳 Google SpeechRecognizer (en-IN)"]
        C --> D["📝 Streamed Text Transcript"]
    end

    subgraph IntelligenceLayer["☁️ Cloud Intelligence (Ultra-Low Cost)"]
        D --> E["⚡ Gemini 3.1 Flash-Lite (SSE Streaming)"]
        E --> F["🧠 Sub-140ms First Token (TTFT)"]
        F --> G["💬 Sentence Pipelining Buffer (Regex Punctuation Match)"]
    end

    subgraph SpeechOutput["🔊 Android Native Audio Output (On-Device · ₹0 Cost)"]
        G --> H["Sentence 1 (".", "!", "?") Ready in ~300ms"]
        H --> I["Android TextToSpeech (en_IN @ 1.35x)"]
        I --> J["🔊 Speaker / Earpiece Playback"]
        J --> K{"User Starts Speaking?"}
        K -->|Yes (Barge-in)| L["🛑 Sub-30ms Hardware Utterance Cancel"]
        K -->|No (Turn Finished)| M["🔄 Auto-Re-Arm VAD Listening"]
    end
```

---

## 3. Deep-Dive: Layer-by-Layer Mechanics

### 3.1 Voice Input Layer: Google Android Native STT (`en-IN`)
- **Technology:** Android `SpeechRecognizer` (`android.speech.SpeechRecognizer`) via `MainActivity.java` JavaScript interface (`UtkioNativeBridge`).
- **Language Code:** `en-IN` (Indian English).
- **Why `en-IN` is Essential:**
  - Google's `en-IN` acoustic language model is trained specifically on Indian multilingual speech.
  - Accurately transcribes mixed English, Indian accents, and everyday Hinglish code-switching (*arre, matlab, actually, practice, hesitation*) into clean Roman text.
- **Latency:** **0ms upload delay** (audio is processed directly on the device hardware).
- **Cost:** **₹0 / 100% Free**.

### 3.2 Hands-Free Turn-Taking & VAD (Approach #2)
- **Voice Activity Detection:** Uses native Android audio silence detection and speech boundaries.
- **Turn-Taking Flow:**
  1. User starts speaking ➔ `stt-partial` events stream words into the chat transcript.
  2. User pauses (0.8s – 1.2s silence) ➔ `stt-final` event automatically fires.
  3. No manual button taps required throughout the practice session.
  4. Session timer (`⏱️ 0:00` ➔ `⏱️ 2:30`...) tracks continuous engagement.

### 3.3 Intelligence Layer: `gemini-3.1-flash-lite`
- **Model Endpoint:** `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:streamGenerateContent?alt=sse`
- **Fallback Hierarchy:** `gemini-3.1-flash-lite` ➔ `gemini-2.0-flash-lite` ➔ `gemini-2.0-flash`.
- **System Persona:** Warm, friendly, non-judgmental Indian AI English Coach ("Utkio").
- **Generation Parameters:**
  - `maxOutputTokens`: 200 (Enforces short, dynamic 1–2 sentence conversational turns).
  - `temperature`: 0.7 (Balances natural empathy with strict fluency modeling).
- **Time to First Token (TTFT):** **100ms – 140ms**.

### 3.4 Voice Output Layer: Sentence-Pipelined Android TTS
- **Technology:** Android `TextToSpeech` (`android.speech.tts.TextToSpeech`) configured with `Locale("en", "IN")`.
- **Speed Tuning:** **1.35x speed** with **1.05x pitch** (ensures snappy, energetic conversational pacing without sounding rushed).
- **Pipelining Mechanics:**
  - As Gemini streams response tokens, text is buffered until punctuation (`.`, `!`, `?`, `\n`) is encountered.
  - The first sentence is immediately enqueued and spoken by Android TTS while subsequent sentences are still being streamed over SSE.
  - **Perceived Speech Latency:** **~280ms – 380ms** (matches human conversational response time).

### 3.5 Sub-30ms Hardware Barge-In (Interruption Handling)
- If the user starts speaking while Android TTS is playing audio, the native bridge immediately triggers:
  - `textToSpeech.stop()`
  - `activeAbortController.abort()`
  - Audio queue flush.
- Allows natural interruptions without requiring headphones.

---

## 4. Cost & Latency Benchmark Comparison

| Pipeline Attribute | Old Bidirectional WebSocket Audio | New Utkio On-Device Cascade | Improvement / Savings |
| :--- | :--- | :--- | :--- |
| **STT Processing Cost** | ~$0.006 / min | **₹0 (On-Device Android)** | **100% Free** |
| **LLM Inference Cost** | ~$0.03 / min (Audio rates) | **~$0.075 / 1M tokens (Flash-Lite)** | **> 98% Cheaper** |
| **TTS Synthesis Cost** | ~$0.015 / min | **₹0 (On-Device Android)** | **100% Free** |
| **Total 15-Min Session Cost**| **~₹20.00 – ₹25.00** | **~₹0.04 – ₹0.06** | **99.8% Cost Reduction** |
| **Gross Margin on ₹99/mo Plan**| -150% (Heavy Loss) | **> 96% Gross Profit** | **Commercially Sustainable** |
| **First Audio Perceived Latency**| 900ms – 1,600ms | **~280ms – 380ms** | **~4x Faster Response** |
| **Bandwidth Consumption** | ~1.5 MB / min (Raw PCM) | **~15 KB / min (Text Only)** | **99% Bandwidth Saved** |

---

## 5. Directory Blueprint (`product_test/`)

```
product_test/
├── android/                         → Android Studio Capacitor Native Project
│   └── app/src/main/java/com/utkio/lab/
│       └── MainActivity.java        → UtkioNativeBridge (Hardware STT + TTS + VAD)
├── www/                             → Capacitor Web Assets Directory
│   └── index.html                   → Synced Native App Webview Entrypoint
├── capacitor.config.json            → Capacitor Android Configuration (com.utkio.lab)
├── index.html                       → Master Single-Page Android Voice UI & Controller
├── PROJECT_CONTEXT.md               → Architectural Source of Truth (This Document)
├── VOICE_ENGINE_AUDIT.md            → Deep-Dive Engineering Audit & Validation Report
└── README.md                        → Quickstart & Operational Guide
```

---

## 6. Migration Roadmap to Utkio Main App (`frontend_updated/`)

1. **Step 1:** Merge `UtkioNativeBridge` methods from `product_test/android/.../MainActivity.java` into `frontend_updated/frontend/android/.../MainActivity.java`.
2. **Step 2:** Replace the heavy WebSocket audio engine in `frontend_updated/frontend/www/shared/voice-live-session.js` with the lightweight `streamGeminiFlash` sentence-pipelined engine.
3. **Step 3:** Update `frontend_updated/frontend/www/chat.html` to consume the native engine with session duration timer.
4. **Step 4:** Run `npx cap sync android` in `frontend_updated/frontend` and build release APK.
