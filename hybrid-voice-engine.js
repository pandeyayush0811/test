/**
 * Utkio Hybrid Voice & Model Testing Engine (hybrid-voice-engine.js)
 * 
 * Industry-Grade Real-Time Conversational Voice Architecture:
 * 1. STT / Voice Input: Real-Time User Audio Transcription into Chat Text
 * 2. LLM: Direct Gemini Flash Streaming API (:streamGenerateContent?alt=sse)
 * 3. TTS Pipelining: Sentence-Level Streaming Synthesis (Immediate playback of sentence 1 in ~350ms)
 * 4. Interruption: Sub-40ms Barge-in Controller with stream abortion & queue flush
 */

// Helper to convert base64 Linear PCM to WAV Blob
export function pcmToWavBlob(base64Pcm, sampleRate = 24000) {
  const binaryString = atob(base64Pcm);
  const len = binaryString.length;
  const buffer = new ArrayBuffer(44 + len);
  const view = new DataView(buffer);

  // RIFF Chunk
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + len, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"

  // FMT Sub-chunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono channel
  view.setUint32(24, sampleRate, true); // Sample rate
  view.setUint32(28, sampleRate * 2, true); // Byte rate
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample

  // DATA Sub-chunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, len, true);

  const pcmBytes = new Uint8Array(buffer, 44);
  for (let i = 0; i < len; i++) {
    pcmBytes[i] = binaryString.charCodeAt(i);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export class HybridVoiceEngine {
  constructor(options = {}) {
    this.apiKey = options.apiKey || '';
    this.model = options.model || 'gemini-3.1-flash-lite';
    this.inputMode = options.inputMode || 'webspeech'; // 'webspeech' (0ms text) | 'multimodal'
    // Auto-detect: use Android native bridge if available, else fall back to browser TTS
    this.ttsEngine = options.ttsEngine || (window.UtkioNativeBridge ? 'android_native' : 'browser_tts');
    this.sttLang = options.sttLang || 'en-IN';
    this.googleLang = options.googleLang || 'en-IN';
    this.speechRate = options.speechRate || 1.35;
    this.geminiVoice = options.geminiVoice || 'Aoede';
    this.systemInstruction = options.systemInstruction || '';
    this.selectedVoice = null;

    // Callbacks
    this.onStatusChange = options.onStatusChange || (() => {});
    this.onInterimSpeech = options.onInterimSpeech || (() => {});
    this.onFinalSpeech = options.onFinalSpeech || (() => {});
    this.onUserTranscription = options.onUserTranscription || (() => {});
    this.onStreamChunk = options.onStreamChunk || (() => {});
    this.onResponseComplete = options.onResponseComplete || (() => {});
    this.onError = options.onError || (() => {});
    this.onMetricsUpdate = options.onMetricsUpdate || (() => {});

    // Audio & Speech Synthesis
    this.synth = window.speechSynthesis;
    this.currentAudio = null;
    this.isListening = false;
    this.history = [];
    this.currentAbortController = null;

    // Pipelined Sentence Stream Queue
    this.sentenceQueue = [];
    this.isSpeakingQueue = false;
    this.sentenceBuffer = '';
    this.hasFirstAudioPlayed = false;

    // Web Speech STT
    this.recognition = null;

    // Direct MediaRecorder
    this.mediaStream = null;
    this.mediaRecorder = null;
    this.audioChunks = [];

    // Telemetry Timers
    this.recStartTime = 0;
    this.userFinishedTime = 0;
    this.llmStartTime = 0;
    this.firstTokenTime = 0;
    this.firstAudioTime = 0;

    this.initSpeechRecognition();
    this.initNativeAndroidBridge();
  }

  setApiKey(key) { this.apiKey = key ? key.trim() : ''; }
  setModel(model) { this.model = model || 'gemini-3.1-flash-lite'; }
  setSttLang(lang) {
    this.sttLang = lang || 'en-IN';
    if (this.recognition) this.recognition.lang = this.sttLang;
  }
  setSystemInstruction(instruction) { this.systemInstruction = instruction; }
  setSelectedVoice(voice) { this.selectedVoice = voice; }

  initNativeAndroidBridge() {
    // INDUSTRY PATTERN: Listen for DOM CustomEvents fired by Java via evaluateJavascript
    // This is decoupled, reliable, and works regardless of bridge injection timing.

    window.addEventListener('stt-partial', (e) => {
      const text = e.detail && e.detail.text;
      if (text) this.onInterimSpeech(text);
    });

    window.addEventListener('stt-final', (e) => {
      const text = e.detail && e.detail.text;
      if (text) {
        this.userFinishedTime = performance.now();
        const sttDuration = Math.round(this.userFinishedTime - this.recStartTime);
        this.onMetricsUpdate({ sttLatency: sttDuration });
        this.onFinalSpeech(text.trim(), false);
        this.sendTextToGemini(text.trim());
      }
    });

    window.addEventListener('stt-error', (e) => {
      const code = e.detail && e.detail.code;
      console.warn('[STT] Native error code:', code);
      this.isListening = false;
      this.onStatusChange('IDLE');
      if (code !== 7 && code !== 6) { // 6=no-speech, 7=no-match — not user errors
        this.onError(`Native STT Error (code ${code}). Ensure mic permission is granted.`);
      }
    });

    // TTS done fires when Java TTS utterance finishes — advance sentence queue
    window.addEventListener('tts-done', () => {
      this.playNextInSentenceQueue();
    });

    window.addEventListener('tts-stopped', () => {
      this.isSpeakingQueue = false;
      this.sentenceQueue = [];
      this.onStatusChange('IDLE');
    });
  }

  clearHistory() {
    this.history = [];
    this.stopSpeaking();
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 1. STT Initialization (Web Speech API)
  // ───────────────────────────────────────────────────────────────────────────
  initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    this.recognition = new SpeechRecognition();
    this.recognition.lang = this.sttLang;
    this.recognition.continuous = false;
    this.recognition.interimResults = true;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.recStartTime = performance.now();
      this.onStatusChange('LISTENING');
    };

    this.recognition.onresult = (event) => {
      let interim = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item.isFinal) finalTranscript += item[0].transcript;
        else interim += item[0].transcript;
      }

      if (interim) this.onInterimSpeech(interim);

      if (finalTranscript) {
        this.userFinishedTime = performance.now();
        const sttDuration = Math.round(this.userFinishedTime - this.recStartTime);
        this.onMetricsUpdate({ sttLatency: sttDuration });
        this.onFinalSpeech(finalTranscript.trim(), false);
        this.sendTextToGemini(finalTranscript.trim());
      }
    };

    this.recognition.onerror = (event) => {
      console.warn('STT Recognition Event Error:', event.error);
      this.isListening = false;
      this.onStatusChange('IDLE');
      if (event.error === 'network') {
        this.onError("Web Speech Network issue. You can switch to 'Direct Mic Audio' mode.");
      } else if (event.error !== 'no-speech') {
        this.onError(`Speech Error (${event.error}). Ensure microphone permission is granted.`);
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
    };
  }

  async startListening() {
    // True Barge-in: immediately stop AI speaking if user speaks
    this.stopSpeaking();

    // 1. If running on Android Native App, use Native Java Bridge
    if (window.UtkioNativeBridge && window.UtkioNativeBridge.startListening) {
      this.isListening = true;
      this.recStartTime = performance.now();
      this.onStatusChange('LISTENING');
      window.UtkioNativeBridge.startListening();
      return;
    }

    if (this.inputMode === 'multimodal') {
      await this.startMediaRecorder();
    } else {
      this.startWebSpeech();
    }
  }

  stopListening() {
    if (window.UtkioNativeBridge && window.UtkioNativeBridge.stopListening) {
      this.isListening = false;
      window.UtkioNativeBridge.stopListening();
      return;
    }

    if (this.inputMode === 'multimodal') {
      this.stopMediaRecorder();
    } else {
      this.stopWebSpeech();
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Mode 1: Direct MediaRecorder (Fallback Mode)
  // ───────────────────────────────────────────────────────────────────────────
  async startMediaRecorder() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Microphone API not supported on this browser.");
      }

      const isStreamValid = this.mediaStream && this.mediaStream.active && this.mediaStream.getAudioTracks().some(t => t.readyState === 'live');
      if (!isStreamValid) {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
      }
      this.audioChunks = [];

      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        if (MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm';
        else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
        else if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg';
        else mimeType = '';
      }

      const recorderOptions = mimeType ? { mimeType, audioBitsPerSecond: 24000 } : { audioBitsPerSecond: 24000 };
      this.mediaRecorder = new MediaRecorder(this.mediaStream, recorderOptions);

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) this.audioChunks.push(e.data);
      };

      this.mediaRecorder.onstart = () => {
        this.isListening = true;
        this.recStartTime = performance.now();
        this.onStatusChange('LISTENING');
        this.onInterimSpeech("Recording voice... Tap mic when finished speaking!");
      };

      this.mediaRecorder.onstop = async () => {
        this.isListening = false;
        this.userFinishedTime = performance.now();
        const recDuration = Math.round(this.userFinishedTime - this.recStartTime);
        this.onMetricsUpdate({ sttLatency: recDuration });

        if (this.audioChunks.length === 0) {
          this.onStatusChange('IDLE');
          return;
        }

        const audioBlob = new Blob(this.audioChunks, { type: mimeType });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Data = reader.result.split(',')[1];
          this.sendAudioToGemini(base64Data, mimeType);
        };
      };

      this.mediaRecorder.start();
    } catch (err) {
      console.error("MediaRecorder start error:", err);
      this.isListening = false;
      this.onStatusChange('IDLE');
      this.onError(`Microphone Error: ${err.message}. Ensure mic access is allowed.`);
    }
  }

  stopMediaRecorder() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }

  startWebSpeech() {
    if (!this.recognition) this.initSpeechRecognition();
    if (this.recognition && !this.isListening) {
      try { this.recognition.start(); } catch(e) {}
    }
  }

  stopWebSpeech() {
    if (this.recognition && this.isListening) {
      try { this.recognition.stop(); } catch(e) {}
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Direct Audio Multimodal Stream to Gemini Flash (Direct Single-Pass Spoken Reply)
  // ───────────────────────────────────────────────────────────────────────────
  async sendAudioToGemini(base64Audio, mimeType) {
    if (!this.apiKey) {
      this.onError('Please enter your Gemini API Key in the left panel.');
      this.onStatusChange('IDLE');
      return;
    }

    this.stopSpeaking();
    if (this.currentAbortController) this.currentAbortController.abort();
    this.currentAbortController = new AbortController();

    this.onStatusChange('THINKING');
    this.llmStartTime = performance.now();
    if (!this.userFinishedTime) this.userFinishedTime = this.llmStartTime;
    this.hasFirstAudioPlayed = false;
    this.sentenceBuffer = '';
    this.sentenceQueue = [];

    // Create user bubble
    this.onFinalSpeech("🎙️ (Spoken Voice Query)", false);

    const promptInstruction = `Listen to the user's spoken audio in Indian English/Hinglish. Respond directly in 1-2 natural, warm spoken sentences as the Utkio AI English Coach. Do NOT include any prefixes, tags, metadata, or bullet points. Speak directly to the learner.`;

    const contents = [
      ...this.history.map(h => ({ role: h.role, parts: h.parts })),
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: mimeType.split(';')[0], data: base64Audio } },
          { text: promptInstruction }
        ]
      }
    ];

    const genConfig = { maxOutputTokens: 200, temperature: 0.7 };
    if (this.ttsEngine === 'gemini_native') {
      genConfig.responseModalities = ["AUDIO", "TEXT"];
      genConfig.speechConfig = {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: this.geminiVoice || "Aoede" } }
      };
    }

    const payload = { contents, generationConfig: genConfig };
    if (this.systemInstruction) {
      payload.systemInstruction = { parts: [{ text: this.systemInstruction }] };
    }

    await this.streamGemini(payload, false);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Text Stream to Gemini Flash-Lite (Fast Path ⚡)
  // ───────────────────────────────────────────────────────────────────────────
  async sendTextToGemini(userText) {
    if (!this.apiKey) {
      this.onError('Please enter your Gemini API Key in the left panel.');
      this.onStatusChange('IDLE');
      return;
    }

    this.stopSpeaking();
    if (this.currentAbortController) this.currentAbortController.abort();
    this.currentAbortController = new AbortController();

    this.onStatusChange('THINKING');
    this.llmStartTime = performance.now();
    if (!this.userFinishedTime) this.userFinishedTime = this.llmStartTime;
    this.hasFirstAudioPlayed = false;
    this.sentenceBuffer = '';
    this.sentenceQueue = [];

    this.history.push({ role: 'user', parts: [{ text: userText }] });

    const genConfig = { maxOutputTokens: 200, temperature: 0.7 };
    if (this.ttsEngine === 'gemini_native') {
      genConfig.responseModalities = ["AUDIO", "TEXT"];
      genConfig.speechConfig = {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: this.geminiVoice || "Aoede" } }
      };
    }

    const payload = {
      contents: this.history.map(h => ({ role: h.role, parts: h.parts })),
      generationConfig: genConfig
    };

    if (this.systemInstruction) {
      payload.systemInstruction = { parts: [{ text: this.systemInstruction }] };
    }

    await this.streamGemini(payload, false);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Core SSE Streamer with Sentence Pipelining ⚡
  // ───────────────────────────────────────────────────────────────────────────
  async streamGemini(payload, isAudioInput = false) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:streamGenerateContent?alt=sse&key=${this.apiKey}`;
    let fullReplyText = '';
    let audioPcmBase64 = '';
    let isFirstToken = true;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: this.currentAbortController.signal
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6);
            if (dataStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(dataStr);
              const candidate = parsed.candidates?.[0];
              const parts = candidate?.content?.parts || [];

              for (const part of parts) {
                if (part.text) {
                  if (isFirstToken) {
                    isFirstToken = false;
                    this.firstTokenTime = performance.now();
                    const ttft = Math.round(this.firstTokenTime - this.llmStartTime);
                    this.onMetricsUpdate({ ttft });
                  }

                  fullReplyText += part.text;
                  this.onStreamChunk(fullReplyText);

                  if (this.ttsEngine !== 'gemini_native') {
                    this.processTextChunkForSentences(part.text);
                  }
                }

                if (part.inlineData && part.inlineData.data) {
                  audioPcmBase64 += part.inlineData.data;
                }
              }
            } catch (e) {
              // Partial JSON, continue
            }
          }
        }
      }

      const genTime = Math.round(performance.now() - this.llmStartTime);
      this.onMetricsUpdate({ genTime });

      // Flush any remaining sentence buffer
      if (this.ttsEngine !== 'gemini_native' && this.sentenceBuffer.trim()) {
        this.enqueueSentence(this.sentenceBuffer.trim());
        this.sentenceBuffer = '';
      }

      if (!fullReplyText && audioPcmBase64) {
        fullReplyText = "(Spoken Voice Response)";
        this.onStreamChunk(fullReplyText);
      }

      this.history.push({ role: 'model', parts: [{ text: fullReplyText }] });
      this.onResponseComplete(fullReplyText);

      // If Gemini Native Audio was returned, play full WAV blob
      if (this.ttsEngine === 'gemini_native' && audioPcmBase64) {
        const wavBlob = pcmToWavBlob(audioPcmBase64, 24000);
        this.playAudioBlob(wavBlob);
      }

    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('Gemini stream aborted by user barge-in.');
        return;
      }
      console.error('Gemini API Stream Error:', err);
      this.onError(`AI Error: ${err.message}`);
      this.onStatusChange('IDLE');
    } finally {
      this.currentAbortController = null;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Sentence & Clause Slicing & Utterance Queue Pipelining 🚀 (< 100ms TTFA)
  // ───────────────────────────────────────────────────────────────────────────
  processTextChunkForSentences(textChunk) {
    this.sentenceBuffer += textChunk;

    let hasMatch = true;
    while (hasMatch) {
      hasMatch = false;

      // Match 1: Full sentence boundary (. ! ? \n Hindi poornaviram)
      const sentenceMatch = this.sentenceBuffer.match(/^([\s\S]+?[.!?\n।]+)\s*([\s\S]*)$/);
      if (sentenceMatch) {
        const sentence = sentenceMatch[1].trim();
        this.sentenceBuffer = sentenceMatch[2];
        if (sentence) {
          this.enqueueSentence(sentence);
          hasMatch = true;
        }
      } else if (!this.hasFirstAudioPlayed && this.sentenceBuffer.length >= 20) {
        // Match 2: Fast Clause Boundary for Initial Audio (< 100ms Perceived Latency)
        const clauseMatch = this.sentenceBuffer.match(/^([\s\S]+?[,;:\-–])\s*([\s\S]*)$/);
        if (clauseMatch) {
          const clause = clauseMatch[1].trim();
          this.sentenceBuffer = clauseMatch[2];
          if (clause) {
            this.enqueueSentence(clause);
            hasMatch = true;
          }
        }
      } else if (this.sentenceBuffer.length > 60) {
        // Match 3: Long clause breaker
        const clauseMatch = this.sentenceBuffer.match(/^([\s\S]+?[,;:\-–])\s*([\s\S]*)$/);
        if (clauseMatch) {
          const clause = clauseMatch[1].trim();
          this.sentenceBuffer = clauseMatch[2];
          if (clause) {
            this.enqueueSentence(clause);
            hasMatch = true;
          }
        }
      }
    }
  }

  enqueueSentence(sentenceText) {
    const clean = sentenceText
      .replace(/[*_`#]/g, '')
      .replace(/\[.*?\]\(.*?\)/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .trim();

    if (!clean) return;

    this.sentenceQueue.push(clean);
    if (!this.isSpeakingQueue) {
      this.playNextInSentenceQueue();
    }
  }

  playNextInSentenceQueue() {
    if (this.sentenceQueue.length === 0) {
      this.isSpeakingQueue = false;
      this.onStatusChange('IDLE');
      return;
    }

    this.isSpeakingQueue = true;
    const currentSentence = this.sentenceQueue.shift();

    const bridgeAvailable = window.UtkioNativeBridge && window.UtkioNativeBridge.speakChunk;

    if (this.ttsEngine === 'android_native' && bridgeAvailable) {
      this.playNativeAndroidSentence(currentSentence);
    } else if (this.ttsEngine === 'android_native' && !bridgeAvailable) {
      // Bridge not available (browser preview / WebView not yet bridged) — fallback to browser TTS
      console.warn('[TTS] android_native selected but UtkioNativeBridge not found. Falling back to browser TTS.');
      this.playBrowserSentence(currentSentence);
    } else if (this.ttsEngine === 'google_indian') {
      this.playGoogleSentence(currentSentence);
    } else {
      this.playBrowserSentence(currentSentence);
    }
  }

  playNativeAndroidSentence(sentence) {
    if (!this.hasFirstAudioPlayed) {
      this.hasFirstAudioPlayed = true;
      this.firstAudioTime = performance.now();
      const ttfa = Math.round(this.firstAudioTime - (this.userFinishedTime || this.llmStartTime));
      const ttsDelay = Math.round(this.firstAudioTime - this.llmStartTime);
      this.onMetricsUpdate({ ttsDelay, totalRtt: ttfa });
    }
    this.onStatusChange('SPEAKING');

    // INDUSTRY PATTERN: speakChunk takes text + rate only.
    // Completion is signalled by 'tts-done' CustomEvent from Java (not a callback param).
    window.UtkioNativeBridge.speakChunk(sentence, parseFloat(this.speechRate) || 1.35);
    // playNextInSentenceQueue() is called by the 'tts-done' event listener above.
  }

  playGoogleSentence(sentence) {
    const lang = this.googleLang || 'en-IN';
    const rate = parseFloat(this.speechRate) || 1.35;
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(lang)}&q=${encodeURIComponent(sentence)}`;

    this.currentAudio = new Audio(url);
    this.currentAudio.playbackRate = rate;
    this.currentAudio.preservesPitch = true;

    this.currentAudio.onplay = () => {
      if (!this.hasFirstAudioPlayed) {
        this.hasFirstAudioPlayed = true;
        this.firstAudioTime = performance.now();
        const ttfa = Math.round(this.firstAudioTime - (this.userFinishedTime || this.llmStartTime));
        const ttsDelay = Math.round(this.firstAudioTime - this.llmStartTime);
        this.onMetricsUpdate({ ttsDelay, totalRtt: ttfa });
      }
      this.onStatusChange('SPEAKING');
    };

    this.currentAudio.onended = () => {
      this.currentAudio = null;
      this.playNextInSentenceQueue();
    };

    this.currentAudio.onerror = (e) => {
      console.warn("Google TTS chunk failed, falling back to local voice:", e);
      this.playBrowserSentence(sentence);
    };

    this.currentAudio.play().catch(err => {
      console.warn("Audio autoplay blocked, falling back to local synth:", err);
      this.playBrowserSentence(sentence);
    });
  }

  playBrowserSentence(sentence) {
    if (!this.synth) {
      this.playNextInSentenceQueue();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.rate = parseFloat(this.speechRate) || 1.35;

    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    } else {
      const voices = this.synth.getVoices();
      const inVoice = voices.find(v => (v.lang.includes('en-IN') || v.lang.includes('hi-IN') || v.name.includes('India') || v.name.includes('Neerja') || v.name.includes('Heera')));
      const usVoice = voices.find(v => v.lang.includes('en-US'));
      if (inVoice) utterance.voice = inVoice;
      else if (usVoice) utterance.voice = usVoice;
    }

    utterance.onstart = () => {
      if (!this.hasFirstAudioPlayed) {
        this.hasFirstAudioPlayed = true;
        this.firstAudioTime = performance.now();
        const ttfa = Math.round(this.firstAudioTime - (this.userFinishedTime || this.llmStartTime));
        const ttsDelay = Math.round(this.firstAudioTime - this.llmStartTime);
        this.onMetricsUpdate({ ttsDelay, totalRtt: ttfa });
      }
      this.onStatusChange('SPEAKING');
    };

    utterance.onend = () => {
      this.playNextInSentenceQueue();
    };

    utterance.onerror = () => {
      this.playNextInSentenceQueue();
    };

    this.synth.speak(utterance);
  }

  playAudioBlob(blob) {
    this.stopSpeaking();
    const url = URL.createObjectURL(blob);
    this.currentAudio = new Audio(url);
    this.currentAudio.playbackRate = parseFloat(this.speechRate) || 1.35;
    this.currentAudio.preservesPitch = true;

    this.currentAudio.onplay = () => {
      const ttfa = Math.round(performance.now() - (this.userFinishedTime || this.llmStartTime));
      this.onMetricsUpdate({ ttsDelay: ttfa, totalRtt: ttfa });
      this.onStatusChange('SPEAKING');
    };

    this.currentAudio.onended = () => {
      URL.revokeObjectURL(url);
      this.currentAudio = null;
      this.onStatusChange('IDLE');
    };

    this.currentAudio.onerror = () => {
      URL.revokeObjectURL(url);
      this.currentAudio = null;
      this.onStatusChange('IDLE');
    };

    this.currentAudio.play().catch(() => {
      this.onStatusChange('IDLE');
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Barge-In / Instant Stop Controller ⏹️
  // ───────────────────────────────────────────────────────────────────────────
  stopSpeaking() {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
    this.sentenceBuffer = '';
    this.sentenceQueue = [];
    this.isSpeakingQueue = false;

    if (window.UtkioNativeBridge && window.UtkioNativeBridge.stopSpeaking) {
      window.UtkioNativeBridge.stopSpeaking();
    }

    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    if (this.synth && this.synth.speaking) {
      this.synth.cancel();
    }
    this.onStatusChange('IDLE');
  }

  speak(rawText) {
    this.stopSpeaking();
    const cleanText = rawText.replace(/[*_`#]/g, '').replace(/\[.*?\]\(.*?\)/g, '').trim();
    if (!cleanText) return;

    const sentences = cleanText.match(/[^.!?\n,]+[.!?\n,]*/g) || [cleanText];
    for (const s of sentences) {
      if (s.trim()) this.enqueueSentence(s.trim());
    }
  }
}
