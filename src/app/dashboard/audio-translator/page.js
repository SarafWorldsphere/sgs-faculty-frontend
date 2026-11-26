"use client";

import { useState, useRef, useEffect } from "react";

// ?? and not ||: an empty value means "same origin as this app", which is
// what a deployment behind nginx wants. || would read it as missing and send
// the browser to localhost:8000.
const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("swais_faculty_token") : null;
}

const LANGUAGES = [
  { code: "en-IN", label: "English" },
  { code: "hi-IN", label: "Hindi (हिंदी)" },
  { code: "te-IN", label: "Telugu (తెలుగు)" },
  { code: "ta-IN", label: "Tamil (தமிழ்)" },
  { code: "kn-IN", label: "Kannada (ಕನ್ನಡ)" },
  { code: "ml-IN", label: "Malayalam (മലയാളം)" },
  { code: "mr-IN", label: "Marathi (मराठी)" },
  { code: "bn-IN", label: "Bengali (বাংলা)" },
];

export default function AudioTranslatorPage() {
  const [isRecording,     setIsRecording]     = useState(false);
  const [transcript,      setTranscript]       = useState("");
  const [translatedText,  setTranslatedText]   = useState("");
  const [sourceLang,      setSourceLang]       = useState("en-IN");
  const [targetLang,      setTargetLang]       = useState("hi-IN");
  const [isTranslating,   setIsTranslating]    = useState(false);
  const [isSpeaking,      setIsSpeaking]       = useState(false);
  const [recordingTime,   setRecordingTime]    = useState(0);
  const [srSupported,     setSrSupported]      = useState(false);

  const recognitionRef = useRef(null);
  const timerRef       = useRef(null);

  useEffect(() => {
    setSrSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition));
    return () => {
      recognitionRef.current?.stop();
      clearInterval(timerRef.current);
      window.speechSynthesis?.cancel();
    };
  }, []);

  const startRecording = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    setTranscript("");
    setTranslatedText("");
    setRecordingTime(0);

    const rec = new SR();
    rec.lang = sourceLang;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      const text = Array.from(e.results).map(r => r[0].transcript).join(" ");
      setTranscript(text);
    };
    rec.onend = () => {
      setIsRecording(false);
      clearInterval(timerRef.current);
    };
    rec.onerror = () => {
      setIsRecording(false);
      clearInterval(timerRef.current);
    };

    recognitionRef.current = rec;
    rec.start();
    setIsRecording(true);

    timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsRecording(false);
    clearInterval(timerRef.current);
  };

  const handleTranslate = async () => {
    if (!transcript.trim()) return;
    setIsTranslating(true);
    setTranslatedText("");
    try {
      const targetLabel = LANGUAGES.find(l => l.code === targetLang)?.label || targetLang;
      const res = await fetch(`${API}/api/v1/translate/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ text: transcript, targetLanguage: targetLabel }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTranslatedText(data.translatedText ?? data.translated_text ?? data.translation ?? data.result ?? JSON.stringify(data));
    } catch {
      setTranslatedText("Translation failed. Please try again.");
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSpeak = async () => {
    if (!translatedText) return;
    if (isSpeaking) {
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
      return;
    }
    setIsSpeaking(true);
    try {
      const targetLabel = LANGUAGES.find(l => l.code === targetLang)?.label || "English";
      const res = await fetch(`${API}/api/v1/speech/to-voice`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ text: translatedText, language: targetLabel, voice: "Female" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const audioSrc = data.audioUrl ?? data.audio_url ?? data.audioBase64 ?? data.audio ?? null;
      if (audioSrc) {
        const src = audioSrc.startsWith("http") ? audioSrc : `data:audio/mp3;base64,${audioSrc}`;
        const audio = new Audio(src);
        audio.onended = () => setIsSpeaking(false);
        audio.onerror = () => setIsSpeaking(false);
        audio.play();
      } else {
        throw new Error("No audio in response");
      }
    } catch {
      // fallback to browser TTS
      const utt = new SpeechSynthesisUtterance(translatedText);
      utt.lang = targetLang;
      utt.onend = () => setIsSpeaking(false);
      utt.onerror = () => setIsSpeaking(false);
      window.speechSynthesis?.cancel();
      window.speechSynthesis?.speak(utt);
    }
  };

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
          style={{ background: "linear-gradient(135deg,#8B5CF6,#06B6D4)" }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-7V4a3 3 0 00-3-3H9" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#F1F5F9", fontFamily: "var(--font-space-grotesk)" }}>
            Audio Language Translator
          </h1>
          <p className="text-sm" style={{ color: "#94A3B8" }}>
            Speak in one language, hear it in another
          </p>
        </div>
        <span className="ml-auto text-xs font-semibold px-3 py-1 rounded-full"
          style={{ background: "#ECFDF5", color: "#10B981", border: "1px solid #A7F3D0" }}>
          AI Connected
        </span>
      </div>

      {/* Language Bar */}
      <div className="bg-white rounded-2xl p-4 flex items-center gap-4 flex-wrap"
        style={{ border: "1px solid rgba(99,102,241,0.1)" }}>
        <div className="flex-1 min-w-[140px]">
          <label className="text-xs font-semibold block mb-1.5" style={{ color: "#64748B" }}>Speak in</label>
          <select value={sourceLang} onChange={e => setSourceLang(e.target.value)}
            className="w-full text-sm rounded-xl px-3 py-2 outline-none cursor-pointer"
            style={{ border: "1px solid #E2E8F0", color: "#0F172A", background: "#F8FAFC" }}>
            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>
        <div className="mt-5 flex items-center" style={{ color: "#94A3B8" }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="text-xs font-semibold block mb-1.5" style={{ color: "#64748B" }}>Translate to</label>
          <select value={targetLang} onChange={e => setTargetLang(e.target.value)}
            className="w-full text-sm rounded-xl px-3 py-2 outline-none cursor-pointer"
            style={{ border: "1px solid #E2E8F0", color: "#0F172A", background: "#F8FAFC" }}>
            {LANGUAGES.filter(l => l.code !== sourceLang).map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>
      </div>

      {/* Record Panel */}
      <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-6"
        style={{ border: "1px solid rgba(99,102,241,0.1)" }}>

        {/* Mic button */}
        <div className="relative">
          {isRecording && (
            <div className="absolute inset-0 rounded-full animate-ping opacity-30"
              style={{ background: "#EF4444", transform: "scale(1.4)" }} />
          )}
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={!srSupported}
            className="w-24 h-24 rounded-full flex items-center justify-center text-white transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
            style={{
              background: isRecording
                ? "linear-gradient(135deg,#EF4444,#DC2626)"
                : "linear-gradient(135deg,#6366F1,#8B5CF6)",
              transform: isRecording ? "scale(1.05)" : "scale(1)",
            }}>
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isRecording ? (
                <rect x="6" y="6" width="12" height="12" rx="2" strokeWidth={2} />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-7V4a3 3 0 00-3-3H9" />
              )}
            </svg>
          </button>
        </div>

        {/* Status */}
        <div className="text-center">
          {!srSupported ? (
            <p className="text-sm" style={{ color: "#EF4444" }}>Microphone not supported in this browser</p>
          ) : isRecording ? (
            <>
              <p className="text-sm font-semibold" style={{ color: "#EF4444" }}>Recording… {formatTime(recordingTime)}</p>
              <p className="text-xs mt-1" style={{ color: "#94A3B8" }}>Tap the button to stop</p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold" style={{ color: "#64748B" }}>Tap to start recording</p>
              <p className="text-xs mt-1" style={{ color: "#94A3B8" }}>Speak clearly in {LANGUAGES.find(l => l.code === sourceLang)?.label}</p>
            </>
          )}
        </div>

        {/* Live transcript */}
        {transcript && (
          <div className="w-full p-4 rounded-xl" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
            <p className="text-xs font-semibold mb-1" style={{ color: "#64748B" }}>Transcribed:</p>
            <p className="text-sm" style={{ color: "#0F172A" }}>{transcript}</p>
          </div>
        )}

        {/* Translate button */}
        {transcript && !isRecording && (
          <button onClick={handleTranslate} disabled={isTranslating}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all cursor-pointer disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#6366F1,#8B5CF6)" }}>
            {isTranslating ? "Translating…" : `Translate to ${LANGUAGES.find(l => l.code === targetLang)?.label} →`}
          </button>
        )}
      </div>

      {/* Translation Output */}
      {(isTranslating || translatedText) && (
        <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid rgba(99,102,241,0.1)" }}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold" style={{ color: "#64748B" }}>
              Translation — {LANGUAGES.find(l => l.code === targetLang)?.label}
            </p>
            {translatedText && (
              <button onClick={handleSpeak}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                style={{
                  background: isSpeaking ? "#EF4444" : "#EEF2FF",
                  color:      isSpeaking ? "white"   : "#6366F1",
                }}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15.536 8.464a5 5 0 010 7.072M12 6v12" />
                </svg>
                {isSpeaking ? "Stop" : "Listen"}
              </button>
            )}
          </div>
          {isTranslating ? (
            <div className="space-y-2">
              <div className="skeleton h-3 w-full rounded" />
              <div className="skeleton h-3 w-4/5 rounded" />
              <div className="skeleton h-3 w-3/5 rounded" />
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap" style={{ color: "#0F172A", lineHeight: "1.7" }}>
              {translatedText}
            </p>
          )}
        </div>
      )}

    </div>
  );
}
