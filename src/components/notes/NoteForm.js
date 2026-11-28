"use client";

/**
 * NoteForm — Create/Edit note modal
 *
 * Three input modes:
 *   🎤 Voice  — Web Speech API, real-time transcript, teacher edits before saving
 *   ✏️  Write  — perfect-freehand canvas (notebook look), key-points text for TTS
 *   ⌨️  Type   — plain textarea (original behaviour)
 *
 * Saves:
 *   content       — canonical text (used for TTS / parent voice delivery)
 *   contentType   — "voice" | "handwritten" | "typed"
 *   canvasImageUrl — base64 PNG (handwritten mode only; swap for S3 URL when backend ready)
 */

import { useState, useEffect, useRef, useCallback, useMemo, Fragment } from "react";
import { getStroke } from "perfect-freehand";
import { useNotes } from "@/context/NotesContext";
import { useToast } from "@/components/ui/Toast";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

// ─── perfect-freehand helpers ────────────────────────────────────────────────

/** Convert perfect-freehand output points to an SVG path string */
function getSvgPathFromStroke(stroke) {
  if (!stroke.length) return "";
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", ...stroke[0], "Q"]
  );
  d.push("Z");
  return d.join(" ");
}

const STROKE_OPTS = {
  smoothing: 0.5,
  thinning: 0.5,
  streamline: 0.5,
  simulatePressure: true,
};

/** Draw all completed strokes + the active stroke onto a 2D canvas context */
function renderStrokes(ctx, strokes, currentPoints, penColor, penSize) {
  for (const s of strokes) {
    const pts = getStroke(s.points, { ...STROKE_OPTS, size: s.size, last: true });
    if (!pts.length) continue;
    ctx.fillStyle = s.color;
    ctx.fill(new Path2D(getSvgPathFromStroke(pts)));
  }
  if (currentPoints.length > 1) {
    const pts = getStroke(currentPoints, { ...STROKE_OPTS, size: penSize });
    if (pts.length) {
      ctx.fillStyle = penColor;
      ctx.fill(new Path2D(getSvgPathFromStroke(pts)));
    }
  }
}

/** Draw lined-notebook background on a 2D canvas context */
function drawNotebookBg(ctx, w, h) {
  ctx.fillStyle = "#fdfdf5";
  ctx.fillRect(0, 0, w, h);
  // Horizontal ruled lines
  ctx.strokeStyle = "#c8d8f0";
  ctx.lineWidth = 1;
  for (let y = 36; y < h; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  // Left red margin
  ctx.strokeStyle = "#f5b8b8";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(52, 0);
  ctx.lineTo(52, h);
  ctx.stroke();
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PEN_COLORS = [
  { value: "#1a1a1a", label: "Black" },
  { value: "#1a56db", label: "Blue" },
  { value: "#e02424", label: "Red" },
  { value: "#057a55", label: "Green" },
];

const PEN_SIZES = [
  { label: "S", value: 3 },
  { label: "M", value: 5 },
  { label: "L", value: 8 },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function NoteForm({ isOpen, onClose, editNote = null, initialChapter = "", onCreated = null }) {
  const { addNote, editNote: updateNote, chapters } = useNotes();
  const toast = useToast();
  const isEditing = !!editNote;

  // Chapters arranged under the subject they belong to, for the selector
  // below. Subjects are listed alphabetically and chapters keep the order
  // the API sent them, which is chapter number. Anything without a subject
  // is collected under "" and rendered ungrouped.
  const chaptersBySubject = useMemo(() => {
    const groups = new Map();
    for (const ch of chapters ?? []) {
      const subject = (typeof ch === "string" ? "" : ch.subject_name) || "";
      if (!groups.has(subject)) groups.set(subject, []);
      groups.get(subject).push(ch);
    }
    return [...groups.entries()]
      .map(([subject, items]) => ({ subject, items }))
      .sort((a, b) => (a.subject === "" ? 1 : b.subject === "" ? -1
                       : a.subject.localeCompare(b.subject)));
  }, [chapters]);

  // ── Shared form state ──────────────────────────────────────────────────────
  const [title, setTitle]     = useState("");
  const [chapter, setChapter] = useState("");
  const [content, setContent] = useState("");
  const [errors, setErrors]   = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // ── Input mode: "voice" | "write" | "type" ───────────────────────────────
  const [inputMode, setInputMode] = useState("voice");
  const [contentType, setContentType] = useState("voice");

  // ── Voice state ────────────────────────────────────────────────────────────
  const [isListening, setIsListening]   = useState(false);
  const [interimText, setInterimText]   = useState("");
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef      = useRef(null);
  const finalTranscriptRef  = useRef(""); // stable ref to avoid stale closure

  // ── Canvas state ───────────────────────────────────────────────────────────
  const canvasRef           = useRef(null);
  const [strokes, setStrokes]             = useState([]);
  const [currentPoints, setCurrentPoints] = useState([]);
  const [isDrawing, setIsDrawing]         = useState(false);
  const [penColor, setPenColor]           = useState(PEN_COLORS[0].value);
  const [penSize, setPenSize]             = useState(5);
  const [canvasHasContent, setCanvasHasContent] = useState(false);

  // ── Check voice API availability on mount ─────────────────────────────────
  useEffect(() => {
    setVoiceSupported(
      typeof window !== "undefined" &&
        !!(window.SpeechRecognition || window.webkitSpeechRecognition)
    );
  }, []);

  // ── Populate form when editing ─────────────────────────────────────────────
  useEffect(() => {
    if (editNote) {
      setTitle(editNote.title || "");
      setChapter(editNote.chapter || "");
      setContent(editNote.content || "");
      finalTranscriptRef.current = editNote.content || "";
      const mode =
        editNote.contentType === "voice"
          ? "voice"
          : editNote.contentType === "handwritten"
          ? "write"
          : "type";
      setInputMode(mode);
      setContentType(editNote.contentType || "typed");
    } else {
      setTitle("");
      setChapter(initialChapter || "");
      setContent("");
      setInputMode("voice");
      setContentType("voice");
      setStrokes([]);
      setCurrentPoints([]);
      setCanvasHasContent(false);
      finalTranscriptRef.current = "";
    }
    setErrors({});
    setInterimText("");
  }, [editNote, isOpen, initialChapter]);

  // ── Stop listening when modal closes ──────────────────────────────────────
  useEffect(() => {
    if (!isOpen) stopListening();
  }, [isOpen]);

  // ── Canvas: redraw whenever strokes / mode change ─────────────────────────
  useEffect(() => {
    if (inputMode !== "write") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    drawNotebookBg(ctx, canvas.width, canvas.height);
    renderStrokes(ctx, strokes, currentPoints, penColor, penSize);
  }, [inputMode, strokes, currentPoints, penColor, penSize]);

  // Cleanup on unmount
  useEffect(() => () => stopListening(), []);

  // ── Voice helpers ──────────────────────────────────────────────────────────
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimText("");
  }, []);

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.continuous      = true;
    rec.interimResults  = true;
    rec.lang            = "en-IN";

    rec.onstart = () => setIsListening(true);
    rec.onend   = () => { setIsListening(false); setInterimText(""); };
    rec.onerror = () => { setIsListening(false); setInterimText(""); };

    rec.onresult = (event) => {
      let interim = "";
      let newFinal = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) newFinal += t + " ";
        else interim += t;
      }
      if (newFinal) {
        const updated = finalTranscriptRef.current + newFinal;
        finalTranscriptRef.current = updated;
        setContent(updated);
        if (errors.content) setErrors((p) => ({ ...p, content: undefined }));
      }
      setInterimText(interim);
    };

    recognitionRef.current = rec;
    rec.start();
  }, [errors.content]);

  const toggleListening = () => (isListening ? stopListening() : startListening());

  // ── Canvas helpers ─────────────────────────────────────────────────────────
  const getPoint = (e) => {
    const canvas = canvasRef.current;
    const rect   = canvas.getBoundingClientRect();
    const sx     = canvas.width  / rect.width;
    const sy     = canvas.height / rect.height;
    return [
      (e.clientX - rect.left) * sx,
      (e.clientY - rect.top)  * sy,
      e.pressure || 0.5,
    ];
  };

  const onCanvasDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    setCurrentPoints([getPoint(e)]);
    setCanvasHasContent(true);
  };

  const onCanvasMove = (e) => {
    if (!isDrawing) return;
    setCurrentPoints((prev) => [...prev, getPoint(e)]);
  };

  const onCanvasUp = () => {
    if (!isDrawing) return;
    if (currentPoints.length > 0) {
      setStrokes((prev) => [
        ...prev,
        { points: currentPoints, color: penColor, size: penSize },
      ]);
    }
    setCurrentPoints([]);
    setIsDrawing(false);
  };

  const undoStroke = () => {
    setStrokes((prev) => {
      const next = prev.slice(0, -1);
      if (!next.length) setCanvasHasContent(false);
      return next;
    });
  };

  const clearCanvas = () => {
    setStrokes([]);
    setCurrentPoints([]);
    setCanvasHasContent(false);
  };

  const exportCanvas = () =>
    canvasRef.current ? canvasRef.current.toDataURL("image/png") : null;

  // ── Mode switch ────────────────────────────────────────────────────────────
  const switchMode = (mode) => {
    if (isListening) stopListening();
    setInputMode(mode);
    const ct = mode === "voice" ? "voice" : mode === "write" ? "handwritten" : "typed";
    setContentType(ct);
    setErrors({});
  };

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = () => {
    const errs = {};
    if (!title.trim())  errs.title   = "Title is required";
    if (!chapter)       errs.chapter = "Please select a chapter";

    if (inputMode === "write") {
      if (!canvasHasContent && !content.trim())
        errs.canvas = "Please draw something or add key points below";
    } else {
      if (!content.trim())           errs.content = "Content is required";
      else if (content.trim().length < 20)
        errs.content = "Content must be at least 20 characters";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isListening) stopListening();
    if (!validate()) return;

    setIsSaving(true);
    try {
      const noteData = {
        title:         title.trim(),
        chapter,
        content:       content.trim(),
        contentType,
        canvasImageUrl:
          inputMode === "write" && canvasHasContent
            ? exportCanvas()
            : editNote?.canvasImageUrl ?? null,
      };

      await (isEditing ? updateNote(editNote.id, noteData) : addNote(noteData));
      toast.success(
        isEditing ? "Note updated successfully" : "Note created successfully",
        isEditing ? "Updated" : "Created"
      );
      // On a successful *create*, let the caller decide what happens next
      // (e.g. the chapter reader navigates to /dashboard/notes). Falls back
      // to just closing when no onCreated handler is provided.
      if (!isEditing && onCreated) onCreated();
      else onClose();
    } catch (err) {
      console.error("Failed to save note:", err);
      toast.error("Could not save note. Please try again.", "Error");
    } finally {
      setIsSaving(false);
    }
  };

  // ── Shared field change helper (clears error on edit) ─────────────────────
  const clearErr = (field) =>
    setErrors((p) => ({ ...p, [field]: undefined }));

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Note" : "Create New Note"}
      maxWidth="max-w-4xl"
      id="note-form-modal"
    >
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Title + Chapter (full-width top row) ── */}
        <div className="grid gap-4 sm:grid-cols-2">

        {/* ── Title ── */}
        <div>
          <label htmlFor="note-title" className="block text-sm font-medium text-text mb-1.5">
            Title <span className="text-danger">*</span>
          </label>
          <input
            id="note-title"
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); clearErr("title"); }}
            placeholder="Enter note title..."
            className={`w-full px-4 py-2.5 border rounded-lg text-sm text-text placeholder:text-text-lighter
              focus:outline-none focus:ring-2 transition-all duration-200
              ${errors.title
                ? "border-danger focus:ring-danger/30"
                : "border-border focus:ring-primary/30 focus:border-primary"}`}
          />
          {errors.title && <p className="mt-1 text-xs text-danger">{errors.title}</p>}
        </div>

        {/* ── Chapter ── */}
        <div>
          <label htmlFor="note-chapter" className="block text-sm font-medium text-text mb-1.5">
            Chapter <span className="text-danger">*</span>
          </label>
          <select
            id="note-chapter"
            value={chapter}
            onChange={(e) => { setChapter(e.target.value); clearErr("chapter"); }}
            className={`w-full px-4 py-2.5 border rounded-lg text-sm text-text bg-white cursor-pointer
              focus:outline-none focus:ring-2 transition-all duration-200
              ${errors.chapter
                ? "border-danger focus:ring-danger/30"
                : "border-border focus:ring-primary/30 focus:border-primary"}`}
          >
            <option value="">Select a chapter...</option>
            {/*
              Grouped by subject. A teacher taking several subjects in one
              class saw every chapter in a single flat list with nothing
              saying which subject each belonged to — "Chapter 3" appearing
              twice, once for Science and once for Social, was impossible to
              tell apart. The API already returns subject_name per chapter;
              it was simply not being shown.

              The option's value stays the chapter title, because that is
              what a note stores. Only the grouping and the displayed text
              change, so existing notes keep matching.
            */}
            {chaptersBySubject.map(({ subject, items }) => {
              const options = items.map((ch) => {
                const label = typeof ch === "string"
                  ? ch
                  : (ch.content_title ?? ch.chapter_name ?? String(ch.chapter_id));
                const key = typeof ch === "string" ? ch : ch.chapter_id;
                return <option key={key} value={label}>{label}</option>;
              });
              // Without a subject there is nothing to group under, so those
              // chapters stay at the top level rather than under a blank
              // heading.
              return subject
                ? <optgroup key={subject} label={subject}>{options}</optgroup>
                : <Fragment key="__ungrouped">{options}</Fragment>;
            })}
          </select>
          {errors.chapter && <p className="mt-1 text-xs text-danger">{errors.chapter}</p>}
        </div>

        </div>{/* end Title + Chapter row */}

        {/* ── Two-pane: mode picker (left rail) + content (right) ── */}
        <div className="grid gap-5 md:grid-cols-[240px_minmax(0,1fr)]">

          {/* Left rail — input-mode picker */}
          <div>
            <label className="block text-sm font-medium text-text mb-2">How do you want to add it?</label>
            <div className="grid grid-cols-3 md:grid-cols-1 gap-2">
              {[
                { id: "voice", icon: "🎤", label: "Voice", desc: "Speak your note" },
                { id: "write", icon: "✏️",  label: "Write", desc: "Handwrite / draw" },
                { id: "type",  icon: "⌨️",  label: "Type",  desc: "Plain text" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => switchMode(tab.id)}
                  className={`flex flex-col md:flex-row items-center md:items-start gap-1.5 md:gap-2.5 p-3 rounded-xl border text-center md:text-left transition-all duration-200
                    ${inputMode === tab.id
                      ? "border-primary bg-primary-light text-primary shadow-sm"
                      : "border-border text-text-light hover:border-primary/40 hover:bg-bg"}`}
                >
                  <span className="text-lg leading-none md:mt-0.5">{tab.icon}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{tab.label}</span>
                    <span className="hidden md:block text-xs text-text-lighter mt-0.5">{tab.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Right pane — active mode content */}
          <div className="min-w-0">

          {/* ══ VOICE TAB ══════════════════════════════════════════════════════ */}
          {inputMode === "voice" && (
            <div className="space-y-4 animate-fade-in">

              {/* Browser support warning */}
              {!voiceSupported && (
                <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg">
                  <span className="text-warning text-base mt-0.5">⚠️</span>
                  <p className="text-sm text-text">
                    Voice input requires Chrome or Edge. Switch to{" "}
                    <button type="button" className="text-primary underline" onClick={() => switchMode("type")}>
                      Type mode
                    </button>{" "}
                    instead.
                  </p>
                </div>
              )}

              {/* Mic area */}
              <div className="flex flex-col items-center gap-4 py-6 bg-bg rounded-2xl border border-border">
                {/* Animated mic button */}
                <div className="relative">
                  {isListening && (
                    <>
                      <span className="absolute inset-0 rounded-full bg-danger/20 animate-ping" />
                      <span className="absolute inset-[-8px] rounded-full bg-danger/10 animate-ping" style={{ animationDelay: "0.2s" }} />
                    </>
                  )}
                  <button
                    type="button"
                    disabled={!voiceSupported}
                    onClick={toggleListening}
                    aria-label={isListening ? "Stop recording" : "Start recording"}
                    className={`relative w-20 h-20 rounded-full flex items-center justify-center
                      shadow-lg transition-all duration-200 active:scale-95
                      disabled:opacity-40 disabled:cursor-not-allowed
                      ${isListening
                        ? "bg-danger shadow-danger/30 scale-110"
                        : "bg-primary hover:bg-primary-dark hover:scale-105 shadow-primary/30"}`}
                  >
                    {isListening ? (
                      /* Stop square */
                      <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="6" y="6" width="12" height="12" rx="2" />
                      </svg>
                    ) : (
                      /* Microphone */
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    )}
                  </button>
                </div>

                <p className={`text-sm font-medium transition-colors ${isListening ? "text-danger" : "text-text-light"}`}>
                  {isListening ? "Listening… tap to stop" : "Tap to speak your note"}
                </p>

                {/* Sound-wave bars */}
                {isListening && (
                  <div className="flex items-center gap-[3px] h-8" aria-hidden="true">
                    {[3, 7, 5, 10, 4, 8, 3, 9, 5, 7, 3].map((h, i) => (
                      <div
                        key={i}
                        className="w-[3px] bg-danger rounded-full animate-bounce"
                        style={{ height: `${h * 2.5}px`, animationDelay: `${i * 0.08}s`, animationDuration: "0.7s" }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Transcript textarea */}
              <div>
                <label className="block text-sm font-medium text-text mb-1.5">
                  Transcript
                  <span className="ml-1.5 text-xs font-normal text-text-lighter">(review and edit before saving)</span>
                  <span className="text-danger"> *</span>
                </label>
                <textarea
                  value={content}
                  onChange={(e) => {
                    setContent(e.target.value);
                    finalTranscriptRef.current = e.target.value;
                    clearErr("content");
                  }}
                  placeholder="Your spoken words appear here automatically. You can also type or edit…"
                  rows={5}
                  className={`w-full px-4 py-2.5 border rounded-lg text-sm text-text placeholder:text-text-lighter
                    focus:outline-none focus:ring-2 transition-all resize-y
                    ${errors.content
                      ? "border-danger focus:ring-danger/30"
                      : "border-border focus:ring-primary/30 focus:border-primary"}`}
                />
                {/* Live interim preview */}
                {interimText && (
                  <p className="mt-1.5 px-3 py-1.5 bg-primary-light rounded-lg text-sm text-primary/60 italic">
                    {interimText}…
                  </p>
                )}
                {errors.content && <p className="mt-1 text-xs text-danger">{errors.content}</p>}
                <p className="mt-1 text-xs text-text-lighter text-right">{content.length} characters</p>
              </div>
            </div>
          )}

          {/* ══ WRITE TAB ══════════════════════════════════════════════════════ */}
          {inputMode === "write" && (
            <div className="space-y-3 animate-fade-in">

              {/* Toolbar */}
              <div className="flex items-center gap-3 px-3 py-2 bg-bg rounded-xl border border-border flex-wrap">
                {/* Ink colours */}
                <div className="flex items-center gap-1.5">
                  {PEN_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      aria-label={`${c.label} pen`}
                      onClick={() => setPenColor(c.value)}
                      className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110
                        ${penColor === c.value ? "scale-125 border-text/70 shadow" : "border-transparent"}`}
                      style={{ background: c.value }}
                    />
                  ))}
                </div>

                <div className="w-px h-5 bg-border" />

                {/* Pen sizes */}
                <div className="flex items-center gap-1">
                  {PEN_SIZES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setPenSize(s.value)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition-all
                        ${penSize === s.value
                          ? "bg-primary text-white shadow-sm"
                          : "bg-white text-text-light hover:bg-primary-light hover:text-primary"}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                <div className="w-px h-5 bg-border" />

                {/* Undo / Clear */}
                <button
                  type="button"
                  onClick={undoStroke}
                  disabled={!strokes.length}
                  title="Undo last stroke"
                  className="flex items-center gap-1 px-2 py-1 text-xs text-text-light hover:text-text
                    hover:bg-white rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                  Undo
                </button>
                <button
                  type="button"
                  onClick={clearCanvas}
                  disabled={!canvasHasContent}
                  className="px-2 py-1 text-xs text-danger hover:bg-danger-light rounded-lg
                    transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Clear
                </button>
              </div>

              {/* Notebook canvas */}
              <div className={`rounded-xl overflow-hidden border-2 transition-colors
                ${errors.canvas ? "border-danger" : "border-border"}`}>
                <canvas
                  ref={canvasRef}
                  width={640}
                  height={320}
                  className="w-full touch-none select-none"
                  style={{ cursor: "crosshair" }}
                  onPointerDown={onCanvasDown}
                  onPointerMove={onCanvasMove}
                  onPointerUp={onCanvasUp}
                  onPointerLeave={onCanvasUp}
                />
              </div>

              {errors.canvas && <p className="text-xs text-danger">{errors.canvas}</p>}

              <p className="text-xs text-text-lighter text-center">
                ✏️&nbsp; Write or draw with your mouse, finger, or stylus &nbsp;·&nbsp; Use Undo to remove the last stroke
              </p>

              {/* Key-points text for TTS / parent voice delivery */}
              <div>
                <label className="block text-sm font-medium text-text mb-1.5">
                  Key Points
                  <span className="ml-1.5 text-xs font-normal text-text-lighter">
                    (typed text used for voice playback to parents)
                  </span>
                </label>
                <textarea
                  value={content}
                  onChange={(e) => { setContent(e.target.value); clearErr("canvas"); }}
                  placeholder="Summarise what you wrote above — parents will hear this as a voice note…"
                  rows={3}
                  className="w-full px-4 py-2.5 border border-border rounded-lg text-sm text-text
                    placeholder:text-text-lighter focus:outline-none focus:ring-2
                    focus:ring-primary/30 focus:border-primary transition-all resize-y"
                />
              </div>
            </div>
          )}

          {/* ══ TYPE TAB ════════════════════════════════════════════════════════ */}
          {inputMode === "type" && (
            <div className="animate-fade-in">
              <label htmlFor="note-content" className="block text-sm font-medium text-text mb-1.5">
                Content <span className="text-danger">*</span>
              </label>
              <textarea
                id="note-content"
                value={content}
                onChange={(e) => { setContent(e.target.value); clearErr("content"); }}
                placeholder="Write your note content here…"
                rows={8}
                className={`w-full px-4 py-2.5 border rounded-lg text-sm text-text placeholder:text-text-lighter
                  focus:outline-none focus:ring-2 transition-all resize-y
                  ${errors.content
                    ? "border-danger focus:ring-danger/30"
                    : "border-border focus:ring-primary/30 focus:border-primary"}`}
              />
              <div className="flex justify-between mt-1">
                {errors.content
                  ? <p className="text-xs text-danger">{errors.content}</p>
                  : <span />}
                <p className="text-xs text-text-lighter">{content.length} characters</p>
              </div>
            </div>
          )}
          </div>{/* end right pane */}
        </div>{/* end two-pane */}

        {/* ── Actions ── */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <Button variant="ghost" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit" loading={isSaving} id="note-save-btn">
            {isEditing ? "Save Changes" : "Create Note"}
          </Button>
        </div>

      </form>
    </Modal>
  );
}
