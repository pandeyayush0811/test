import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const INDEX_HTML_PATH = path.resolve('c:/Users/pande/OneDrive/Desktop/Safe Version/v2/product_test/index.html');
const MANIFEST_PATH = path.resolve('c:/Users/pande/OneDrive/Desktop/Safe Version/v2/product_test/android/app/src/main/AndroidManifest.xml');

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

test('FAILING TEST AUD-072: AndroidManifest.xml must declare RECORD_AUDIO and Android 11+ SpeechRecognizer queries', () => {
  const manifest = fs.readFileSync(MANIFEST_PATH, 'utf-8');
  const hasRecordAudio = manifest.includes('android.permission.RECORD_AUDIO');
  const hasQueries = manifest.includes('<queries>') && manifest.includes('android.speech.RecognitionService');
  
  assert.strictEqual(
    hasRecordAudio && hasQueries,
    true,
    'FAIL: AndroidManifest.xml is missing RECORD_AUDIO permission and <queries> declaration for RecognitionService.'
  );
});

test('FAILING TEST AUD-072 (UI): stt-error event must reconcile and purge orphan interim user bubbles', () => {
  const content = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
  const cleansInterimOnError = content.includes('stt-error') && 
                               (content.includes('currentUserRow.remove()') || content.includes('currentUserRow = null'));
                               
  assert.strictEqual(
    cleansInterimOnError,
    true,
    'FAIL: index.html stt-error listener does not clean up currentUserRow, leaving dead "Listening..." bubble on screen.'
  );
});

test('FAILING TEST AUD-074: index.html must use dynamic bridge getter getNativeBridge() to prevent init race conditions', () => {
  const content = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
  const hasDynamicGetter = content.includes('function getNativeBridge') || content.includes('const getNativeBridge');
  
  assert.strictEqual(
    hasDynamicGetter,
    true,
    'FAIL: index.html relies on static boolean hasAndroidNativeBridge evaluated at parse time, which misses late-injected Capacitor bridges.'
  );
});
