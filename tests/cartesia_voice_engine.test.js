import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const INDEX_HTML_PATH = path.resolve('c:/Users/pande/OneDrive/Desktop/Safe Version/v2/product_test/index.html');

test('CARTESIA SUITE 1: DOM Elements and Selectors for Cartesia Sonic', () => {
  assert.strictEqual(fs.existsSync(INDEX_HTML_PATH), true, 'index.html must exist');
  const content = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');

  assert.ok(content.includes('modalTtsEngineSelect'), 'Must include TTS Engine Selector');
  assert.ok(content.includes('modalCartesiaKeyInput'), 'Must include Cartesia API Key input');
  assert.ok(content.includes('modalCartesiaVoiceSelect'), 'Must include Cartesia Voice selector');
  assert.ok(content.includes('cartesiaConfigGroup'), 'Must include Cartesia configuration wrapper');
  assert.ok(content.includes('tts-val'), 'Must include TTS latency display element');
});

test('CARTESIA SUITE 2: Cartesia Sonic Voices and Model Config', () => {
  const content = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');

  // Verify Cartesia model ID
  assert.ok(content.includes('sonic-english'), 'Must target sonic-english model');

  // Verify Cartesia top voice IDs
  assert.ok(content.includes('db6b0ed5-d5d3-463d-ae85-518a07d3c2b4'), 'Must configure Gemma voice ID');
  assert.ok(content.includes('69267136-1bdc-4103-a10e-5c192337433a'), 'Must configure Jacqueline voice ID');
  assert.ok(content.includes('a0e99841-438c-4a64-b679-ae501e7d6091'), 'Must configure Daniel voice ID');
  assert.ok(content.includes('ee7ea9f8-c0c1-498e-9279-764d6b56d189'), 'Must configure Corey voice ID');
  assert.ok(content.includes('f786b574-daa5-4673-aa0c-cbe3e8534c02'), 'Must configure Archie voice ID');
});

test('CARTESIA SUITE 3: Protocol, Headers & Synthesis Invariants', () => {
  const content = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');

  assert.ok(content.includes('https://api.cartesia.ai/tts/bytes'), 'Must call Cartesia REST bytes endpoint');
  assert.ok(content.includes('Cartesia-Version'), 'Must send Cartesia-Version header');
  assert.ok(content.includes('X-API-Key'), 'Must send X-API-Key header');
  assert.ok(content.includes('container: \'wav\'') || content.includes('container: "wav"'), 'Must request wav container');
  assert.ok(content.includes('encoding: \'pcm_s16le\'') || content.includes('encoding: "pcm_s16le"'), 'Must specify pcm_s16le encoding');
  assert.ok(content.includes('sample_rate: 24000'), 'Must specify 24000Hz sample rate for snappy transfer');
});

test('CARTESIA SUITE 4: Graceful Degradation & Fallback Resilience', () => {
  const content = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');

  assert.ok(content.includes('fallbackPlaySentence'), 'Must define fallbackPlaySentence');
  assert.ok(content.includes('generateEdgeTTSAudio'), 'Must preserve Edge TTS as fallback engine');
  assert.ok(content.includes('updateTtsBadge'), 'Must implement dynamic updateTtsBadge helper');
});
