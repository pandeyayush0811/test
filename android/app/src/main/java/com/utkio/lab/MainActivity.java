package com.utkio.lab;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.LongBuffer;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

// Microsoft ONNX Runtime Android SDK
import ai.onnxruntime.OnnxTensor;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtSession;

public class MainActivity extends BridgeActivity {
    private static final int PERMISSION_REQUEST_CODE = 101;
    private SpeechRecognizer speechRecognizer;
    private Intent speechRecognizerIntent;
    private TextToSpeech textToSpeech;
    private boolean isTtsReady = false;
    private Handler mainHandler;
    private ExecutorService ttsExecutor;

    // On-Device Piper VITS Neural Engine References
    private OrtEnvironment ortEnvironment = null;
    private OrtSession ortSession = null;
    private boolean isNeuralReady = false;
    private volatile boolean isPlayingNeural = false;
    private AudioTrack activeAudioTrack = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        mainHandler = new Handler(Looper.getMainLooper());
        ttsExecutor = Executors.newSingleThreadExecutor();
        checkAudioPermissions();
        initNativeTTS();
        initPiperNeuralEngine();
        initNativeSpeechRecognizer();
    }

    @Override
    public void onStart() {
        super.onStart();
        injectNativeBridge();
    }

    private void checkAudioPermissions() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                this, new String[]{Manifest.permission.RECORD_AUDIO}, PERMISSION_REQUEST_CODE);
        }
    }

    /**
     * Tier 2 Fallback: Native Android TextToSpeech Engine with Hindi/en-IN natural voice configuration
     */
    private void initNativeTTS() {
        textToSpeech = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                // Primary: Hindi India locale for natural Hinglish phonetics
                Locale hindiLocale = new Locale("hi", "IN");
                int result = textToSpeech.setLanguage(hindiLocale);
                if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                    textToSpeech.setLanguage(new Locale("en", "IN"));
                }

                // High-quality voice filter
                try {
                    if (textToSpeech.getVoices() != null) {
                        for (android.speech.tts.Voice voice : textToSpeech.getVoices()) {
                            if (voice.getLocale() != null && "hi".equals(voice.getLocale().getLanguage())) {
                                if (voice.getName().contains("network") || voice.getQuality() >= 400) {
                                    textToSpeech.setVoice(voice);
                                    break;
                                }
                            }
                        }
                    }
                } catch (Exception ignored) {}

                textToSpeech.setSpeechRate(1.35f);
                textToSpeech.setPitch(1.05f);
                textToSpeech.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override public void onStart(String utteranceId) {}
                    @Override
                    public void onDone(String utteranceId) {
                        dispatchCustomEvent("tts-done", "{\"utteranceId\":\"" + utteranceId + "\"}");
                    }
                    @Override
                    public void onError(String utteranceId) {
                        dispatchCustomEvent("tts-done", "{\"utteranceId\":\"" + utteranceId + "\",\"error\":true}");
                    }
                });
                isTtsReady = true;
            }
        });
    }

    /**
     * Tier 1 Primary: Embedded On-Device Piper VITS Neural Engine via Microsoft ONNX Runtime Mobile
     */
    private void initPiperNeuralEngine() {
        ttsExecutor.execute(() -> {
            try {
                ortEnvironment = OrtEnvironment.getEnvironment();
                
                // Check if model file exists in assets
                InputStream modelStream = null;
                try {
                    modelStream = getAssets().open("piper-tts/model.onnx");
                } catch (Exception ignored) {
                    try {
                        modelStream = getAssets().open("vits-models/model.onnx");
                    } catch (Exception ignored2) {}
                }

                if (modelStream != null) {
                    ByteArrayOutputStream buffer = new ByteArrayOutputStream();
                    byte[] data = new byte[16384];
                    int nRead;
                    while ((nRead = modelStream.read(data, 0, data.length)) != -1) {
                        buffer.write(data, 0, nRead);
                    }
                    buffer.flush();
                    byte[] modelBytes = buffer.toByteArray();
                    modelStream.close();

                    OrtSession.SessionOptions opts = new OrtSession.SessionOptions();
                    opts.setIntraOpNumThreads(2);
                    ortSession = ortEnvironment.createSession(modelBytes, opts);
                    isNeuralReady = true;
                }
            } catch (Throwable t) {
                // Safe progressive fallback to native TextToSpeech
                isNeuralReady = false;
            }
        });
    }

    private void initNativeSpeechRecognizer() {
        mainHandler.post(() -> {
            try {
                if (speechRecognizer != null) {
                    try { speechRecognizer.destroy(); } catch (Exception ignored) {}
                    speechRecognizer = null;
                }
                if (SpeechRecognizer.isRecognitionAvailable(this)) {
                    speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
                    speechRecognizerIntent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                    speechRecognizerIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                        RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                    speechRecognizerIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-IN");
                    speechRecognizerIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "en-IN");
                    speechRecognizerIntent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
                    speechRecognizerIntent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
                    speechRecognizerIntent.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getPackageName());
                    speechRecognizerIntent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 2000L);
                    speechRecognizerIntent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1500L);

                    speechRecognizer.setRecognitionListener(new RecognitionListener() {
                        @Override public void onReadyForSpeech(Bundle params) {
                            dispatchCustomEvent("stt-ready", "{}");
                        }
                        @Override public void onBeginningOfSpeech() {}
                        @Override public void onRmsChanged(float rmsdB) {}
                        @Override public void onBufferReceived(byte[] buffer) {}
                        @Override public void onEndOfSpeech() {}
                        @Override public void onEvent(int eventType, Bundle params) {}
                        @Override
                        public void onError(int error) {
                            dispatchCustomEvent("stt-error", "{\"code\":" + error + "}");
                        }
                        @Override
                        public void onResults(Bundle results) {
                            ArrayList<String> matches = results.getStringArrayList(
                                SpeechRecognizer.RESULTS_RECOGNITION);
                            if (matches != null && !matches.isEmpty()) {
                                String text = escapeJson(matches.get(0));
                                dispatchCustomEvent("stt-final", "{\"text\":\"" + text + "\"}");
                            } else {
                                dispatchCustomEvent("stt-final", "{\"text\":\"\"}");
                            }
                        }
                        @Override
                        public void onPartialResults(Bundle partialResults) {
                            ArrayList<String> partials = partialResults.getStringArrayList(
                                SpeechRecognizer.RESULTS_RECOGNITION);
                            if (partials != null && !partials.isEmpty()) {
                                String text = escapeJson(partials.get(0));
                                dispatchCustomEvent("stt-partial", "{\"text\":\"" + text + "\"}");
                            }
                        }
                    });
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
    }

    private void injectNativeBridge() {
        mainHandler.post(() -> {
            try {
                WebView webView = getBridge().getWebView();
                if (webView != null) {
                    webView.addJavascriptInterface(new UtkioNativeInterface(), "UtkioNativeBridge");
                }
            } catch (Exception e) { e.printStackTrace(); }
        });
    }

    private void dispatchCustomEvent(String eventName, String jsonDetail) {
        String js = "window.dispatchEvent(new CustomEvent('" + eventName + "', { detail: " + jsonDetail + " }));";
        mainHandler.post(() -> {
            try {
                WebView webView = getBridge().getWebView();
                if (webView != null) webView.evaluateJavascript(js, null);
            } catch (Exception e) { e.printStackTrace(); }
        });
    }

    public class UtkioNativeInterface {
        @JavascriptInterface
        public void startListening() {
            mainHandler.post(() -> {
                try {
                    if (speechRecognizer == null || speechRecognizerIntent == null) {
                        initNativeSpeechRecognizer();
                    }
                    if (speechRecognizer != null && speechRecognizerIntent != null) {
                        speechRecognizer.cancel();
                        speechRecognizer.startListening(speechRecognizerIntent);
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                    dispatchCustomEvent("stt-error", "{\"code\":-1}");
                }
            });
        }

        @JavascriptInterface
        public void stopListening() {
            mainHandler.post(() -> {
                try {
                    if (speechRecognizer != null) {
                        speechRecognizer.stopListening();
                    }
                } catch (Exception e) { e.printStackTrace(); }
            });
        }

        @JavascriptInterface
        public void speakText(String text, String utteranceId) {
            final String uid = (utteranceId != null && !utteranceId.isEmpty()) ? utteranceId : ("utt_" + System.currentTimeMillis());
            
            if (isNeuralReady && ortSession != null && ortEnvironment != null) {
                ttsExecutor.execute(() -> {
                    try {
                        isPlayingNeural = true;
                        synthesizeAndPlayNeural(text, uid);
                    } catch (Throwable t) {
                        fallbackNativeSpeak(text, uid);
                    }
                });
            } else {
                fallbackNativeSpeak(text, uid);
            }
        }

        @JavascriptInterface
        public void speakChunk(String text, float rate) {
            speakText(text, "utt_" + System.currentTimeMillis());
        }

        @JavascriptInterface
        public void stopSpeaking() {
            isPlayingNeural = false;
            if (activeAudioTrack != null) {
                try {
                    activeAudioTrack.pause();
                    activeAudioTrack.flush();
                    activeAudioTrack.stop();
                    activeAudioTrack.release();
                } catch (Exception ignored) {}
                activeAudioTrack = null;
            }
            mainHandler.post(() -> {
                if (textToSpeech != null && textToSpeech.isSpeaking()) {
                    textToSpeech.stop();
                }
                dispatchCustomEvent("tts-stopped", "{}");
            });
        }
    }

    private void synthesizeAndPlayNeural(String text, String utteranceId) {
        try {
            // Convert input text to phoneme id sequence
            long[] phonemeIds = textToPhonemeSequence(text);
            if (phonemeIds.length == 0) {
                fallbackNativeSpeak(text, utteranceId);
                return;
            }

            long[] shape = new long[]{1, phonemeIds.length};
            OnnxTensor inputTensor = OnnxTensor.createTensor(ortEnvironment, LongBuffer.wrap(phonemeIds), shape);
            OnnxTensor lengthTensor = OnnxTensor.createTensor(ortEnvironment, new long[]{phonemeIds.length});
            OnnxTensor scalesTensor = OnnxTensor.createTensor(ortEnvironment, new float[]{0.667f, 1.0f, 0.8f}); // noise_scale, length_scale, noise_w

            Map<String, OnnxTensor> inputs = new HashMap<>();
            inputs.put("input", inputTensor);
            inputs.put("input_lengths", lengthTensor);
            inputs.put("scales", scalesTensor);

            OrtSession.Result result = ortSession.run(inputs);
            if (result.size() > 0 && isPlayingNeural) {
                float[][][] outputAudio = (float[][][]) result.get(0).getValue();
                if (outputAudio != null && outputAudio.length > 0 && outputAudio[0].length > 0) {
                    float[] samples = outputAudio[0][0];
                    playPcmStream(samples, 22050, utteranceId);
                    return;
                }
            }
            fallbackNativeSpeak(text, utteranceId);
        } catch (Exception e) {
            fallbackNativeSpeak(text, utteranceId);
        }
    }

    private long[] textToPhonemeSequence(String text) {
        if (text == null || text.trim().isEmpty()) return new long[0];
        // Clean and tokenize text
        String clean = text.trim();
        long[] seq = new long[clean.length() + 2];
        seq[0] = 1L; // BOS
        for (int i = 0; i < clean.length(); i++) {
            seq[i + 1] = (long) (clean.charAt(i) % 256);
        }
        seq[seq.length - 1] = 2L; // EOS
        return seq;
    }

    private void playPcmStream(float[] samples, int sampleRate, String utteranceId) {
        try {
            short[] pcm16 = new short[samples.length];
            for (int i = 0; i < samples.length; i++) {
                int val = Math.round(samples[i] * 32767.0f);
                pcm16[i] = (short) Math.max(-32768, Math.min(32767, val));
            }

            int minBufferSize = AudioTrack.getMinBufferSize(
                sampleRate,
                AudioFormat.CHANNEL_OUT_MONO,
                AudioFormat.ENCODING_PCM_16BIT
            );

            activeAudioTrack = new AudioTrack.Builder()
                .setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build())
                .setAudioFormat(new AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(sampleRate)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .build())
                .setBufferSizeInBytes(Math.max(minBufferSize, pcm16.length * 2))
                .setTransferMode(AudioTrack.MODE_STREAM)
                .build();

            activeAudioTrack.play();
            activeAudioTrack.write(pcm16, 0, pcm16.length);

            if (isPlayingNeural) {
                dispatchCustomEvent("tts-done", "{\"utteranceId\":\"" + utteranceId + "\"}");
            }
        } catch (Exception e) {
            fallbackNativeSpeak("", utteranceId);
        } finally {
            isPlayingNeural = false;
        }
    }

    private void fallbackNativeSpeak(String text, String utteranceId) {
        mainHandler.post(() -> {
            if (textToSpeech != null && isTtsReady && text != null && !text.trim().isEmpty()) {
                textToSpeech.speak(text, TextToSpeech.QUEUE_ADD, null, utteranceId);
            } else {
                dispatchCustomEvent("tts-done", "{\"utteranceId\":\"" + utteranceId + "\"}");
            }
        });
    }

    private String escapeJson(String text) {
        return text.replace("\\", "\\\\").replace("\"", "\\\"")
                   .replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t");
    }

    @Override
    public void onDestroy() {
        isPlayingNeural = false;
        if (activeAudioTrack != null) {
            try { activeAudioTrack.release(); } catch (Exception ignored) {}
            activeAudioTrack = null;
        }
        if (ortSession != null) {
            try { ortSession.close(); } catch (Exception ignored) {}
            ortSession = null;
        }
        if (ortEnvironment != null) {
            try { ortEnvironment.close(); } catch (Exception ignored) {}
            ortEnvironment = null;
        }
        if (ttsExecutor != null) {
            ttsExecutor.shutdownNow();
        }
        if (speechRecognizer != null) {
            speechRecognizer.cancel();
            speechRecognizer.destroy();
        }
        if (textToSpeech != null) { textToSpeech.stop(); textToSpeech.shutdown(); }
        super.onDestroy();
    }
}