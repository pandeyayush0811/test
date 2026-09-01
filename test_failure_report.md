# 🚨 Test Failure Report — Voice Engine Production Readiness
**Target Scope:** `product_test/index.html` (Android Voice Engine & Cascade Controller)  
**Test Suite:** [`product_test/tests/production_readiness_failures.test.js`](file:///c:/Users/pande/OneDrive/Desktop/Safe%20Version/v2/product_test/tests/production_readiness_failures.test.js)  
**Report Date:** September 1, 2026  
**Audited By:** 22_ProductionReadinessPanel

---

## 📊 Summary of Test Failures

| Test ID | Severity | Failure Summary | Root Cause | Status |
| :--- | :--- | :--- | :--- | :--- |
| **AUD-070** | 🟡 Medium | Missing Hands-Free Auto-Re-Arm VAD Loop | `playNextSentence()` calls `setState('IDLE')` when queue is empty, forcing manual mic tap | ❌ Failing (Proven) |
| **AUD-071** | 🟡 Medium | Unbounded `conversationHistory` Token Growth | `conversationHistory` is sent un-sliced to Gemini API, causing cost inflation over 20+ turns | ❌ Failing (Proven) |

---

## 1. Detailed Failure Analysis: AUD-070 (Hands-Free VAD Auto-Re-Arm)

### Failing Test Code:
```javascript
test('FAILING TEST AUD-070: index.html must implement hands-free auto-rearm VAD loop upon TTS completion', () => {
  const content = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
  const hasAutoRearm = content.includes('autoRearm') || 
                       content.includes('autoListen') || 
                       (content.includes('startListening') && content.includes('playNextSentence') && content.includes('setTimeout'));
                       
  assert.strictEqual(hasAutoRearm, true);
});
```

### Actual Test Execution Output:
```text
✖ FAILING TEST AUD-070: index.html must implement hands-free auto-rearm VAD loop upon TTS completion (3.3666ms)
  AssertionError [ERR_ASSERTION]: FAIL: index.html currently resets state to IDLE and stops listening when TTS ends, requiring manual user taps on every turn instead of continuous hands-free VAD conversation.
  false !== true
```

### Why It Failed (Root Cause):
In [`product_test/index.html:920-940`](file:///c:/Users/pande/OneDrive/Desktop/Safe%20Version/v2/product_test/index.html#L920-L940), when `sentenceQueue` is drained after the AI finishes speaking, the function executes:
```javascript
if (!sentenceQueue.length) {
  isSpeakingQueue = false;
  if (state === 'SPEAKING') {
    setState('IDLE');
  }
  return;
}
```
Because it resets to `IDLE` without re-engaging the speech recognizer, the user must reach out and tap the phone screen on every single turn. This breaks the hands-free phone-call immersion.

### Suggested Fix Direction:
When `sentenceQueue` empties, if the user has not explicitly tapped "Stop", schedule a brief **350ms natural conversational pause** before automatically invoking `startListening()`:
```javascript
if (!sentenceQueue.length) {
  isSpeakingQueue = false;
  setState('IDLE');
  // Hands-Free VAD Loop: auto-listen for next user turn after natural conversational pause
  if (isSessionStarted && state !== 'LISTENING') {
    setTimeout(() => {
      if (state === 'IDLE') startListening();
    }, 350);
  }
  return;
}
```

---

## 2. Detailed Failure Analysis: AUD-071 (Sliding Window History Cap)

### Failing Test Code:
```javascript
test('FAILING TEST AUD-071: conversationHistory must enforce sliding window bounding to prevent token inflation', () => {
  const content = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
  const hasSlidingWindow = content.includes('MAX_HISTORY_TURNS') || 
                           content.includes('conversationHistory.slice(-') ||
                           content.includes('trimmedHistory');
                           
  assert.strictEqual(hasSlidingWindow, true);
});
```

### Actual Test Execution Output:
```text
✖ FAILING TEST AUD-071: conversationHistory must enforce sliding window bounding to prevent token inflation (1.0449ms)
  AssertionError [ERR_ASSERTION]: FAIL: index.html pushes unbounded turns into conversationHistory without a sliding window cap, leading to token accumulation and cost inflation on long practice sessions.
  false !== true
```

### Why It Failed (Root Cause):
In [`product_test/index.html:815-835`](file:///c:/Users/pande/OneDrive/Desktop/Safe%20Version/v2/product_test/index.html#L815-L835), `conversationHistory` is pushed onto on every turn and sent wholesale to Gemini:
```javascript
const payload = {
  contents: conversationHistory,
  systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] }, ...
};
```
In a 15-minute practice session with 30 turns, the prompt token count grows linearly ($100 \times 30 = 3,000$ tokens per turn), multiplying the API cost by 15x unnecessarily.

### Suggested Fix Direction:
Enforce a sliding window constant `MAX_HISTORY_TURNS = 12` (preserving the most recent 6 user turns and 6 coach turns) before passing `contents` to Gemini:
```javascript
const MAX_HISTORY_TURNS = 12;
const boundedHistory = conversationHistory.slice(-MAX_HISTORY_TURNS);

const payload = {
  contents: boundedHistory,
  systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
  generationConfig: { maxOutputTokens: 200, temperature: 0.7 }
};
```

---

## 🏁 Handoff to 05_Fixer
This failure report provides the exact failing test suite and reproduction evidence. The Fixer can now resolve AUD-070 and AUD-071 with precision.
