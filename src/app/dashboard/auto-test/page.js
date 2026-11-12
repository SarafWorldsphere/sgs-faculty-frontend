"use client";

import { useState, useEffect } from "react";
import ChapterPicker from "@/components/chapters/ChapterPicker";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { todayISO } from "@/lib/dates";
import {
  saveQuestionPaper,
  fetchQuestionPapers,
  fetchQuestionPaper,
  deleteQuestionPaper,
  assignQuestionPaper,
} from "@/lib/api";

// ?? and not ||: an empty value means "same origin as this app", which is
// what a deployment behind nginx wants. || would read it as missing and send
// the browser to localhost:8000.
const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("swais_faculty_token") : null;
}

const DIFFICULTIES = ["Easy", "Medium", "Hard"];
const QTYPES = ["MCQ", "True/False", "Short Answer"];

/* ─── Configure Step ──────────────────────────────────────── */
function ConfigStep({ onGenerate }) {
  const [chapterId,   setChapterId]   = useState("");
  const [chapterName, setChapterName] = useState("");
  const [difficulty,  setDifficulty]  = useState("Medium");
  const [qtype,       setQtype]       = useState("");
  const [totalMarks,  setTotalMarks]  = useState(50);

  return (
    <div className="bg-white rounded-2xl p-8 shadow-sm max-w-xl mx-auto"
      style={{ border: "1px solid rgba(99,102,241,0.1)" }}>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl ai-gradient flex items-center justify-center pulse-glow">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-bold" style={{ color: "#0F172A", fontFamily: "var(--font-space-grotesk)" }}>
            Configure Your Test
          </h2>
          <p className="text-xs" style={{ color: "#94A3B8" }}>Select chapter, difficulty, and total marks</p>
        </div>
      </div>

      <div className="space-y-5">

        {/* Chapter */}
        <div>
          <label className="block text-sm font-semibold mb-2" style={{ color: "#374151" }}>📖 Class / Subject / Chapter</label>
          <ChapterPicker onChapterChange={(id, name) => { setChapterId(id); setChapterName(name); }} />
        </div>

        {/* Difficulty */}
        <div>
          <label className="block text-sm font-semibold mb-2" style={{ color: "#374151" }}>🎯 Difficulty</label>
          <div className="grid grid-cols-3 gap-2">
            {DIFFICULTIES.map(d => {
              const colors = { Easy: "#10B981", Medium: "#F59E0B", Hard: "#EF4444" };
              const bgs    = { Easy: "#ECFDF5", Medium: "#FFFBEB", Hard: "#FEF2F2" };
              const active = difficulty === d;
              return (
                <button key={d} onClick={() => setDifficulty(d)}
                  className="py-2.5 px-3 rounded-xl text-xs font-semibold text-center transition-all cursor-pointer"
                  style={active
                    ? { background: bgs[d], color: colors[d], border: `1.5px solid ${colors[d]}`, boxShadow: `0 4px 12px ${colors[d]}33` }
                    : { background: "#F8FAFC", color: "#64748B", border: "1.5px solid #E2E8F0" }}>
                  {d}
                </button>
              );
            })}
          </div>
        </div>

        {/* Question Type (optional) */}
        <div>
          <label className="block text-sm font-semibold mb-1" style={{ color: "#374151" }}>
            🧩 Question Type
            <span className="ml-2 text-xs font-normal" style={{ color: "#94A3B8" }}>(optional)</span>
          </label>
          <div className="grid grid-cols-4 gap-2">
            {QTYPES.map(t => (
              <button key={t} onClick={() => setQtype(prev => prev === t ? "" : t)}
                className="py-2.5 px-2 rounded-xl text-xs font-semibold text-center transition-all cursor-pointer"
                style={qtype === t
                  ? { background: "linear-gradient(135deg,#6366F1,#8B5CF6)", color: "#fff", boxShadow: "0 4px 12px rgba(99,102,241,0.3)" }
                  : { background: "#F8FAFC", color: "#64748B", border: "1.5px solid #E2E8F0" }}
                  >
                {t}
              </button>
            ))}
            <button onClick={() => setQtype("")}
              className="py-2.5 px-2 rounded-xl text-xs font-semibold text-center transition-all cursor-pointer"
              style={qtype === ""
                ? { background: "linear-gradient(135deg,#6366F1,#8B5CF6)", color: "#fff", boxShadow: "0 4px 12px rgba(99,102,241,0.3)" }
                : { background: "#F8FAFC", color: "#64748B", border: "1.5px solid #E2E8F0" }}>
              All
            </button>
          </div>
        </div>

        {/* Total Marks slider */}
        <div>
          <label className="block text-sm font-semibold mb-2 flex items-center justify-between" style={{ color: "#374151" }}>
            <span>🔢 Total Marks</span>
            <span className="font-bold" style={{ color: "#6366F1" }}>{totalMarks}</span>
          </label>
          <input type="range" min={10} max={100} step={10} value={totalMarks}
            onChange={e => setTotalMarks(Number(e.target.value))}
            className="w-full cursor-pointer"
            style={{ accentColor: "#6366F1" }} />
          <div className="flex justify-between text-[10px] mt-1" style={{ color: "#94A3B8" }}>
            <span>10</span><span>100</span>
          </div>
        </div>

        {/* Preview info */}
        <div className="p-3.5 rounded-xl flex items-start gap-2.5"
          style={{ background: "linear-gradient(135deg,#EEF2FF,#F5F3FF)", border: "1px solid #DDD6FE" }}>
          <span className="text-sm mt-0.5">⚡</span>
          <div>
            <p className="text-xs font-bold" style={{ color: "#6366F1" }}>AI will generate:</p>
            <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>
              <span className="font-semibold">{difficulty}</span> · {totalMarks} marks ·{" "}
              <span className="font-semibold">{qtype || "All question types"}</span> ·{" "}
              {chapterName || "Selected chapter"}
            </p>
          </div>
        </div>

        <button
          onClick={() => onGenerate({ chapterId, chapterName, difficulty, totalMarks, qtype })}
          disabled={!chapterId}
          className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all cursor-pointer ai-gradient hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
          style={{ boxShadow: "0 4px 16px rgba(99,102,241,0.35)" }}>
          ✨ Generate Test
        </button>
      </div>
    </div>
  );
}

/* ─── Generating Step ─────────────────────────────────────── */
function GeneratingStep({ config }) {
  const steps = [
    "Analysing chapter content…",
    "Applying difficulty settings…",
    "Generating questions with AI…",
    "Preparing answer key…",
    "Finalising test paper…",
  ];
  return (
    <div className="bg-white rounded-2xl p-12 shadow-sm max-w-xl mx-auto text-center"
      style={{ border: "1px solid rgba(99,102,241,0.1)" }}>
      <div className="w-16 h-16 rounded-2xl ai-gradient mx-auto mb-5 flex items-center justify-center pulse-glow">
        <svg className="w-8 h-8 text-white animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </div>
      <h2 className="text-lg font-bold mb-1" style={{ color: "#0F172A", fontFamily: "var(--font-space-grotesk)" }}>
        AI is generating your test…
      </h2>
      <p className="text-xs mb-8" style={{ color: "#94A3B8" }}>
        {config.difficulty} · {config.totalMarks} marks · {config.chapterName}
      </p>
      <div className="space-y-2.5 text-left">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-2.5 animate-fade-in" style={{ animationDelay: `${i * 0.3}s` }}>
            <div className="w-4 h-4 rounded-full ai-gradient flex items-center justify-center flex-shrink-0">
              <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-xs" style={{ color: "#64748B" }}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Question Card ───────────────────────────────────────── */
function QuestionCard({ question, index }) {
  // Normalise whatever shape Node.js returns
  const text    = question.question ?? question.q ?? question.questionText ?? `Question ${index + 1}`;
  const options = question.options ?? question.opts ?? question.choices ?? [];
  const answer  = question.answer ?? question.ans ?? question.correctAnswer ?? question.correct_answer ?? null;
  const marks   = question.marks ?? question.maxMarks ?? question.max_marks ?? null;
  const type    = question.type ?? question.questionType ?? "";

  return (
    <div className="bg-white rounded-xl p-5 transition-all"
      style={{ border: "1px solid rgba(99,102,241,0.08)" }}>
      <div className="flex gap-3">
        <div className="w-7 h-7 rounded-lg ai-gradient flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-sm font-medium" style={{ color: "#0F172A" }}>{text}</p>
            {marks && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
                style={{ background: "#EEF2FF", color: "#6366F1" }}>{marks}m</span>
            )}
          </div>

          {/* MCQ options */}
          {options.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5 mt-2">
              {options.map((opt, oi) => {
                const optText = typeof opt === "object" ? (opt.text ?? opt.label ?? JSON.stringify(opt)) : opt;
                const isCorrect = answer !== null && (
                  oi === answer || optText === answer ||
                  String(oi) === String(answer) ||
                  optText?.toLowerCase() === String(answer)?.toLowerCase()
                );
                return (
                  <div key={oi} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                    style={{
                      background: isCorrect ? "#ECFDF5" : "#F8FAFC",
                      border: `1px solid ${isCorrect ? "#A7F3D0" : "#E2E8F0"}`,
                      color: isCorrect ? "#059669" : "#64748B",
                      fontWeight: isCorrect ? 600 : 400,
                    }}>
                    <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                      style={{ background: isCorrect ? "#059669" : "#E2E8F0", color: isCorrect ? "#fff" : "#94A3B8" }}>
                      {String.fromCharCode(65 + oi)}
                    </span>
                    {optText}
                    {isCorrect && <span className="ml-auto">✓</span>}
                  </div>
                );
              })}
            </div>
          )}

          {/* True/False */}
          {options.length === 0 && (answer === true || answer === false || answer === "true" || answer === "false" || answer === "True" || answer === "False") && (
            <div className="flex gap-2 mt-1">
              {[true, false].map(v => {
                const isAns = String(v) === String(answer)?.toLowerCase() || v === answer;
                return (
                  <span key={String(v)} className="px-3 py-1 rounded-lg text-xs font-semibold"
                    style={isAns
                      ? { background: "#ECFDF5", color: "#059669", border: "1px solid #A7F3D0" }
                      : { background: "#F8FAFC", color: "#94A3B8", border: "1px solid #E2E8F0" }}>
                    {v ? "True" : "False"} {isAns && "✓"}
                  </span>
                );
              })}
            </div>
          )}

          {/* Short answer / answer text */}
          {answer && options.length === 0 && answer !== true && answer !== false && answer !== "true" && answer !== "false" && (
            <div className="mt-2 px-3 py-2 rounded-lg" style={{ background: "#ECFDF5", border: "1px solid #A7F3D0" }}>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: "#059669" }}>Answer</p>
              <p className="text-xs" style={{ color: "#065F46" }}>{String(answer)}</p>
            </div>
          )}

          {/* No answer provided — write space */}
          {!answer && options.length === 0 && (
            <div className="mt-2 px-3 py-2 rounded-lg" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: "#94A3B8" }}>Answer Space</p>
              <div className="h-10 rounded" style={{ background: "repeating-linear-gradient(transparent, transparent 19px, #E2E8F0 19px, #E2E8F0 20px)" }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Shared helpers ──────────────────────────────────────── */
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

/** Plain-text rendering of structured questions — used for print and assign. */
function questionsToText(questions = []) {
  return questions.map((q, i) => {
    const text = q.question ?? q.q ?? q.questionText ?? `Question ${i + 1}`;
    const opts = q.options ?? q.opts ?? q.choices ?? [];
    const marks = q.marks ?? q.maxMarks ?? q.max_marks;
    const head = `${i + 1}. ${text}${marks ? `  [${marks} marks]` : ""}`;
    const body = opts.map((o, j) => `   ${String.fromCharCode(65 + j)}) ${typeof o === "string" ? o : o.text ?? o.option ?? ""}`).join("\n");
    return body ? `${head}\n${body}` : head;
  }).join("\n\n");
}

/* ─── Print sheet ─────────────────────────────────────────────
   One hidden sheet for the whole page. Set `paper` to print it; the sheet
   mounts, prints, and unmounts on afterprint. Being the only .qp-sheet on
   the page means nothing else can leak into the printout. */
function PrintSheet({ paper, onDone }) {
  useEffect(() => {
    if (!paper) return;
    const done = () => onDone?.();
    window.addEventListener("afterprint", done);
    // Let the sheet paint before the print dialog snapshots it.
    const t = setTimeout(() => window.print(), 80);
    return () => { clearTimeout(t); window.removeEventListener("afterprint", done); };
  }, [paper, onDone]);

  if (!paper) return null;
  const body = paper.paper_text || questionsToText(paper.questions);
  return (
    <>
      <style jsx global>{`
        .qp-sheet { display: none; }
        @page { size: A4; margin: 14mm; }
        @media print {
          body * { visibility: hidden; }
          .qp-sheet, .qp-sheet * { visibility: visible; }
          .qp-sheet { display: block; position: absolute; left: 0; top: 0; width: 100%;
                      font: 11pt/1.55 "Times New Roman", serif; color: #000; }
          .qp-sheet h1 { font-size: 15pt; margin: 0 0 2mm; text-align: center; }
          .qp-sheet .qp-meta { display: flex; justify-content: space-between; font-size: 10pt;
                               border-bottom: 1px solid #000; padding-bottom: 2mm; margin-bottom: 5mm; }
          .qp-sheet pre { white-space: pre-wrap; font: inherit; margin: 0; }
        }
      `}</style>
      <div className="qp-sheet" aria-hidden="true">
        <h1>{paper.title}</h1>
        <div className="qp-meta">
          <span>{paper.subject || ""}</span>
          <span>{[paper.difficulty, paper.question_type, paper.total_marks ? `Max marks: ${paper.total_marks}` : null].filter(Boolean).join("  ·  ")}</span>
        </div>
        <pre>{body}</pre>
      </div>
    </>
  );
}

/* ─── Assign dialog ───────────────────────────────────────── */
function AssignDialog({ paper, onClose }) {
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy]       = useState(false);
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState("");

  const submit = async () => {
    if (!dueDate || busy) return;
    setBusy(true); setError("");
    try {
      await assignQuestionPaper(paper, dueDate);
      setDone(true);
    } catch (err) {
      setError(err.message || "Couldn't create the assignment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={!!paper} onClose={onClose} title={done ? "Assigned" : "Assign to students"} maxWidth="max-w-md">
      <div className="px-6 py-5">
        {done ? (
          <div className="text-center py-2">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center text-2xl" style={{ background: "#ECFDF5" }}>✅</div>
            <p className="text-sm" style={{ color: "#334155" }}>
              <span className="font-semibold">{paper.title}</span> is now an assignment for your class, due {fmtDate(dueDate)}.
            </p>
            <button onClick={onClose} className="mt-5 px-5 py-2 rounded-xl text-sm font-semibold text-white cursor-pointer ai-gradient">Done</button>
          </div>
        ) : (
          <>
            <p className="text-sm mb-4" style={{ color: "#64748B" }}>
              Creates an assignment named <span className="font-semibold" style={{ color: "#0F172A" }}>{paper.title}</span> with this paper as its content, for every student in your class.
            </p>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "#475569" }}>Due date *</label>
            <input type="date" min={todayISO()} value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
              style={{ border: "1.5px solid #E2E8F0", color: "#0F172A" }} />
            {error && <p className="text-xs mt-2" style={{ color: "#DC2626" }}>{error}</p>}
            <div className="mt-5 flex justify-end gap-2.5">
              <button onClick={onClose} disabled={busy} className="px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer"
                style={{ border: "1.5px solid #E2E8F0", color: "#334155" }}>Cancel</button>
              <button onClick={submit} disabled={!dueDate || busy}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white cursor-pointer ai-gradient disabled:opacity-60 disabled:cursor-not-allowed">
                {busy ? "Assigning…" : "Assign"}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

/* ─── Preview Step ────────────────────────────────────────── */
function PreviewStep({ config, questions, rawResponse, onReset, onPrint, onSaved }) {
  const [title, setTitle]       = useState(`${config?.chapterName || "Chapter"} — ${config?.difficulty || ""} test`.trim());
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(null);   // the stored paper, once saved
  const [error, setError]       = useState("");
  const [assigning, setAssigning] = useState(false);

  const hasStructured = questions.length > 0;
  const paperText = !hasStructured && typeof rawResponse === "string" ? rawResponse : null;

  // What Print and Assign work from, whether or not it's been saved yet.
  const asPaper = () => ({
    title, subject: config?.subject, difficulty: config?.difficulty,
    total_marks: config?.totalMarks, question_type: config?.qtype || null,
    paper_text: paperText, questions: hasStructured ? questions : null,
  });

  const handleSave = async () => {
    if (saving || saved) return;
    if (!title.trim()) { setError("Give the paper a title before saving."); return; }
    setSaving(true); setError("");
    try {
      const stored = await saveQuestionPaper({
        title: title.trim(),
        chapterId: config?.chapterId ?? null,
        subject: config?.subject ?? null,
        difficulty: config?.difficulty ?? null,
        totalMarks: config?.totalMarks ?? null,
        questionType: config?.qtype || null,
        paperText,
        questions: hasStructured ? questions : null,
      });
      setSaved(stored);
      onSaved?.(stored);
    } catch (err) {
      setError(err.message || "Couldn't save the paper.");
    } finally {
      setSaving(false);
    }
  };

  const btn = "px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all disabled:opacity-60 disabled:cursor-not-allowed";

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header: title (editable until saved) + actions */}
      <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid rgba(99,102,241,0.1)" }}>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: "#EEF2FF", color: "#6366F1" }}>{config?.difficulty}</span>
          <span className="text-xs font-medium" style={{ color: "#64748B" }}>· {config?.totalMarks} marks</span>
          {config?.qtype && <span className="text-xs font-medium" style={{ color: "#64748B" }}>· {config.qtype}</span>}
          {hasStructured && <span className="text-xs font-medium" style={{ color: "#64748B" }}>· {questions.length} questions</span>}
        </div>
        {saved ? (
          <h2 className="text-base font-bold" style={{ color: "#0F172A", fontFamily: "var(--font-space-grotesk)" }}>{saved.title}</h2>
        ) : (
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Paper title"
            className="w-full text-base font-bold outline-none rounded-lg px-2 py-1 -ml-2"
            style={{ color: "#0F172A", fontFamily: "var(--font-space-grotesk)", border: "1.5px solid transparent" }}
            onFocus={e => e.target.style.borderColor = "#C7D2FE"} onBlur={e => e.target.style.borderColor = "transparent"} />
        )}

        <div className="flex gap-2 mt-4 flex-wrap">
          <button onClick={onReset} className={btn} style={{ background: "#F8FAFC", color: "#64748B", border: "1px solid #E2E8F0" }}>← Reconfigure</button>
          <button onClick={() => onPrint(saved ?? asPaper())} className={btn} style={{ border: "1.5px solid #6366F1", color: "#6366F1", background: "white" }}>🖨 Print</button>
          {saved ? (
            <>
              <span className={btn} style={{ background: "#ECFDF5", color: "#059669", cursor: "default" }}>✓ Saved</span>
              <button onClick={() => setAssigning(true)} className={`${btn} text-white ai-gradient`}>Assign to students →</button>
            </>
          ) : (
            <button onClick={handleSave} disabled={saving} className={`${btn} text-white ai-gradient`}
              style={{ boxShadow: "0 4px 12px rgba(99,102,241,0.3)" }}>
              {saving ? "Saving…" : "💾 Save"}
            </button>
          )}
        </div>
        {error && <p className="text-xs mt-3" style={{ color: "#DC2626" }}>{error}</p>}
      </div>

      {/* Body */}
      {hasStructured ? (
        <div className="space-y-3">
          {questions.map((q, idx) => <QuestionCard key={idx} question={q} index={idx} />)}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-6 whitespace-pre-wrap text-sm"
          style={{ border: "1px solid rgba(99,102,241,0.1)", color: "#1E293B", lineHeight: 1.7 }}>
          {paperText ?? JSON.stringify(rawResponse, null, 2)}
        </div>
      )}

      {assigning && saved && <AssignDialog paper={saved} onClose={() => setAssigning(false)} />}
    </div>
  );
}

/* ─── Saved papers ────────────────────────────────────────── */
function SavedPapers({ refreshKey, onPrint }) {
  const [papers, setPapers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId]   = useState(null);
  const [assignPaper, setAssignPaper] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [error, setError]     = useState("");

  const [tick, setTick] = useState(0);   // local refresh after delete
  const reload = () => setTick(t => t + 1);

  // `loading` starts true and is only ever cleared — a refresh after Save or
  // Delete replaces the list in place rather than flashing the skeleton.
  useEffect(() => {
    let alive = true;
    fetchQuestionPapers()
      .then(p => { if (alive) { setPapers(p); setError(""); } })
      .catch(err => { if (alive) setError(err.message || "Couldn't load saved papers."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [refreshKey, tick]);

  // List rows are summaries; Print and Assign need the full paper.
  const withFull = async (id, fn) => {
    setBusyId(id);
    try { fn(await fetchQuestionPaper(id)); }
    catch (err) { setError(err.message || "Couldn't open the paper."); }
    finally { setBusyId(null); }
  };

  const confirmDelete = async () => {
    const p = deleteTarget; if (!p) return;
    setBusyId(p.paper_id);
    try { await deleteQuestionPaper(p.paper_id); setDeleteTarget(null); reload(); }
    catch (err) { setError(err.message || "Couldn't delete the paper."); }
    finally { setBusyId(null); }
  };

  const small = "px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all disabled:opacity-50";

  return (
    <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid rgba(99,102,241,0.1)" }}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold" style={{ color: "#0F172A", fontFamily: "var(--font-space-grotesk)" }}>Saved papers</h2>
        <span className="text-xs" style={{ color: "#94A3B8" }}>{papers.length} saved</span>
      </div>
      {error && <p className="text-xs mb-3" style={{ color: "#DC2626" }}>{error}</p>}
      {loading ? (
        <div className="h-12 rounded-xl animate-pulse" style={{ background: "#F1F5F9" }} />
      ) : papers.length === 0 ? (
        <p className="text-sm py-4 text-center" style={{ color: "#94A3B8" }}>Nothing saved yet — generate a test and click Save.</p>
      ) : (
        <ul className="divide-y" style={{ borderColor: "#F1F5F9" }}>
          {papers.map(p => (
            <li key={p.paper_id} className="py-3 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: "#0F172A" }}>{p.title}</p>
                <p className="text-xs" style={{ color: "#94A3B8" }}>
                  {[p.subject, p.difficulty, p.question_type, p.total_marks ? `${p.total_marks} marks` : null, fmtDate(p.created_at)].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button disabled={busyId === p.paper_id} onClick={() => withFull(p.paper_id, onPrint)} className={small}
                  style={{ border: "1px solid #C7D2FE", color: "#6366F1", background: "white" }}>🖨 Print</button>
                <button disabled={busyId === p.paper_id} onClick={() => withFull(p.paper_id, setAssignPaper)} className={`${small} text-white ai-gradient`}>Assign</button>
                <button disabled={busyId === p.paper_id} onClick={() => setDeleteTarget(p)} className={small}
                  style={{ border: "1px solid #FECACA", color: "#DC2626", background: "white" }} aria-label={`Delete ${p.title}`}>✕</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {assignPaper && <AssignDialog paper={assignPaper} onClose={() => setAssignPaper(null)} />}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete this paper?"
        message={deleteTarget ? `"${deleteTarget.title}" will be removed from your saved papers.` : ""}
        confirmLabel="Delete" danger
        busy={!!deleteTarget && busyId === deleteTarget.paper_id}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────────── */
export default function AutoTestPage() {
  const [step,        setStep]        = useState(0);
  const [config,      setConfig]      = useState(null);
  const [questions,   setQuestions]   = useState([]);
  const [rawResponse, setRawResponse] = useState(null);
  const [error,       setError]       = useState("");
  const [printPaper,  setPrintPaper]  = useState(null);
  const [savedKey,    setSavedKey]    = useState(0);   // bumps to refresh the saved list

  const handleGenerate = async (cfg) => {
    setConfig(cfg);
    setError("");
    setStep(1);

    try {
      const token = getToken();
      const body = {
        chapterId:  cfg.chapterId,
        difficulty: cfg.difficulty,
        totalMarks: cfg.totalMarks,
        questionType: cfg.qtype || null,   // null / omitted = all question types
      };

      const res = await fetch(`${API}/api/v1/question-papers/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.detail || `Error ${res.status}`);
      }

      // Normalise response — Node.js might return questions in various shapes
      const qs =
        Array.isArray(data)                          ? data :
        Array.isArray(data?.questions)               ? data.questions :
        Array.isArray(data?.data)                    ? data.data :
        Array.isArray(data?.questionPaper)           ? data.questionPaper :
        Array.isArray(data?.question_paper)          ? data.question_paper :
        null;

      setRawResponse(qs ? null : (typeof data?.questionPaper === "string" ? data.questionPaper : data));
      setQuestions(qs ?? []);
      setStep(2);
    } catch (err) {
      setError(err.message || "Failed to generate test. Please try again.");
      setStep(0);
    }
  };

  const handleReset = () => {
    setStep(0);
    setConfig(null);
    setQuestions([]);
    setRawResponse(null);
    setError("");
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">

      {/* Page header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-8 h-8 rounded-lg ai-gradient flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold" style={{ color: "#F1F5F9", fontFamily: "var(--font-space-grotesk)" }}>
              Auto Test Generation
            </h1>
          </div>
          <p className="text-sm pl-10" style={{ color: "#94A3B8" }}>
            AI-powered question paper generation
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {["Configure", "Generating", "Preview"].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className="w-6 h-px" style={{ background: step > i - 1 ? "#6366F1" : "#E2E8F0" }} />}
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={step === i
                    ? { background: "linear-gradient(135deg,#6366F1,#8B5CF6)", color: "#fff" }
                    : step > i
                    ? { background: "#ECFDF5", color: "#059669" }
                    : { background: "#F1F5F9", color: "#94A3B8" }}>
                  {step > i ? "✓" : i + 1}
                </div>
                <span className="text-xs font-medium hidden sm:block"
                  style={{ color: step === i ? "#6366F1" : step > i ? "#059669" : "#94A3B8" }}>{s}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-2xl p-4 flex items-center gap-3"
          style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
          <svg className="w-4 h-4 shrink-0" style={{ color: "#EF4444" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm" style={{ color: "#991B1B" }}>{error}</p>
        </div>
      )}

      {step === 0 && <ConfigStep onGenerate={handleGenerate} />}
      {step === 1 && <GeneratingStep config={config} />}
      {step === 2 && (
        <PreviewStep
          config={config}
          questions={questions}
          rawResponse={rawResponse}
          onReset={handleReset}
          onPrint={setPrintPaper}
          onSaved={() => setSavedKey(k => k + 1)}
        />
      )}

      <SavedPapers refreshKey={savedKey} onPrint={setPrintPaper} />

      <PrintSheet paper={printPaper} onDone={() => setPrintPaper(null)} />
    </div>
  );
}
