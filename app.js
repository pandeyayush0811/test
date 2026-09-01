/**
 * Utkio Architecture Lab — Main Controller (app.js)
 */

import { HybridVoiceEngine } from './hybrid-voice-engine.js';
import { AudioVisualizer } from './audio-visualizer.js';
import { SCENARIO_PRESETS } from './scenarios.js';
import { generateHinglishReport, renderMarkdownToHtml } from './report-evaluator.js';

// DOM Elements
const geminiApiKeyInput = document.getElementById('geminiApiKey');
const toggleKeyVisibilityBtn = document.getElementById('toggleKeyVisibility');
const apiStatusBadge = document.getElementById('apiStatusBadge');
const modelSelect = document.getElementById('modelSelect');
const customModelGroup = document.getElementById('customModelGroup');
const customModelNameInput = document.getElementById('customModelName');
const sttLangSelect = document.getElementById('sttLang');
const ttsVoiceSelect = document.getElementById('ttsVoiceSelect');
const testApiBtn = document.getElementById('testApiBtn');

const scenarioChips = document.getElementById('scenarioChips');
const systemPromptEditor = document.getElementById('systemPromptEditor');
const resetPromptBtn = document.getElementById('resetPromptBtn');

const metricStt = document.getElementById('metricStt');
const metricTtft = document.getElementById('metricTtft');
const metricTts = document.getElementById('metricTts');
const metricTurns = document.getElementById('metricTurns');
const generateReportBtn = document.getElementById('generateReportBtn');
const clearChatBtn = document.getElementById('clearChatBtn');

const stateOrb = document.getElementById('stateOrb');
const stateTitle = document.getElementById('stateTitle');
const stateDesc = document.getElementById('stateDesc');

const chatViewport = document.getElementById('chatViewport');
const welcomeBanner = document.getElementById('welcomeBanner');
const messagesStream = document.getElementById('messagesStream');

const interimCapsule = document.getElementById('interimCapsule');
const interimText = document.getElementById('interimText');
const mainMicBtn = document.getElementById('mainMicBtn');
const micBtnLabel = document.getElementById('micBtnLabel');
const textInput = document.getElementById('textInput');
const sendTextBtn = document.getElementById('sendTextBtn');
const stopTtsBtn = document.getElementById('stopTtsBtn');

// Report Modal Elements
const reportModal = document.getElementById('reportModal');
const closeReportModalBtn = document.getElementById('closeReportModalBtn');
const closeReportBtn2 = document.getElementById('closeReportBtn2');
const reportLoading = document.getElementById('reportLoading');
const reportContent = document.getElementById('reportContent');
const copyReportBtn = document.getElementById('copyReportBtn');
const exportJsonBtn = document.getElementById('exportJsonBtn');

const toast = document.getElementById('toast');

// State
let currentScenario = 'freeform';
let conversationTurns = []; // Array of { id, role, text, timestamp }
let visualizer = null;
let engine = null;
let currentStreamingMsgBubble = null;
let currentUserMsgBubble = null;
let lastGeneratedReportMarkdown = '';

// ─────────────────────────────────────────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  visualizer = new AudioVisualizer('waveformCanvas');

  // Load saved preferences
  const savedKey = localStorage.getItem('utkio_lab_gemini_key') || '';
  if (savedKey) {
    geminiApiKeyInput.value = savedKey;
    updateKeyStatusBadge(true);
  }

  const savedModel = localStorage.getItem('utkio_lab_model') || 'gemini-3.1-flash-lite';
  if (modelSelect.querySelector(`option[value="${savedModel}"]`)) {
    modelSelect.value = savedModel;
  } else {
    modelSelect.value = 'custom';
    customModelGroup.style.display = 'block';
    customModelNameInput.value = savedModel;
  }

  // Populate System Prompt
  loadScenarioPrompt(currentScenario);

  // Initialize Voices
  populateVoices();
  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = populateVoices;
  }

  // Initialize Hybrid Engine
  initEngine();

  // Attach Event Listeners
  attachEvents();
});

function getActiveModel() {
  if (modelSelect.value === 'custom') {
    return customModelNameInput.value.trim() || 'gemini-3.1-flash-lite';
  }
  return modelSelect.value;
}

function initEngine() {
  engine = new HybridVoiceEngine({
    apiKey: geminiApiKeyInput.value.trim(),
    model: getActiveModel(),
    sttLang: sttLangSelect.value,
    systemInstruction: systemPromptEditor.value,

    onStatusChange: (status) => {
      handleEngineStatusChange(status);
    },

    onInterimSpeech: (interim) => {
      interimCapsule.style.display = 'flex';
      interimText.innerText = `"${interim}"`;
    },

    onFinalSpeech: (text, isStreaming = false) => {
      interimCapsule.style.display = 'none';
      currentUserMsgBubble = appendMessage('user', text, isStreaming);
    },

    onUserTranscription: (transcriptionText, isFinal = false) => {
      if (currentUserMsgBubble) {
        updateMessageText(currentUserMsgBubble, transcriptionText);
        if (isFinal) {
          conversationTurns.push({
            id: crypto.randomUUID(),
            role: 'user',
            text: transcriptionText,
            timestamp: new Date().toISOString()
          });
          updateTurnMetrics();
          currentUserMsgBubble = null;
        }
      }
    },

    onStreamChunk: (fullTextSoFar) => {
      if (!currentStreamingMsgBubble) {
        currentStreamingMsgBubble = appendMessage('ai', fullTextSoFar, true);
      } else {
        updateMessageText(currentStreamingMsgBubble, fullTextSoFar);
      }
    },

    onResponseComplete: (finalReply) => {
      if (currentStreamingMsgBubble) {
        updateMessageText(currentStreamingMsgBubble, finalReply);
        currentStreamingMsgBubble = null;
      }
      conversationTurns.push({
        id: crypto.randomUUID(),
        role: 'ai',
        text: finalReply,
        timestamp: new Date().toISOString()
      });
      updateTurnMetrics();
    },

    onError: (errMsg) => {
      showToast(errMsg, 'error');
      handleEngineStatusChange('IDLE');
    },

    onMetricsUpdate: (metrics) => {
      if (metrics.sttLatency !== undefined) metricStt.innerText = `${metrics.sttLatency} ms`;
      if (metrics.ttft !== undefined) metricTtft.innerText = `${metrics.ttft} ms`;
      if (metrics.ttsDelay !== undefined) metricTts.innerText = `${metrics.ttsDelay} ms`;
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Engine Status & Visualizer Updates
// ─────────────────────────────────────────────────────────────────────────────
function handleEngineStatusChange(status) {
  if (visualizer) visualizer.setState(status);

  stateOrb.className = 'state-orb';

  switch (status) {
    case 'LISTENING':
      stateOrb.classList.add('listening');
      stateTitle.innerText = 'Listening to you...';
      stateDesc.innerText = 'Speak in Indian English or Hinglish. Stop speaking when finished.';
      mainMicBtn.classList.add('active');
      micBtnLabel.innerText = 'Listening...';
      stopTtsBtn.style.display = 'none';
      break;

    case 'THINKING':
      stateOrb.classList.add('thinking');
      stateTitle.innerText = 'Gemini is processing...';
      stateDesc.innerText = 'Streaming response tokens with ultra-low latency...';
      mainMicBtn.classList.remove('active');
      micBtnLabel.innerText = 'Thinking...';
      stopTtsBtn.style.display = 'none';
      break;

    case 'SPEAKING':
      stateOrb.classList.add('speaking');
      stateTitle.innerText = 'Coach Speaking';
      stateDesc.innerText = 'Playing response via Native SpeechSynthesis TTS.';
      mainMicBtn.classList.remove('active');
      micBtnLabel.innerText = 'Tap to Speak';
      stopTtsBtn.style.display = 'inline-flex';
      break;

    case 'IDLE':
    default:
      stateTitle.innerText = 'Ready to Test';
      stateDesc.innerText = 'Tap the microphone to speak or type in the box below.';
      mainMicBtn.classList.remove('active');
      micBtnLabel.innerText = 'Tap to Speak';
      stopTtsBtn.style.display = 'none';
      interimCapsule.style.display = 'none';
      break;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UI Helpers & Message Rendering
// ─────────────────────────────────────────────────────────────────────────────
function appendMessage(role, text, isStreaming = false) {
  if (welcomeBanner) {
    welcomeBanner.style.display = 'none';
  }

  const row = document.createElement('div');
  row.className = `message-row ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.innerText = role === 'user' ? '👤' : '🤖';

  const wrap = document.createElement('div');
  wrap.className = 'msg-bubble-wrap';

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.innerText = text;

  const meta = document.createElement('div');
  meta.className = 'msg-meta';
  
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  meta.innerHTML = `<span class="msg-tag">${role === 'user' ? 'You' : 'Utkio Coach'}</span> <span>${timeStr}</span>`;

  if (role === 'ai') {
    const replayBtn = document.createElement('button');
    replayBtn.className = 'btn-link';
    replayBtn.innerText = '🔊 Replay Voice';
    replayBtn.onclick = () => {
      if (engine) engine.speak(bubble.innerText);
    };
    meta.appendChild(replayBtn);
  }

  wrap.appendChild(bubble);
  wrap.appendChild(meta);

  row.appendChild(avatar);
  row.appendChild(wrap);

  messagesStream.appendChild(row);
  chatViewport.scrollTop = chatViewport.scrollHeight;

  if (role === 'user' && !isStreaming) {
    conversationTurns.push({
      id: crypto.randomUUID(),
      role: 'user',
      text: text,
      timestamp: new Date().toISOString()
    });
    updateTurnMetrics();
  }

  return bubble;
}

function updateMessageText(bubbleElement, text) {
  bubbleElement.innerText = text;
  chatViewport.scrollTop = chatViewport.scrollHeight;
}

function updateTurnMetrics() {
  metricTurns.innerText = conversationTurns.length;
  generateReportBtn.disabled = conversationTurns.length < 2;
}

function updateKeyStatusBadge(isValid) {
  if (isValid) {
    apiStatusBadge.className = 'status-pill status-ready';
    apiStatusBadge.innerText = 'Key Set ✓';
  } else {
    apiStatusBadge.className = 'status-pill status-missing';
    apiStatusBadge.innerText = 'Key Needed';
  }
}

function populateVoices() {
  if (!window.speechSynthesis) return;
  const voices = window.speechSynthesis.getVoices();
  ttsVoiceSelect.innerHTML = '';

  const defaultOpt = document.createElement('option');
  defaultOpt.value = 'default';
  defaultOpt.innerText = 'Auto-Detect (Indian English en-IN)';
  ttsVoiceSelect.appendChild(defaultOpt);

  voices.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.name;
    opt.innerText = `${v.name} (${v.lang})${v.default ? ' — System Default' : ''}`;
    ttsVoiceSelect.appendChild(opt);
  });
}

function loadScenarioPrompt(key) {
  const preset = SCENARIO_PRESETS[key];
  if (preset) {
    systemPromptEditor.value = preset.systemInstruction;
    if (engine) engine.setSystemInstruction(preset.systemInstruction);
  }
}

function showToast(msg, type = 'info') {
  toast.innerText = msg;
  toast.style.borderColor = type === 'error' ? 'var(--accent-red)' : 'var(--primary)';
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 4000);
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Listeners
// ─────────────────────────────────────────────────────────────────────────────
function attachEvents() {
  
  // Save API Key
  geminiApiKeyInput.addEventListener('input', (e) => {
    const key = e.target.value.trim();
    localStorage.setItem('utkio_lab_gemini_key', key);
    if (engine) engine.setApiKey(key);
    updateKeyStatusBadge(!!key);
  });

  toggleKeyVisibilityBtn.addEventListener('click', () => {
    geminiApiKeyInput.type = geminiApiKeyInput.type === 'password' ? 'text' : 'password';
  });

  // Model Selection
  modelSelect.addEventListener('change', () => {
    if (modelSelect.value === 'custom') {
      customModelGroup.style.display = 'block';
    } else {
      customModelGroup.style.display = 'none';
    }
    const model = getActiveModel();
    localStorage.setItem('utkio_lab_model', model);
    if (engine) engine.setModel(model);
  });

  customModelNameInput.addEventListener('input', () => {
    const model = getActiveModel();
    localStorage.setItem('utkio_lab_model', model);
    if (engine) engine.setModel(model);
  });

  // STT Lang
  sttLangSelect.addEventListener('change', () => {
    if (engine) engine.setSttLang(sttLangSelect.value);
  });

  // TTS Voice
  ttsVoiceSelect.addEventListener('change', () => {
    const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    const chosen = voices.find(v => v.name === ttsVoiceSelect.value);
    if (engine) engine.setSelectedVoice(chosen || null);
  });

  // Validate API Key Button
  testApiBtn.addEventListener('click', async () => {
    const key = geminiApiKeyInput.value.trim();
    if (!key) {
      showToast('Please enter an API Key first!', 'error');
      return;
    }
    testApiBtn.innerText = 'Testing...';
    testApiBtn.disabled = true;
    try {
      const model = getActiveModel();
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Hello! Respond with: "API is Working"' }] }]
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Connection failed');
      showToast('✓ Gemini API Key and Model validated successfully!');
      updateKeyStatusBadge(true);
    } catch (e) {
      showToast(`Validation Failed: ${e.message}`, 'error');
    } finally {
      testApiBtn.innerText = '⚡ Validate API Key & Model';
      testApiBtn.disabled = false;
    }
  });

  // Scenario Chips
  scenarioChips.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      scenarioChips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentScenario = chip.dataset.scenario;
      loadScenarioPrompt(currentScenario);
      showToast(`Switched scenario to: ${chip.querySelector('.chip-label').innerText}`);
    });
  });

  systemPromptEditor.addEventListener('input', () => {
    if (engine) engine.setSystemInstruction(systemPromptEditor.value);
  });

  resetPromptBtn.addEventListener('click', () => {
    loadScenarioPrompt(currentScenario);
    showToast('Reset system instructions to scenario preset.');
  });

  // Big Mic Button (Tap to Speak)
  mainMicBtn.addEventListener('click', () => {
    if (!engine) return;
    if (engine.isListening) {
      engine.stopListening();
    } else {
      engine.startListening();
    }
  });

  // Text Input Send
  const handleSendText = () => {
    const text = textInput.value.trim();
    if (!text) return;
    textInput.value = '';
    appendMessage('user', text);
    if (engine) engine.sendToGemini(text);
  };

  sendTextBtn.addEventListener('click', handleSendText);
  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSendText();
  });

  // Stop TTS Button (Barge-in Mute)
  stopTtsBtn.addEventListener('click', () => {
    if (engine) engine.stopSpeaking();
  });

  // Clear Chat
  clearChatBtn.addEventListener('click', () => {
    if (confirm('Clear the current conversation?')) {
      messagesStream.innerHTML = '';
      if (welcomeBanner) welcomeBanner.style.display = 'block';
      conversationTurns = [];
      updateTurnMetrics();
      if (engine) engine.clearHistory();
      metricStt.innerText = '0 ms';
      metricTtft.innerText = '0 ms';
      metricTts.innerText = '0 ms';
      showToast('Conversation cleared.');
    }
  });

  // Report Generator Modal Trigger
  generateReportBtn.addEventListener('click', async () => {
    const key = geminiApiKeyInput.value.trim();
    if (!key) {
      showToast('Gemini API Key is required to test report generation.', 'error');
      return;
    }
    reportModal.style.display = 'flex';
    reportLoading.style.display = 'flex';
    reportContent.style.display = 'none';

    try {
      const model = getActiveModel();
      const reportMarkdown = await generateHinglishReport(key, model, conversationTurns);
      lastGeneratedReportMarkdown = reportMarkdown;
      reportLoading.style.display = 'none';
      reportContent.innerHTML = renderMarkdownToHtml(reportMarkdown);
      reportContent.style.display = 'block';
    } catch (err) {
      reportLoading.style.display = 'none';
      reportContent.innerHTML = `<div style="color:var(--accent-red);">Failed to generate report: ${err.message}</div>`;
      reportContent.style.display = 'block';
    }
  });

  // Close Report Modal
  const closeReportModal = () => { reportModal.style.display = 'none'; };
  closeReportModalBtn.addEventListener('click', closeReportModal);
  closeReportBtn2.addEventListener('click', closeReportModal);

  // Copy Report
  copyReportBtn.addEventListener('click', () => {
    if (lastGeneratedReportMarkdown) {
      navigator.clipboard.writeText(lastGeneratedReportMarkdown);
      showToast('✓ Report Markdown copied to clipboard!');
    }
  });

  // Export JSON
  exportJsonBtn.addEventListener('click', () => {
    const sessionData = {
      scenario: currentScenario,
      model: getActiveModel(),
      sttLang: sttLangSelect.value,
      turns: conversationTurns,
      reportMarkdown: lastGeneratedReportMarkdown,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `utkio_test_session_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✓ Session JSON exported!');
  });
}
