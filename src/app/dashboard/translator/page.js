"use client";

import { useState, useRef } from "react";

// ?? and not ||: an empty value means "same origin as this app", which is
// what a deployment behind nginx wants. || would read it as missing and send
// the browser to localhost:8000.
const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("swais_faculty_token") : null;
}

const LANGUAGES = [
  { code: "en",    label: "English" },
  { code: "hi",    label: "Hindi (हिंदी)" },
  { code: "te",    label: "Telugu (తెలుగు)" },
  { code: "ta",    label: "Tamil (தமிழ்)" },
  { code: "kn",    label: "Kannada (ಕನ್ನಡ)" },
  { code: "ml",    label: "Malayalam (മലയാളം)" },
  { code: "mr",    label: "Marathi (मराठी)" },
  { code: "bn",    label: "Bengali (বাংলা)" },
  { code: "gu",    label: "Gujarati (ગુજરાતી)" },
  { code: "pa",    label: "Punjabi (ਪੰਜਾਬੀ)" },
  { code: "ur",    label: "Urdu (اردو)" },
];

export default function TranslatorPage() {
  const [inputText,   setInputText]   = useState("");
  const [outputText,  setOutputText]  = useState("");
  const [sourceLang,  setSourceLang]  = useState("en");
  const [targetLang,  setTargetLang]  = useState("hi");
  const [isLoading,   setIsLoading]   = useState(false);
  const [copied,      setCopied]      = useState(false);
  const [charCount,   setCharCount]   = useState(0);
  const [isListening, setIsListening] = useState(false);
  const mediaRecorderRef = useRef(null);

  const MAX_CHARS = 1000;

  const handleInputChange = (e) => {
    const val = e.target.value;
    if (val.length > MAX_CHARS) return;
    setInputText(val);
    setCharCount(val.length);
    if (!val.trim()) setOutputText("");
  };

  const handleSwapLanguages = () => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setInputText(outputText);
    setOutputText(inputText);
    setCharCount(outputText.length);
  };

  const handleTranslate = async () => {
    if (!inputText.trim()) return;
    setIsLoading(true);
    setOutputText("");
    try {
      const targetLabel = LANGUAGES.find(l => l.code === targetLang)?.label || targetLang;
      const res = await fetch(`${API}/api/v1/translate/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ text: inputText, targetLanguage: targetLabel }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setOutputText(data.translatedText ?? data.translated_text ?? data.translation ?? data.result ?? JSON.stringify(data));
    } catch {
      setOutputText("Translation failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMicInput = async () => {
    if (isListening) {
      mediaRecorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result.split(",")[1];
          const langLabel = LANGUAGES.find(l => l.code === sourceLang)?.label || "English";
          try {
            const res = await fetch(`${API}/api/v1/speech/to-text`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
              body: JSON.stringify({ audioFile: base64, language: langLabel }),
            });
            const data = await res.json();
            const text = data.text ?? data.transcript ?? data.result ?? "";
            if (text) { setInputText(text); setCharCount(text.length); }
          } catch { /* silent fail */ }
          setIsListening(false);
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsListening(true);
      setTimeout(() => mediaRecorderRef.current?.stop(), 6000);
    } catch {
      setIsListening(false);
    }
  };

  const handleCopy = () => {
    if (!outputText) return;
    navigator.clipboard.writeText(outputText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSpeak = () => {
    if (!outputText || typeof window === "undefined") return;
    window.speechSynthesis.cancel();
    const lang = LANGUAGES.find(l => l.code === targetLang);
    const utt = new SpeechSynthesisUtterance(outputText);
    utt.lang = targetLang;
    window.speechSynthesis.speak(utt);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
          style={{ background: "linear-gradient(135deg,#6366F1,#8B5CF6)" }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#F1F5F9", fontFamily: "var(--font-space-grotesk)" }}>
            Language Script Translator
          </h1>
          <p className="text-sm" style={{ color: "#94A3B8" }}>
            Translate teaching content across Indian languages
          </p>
        </div>
        <span className="ml-auto text-xs font-semibold px-3 py-1 rounded-full"
          style={{ background: "#ECFDF5", color: "#10B981", border: "1px solid #A7F3D0" }}>
          AI Connected
        </span>
      </div>

      {/* Language Selector Bar */}
      <div className="bg-white rounded-2xl p-4 flex items-center gap-4 flex-wrap"
        style={{ border: "1px solid rgba(99,102,241,0.1)" }}>
        <div className="flex-1 min-w-[140px]">
          <label className="text-xs font-semibold block mb-1.5" style={{ color: "#64748B" }}>From</label>
          <select value={sourceLang} onChange={e => setSourceLang(e.target.value)}
            className="w-full text-sm rounded-xl px-3 py-2 outline-none cursor-pointer"
            style={{ border: "1px solid #E2E8F0", color: "#0F172A", background: "#F8FAFC" }}>
            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>

        <button onClick={handleSwapLanguages}
          className="mt-5 w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer"
          style={{ background: "#EEF2FF", color: "#6366F1" }}
          onMouseEnter={e => e.currentTarget.style.background = "#C7D2FE"}
          onMouseLeave={e => e.currentTarget.style.background = "#EEF2FF"}
          title="Swap languages">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        </button>

        <div className="flex-1 min-w-[140px]">
          <label className="text-xs font-semibold block mb-1.5" style={{ color: "#64748B" }}>To</label>
          <select value={targetLang} onChange={e => setTargetLang(e.target.value)}
            className="w-full text-sm rounded-xl px-3 py-2 outline-none cursor-pointer"
            style={{ border: "1px solid #E2E8F0", color: "#0F172A", background: "#F8FAFC" }}>
            {LANGUAGES.filter(l => l.code !== sourceLang).map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>
      </div>

      {/* Translation Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Input */}
        <div className="bg-white rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(99,102,241,0.1)" }}>
          <div className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: "1px solid #F1F5F9" }}>
            <span className="text-xs font-semibold" style={{ color: "#64748B" }}>
              {LANGUAGES.find(l => l.code === sourceLang)?.label}
            </span>
            <span className="text-xs" style={{ color: charCount > MAX_CHARS * 0.9 ? "#EF4444" : "#94A3B8" }}>
              {charCount}/{MAX_CHARS}
            </span>
          </div>
          <textarea
            value={inputText}
            onChange={handleInputChange}
            placeholder="Type or paste text to translate..."
            className="w-full p-4 text-sm resize-none outline-none"
            style={{ color: "#0F172A", minHeight: "240px", background: "transparent" }}
          />
          <div className="px-4 pb-4 flex gap-2">
            <button onClick={handleMicInput}
              title={isListening ? "Stop recording" : "Speak to fill input"}
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all cursor-pointer"
              style={{ background: isListening ? "#EF4444" : "#EEF2FF", color: isListening ? "white" : "#6366F1" }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-7V4a3 3 0 00-3-3H9" />
              </svg>
            </button>
            <button onClick={handleTranslate}
              disabled={!inputText.trim() || isLoading}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg,#6366F1,#8B5CF6)" }}>
              {isLoading ? "Translating…" : "Translate →"}
            </button>
          </div>
        </div>

        {/* Output */}
        <div className="bg-white rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(99,102,241,0.1)", background: outputText ? "white" : "#FAFBFF" }}>
          <div className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: "1px solid #F1F5F9" }}>
            <span className="text-xs font-semibold" style={{ color: "#64748B" }}>
              {LANGUAGES.find(l => l.code === targetLang)?.label}
            </span>
            <div className="flex items-center gap-2">
              {outputText && (
                <>
                  <button onClick={handleSpeak} title="Listen"
                    className="p-1.5 rounded-lg transition-all cursor-pointer"
                    style={{ color: "#6366F1", background: "#EEF2FF" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#C7D2FE"}
                    onMouseLeave={e => e.currentTarget.style.background = "#EEF2FF"}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15.536 8.464a5 5 0 010 7.072M12 6v12m0 0l-3-3m3 3l3-3" />
                    </svg>
                  </button>
                  <button onClick={handleCopy} title="Copy"
                    className="p-1.5 rounded-lg transition-all cursor-pointer"
                    style={{ color: copied ? "#10B981" : "#6366F1", background: copied ? "#ECFDF5" : "#EEF2FF" }}>
                    {copied ? (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="p-4 min-h-[240px] flex items-start">
            {isLoading ? (
              <div className="flex flex-col gap-3 w-full pt-4">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
                  <span className="text-sm" style={{ color: "#94A3B8" }}>Translating…</span>
                </div>
                <div className="skeleton h-3 w-full rounded" />
                <div className="skeleton h-3 w-4/5 rounded" />
                <div className="skeleton h-3 w-3/5 rounded" />
              </div>
            ) : outputText ? (
              <p className="text-sm whitespace-pre-wrap" style={{ color: "#0F172A", lineHeight: "1.7" }}>
                {outputText}
              </p>
            ) : (
              <p className="text-sm" style={{ color: "#CBD5E1" }}>
                Translation will appear here…
              </p>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
