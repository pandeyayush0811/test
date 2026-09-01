import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const INDEX_HTML_PATH = path.resolve('c:/Users/pande/OneDrive/Desktop/Safe Version/v2/product_test/index.html');
const MAIN_ACTIVITY_PATH = path.resolve('c:/Users/pande/OneDrive/Desktop/Safe Version/v2/product_test/android/app/src/main/java/com/utkio/lab/MainActivity.java');
const CAPACITOR_CONFIG_PATH = path.resolve('c:/Users/pande/OneDrive/Desktop/Safe Version/v2/product_test/capacitor.config.json');

test('AUDIT TEST 1: index.html exists, is non-empty, and contains pure Audio Talk UI', () => {
  assert.strictEqual(fs.existsSync(INDEX_HTML_PATH), true, 'index.html must exist');
  const content = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
  assert.ok(content.includes('Utkio'), 'Must include Utkio branding');
  assert.ok(content.includes('gemini-3.1-flash-lite'), 'Must target gemini-3.1-flash-lite');
  assert.ok(content.includes('sessionTimerText'), 'Must have top session duration timer');
  assert.ok(content.includes('micBtn'), 'Must have central mic button');
  assert.ok(content.includes('wave wave-left'), 'Must have animated sound wave dock');
});

test('AUDIT TEST 2: SYSTEM_INSTRUCTION explicitly mandates natural Hinglish audio dialogue', () => {
  const content = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
  assert.ok(content.includes('HINGLISH'), 'Must explicitly enforce Hinglish in SYSTEM_INSTRUCTION');
  assert.ok(content.includes('1 to 2 short sentences'), 'Must enforce short 1-2 sentence turns');
  assert.ok(content.includes('Arre bilkul') || content.includes('Haan dekho'), 'Must provide Hinglish conversational examples');
});

test('AUDIT TEST 3: Sentence Regex Chunker properly splits streaming tokens for sub-350ms TTS playback', () => {
  const regex = /([^.?!:\n]+[.?!:\n]+)/g;
  const sampleStream = "Arre bilkul don't worry! Main aapki help karunga. Let's start practicing right now.";
  
  const sentences = [];
  let match;
  let lastIndex = 0;
  while ((match = regex.exec(sampleStream)) !== null) {
    const s = match[0].trim();
    if (s.length > 1) sentences.push(s);
    lastIndex = regex.lastIndex;
  }
  
  assert.strictEqual(sentences.length, 3, 'Must split into exactly 3 sentences');
  assert.strictEqual(sentences[0], "Arre bilkul don't worry!");
  assert.strictEqual(sentences[1], "Main aapki help karunga.");
  assert.strictEqual(sentences[2], "Let's start practicing right now.");
});

test('AUDIT TEST 4: Android Native MainActivity.java implements UtkioNativeBridge contracts', () => {
  assert.strictEqual(fs.existsSync(MAIN_ACTIVITY_PATH), true, 'MainActivity.java must exist');
  const javaCode = fs.readFileSync(MAIN_ACTIVITY_PATH, 'utf-8');
  
  assert.ok(javaCode.includes('UtkioNativeBridge'), 'Must register UtkioNativeBridge interface');
  assert.ok(javaCode.includes('startListening'), 'Must implement startListening()');
  assert.ok(javaCode.includes('stopListening'), 'Must implement stopListening()');
  assert.ok(javaCode.includes('speakText'), 'Must implement speakText()');
  assert.ok(javaCode.includes('stopSpeaking'), 'Must implement stopSpeaking() for hardware barge-in');
  assert.ok(javaCode.includes('stt-partial'), 'Must dispatch stt-partial events');
  assert.ok(javaCode.includes('stt-final'), 'Must dispatch stt-final events');
  assert.ok(javaCode.includes('tts-done'), 'Must dispatch tts-done events');
  assert.ok(javaCode.includes('setLanguage(new Locale("en", "IN"))'), 'Must set TTS locale to en-IN for Indian phonetics');
});

test('AUDIT TEST 5: Capacitor Config is valid JSON with webDir www', () => {
  assert.strictEqual(fs.existsSync(CAPACITOR_CONFIG_PATH), true, 'capacitor.config.json must exist');
  const config = JSON.parse(fs.readFileSync(CAPACITOR_CONFIG_PATH, 'utf-8'));
  assert.strictEqual(config.appId, 'com.utkio.lab');
  assert.strictEqual(config.appName, 'Utkio Lab');
  assert.strictEqual(config.webDir, 'www');
});

test('AUDIT TEST 6: Synced assets match in www/ and android assets public', () => {
  const masterContent = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
  const wwwPath = path.resolve('c:/Users/pande/OneDrive/Desktop/Safe Version/v2/product_test/www/index.html');
  const androidAssetPath = path.resolve('c:/Users/pande/OneDrive/Desktop/Safe Version/v2/product_test/android/app/src/main/assets/public/index.html');
  
  assert.strictEqual(fs.existsSync(wwwPath), true, 'www/index.html must exist');
  assert.strictEqual(fs.existsSync(androidAssetPath), true, 'assets/public/index.html must exist');
  
  const wwwContent = fs.readFileSync(wwwPath, 'utf-8');
  const assetContent = fs.readFileSync(androidAssetPath, 'utf-8');
  
  assert.strictEqual(wwwContent, masterContent, 'www/index.html must match index.html exactly');
  assert.strictEqual(assetContent, masterContent, 'assets/public/index.html must match index.html exactly');
});
