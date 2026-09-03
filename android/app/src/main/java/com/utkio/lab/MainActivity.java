package com.utkio.lab;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import okio.ByteString;

public class MainActivity extends BridgeActivity {
    private static final int PERMISSION_REQUEST_CODE = 101;
    private SpeechRecognizer speechRecognizer;
    private Intent speechRecognizerIntent;
    private TextToSpeech textToSpeech;
    private boolean isTtsReady = false;
    private Handler mainHandler;
    private ExecutorService ttsExecutor;
    private OkHttpClient okHttpClient;

    // Active Speech & Playback State
    private String selectedVoice = "en-IN-NeerjaNeural";
    private String selectedRate = "+35%";
    private volatile boolean isSpeakingActive = false;
    private WebSocket activeWebSocket = null;
    private MediaPlayer mediaPlayer = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        mainHandler = new Handler(Looper.getMainLooper());
        ttsExecutor = Executors.newSingleThreadExecutor();
        okHttpClient = new OkHttpClient.Builder()
                .connectTimeout(5, TimeUnit.SECONDS)
                .readTimeout(10, TimeUnit.SECONDS)
                .build();

        checkAudioPermissions();
        initNativeTTS();
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
     * Tier 1 Engine: Calibrated Native High-Quality Google Neural Engine (0ms Latency, ₹0 Cost)
     */
    private void initNativeTTS() {
        textToSpeech = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                updateNativeTtsVoice(selectedVoice);
                textToSpeech.setSpeechRate(1.15f); // Natural human conversational pace
                textToSpeech.setPitch(1.02f);
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
                Log.i("UtkioNativeBridge", "Native Google TTS Initialized Successfully");
            }
        });
    }

    private void updateNativeTtsVoice(String voiceName) {
        if (textToSpeech == null) return;
        boolean isMale = voiceName != null && (voiceName.contains("Prabhat") || voiceName.contains("Madhur") || voiceName.contains("Guy") || voiceName.toLowerCase().contains("male"));
        boolean isHindi = voiceName != null && voiceName.startsWith("hi-");
        
        Locale targetLocale = isHindi ? new Locale("hi", "IN") : new Locale("en", "IN");
        try {
            int res = textToSpeech.setLanguage(targetLocale);
            if (res == TextToSpeech.LANG_MISSING_DATA || res == TextToSpeech.LANG_NOT_SUPPORTED) {
                textToSpeech.setLanguage(new Locale("en", "IN"));
            }
        } catch (Exception ignored) {}

        try {
            if (textToSpeech.getVoices() != null) {
                Voice bestVoice = null;
                int bestScore = -1;

                for (Voice voice : textToSpeech.getVoices()) {
                    if (voice.getLocale() == null) continue;
                    String lang = voice.getLocale().getLanguage();
                    String country = voice.getLocale().getCountry();

                    boolean localeMatch = isHindi ? "hi".equalsIgnoreCase(lang) : ("en".equalsIgnoreCase(lang) && "IN".equalsIgnoreCase(country));
                    if (!localeMatch) {
                        if (!isHindi && "en".equalsIgnoreCase(lang)) {
                            // Secondary fallback
                        } else {
                            continue;
                        }
                    }

                    String name = voice.getName().toLowerCase();
                    int score = 0;

                    if ("IN".equalsIgnoreCase(country)) score += 40;
                    if (name.contains("network") || voice.isNetworkConnectionRequired()) score += 50;
                    if (name.contains("neural") || name.contains("high")) score += 40;
                    if (voice.getQuality() >= 400) score += 30;
                    else if (voice.getQuality() >= 300) score += 20;

                    if (isMale) {
                        if (name.contains("male") || name.contains("#male") || name.contains("enc") || name.contains("hid")) score += 25;
                    } else {
                        if (name.contains("female") || name.contains("#female") || name.contains("end") || name.contains("ena") || name.contains("hie")) score += 25;
                    }

                    if (score > bestScore) {
                        bestScore = score;
                        bestVoice = voice;
                    }
                }

                if (bestVoice != null) {
                    textToSpeech.setVoice(bestVoice);
                    Log.i("UtkioNativeBridge", "Selected Best Google TTS Voice: " + bestVoice.getName() + " (score=" + bestScore + ")");
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
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
        public void setVoiceConfig(String voiceName, String rate) {
            mainHandler.post(() -> {
                if (voiceName != null && !voiceName.isEmpty()) selectedVoice = voiceName;
                if (rate != null && !rate.isEmpty()) selectedRate = rate;
                updateNativeTtsVoice(selectedVoice);
                if (textToSpeech != null) {
                    float speed = 1.15f;
                    if (selectedRate != null) {
                        if (selectedRate.contains("0%")) speed = 1.0f;
                        else if (selectedRate.contains("15%")) speed = 1.15f;
                        else if (selectedRate.contains("35%")) speed = 1.25f;
                        else if (selectedRate.contains("50%")) speed = 1.4f;
                    }
                    textToSpeech.setSpeechRate(speed);
                }
            });
        }

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
            speakWithNativeTTS(text, uid);
        }

        @JavascriptInterface
        public void speakChunk(String text, float rate) {
            speakText(text, "utt_" + System.currentTimeMillis());
        }

        @JavascriptInterface
        public void stopSpeaking() {
            stopActivePlayback();
            dispatchCustomEvent("tts-stopped", "{}");
        }
    }

    private void speakWithNativeTTS(String text, String utteranceId) {
        mainHandler.post(() -> {
            try {
                if (text == null || text.trim().isEmpty()) {
                    dispatchCustomEvent("tts-done", "{\"utteranceId\":\"" + utteranceId + "\"}");
                    return;
                }
                isSpeakingActive = true;
                if (textToSpeech != null && isTtsReady) {
                    Bundle params = new Bundle();
                    params.putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, utteranceId);
                    textToSpeech.speak(text.trim(), TextToSpeech.QUEUE_FLUSH, params, utteranceId);
                } else {
                    dispatchCustomEvent("tts-done", "{\"utteranceId\":\"" + utteranceId + "\"}");
                }
            } catch (Exception e) {
                e.printStackTrace();
                dispatchCustomEvent("tts-done", "{\"utteranceId\":\"" + utteranceId + "\",\"error\":true}");
            }
        });
    }

    private void speakWithEdgeTTS(String text, String voice, String rate, String utteranceId) {
        ttsExecutor.execute(() -> {
            try {
                stopActivePlayback();
                isSpeakingActive = true;

                String connectionId = UUID.randomUUID().toString().replace("-", "");
                String requestId = UUID.randomUUID().toString().replace("-", "");
                String token = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
                String wsUrl = "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=" + token + "&ConnectionId=" + connectionId;

                Request request = new Request.Builder()
                    .url(wsUrl)
                    .addHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0")
                    .addHeader("Origin", "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold")
                    .addHeader("Pragma", "no-cache")
                    .addHeader("Cache-Control", "no-cache")
                    .build();

                File tempAudioFile = new File(getCacheDir(), "edge_tts_" + System.currentTimeMillis() + ".mp3");
                FileOutputStream fos = new FileOutputStream(tempAudioFile);

                final Object lock = new Object();
                final boolean[] completed = new boolean[]{false};
                final boolean[] error = new boolean[]{false};

                activeWebSocket = okHttpClient.newWebSocket(request, new WebSocketListener() {
                    @Override
                    public void onOpen(WebSocket webSocket, Response response) {
                        String configMsg = "Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{\"context\":{\"synthesis\":{\"client\":{\"clientid\":\"" + connectionId + "\",\"version\":\"10.0.22621.1\",\"name\":\"edge\"}}}}\r\n";
                        webSocket.send(configMsg);

                        String cleanText = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
                        String ssml = "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='" + voice + "'><prosody pitch='+0Hz' rate='" + rate + "'>" + cleanText + "</prosody></voice></speak>";
                        String ssmlMsg = "X-RequestId:" + requestId + "\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n" + ssml;
                        webSocket.send(ssmlMsg);
                    }

                    @Override
                    public void onMessage(WebSocket webSocket, String text) {
                        if (text.contains("Path:turn.end")) {
                            completed[0] = true;
                            synchronized (lock) { lock.notifyAll(); }
                        }
                    }

                    @Override
                    public void onMessage(WebSocket webSocket, ByteString bytes) {
                        byte[] data = bytes.toByteArray();
                        if (data.length > 2) {
                            int headerLength = ((data[0] & 0xFF) << 8) | (data[1] & 0xFF);
                            if (data.length > 2 + headerLength) {
                                try {
                                    fos.write(data, 2 + headerLength, data.length - (2 + headerLength));
                                } catch (IOException ignored) {}
                            }
                        }
                    }

                    @Override
                    public void onFailure(WebSocket webSocket, Throwable t, Response response) {
                        error[0] = true;
                        synchronized (lock) { lock.notifyAll(); }
                    }
                });

                synchronized (lock) {
                    if (!completed[0] && !error[0]) {
                        lock.wait(3500);
                    }
                }

                try { fos.close(); } catch (Exception ignored) {}

                if (completed[0] && tempAudioFile.length() > 200 && isSpeakingActive) {
                    playAudioFile(tempAudioFile, utteranceId);
                } else {
                    tempAudioFile.delete();
                    fallbackNativeSpeak(text, utteranceId);
                }
            } catch (Exception e) {
                fallbackNativeSpeak(text, utteranceId);
            }
        });
    }

    private void playAudioFile(File file, String utteranceId) {
        mainHandler.post(() -> {
            try {
                if (!isSpeakingActive) {
                    file.delete();
                    return;
                }
                mediaPlayer = new MediaPlayer();
                mediaPlayer.setAudioAttributes(new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                    .build());
                mediaPlayer.setDataSource(file.getAbsolutePath());
                mediaPlayer.setOnCompletionListener(mp -> {
                    mp.release();
                    mediaPlayer = null;
                    file.delete();
                    isSpeakingActive = false;
                    dispatchCustomEvent("tts-done", "{\"utteranceId\":\"" + utteranceId + "\"}");
                });
                mediaPlayer.setOnErrorListener((mp, what, extra) -> {
                    mp.release();
                    mediaPlayer = null;
                    file.delete();
                    isSpeakingActive = false;
                    dispatchCustomEvent("tts-done", "{\"utteranceId\":\"" + utteranceId + "\",\"error\":true}");
                    return true;
                });
                mediaPlayer.prepare();
                mediaPlayer.start();
            } catch (Exception e) {
                file.delete();
                fallbackNativeSpeak("", utteranceId);
            }
        });
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

    private void stopActivePlayback() {
        isSpeakingActive = false;
        if (activeWebSocket != null) {
            try { activeWebSocket.cancel(); } catch (Exception ignored) {}
            activeWebSocket = null;
        }
        mainHandler.post(() -> {
            if (mediaPlayer != null) {
                try {
                    if (mediaPlayer.isPlaying()) mediaPlayer.stop();
                    mediaPlayer.reset();
                    mediaPlayer.release();
                } catch (Exception ignored) {}
                mediaPlayer = null;
            }
            if (textToSpeech != null && textToSpeech.isSpeaking()) {
                try { textToSpeech.stop(); } catch (Exception ignored) {}
            }
        });
    }

    private String escapeJson(String text) {
        return text.replace("\\", "\\\\").replace("\"", "\\\"")
                   .replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t");
    }

    @Override
    public void onDestroy() {
        stopActivePlayback();
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