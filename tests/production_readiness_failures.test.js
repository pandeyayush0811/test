import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const INDEX_HTML_PATH = path.resolve('c:/Users/pande/OneDrive/Desktop/Safe Version/v2/product_test/index.html');

test('FAILING TEST AUD-070: index.html must implement hands-free auto-rearm VAD loop upon TTS completion', () => {
  const content = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
  
  // Checks if playNextSentence or TTS completion automatically triggers startListening / auto-rearm
  const hasAutoRearm = content.includes('autoRearm') || 
                       content.includes('autoListen') || 
                       (content.includes('startListening') && content.includes('playNextSentence') && content.includes('setTimeout'));
                       
  assert.strictEqual(
    hasAutoRearm,
    true,
    'FAIL: index.html currently resets state to IDLE and stops listening when TTS ends, requiring manual user taps on every turn instead of continuous hands-free VAD conversation.'
  );
});

test('FAILING TEST AUD-071: conversationHistory must enforce sliding window bounding to prevent token inflation', () => {
  const content = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
  
  // Checks if conversationHistory is bounded before sending to Gemini API
  const hasSlidingWindow = content.includes('MAX_HISTORY_TURNS') || 
                           content.includes('conversationHistory.slice(-') ||
                           content.includes('trimmedHistory');
                           
  assert.strictEqual(
    hasSlidingWindow,
    true,
    'FAIL: index.html pushes unbounded turns into conversationHistory without a sliding window cap, leading to token accumulation and cost inflation on long practice sessions.'
  );
});
