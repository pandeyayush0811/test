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
        injectNativeBridge();
    }

    private void checkAudioPermissions() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.RECORD_AUDIO}, PERMISSION_REQUEST_CODE);
        }
    }

    private void initNativeTTS() {
        textToSpeech = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                int result = textToSpeech.setLanguage(new Locale("en", "IN"));
                if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                    textToSpeech.setLanguage(Locale.US);
                }
                // ⚡ 1.35x Conversational Speed Tuning for energetic coaching
                textToSpeech.setSpeechRate(1.35f);
                textToSpeech.setPitch(1.05f);

                textToSpeech.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override
                    public void onStart(String utteranceId) {}

                    @Override
                    public void onDone(String utteranceId) {
                        dispatchJs("if (window.UtkioNativeBridge && window.UtkioNativeBridge.onTtsDone) window.UtkioNativeBridge.onTtsDone('" + utteranceId + "');");
                    }

                    @Override
                    public void onError(String utteranceId) {
                        dispatchJs("if (window.UtkioNativeBridge && window.UtkioNativeBridge.onTtsDone) window.UtkioNativeBridge.onTtsDone('" + utteranceId + "');");
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
                speechRecognizerIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                speechRecognizerIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-IN");
                speechRecognizerIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "en-IN");
                speechRecognizerIntent.putExtra(RecognizerIntent.EXTRA_ONLY_RETURN_LANGUAGE_PREFERENCE, "en-IN");
                speechRecognizerIntent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
                speechRecognizerIntent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);

                speechRecognizer.setRecognitionListener(new RecognitionListener() {
                    @Override
                    public void onReadyForSpeech(Bundle params) {}

                    @Override
                    public void onBeginningOfSpeech() {}

                    @Override
                    public void onRmsChanged(float rmsdB) {}

                    @Override
                    public void onBufferReceived(byte[] buffer) {}

                    @Override
                    public void onEndOfSpeech() {}

                    @Override
                    public void onError(int error) {
                        String errMsg = "STT Error code: " + error;
                        dispatchJs("if (window.UtkioNativeBridge && window.UtkioNativeBridge.onError) window.UtkioNativeBridge.onError('" + errMsg + "');");
                    }

                    @Override
                    public void onResults(Bundle results) {
                        ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                        if (matches != null && !matches.isEmpty()) {
                            String finalTranscript = matches.get(0).replace("'", "\\'");
                            dispatchJs("if (window.UtkioNativeBridge && window.UtkioNativeBridge.onFinalSpeech) window.UtkioNativeBridge.onFinalSpeech('" + finalTranscript + "');");
                        }
                    }

                    @Override
                    public void onPartialResults(Bundle partialResults) {
                        ArrayList<String> partials = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                        if (partials != null && !partials.isEmpty()) {
                            String interim = partials.get(0).replace("'", "\\'");
                            dispatchJs("if (window.UtkioNativeBridge && window.UtkioNativeBridge.onPartialSpeech) window.UtkioNativeBridge.onPartialSpeech('" + interim + "');");
                        }
                    }

                    @Override
                    public void onEvent(int eventType, Bundle params) {}
                });
            }
        });
    }

    private void injectNativeBridge() {
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.addJavascriptInterface(new UtkioNativeInterface(), "UtkioNativeBridge");
        }
    }

    private void dispatchJs(String jsCode) {
        mainHandler.post(() -> {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.evaluateJavascript(jsCode, null);
            }
        });
    }

    public class UtkioNativeInterface {
        @JavascriptInterface
        public void startListening() {
            mainHandler.post(() -> {
                if (speechRecognizer != null && speechRecognizerIntent != null) {
                    try {
                        speechRecognizer.startListening(speechRecognizerIntent);
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
            });
        }

        @JavascriptInterface
        public void stopListening() {
            mainHandler.post(() -> {
                if (speechRecognizer != null) {
                    try {
                        speechRecognizer.stopListening();
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
            });
        }

        @JavascriptInterface
        public void speakChunk(String text, float rate) {
            mainHandler.post(() -> {
                if (textToSpeech != null && isTtsReady && text != null && !text.trim().isEmpty()) {
                    float speechRate = rate > 0 ? rate : 1.35f;
                    textToSpeech.setSpeechRate(speechRate);
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
                }
            });
        }
    }

    @Override
    public void onDestroy() {
        if (speechRecognizer != null) {
            speechRecognizer.destroy();
        }
        if (textToSpeech != null) {
            textToSpeech.stop();
            textToSpeech.shutdown();
        }
        super.onDestroy();
    }
}
