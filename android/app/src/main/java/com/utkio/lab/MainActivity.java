package com.utkio.lab;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
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
import java.util.ArrayList;
import java.util.Locale;

public class MainActivity extends BridgeActivity {
    private static final int PERMISSION_REQUEST_CODE = 101;
    private SpeechRecognizer speechRecognizer;
    private Intent speechRecognizerIntent;
    private TextToSpeech textToSpeech;
    private boolean isTtsReady = false;
    private Handler mainHandler;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        mainHandler = new Handler(Looper.getMainLooper());
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

    private void initNativeTTS() {
        textToSpeech = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                int result = textToSpeech.setLanguage(new Locale("en", "IN"));
                if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                    textToSpeech.setLanguage(Locale.US);
                }
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

    private void initNativeSpeechRecognizer() {
        mainHandler.post(() -> {
            if (SpeechRecognizer.isRecognitionAvailable(this)) {
                speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
                speechRecognizerIntent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                speechRecognizerIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                    RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                speechRecognizerIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-IN");
                speechRecognizerIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "en-IN");
                speechRecognizerIntent.putExtra(RecognizerIntent.EXTRA_ONLY_RETURN_LANGUAGE_PREFERENCE, "en-IN");
                speechRecognizerIntent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
                speechRecognizerIntent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
                speechRecognizer.setRecognitionListener(new RecognitionListener() {
                    @Override public void onReadyForSpeech(Bundle params) {}
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
                if (speechRecognizer != null && speechRecognizerIntent != null) {
                    try { speechRecognizer.startListening(speechRecognizerIntent); }
                    catch (Exception e) { e.printStackTrace(); }
                }
            });
        }

        @JavascriptInterface
        public void stopListening() {
            mainHandler.post(() -> {
                if (speechRecognizer != null) {
                    try { speechRecognizer.stopListening(); }
                    catch (Exception e) { e.printStackTrace(); }
                }
            });
        }

        @JavascriptInterface
        public void speakChunk(String text, float rate) {
            mainHandler.post(() -> {
                if (textToSpeech != null && isTtsReady && text != null && !text.trim().isEmpty()) {
                    textToSpeech.setSpeechRate(rate > 0 ? rate : 1.35f);
                    String utteranceId = "utt_" + System.currentTimeMillis();
                    textToSpeech.speak(text, TextToSpeech.QUEUE_ADD, null, utteranceId);
                }
            });
        }

        @JavascriptInterface
        public void stopSpeaking() {
            mainHandler.post(() -> {
                if (textToSpeech != null && textToSpeech.isSpeaking()) {
                    textToSpeech.stop();
                    dispatchCustomEvent("tts-stopped", "{}");
                }
            });
        }
    }

    private String escapeJson(String text) {
        return text.replace("\\", "\\\\").replace("\"", "\\\"")
                   .replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t");
    }

    @Override
    public void onDestroy() {
        if (speechRecognizer != null) speechRecognizer.destroy();
        if (textToSpeech != null) { textToSpeech.stop(); textToSpeech.shutdown(); }
        super.onDestroy();
    }
}