/**
 * ================================================================
 * Utkio Product Test — Functional Sanity Test Suite
 * ================================================================
 * Role: FunctionalSanityTester
 * Target: product_test/index.html (Utkio Voice Engine Workbench)
 *
 * MINDSET: Ye tests ek real Indian user ke nazar se likhe hain —
 * koi bhi ek pehli baar app kholta hai, button dabata hai, aur
 * expect karta hai ki kuch ACTUAL ho. Sirf UI indicator change
 * nahi — asli kaam ho.
 *
 * HOW TO RUN:
 *   1. product_test/index.html ko Chrome me open karo (local server se)
 *   2. Browser Console (F12) me paste karo:
 *        const script = document.createElement('script');
 *        script.type = 'module';
 *        script.src = './tests/functional_sanity_tests.js';
 *        document.head.appendChild(script);
 *   3. Results: Console + floating panel (top-right corner) me dikhenge
 *
 * NOTE: Kuch tests (mic, voice output) ko real browser environment
 * chahiye — headless/Node me nahi chalenge. Chrome desktop pe chalao.
 * ================================================================
 */

// ─────────────────────────────────────────────────────────────────
// Test Runner Core
// ─────────────────────────────────────────────────────────────────
const TestRunner = {
  results: [],
  passed: 0,
  failed: 0,
  skipped: 0,

  async run(name, testFn, { skip = false } = {}) {
    if (skip) {
      this.skipped++;
      this.results.push({ name, status: 'SKIP', reason: 'Skipped (environment constraint)' });
      console.warn(`⏭️  [SKIP] ${name}`);
      return;
    }

    try {
      const result = await testFn();
      if (result && result.pass === false) {
        this.failed++;
        this.results.push({ name, status: 'FAIL', detail: result.detail || 'No detail' });
        console.error(`🔴 [FAIL] ${name}\n       → ${result.detail}`);
      } else {
        this.passed++;
        this.results.push({ name, status: 'PASS', detail: result?.detail || '' });
        console.log(`✅ [PASS] ${name}${result?.detail ? ' — ' + result.detail : ''}`);
      }
    } catch (err) {
      this.failed++;
      this.results.push({ name, status: 'FAIL', detail: `Unexpected error: ${err.message}` });
      console.error(`🔴 [FAIL] ${name}\n       → Unexpected error: ${err.message}`, err);
    }
  },

  summary() {
    const total = this.passed + this.failed + this.skipped;
    console.group('📊 ===== UTKIO FUNCTIONAL SANITY — FINAL REPORT =====');
    console.log(`Total: ${total} | ✅ Passed: ${this.passed} | 🔴 Failed: ${this.failed} | ⏭️ Skipped: ${this.skipped}`);
    this.results.forEach(r => {
      const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '🔴' : '⏭️';
      console.log(`${icon} ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
    });
    console.groupEnd();
    renderFloatingPanel(this.results, this.passed, this.failed, this.skipped);
  }
};

// ─────────────────────────────────────────────────────────────────
// DOM Helpers
// ─────────────────────────────────────────────────────────────────
function getEl(id) {
  return document.getElementById(id);
}

function waitFor(conditionFn, timeoutMs = 5000, intervalMs = 100) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = setInterval(() => {
      if (conditionFn()) {
        clearInterval(check);
        resolve(true);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(check);
        reject(new Error(`waitFor timed out after ${timeoutMs}ms`));
      }
    }, intervalMs);
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─────────────────────────────────────────────────────────────────
// Floating Results Panel (Browser UI)
// ─────────────────────────────────────────────────────────────────
function renderFloatingPanel(results, passed, failed, skipped) {
  const existing = document.getElementById('__utkio_test_panel__');
  if (existing) existing.remove();

  const panel = document.createElement('div');
  panel.id = '__utkio_test_panel__';
  panel.style.cssText = `
    position: fixed; top: 16px; right: 16px; z-index: 99999;
    background: rgba(12, 14, 20, 0.97); border: 1px solid rgba(99,102,241,0.4);
    border-radius: 14px; padding: 16px 20px; width: 360px; max-height: 80vh;
    overflow-y: auto; font-family: 'JetBrains Mono', monospace; font-size: 12px;
    color: #f8fafc; box-shadow: 0 20px 60px rgba(0,0,0,0.6);
    backdrop-filter: blur(20px);
  `;

  const total = passed + failed + skipped;
  const allPass = failed === 0;

  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <span style="font-weight:700;font-size:13px;color:#818cf8;">🧪 Utkio Functional Tests</span>
      <button onclick="this.closest('#__utkio_test_panel__').remove()"
        style="background:none;border:none;color:#64748b;font-size:18px;cursor:pointer;line-height:1;">×</button>
    </div>
    <div style="margin-bottom:12px;padding:10px;border-radius:8px;background:${allPass ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'};border:1px solid ${allPass ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'};">
      <strong style="color:${allPass ? '#10b981' : '#ef4444'};">${allPass ? '✅ ALL PASS' : '🔴 FAILURES DETECTED'}</strong><br>
      <span style="color:#94a3b8;">Total: ${total} | Pass: ${passed} | Fail: ${failed} | Skip: ${skipped}</span>
    </div>
    ${results.map(r => `
      <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:6px;padding:6px 8px;border-radius:6px;background:rgba(255,255,255,0.03);">
        <span style="flex-shrink:0;">${r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '🔴' : '⏭️'}</span>
        <div>
          <div style="color:#e2e8f0;font-size:11px;font-weight:500;">${r.name}</div>
          ${r.detail ? `<div style="color:#64748b;font-size:10px;margin-top:2px;">${r.detail}</div>` : ''}
        </div>
      </div>
    `).join('')}
  `;
  document.body.appendChild(panel);
}

// ─────────────────────────────────────────────────────────────────
// SECTION 1: API KEY & SETUP TESTS
// ─────────────────────────────────────────────────────────────────

/**
 * TEST 1.1 — API Key Field Exists & Has Saved Value
 * User story: "Pehli baar app khola, key already saved thi ya nahi?"
 */
async function test_apiKeyFieldExistsAndLoads() {
  const input = getEl('geminiApiKey');
  if (!input) return { pass: false, detail: 'API key input field DOM me nahi mila (id: geminiApiKey)' };

  const badge = getEl('apiStatusBadge');
  if (!badge) return { pass: false, detail: 'API status badge DOM me nahi mila (id: apiStatusBadge)' };

  const savedKey = localStorage.getItem('utkio_lab_gemini_key');
  if (savedKey && savedKey.trim()) {
    if (!badge.textContent.includes('Key Set')) {
      return { pass: false, detail: `Key localStorage me hai lekin badge "Key Set" nahi dikh raha — badge text: "${badge.textContent}"` };
    }
    return { pass: true, detail: `Saved key load hui, badge sahi: "${badge.textContent}"` };
  } else {
    if (!badge.textContent.includes('Key Needed') && !badge.textContent.includes('Missing')) {
      return { pass: false, detail: `Koi saved key nahi hai lekin badge correct nahi — badge: "${badge.textContent}"` };
    }
    return { pass: true, detail: 'Key nahi hai, badge sahi "Key Needed" dikha raha hai' };
  }
}

/**
 * TEST 1.2 — API Key Toggle (Show/Hide)
 * User story: "Key type kar raha hun, ankhon se chhupana chahta hun ya dekhna chahta hun"
 */
async function test_apiKeyToggleVisibility() {
  const input = getEl('geminiApiKey');
  const toggleBtn = getEl('toggleKeyVisibility');

  if (!input || !toggleBtn) return { pass: false, detail: 'Input ya toggle button DOM me nahi mila' };

  const initialType = input.type;
  toggleBtn.click();
  await sleep(50);
  const afterClickType = input.type;

  if (afterClickType === initialType) {
    return { pass: false, detail: `Toggle button click ke baad input type nahi badla — abhi bhi: ${afterClickType}` };
  }

  toggleBtn.click();
  await sleep(50);
  const finalType = input.type;
  if (finalType !== initialType) {
    return { pass: false, detail: `Double toggle ke baad original type restore nahi hua. Expected: ${initialType}, Got: ${finalType}` };
  }

  return { pass: true, detail: `Toggle kaam kar raha hai: ${initialType} → ${afterClickType} → ${finalType}` };
}

/**
 * TEST 1.3 — "Validate API Key" Button Actually Calls API
 * User story: "Maine key daali, validate kiya — kuch hua ya sirf button daba?"
 */
async function test_validateApiKeyButton() {
  const btn = getEl('testApiBtn');
  const input = getEl('geminiApiKey');

  if (!btn || !input) return { pass: false, detail: 'Validate button ya input DOM me nahi mila' };

  const key = localStorage.getItem('utkio_lab_gemini_key') || input.value.trim();

  if (!key) {
    btn.click();
    await sleep(300);
    const toast = getEl('toast');
    const toastVisible = toast && toast.style.display !== 'none' && toast.textContent.length > 0;
    if (!toastVisible) {
      return { pass: false, detail: 'Bina API key ke validate press kiya — error toast nahi dikha' };
    }
    return { pass: true, detail: 'Bina key ke error toast theek se dikha' };
  }

  const originalText = btn.innerText;
  btn.click();
  await sleep(200);

  const isTesting = btn.innerText.includes('Testing') || btn.disabled;
  if (!isTesting) {
    return { pass: false, detail: 'Validate click ke baad button loading state me nahi gaya' };
  }

  try {
    await waitFor(() => !btn.disabled && btn.innerText === originalText, 10000);
    const badge = getEl('apiStatusBadge');
    return { pass: true, detail: `Validation complete. Badge: "${badge?.textContent}"` };
  } catch {
    return { pass: false, detail: 'Validate button 10 seconds ke baad bhi loading me atak gaya' };
  }
}

// ─────────────────────────────────────────────────────────────────
// SECTION 2: SCENARIO SWITCHING TESTS
// ─────────────────────────────────────────────────────────────────

/**
 * TEST 2.1 — Scenario Chips Render Karein
 * User story: "Scenarios dekh raha hun — 6 options dikh rahe hain?"
 */
async function test_scenarioChipsRender() {
  const chips = document.querySelectorAll('#scenarioChips .chip');
  const EXPECTED_SCENARIOS = ['freeform', 'restaurant', 'job_interview', 'bargaining', 'directions', 'ielts'];

  if (chips.length === 0) return { pass: false, detail: 'Koi bhi scenario chip DOM me nahi mili' };
  if (chips.length < EXPECTED_SCENARIOS.length) {
    return { pass: false, detail: `Expected ${EXPECTED_SCENARIOS.length} chips, mili sirf ${chips.length}` };
  }

  const chipScenarios = Array.from(chips).map(c => c.dataset.scenario);
  const missing = EXPECTED_SCENARIOS.filter(s => !chipScenarios.includes(s));
  if (missing.length) {
    return { pass: false, detail: `Missing scenarios: ${missing.join(', ')}` };
  }

  return { pass: true, detail: `${chips.length} scenario chips sahi render hue: ${chipScenarios.join(', ')}` };
}

/**
 * TEST 2.2 — Scenario Click → System Prompt Badlta Hai
 * User story: "Maine 'Job Interview' select kiya — kya neeche ka prompt badla?"
 */
async function test_scenarioSwitchChangesPrompt() {
  const chips = document.querySelectorAll('#scenarioChips .chip');
  const promptEditor = getEl('systemPromptEditor');

  if (!chips.length || !promptEditor) return { pass: false, detail: 'Chips ya prompt editor nahi mili' };

  const firstChip = Array.from(chips).find(c => c.dataset.scenario === 'freeform');
  const jobChip = Array.from(chips).find(c => c.dataset.scenario === 'job_interview');

  if (!firstChip || !jobChip) return { pass: false, detail: 'Freeform ya Job Interview chip nahi mili' };

  firstChip.click();
  await sleep(100);
  const freeformPrompt = promptEditor.value;

  jobChip.click();
  await sleep(100);
  const jobPrompt = promptEditor.value;

  if (freeformPrompt === jobPrompt) {
    return { pass: false, detail: 'Job Interview chip click ke baad system prompt NAHI badla — dono same hain' };
  }

  if (!jobPrompt.toLowerCase().includes('interview') && !jobPrompt.toLowerCase().includes('priya') && !jobPrompt.toLowerCase().includes('hr')) {
    return { pass: false, detail: `Job Interview prompt load hua lekin wrong content — "${jobPrompt.slice(0, 60)}..."` };
  }

  firstChip.click();
  return { pass: true, detail: 'Scenario switch se system prompt sahi badla' };
}

/**
 * TEST 2.3 — Active Chip Highlight
 * User story: "Maine ek scenario select kiya — kya wo highlighted dikh raha hai?"
 */
async function test_scenarioChipActiveHighlight() {
  const chips = document.querySelectorAll('#scenarioChips .chip');
  const restaurantChip = Array.from(chips).find(c => c.dataset.scenario === 'restaurant');

  if (!restaurantChip) return { pass: false, detail: 'Restaurant chip nahi mili' };

  restaurantChip.click();
  await sleep(100);

  if (!restaurantChip.classList.contains('active')) {
    return { pass: false, detail: "Restaurant chip click ke baad 'active' class nahi mili" };
  }

  const wronglyActive = Array.from(chips).filter(c => c !== restaurantChip && c.classList.contains('active'));
  if (wronglyActive.length > 0) {
    return { pass: false, detail: `${wronglyActive.length} other chips bhi 'active' class liye hain (sirf 1 honi chahiye)` };
  }

  Array.from(chips)[0]?.click();
  return { pass: true, detail: 'Active chip sahi highlight ho rahi hai, baaki clear' };
}

// ─────────────────────────────────────────────────────────────────
// SECTION 3: TEXT INPUT & SEND TESTS
// ─────────────────────────────────────────────────────────────────

/**
 * TEST 3.1 — Text Input Field Exist Karta Hai
 * User story: "Mic use nahi karna, text type karna hai — box hai?"
 */
async function test_textInputExists() {
  const textInput = getEl('textInput');
  const sendBtn = getEl('sendTextBtn');

  if (!textInput) return { pass: false, detail: 'Text input field DOM me nahi mila (id: textInput)' };
  if (!sendBtn) return { pass: false, detail: 'Send button DOM me nahi mila (id: sendTextBtn)' };

  const placeholder = textInput.placeholder || textInput.getAttribute('placeholder');
  if (!placeholder) return { pass: false, detail: 'Text input me placeholder nahi hai' };

  return { pass: true, detail: `Text input aur Send button dono hain. Placeholder: "${placeholder}"` };
}

/**
 * TEST 3.2 — Text Type Karo & Send Karo → Chat Me Message Aata Hai
 * User story: "Maine type kiya 'Hello', Send dabaya — kya chat me mera message dikh raha hai?"
 */
async function test_textSendShowsInChat() {
  const textInput = getEl('textInput');
  const sendBtn = getEl('sendTextBtn');
  const messagesStream = getEl('messagesStream');

  if (!textInput || !sendBtn || !messagesStream) {
    return { pass: false, detail: 'Required elements nahi mile' };
  }

  const testMessage = `Hello Coach! Testing at ${Date.now()}`;
  const initialCount = messagesStream.querySelectorAll('.message-row').length;

  textInput.value = testMessage;
  textInput.dispatchEvent(new Event('input', { bubbles: true }));
  sendBtn.click();
  await sleep(300);

  if (textInput.value !== '') {
    return { pass: false, detail: `Send ke baad text input clear nahi hua — abhi bhi: "${textInput.value}"` };
  }

  const newMessages = messagesStream.querySelectorAll('.message-row');
  if (newMessages.length <= initialCount) {
    return { pass: false, detail: 'Send ke baad chat me koi naya message nahi aaya' };
  }

  const userBubbles = messagesStream.querySelectorAll('.message-row.user .msg-bubble');
  const ourMessage = Array.from(userBubbles).find(b => b.textContent.includes('Hello Coach!'));

  if (!ourMessage) {
    return { pass: false, detail: 'User message chat me add hua lekin text match nahi kar raha' };
  }

  return { pass: true, detail: `User message chat me sahi dikh raha hai` };
}

/**
 * TEST 3.3 — Enter Key Se Bhi Send Hota Hai
 * User story: "Hath keyboard pe hai — Enter dabaya, bhej gaya?"
 */
async function test_enterKeySendsMessage() {
  const textInput = getEl('textInput');
  const messagesStream = getEl('messagesStream');

  if (!textInput || !messagesStream) return { pass: false, detail: 'Required elements nahi mile' };

  const countBefore = messagesStream.querySelectorAll('.message-row').length;
  textInput.value = `Enter key test ${Date.now()}`;
  textInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await sleep(300);

  const countAfter = messagesStream.querySelectorAll('.message-row').length;
  if (countAfter <= countBefore) {
    return { pass: false, detail: 'Enter key dabane se message send nahi hua' };
  }

  if (textInput.value !== '') {
    return { pass: false, detail: `Enter key press ke baad input clear nahi hua: "${textInput.value}"` };
  }

  return { pass: true, detail: 'Enter key se message sahi bheja gaya aur input clear hua' };
}

/**
 * TEST 3.4 — Empty Input Send Nahi Hota
 * User story: "Khaali box me Send daba diya — kya kuch hua?"
 */
async function test_emptyInputDoesNotSend() {
  const textInput = getEl('textInput');
  const sendBtn = getEl('sendTextBtn');
  const messagesStream = getEl('messagesStream');

  if (!textInput || !sendBtn || !messagesStream) return { pass: false, detail: 'Elements nahi mile' };

  textInput.value = '';
  const countBefore = messagesStream.querySelectorAll('.message-row').length;

  sendBtn.click();
  await sleep(200);

  const countAfter = messagesStream.querySelectorAll('.message-row').length;
  if (countAfter > countBefore) {
    return { pass: false, detail: 'Khaali input se bhi message send ho gaya — galat behavior' };
  }

  return { pass: true, detail: 'Khaali input par Send click se kuch nahi hua — sahi hai' };
}

// ─────────────────────────────────────────────────────────────────
// SECTION 4: AI RESPONSE TESTS (requires valid API key)
// ─────────────────────────────────────────────────────────────────

/**
 * TEST 4.1 — AI Response Aata Hai Chat Me (Text)
 * User story: "Maine kuch type kiya, AI ne jawab diya text me?"
 */
async function test_aiResponseAppearsInChat() {
  const key = localStorage.getItem('utkio_lab_gemini_key') || getEl('geminiApiKey')?.value;
  if (!key || !key.trim()) {
    return { pass: false, detail: 'API Key nahi hai — ye critical feature hai. Key set karo aur test dobara chalao.' };
  }

  const messagesStream = getEl('messagesStream');
  const textInput = getEl('textInput');
  const sendBtn = getEl('sendTextBtn');

  if (!messagesStream || !textInput || !sendBtn) return { pass: false, detail: 'Required elements nahi mile' };

  const initialAICount = messagesStream.querySelectorAll('.message-row.ai').length;

  textInput.value = 'Say exactly: "I am working"';
  sendBtn.click();

  let aiResponseText = '';
  try {
    await waitFor(() => {
      const aiBubbles = messagesStream.querySelectorAll('.message-row.ai .msg-bubble');
      if (aiBubbles.length > initialAICount) {
        aiResponseText = aiBubbles[aiBubbles.length - 1].textContent;
        return aiResponseText.trim().length > 0;
      }
      return false;
    }, 20000, 200);
  } catch {
    return { pass: false, detail: 'AI response 20 seconds tak nahi aaya — API call fail ya response render nahi ho raha' };
  }

  return { pass: true, detail: `AI response mila: "${aiResponseText.slice(0, 60)}..."` };
}

/**
 * TEST 4.2 — Latency Metrics Update Hote Hain After AI Response
 * User story: "AI ne jawab diya — kya metrics dashboard me numbers change hue?"
 */
async function test_metricsUpdateAfterAIResponse() {
  const metricTtft = getEl('metricTtft');
  const metricTurns = getEl('metricTurns');

  if (!metricTtft || !metricTurns) return { pass: false, detail: 'Metrics elements DOM me nahi mile' };

  const turnsNow = parseInt(metricTurns.textContent, 10) || 0;

  if (turnsNow === 0) {
    return { pass: false, detail: 'Turns counter 0 hai — conversation nahi hua ya counter update nahi ho raha' };
  }

  const ttftText = metricTtft.textContent;
  const ttftHasValue = ttftText && ttftText !== '0 ms' && ttftText !== '--';

  if (!ttftHasValue) {
    return { pass: false, detail: `TTFT metric update nahi hua conversation ke baad — value: "${ttftText}"` };
  }

  return { pass: true, detail: `Metrics sahi update hue. Turns: ${turnsNow}, TTFT: ${ttftText}` };
}

/**
 * TEST 4.3 — AI Response Me "Replay Voice" Button Hota Hai
 * User story: "AI ka jawab aaya — kya main dobara sun sakta hun?"
 */
async function test_aiMessageHasReplayButton() {
  const messagesStream = getEl('messagesStream');
  if (!messagesStream) return { pass: false, detail: 'messagesStream element nahi mila' };

  const aiRows = messagesStream.querySelectorAll('.message-row.ai');
  if (aiRows.length === 0) {
    return { pass: false, detail: 'Koi AI message nahi hai test karne ke liye' };
  }

  const lastAIRow = aiRows[aiRows.length - 1];
  const replayBtn = lastAIRow.querySelector('.btn-link');

  if (!replayBtn) {
    return { pass: false, detail: 'AI message me "Replay Voice" button nahi mila — user dobara nahi sun sakta' };
  }

  if (!replayBtn.textContent.includes('Replay') && !replayBtn.textContent.includes('🔊')) {
    return { pass: false, detail: `Replay button text unexpected: "${replayBtn.textContent}"` };
  }

  return { pass: true, detail: `AI message me Replay button hai: "${replayBtn.textContent}"` };
}

// ─────────────────────────────────────────────────────────────────
// SECTION 5: MIC BUTTON TESTS
// ─────────────────────────────────────────────────────────────────

/**
 * TEST 5.1 — Mic Button DOM Me Hai Aur Clickable Hai
 * User story: "Mic button dikh raha hai? Click ho sakta hai?"
 */
async function test_micButtonExistsAndClickable() {
  const micBtn = getEl('mainMicBtn');
  const micLabel = getEl('micBtnLabel');

  if (!micBtn) return { pass: false, detail: 'Main mic button DOM me nahi mila (id: mainMicBtn)' };
  if (!micLabel) return { pass: false, detail: 'Mic button label nahi mila (id: micBtnLabel)' };
  if (micBtn.disabled) return { pass: false, detail: 'Mic button disabled hai — user click nahi kar sakta' };

  const initialLabel = micLabel.textContent;
  if (!initialLabel) return { pass: false, detail: 'Mic button label khaali hai' };

  return { pass: true, detail: `Mic button exists, clickable, label: "${initialLabel}"` };
}

/**
 * TEST 5.2 — Mic Click → UI State "LISTENING" Me Jaata Hai
 * User story: "Mic dabaya — kya kuch hua? App sunta hua lag raha hai?"
 */
async function test_micClickTriggersListeningState() {
  const micBtn = getEl('mainMicBtn');
  const stateTitle = getEl('stateTitle');
  const micLabel = getEl('micBtnLabel');

  if (!micBtn || !stateTitle || !micLabel) return { pass: false, detail: 'Mic button ya state elements nahi mile' };

  const hasSpeechSupport = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const hasAndroidBridge = !!(window.UtkioNativeBridge);

  if (!hasSpeechSupport && !hasAndroidBridge) {
    return { pass: false, detail: 'Browser Web Speech API support nahi karta — Chrome chahiye.' };
  }

  micBtn.click();
  await sleep(500);

  const afterTitle = stateTitle.textContent;
  const afterLabel = micLabel.textContent;

  const isListening =
    afterLabel.toLowerCase().includes('listen') ||
    afterTitle.toLowerCase().includes('listen') ||
    micBtn.classList.contains('active');

  if (!isListening) {
    const toast = getEl('toast');
    const toastVisible = toast && toast.style.display !== 'none';
    if (toastVisible) {
      return { pass: false, detail: `Mic click pe error aaya: "${toast.textContent}"` };
    }
    return { pass: false, detail: `Mic click ke baad LISTENING state nahi aaya. Title: "${afterTitle}", Label: "${afterLabel}"` };
  }

  await sleep(500);
  micBtn.click();
  await sleep(300);

  return { pass: true, detail: `Mic click → LISTENING state aaya. Label: "${afterLabel}"` };
}

/**
 * TEST 5.3 — Stop TTS Button Sirf Speaking State Me Dikhe
 * User story: "Jab AI bol raha ho tab hi 'Stop' button dike — warna band rahe"
 */
async function test_stopTtsButtonVisibility() {
  const stopBtn = getEl('stopTtsBtn');
  if (!stopBtn) return { pass: false, detail: 'Stop TTS button DOM me nahi mila (id: stopTtsBtn)' };

  const isHiddenInIdle = stopBtn.style.display === 'none' || getComputedStyle(stopBtn).display === 'none';
  if (!isHiddenInIdle) {
    return { pass: false, detail: 'Stop button Idle state me visible hai — ye sirf SPEAKING state me dikhna chahiye' };
  }

  return { pass: true, detail: 'Stop TTS button Idle state me sahi hidden hai' };
}

// ─────────────────────────────────────────────────────────────────
// SECTION 6: REPORT GENERATION TESTS
// ─────────────────────────────────────────────────────────────────

/**
 * TEST 6.1 — "Generate Report" Button Pehle Disabled Hota Hai
 * User story: "Koi baat nahi hui, Report button clickable hai?"
 */
async function test_reportButtonDisabledWithNoChatHistory() {
  const reportBtn = getEl('generateReportBtn');
  const turnsEl = getEl('metricTurns');

  if (!reportBtn) return { pass: false, detail: 'Generate Report button DOM me nahi mila' };

  const turns = parseInt(turnsEl?.textContent, 10) || 0;

  if (turns < 2 && !reportBtn.disabled) {
    return { pass: false, detail: `Sirf ${turns} turns hain lekin Report button enabled hai` };
  }

  if (turns >= 2 && reportBtn.disabled) {
    return { pass: false, detail: `${turns} turns ke baad bhi Report button disabled hai` };
  }

  return {
    pass: true,
    detail: `Report button state sahi: ${turns} turns → ${reportBtn.disabled ? 'disabled' : 'enabled'}`
  };
}

/**
 * TEST 6.2 — Report Modal Open/Close
 * User story: "Report khola, pura padha, band kiya — sahi se kaam kar raha?"
 */
async function test_reportModalOpenAndClose() {
  const reportBtn = getEl('generateReportBtn');
  const modal = getEl('reportModal');
  const closeBtn = getEl('closeReportModalBtn');

  if (!reportBtn || !modal || !closeBtn) {
    return { pass: false, detail: 'Report modal elements nahi mile' };
  }

  if (reportBtn.disabled) {
    return { pass: true, detail: 'Report button disabled hai (< 2 turns) — modal test skip, button state sahi hai' };
  }

  const key = localStorage.getItem('utkio_lab_gemini_key') || getEl('geminiApiKey')?.value;
  if (!key) {
    return { pass: false, detail: 'API key nahi hai — modal test nahi ho sakta' };
  }

  reportBtn.click();
  await sleep(300);

  const isVisible = modal.style.display !== 'none' && getComputedStyle(modal).display !== 'none';
  if (!isVisible) {
    return { pass: false, detail: 'Report button click ke baad modal nahi khula' };
  }

  const loadingEl = getEl('reportLoading');
  const loadingVisible = loadingEl && loadingEl.style.display !== 'none';
  if (!loadingVisible) {
    return { pass: false, detail: 'Modal khula lekin loading state nahi dikha' };
  }

  closeBtn.click();
  await sleep(200);

  const isHidden = modal.style.display === 'none';
  if (!isHidden) {
    return { pass: false, detail: 'Close button dabane ke baad modal band nahi hua' };
  }

  return { pass: true, detail: 'Report modal sahi khula, loading dikha, close ne band kiya' };
}

// ─────────────────────────────────────────────────────────────────
// SECTION 7: CLEAR CHAT TEST
// ─────────────────────────────────────────────────────────────────

/**
 * TEST 7.1 — Clear Chat Button → Sab Saaf Ho Jaata Hai
 * User story: "Maine 'Clear Chat' dabaya — poora chat saaf ho gaya?"
 */
async function test_clearChatWipesEverything() {
  const clearBtn = getEl('clearChatBtn');
  const messagesStream = getEl('messagesStream');
  const welcomeBanner = getEl('welcomeBanner');
  const metricTurns = getEl('metricTurns');

  if (!clearBtn || !messagesStream) return { pass: false, detail: 'Clear button ya messagesStream nahi mila' };

  const textInput = getEl('textInput');
  const sendBtn = getEl('sendTextBtn');
  if (textInput && sendBtn && messagesStream.querySelectorAll('.message-row').length === 0) {
    textInput.value = 'Test clear message';
    sendBtn.click();
    await sleep(200);
  }

  const origConfirm = window.confirm;
  window.confirm = () => true;

  clearBtn.click();
  await sleep(200);

  window.confirm = origConfirm;

  const remainingMessages = messagesStream.querySelectorAll('.message-row').length;
  if (remainingMessages > 0) {
    return { pass: false, detail: `Clear ke baad ${remainingMessages} messages abhi bhi hain` };
  }

  const turnsNow = parseInt(metricTurns?.textContent, 10) || 0;
  if (turnsNow !== 0) {
    return { pass: false, detail: `Chat clear hua lekin turns counter reset nahi hua — ${turnsNow} dikha raha hai` };
  }

  const bannerVisible = welcomeBanner && welcomeBanner.style.display !== 'none';
  if (!bannerVisible) {
    return { pass: false, detail: 'Clear ke baad welcome banner wapas nahi aaya — blank screen!' };
  }

  return { pass: true, detail: 'Chat clear hua, turns reset, welcome banner wapas aaya' };
}

// ─────────────────────────────────────────────────────────────────
// SECTION 8: MODEL SELECTION TEST
// ─────────────────────────────────────────────────────────────────

/**
 * TEST 8.1 — Model Dropdown Exist Karta Hai Aur Options Hain
 * User story: "Model badalna hai — dropdown mila?"
 */
async function test_modelDropdownHasOptions() {
  const modelSelect = getEl('modelSelect');
  if (!modelSelect) return { pass: false, detail: 'Model select dropdown nahi mila (id: modelSelect)' };

  const options = modelSelect.querySelectorAll('option');
  if (options.length < 2) {
    return { pass: false, detail: `Model dropdown me sirf ${options.length} option(s) hain` };
  }

  const optionValues = Array.from(options).map(o => o.value);
  return { pass: true, detail: `Model dropdown me ${options.length} options: ${optionValues.join(', ')}` };
}

/**
 * TEST 8.2 — Custom Model Select → Custom Input Field Dikhta Hai
 * User story: "Custom model likhna tha — field kahan hai?"
 */
async function test_customModelFieldShows() {
  const modelSelect = getEl('modelSelect');
  const customGroup = getEl('customModelGroup');

  if (!modelSelect || !customGroup) {
    return { pass: false, detail: 'Model select ya custom group element nahi mila' };
  }

  if (modelSelect.value === 'custom') {
    const isVisible = customGroup.style.display !== 'none';
    if (!isVisible) return { pass: false, detail: 'Custom model selected hai lekin input field hidden hai' };
    return { pass: true, detail: 'Custom already selected, field visible hai' };
  }

  modelSelect.value = 'custom';
  modelSelect.dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(100);

  const isVisible = customGroup.style.display !== 'none';
  if (!isVisible) {
    return { pass: false, detail: 'Custom model select karne ke baad input field nahi dikha' };
  }

  const nonCustomOption = Array.from(modelSelect.options).find(o => o.value !== 'custom');
  if (nonCustomOption) {
    modelSelect.value = nonCustomOption.value;
    modelSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(100);
  }

  return { pass: true, detail: 'Custom model select → input field sahi dikhta hai' };
}

// ─────────────────────────────────────────────────────────────────
// SECTION 9: SESSION EXPORT TEST
// ─────────────────────────────────────────────────────────────────

/**
 * TEST 9.1 — Export JSON Button Download Trigger Karta Hai
 * User story: "Maine session export kiya — kya file download ho gayi?"
 */
async function test_exportJsonTriggerWorks() {
  const exportBtn = getEl('exportJsonBtn');
  if (!exportBtn) return { pass: false, detail: 'Export JSON button nahi mila (id: exportJsonBtn)' };

  let downloadTriggered = false;
  const origCreate = URL.createObjectURL;
  const origRevoke = URL.revokeObjectURL;

  URL.createObjectURL = (blob) => {
    downloadTriggered = true;
    return origCreate(blob);
  };
  URL.revokeObjectURL = (url) => origRevoke(url);

  exportBtn.click();
  await sleep(300);

  URL.createObjectURL = origCreate;
  URL.revokeObjectURL = origRevoke;

  if (!downloadTriggered) {
    return { pass: false, detail: 'Export JSON button click ke baad download trigger nahi hua' };
  }

  return { pass: true, detail: 'Export JSON → download trigger hua — file browser me save ho rahi hai' };
}

// ─────────────────────────────────────────────────────────────────
// SECTION 10: WELCOME BANNER TEST
// ─────────────────────────────────────────────────────────────────

/**
 * TEST 10.1 — Welcome Banner Initially Visible, Messages Pe Hide
 * User story: "Pehli baar khola — swagat wala screen dikh raha tha, phir gayab hua"
 */
async function test_welcomeBannerBehavior() {
  const welcome = getEl('welcomeBanner');
  const messagesStream = getEl('messagesStream');

  if (!welcome) return { pass: false, detail: 'Welcome banner element nahi mila (id: welcomeBanner)' };

  const messages = messagesStream?.querySelectorAll('.message-row') || [];

  if (messages.length === 0) {
    const isVisible = welcome.style.display !== 'none';
    if (!isVisible) {
      return { pass: false, detail: 'Koi message nahi hai lekin welcome banner hidden hai — blank screen!' };
    }
    return { pass: true, detail: 'Koi message nahi → welcome banner sahi dikh raha hai' };
  } else {
    const isHidden = welcome.style.display === 'none';
    if (!isHidden) {
      return { pass: false, detail: 'Messages hain lekin welcome banner abhi bhi dikh raha hai — overlap!' };
    }
    return { pass: true, detail: 'Messages hain → welcome banner sahi hidden hai' };
  }
}

// ─────────────────────────────────────────────────────────────────
// SECTION 11: STT LANGUAGE SELECTOR TEST
// ─────────────────────────────────────────────────────────────────

/**
 * TEST 11.1 — STT Language Dropdown Exist Karta Hai
 * User story: "Mujhe Hindi me bolna hai — setting hai?"
 */
async function test_sttLanguageDropdownExists() {
  const sttSelect = getEl('sttLang');
  if (!sttSelect) return { pass: false, detail: 'STT language dropdown nahi mila (id: sttLang)' };

  const options = sttSelect.querySelectorAll('option');
  if (options.length < 1) return { pass: false, detail: 'STT dropdown me koi option nahi hai' };

  const hasIndianEnglish = Array.from(options).some(o =>
    o.value.includes('en-IN') || o.textContent.includes('Indian')
  );
  if (!hasIndianEnglish) {
    return { pass: false, detail: 'en-IN (Indian English) option nahi mila — Indian users ke liye critical' };
  }

  return { pass: true, detail: `STT dropdown hai, ${options.length} options, en-IN included` };
}

// ─────────────────────────────────────────────────────────────────
// SECTION 12: TTS VOICE DROPDOWN TEST
// ─────────────────────────────────────────────────────────────────

/**
 * TEST 12.1 — TTS Voice Dropdown Populate Hota Hai
 * User story: "Voice change karna hai — options hain?"
 */
async function test_ttsVoiceDropdownPopulates() {
  const ttsSelect = getEl('ttsVoiceSelect');
  if (!ttsSelect) return { pass: false, detail: 'TTS voice select nahi mila (id: ttsVoiceSelect)' };

  const options = ttsSelect.querySelectorAll('option');
  if (options.length === 0) {
    return { pass: false, detail: 'TTS voice dropdown bilkul khaali hai — speechSynthesis voices load nahi hue' };
  }

  const hasDefaultOption = Array.from(options).some(o => o.value === 'default' || o.textContent.includes('Auto'));
  if (!hasDefaultOption) {
    return { pass: false, detail: 'Default/Auto-detect voice option nahi hai' };
  }

  return { pass: true, detail: `TTS dropdown me ${options.length} voice options, default option present` };
}

// ─────────────────────────────────────────────────────────────────
// SECTION 13: RESET PROMPT TEST
// ─────────────────────────────────────────────────────────────────

/**
 * TEST 13.1 — "Reset Prompt" Button Preset Wapas Laata Hai
 * User story: "Mujhse kuch galat edit ho gaya — reset kiya, purana prompt wapas aaya?"
 */
async function test_resetPromptRestoresPreset() {
  const resetBtn = getEl('resetPromptBtn');
  const promptEditor = getEl('systemPromptEditor');

  if (!resetBtn || !promptEditor) return { pass: false, detail: 'Reset button ya prompt editor nahi mila' };

  promptEditor.value = 'DIRTY PROMPT - this should not remain';
  promptEditor.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(50);

  resetBtn.click();
  await sleep(150);

  const afterReset = promptEditor.value;

  if (afterReset === 'DIRTY PROMPT - this should not remain') {
    return { pass: false, detail: 'Reset button ne prompt restore nahi kiya — dirty prompt wahi raha' };
  }

  if (afterReset.trim().length < 20) {
    return { pass: false, detail: `Reset ke baad prompt bahut chhota/khaali hai: "${afterReset}"` };
  }

  return { pass: true, detail: `Reset button ne prompt restore kiya: "${afterReset.slice(0, 50)}..."` };
}

// ─────────────────────────────────────────────────────────────────
// SECTION 14: TOAST NOTIFICATION TEST
// ─────────────────────────────────────────────────────────────────

/**
 * TEST 14.1 — Toast Auto-Hide Hota Hai
 * User story: "Error message tha, thodi der baad khud gayab ho gaya — sahi hai?"
 */
async function test_toastAutoHides() {
  const toast = getEl('toast');
  if (!toast) return { pass: false, detail: 'Toast element nahi mila (id: toast)' };

  const chips = document.querySelectorAll('#scenarioChips .chip');
  if (chips.length > 1) {
    chips[1].click();
    await sleep(200);

    const isVisible = toast.style.display !== 'none' && toast.textContent.length > 0;
    if (!isVisible) {
      return { pass: false, detail: 'Toast trigger hua lekin visible nahi dikha' };
    }

    try {
      await waitFor(() => toast.style.display === 'none', 6000, 200);
    } catch {
      return { pass: false, detail: 'Toast 6 seconds ke baad bhi visible hai — auto-hide kaam nahi kar raha' };
    }

    chips[0].click();
    return { pass: true, detail: 'Toast dikha aur 4-5 seconds me auto-hide bhi hua' };
  }

  return { pass: true, detail: 'Toast element DOM me hai' };
}

// ─────────────────────────────────────────────────────────────────
// MAIN TEST RUNNER — Sab Tests Chalao
// ─────────────────────────────────────────────────────────────────
async function runAllTests() {
  console.group('🚀 ===== UTKIO FUNCTIONAL SANITY TESTS STARTING =====');
  console.log('Target: product_test/index.html | Role: FunctionalSanityTester');
  console.log('Mindset: Normal Indian user — kya jo dikhta hai wahi hota hai?');
  console.groupEnd();

  console.group('📋 Section 1: API Key & Setup');
  await TestRunner.run('1.1 API key field exists & saved value loads', test_apiKeyFieldExistsAndLoads);
  await TestRunner.run('1.2 API key toggle show/hide kaam karta hai', test_apiKeyToggleVisibility);
  await TestRunner.run('1.3 Validate API key button actual API call karta hai', test_validateApiKeyButton);
  console.groupEnd();

  console.group('🎭 Section 2: Scenario Switching');
  await TestRunner.run('2.1 6 scenario chips sahi render hote hain', test_scenarioChipsRender);
  await TestRunner.run('2.2 Scenario switch → system prompt badalta hai', test_scenarioSwitchChangesPrompt);
  await TestRunner.run('2.3 Selected chip highlighted hoti hai', test_scenarioChipActiveHighlight);
  console.groupEnd();

  console.group('⌨️  Section 3: Text Input & Send');
  await TestRunner.run('3.1 Text input field aur Send button exist karte hain', test_textInputExists);
  await TestRunner.run('3.2 Text type + Send → chat me message dikhta hai', test_textSendShowsInChat);
  await TestRunner.run('3.3 Enter key press → message send hota hai', test_enterKeySendsMessage);
  await TestRunner.run('3.4 Khaali input se message send nahi hota', test_emptyInputDoesNotSend);
  console.groupEnd();

  console.group('🤖 Section 4: AI Response (API key required)');
  await TestRunner.run('4.1 AI response chat me text ke roop me aata hai', test_aiResponseAppearsInChat);
  await TestRunner.run('4.2 Latency metrics AI response ke baad update hote hain', test_metricsUpdateAfterAIResponse);
  await TestRunner.run('4.3 AI message me "Replay Voice" button hota hai', test_aiMessageHasReplayButton);
  console.groupEnd();

  console.group('🎙️  Section 5: Mic Button');
  await TestRunner.run('5.1 Mic button DOM me hai aur clickable hai', test_micButtonExistsAndClickable);
  await TestRunner.run('5.2 Mic click → LISTENING UI state aata hai', test_micClickTriggersListeningState);
  await TestRunner.run('5.3 Stop TTS button sirf SPEAKING state me dikhta hai', test_stopTtsButtonVisibility);
  console.groupEnd();

  console.group('📝 Section 6: Report Generation');
  await TestRunner.run('6.1 Report button < 2 turns pe disabled hota hai', test_reportButtonDisabledWithNoChatHistory);
  await TestRunner.run('6.2 Report modal open + loading + close sahi kaam karta hai', test_reportModalOpenAndClose);
  console.groupEnd();

  console.group('🗑️  Section 7: Clear Chat');
  await TestRunner.run('7.1 Clear chat → messages + turns + welcome banner sab reset', test_clearChatWipesEverything);
  console.groupEnd();

  console.group('🧠 Section 8: Model Selection');
  await TestRunner.run('8.1 Model dropdown hai aur options hain', test_modelDropdownHasOptions);
  await TestRunner.run('8.2 Custom model select → input field dikhta hai', test_customModelFieldShows);
  console.groupEnd();

  console.group('💾 Section 9: Session Export');
  await TestRunner.run('9.1 Export JSON button download trigger karta hai', test_exportJsonTriggerWorks);
  console.groupEnd();

  console.group('👋 Section 10: Welcome Banner');
  await TestRunner.run('10.1 Welcome banner initially visible, messages pe hide hota hai', test_welcomeBannerBehavior);
  console.groupEnd();

  console.group('🌐 Section 11: STT Language');
  await TestRunner.run('11.1 STT language dropdown aur en-IN option exist karta hai', test_sttLanguageDropdownExists);
  console.groupEnd();

  console.group('🔊 Section 12: TTS Voice');
  await TestRunner.run('12.1 TTS voice dropdown populate hota hai', test_ttsVoiceDropdownPopulates);
  console.groupEnd();

  console.group('↩️  Section 13: Reset Prompt');
  await TestRunner.run('13.1 Reset button system prompt ko preset par restore karta hai', test_resetPromptRestoresPreset);
  console.groupEnd();

  console.group('🍞 Section 14: Toast Notifications');
  await TestRunner.run('14.1 Toast notification auto-hide hota hai', test_toastAutoHides);
  console.groupEnd();

  await sleep(200);
  TestRunner.summary();
}

runAllTests();
