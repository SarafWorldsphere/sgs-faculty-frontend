"use client";

import { useState, useEffect, useRef } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("swais_faculty_token") : null;
}

const GRADE_STYLE = {
  "A+": { color: "#10B981", bg: "#ECFDF5" },
  "A":  { color: "#10B981", bg: "#ECFDF5" },
  "B":  { color: "#6366F1", bg: "#EEF2FF" },
  "C":  { color: "#F59E0B", bg: "#FFFBEB" },
  "D":  { color: "#EF4444", bg: "#FEF2F2" },
};

function getGrade(pct) {
  if (pct >= 90) return "A+";
  if (pct >= 75) return "A";
  if (pct >= 60) return "B";
  if (pct >= 45) return "C";
  return "D";
}

export default function AutoCorrectPage() {
  const [step,          setStep]          = useState(1); // 1=setup, 2=answers, 3=results
  const [selectedTopic, setSelectedTopic] = useState("");
  const [answers,       setAnswers]       = useState({});
  const [studentMode,   setStudentMode]   = useState("class");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [isProcessing,  setIsProcessing]  = useState(false);
  const [results,       setResults]       = useState(null);
  const [students,      setStudents]      = useState([]);
  const [topics,        setTopics]        = useState([]);
  const [questions,     setQuestions]     = useState([]);   // extracted from an uploaded PDF
  const [uploading,     setUploading]     = useState(false);
  const [uploadError,   setUploadError]   = useState("");
  const [saving,        setSaving]        = useState(false);
  const [saveError,     setSaveError]     = useState("");
  const [savedFor,      setSavedFor]      = useState([]);   // student ids kept this sitting

  /* Marking happens one paper at a time, but a class belongs on one test row.
     The first save creates the assessment and hands back its id; every paper
     after it is added to the same one. */
  const assessmentId = useRef(null);

  const handleUploadPdf = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    const token = getToken();
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API}/api/v1/questions/extract`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`);
      if (!data.questions?.length) {
        setQuestions([]);
        setUploadError("No questions found in that PDF. Try a text-based (not scanned) paper.");
      } else {
        setQuestions(data.questions);
      }
    } catch (err) {
      setQuestions([]);
      setUploadError(err.message || "Couldn't read the PDF. Please try again.");
    } finally {
      setUploading(false);
      e.target.value = "";   // allow re-uploading the same file
    }
  };

  // Load real students + chapters from the API (no mock data)
  useEffect(() => {
    const token = getToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`${API}/api/v1/students`, { headers })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setStudents(d.students || []))
      .catch(() => setStudents([]));
    fetch(`${API}/api/v1/chapters`, { headers })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setTopics(d.chapters || []))
      .catch(() => setTopics([]));
  }, []);

  const totalMarks = questions.reduce((s, q) => s + q.maxMarks, 0);

  /**
   * Keep the result.
   *
   * The screen used to mark a paper, show the score and forget it, so nothing
   * built on sgs_assessments ever saw a corrected paper. This writes it through
   * the same path as marks entry, which is what makes it show up in the
   * headmaster's reports alongside marks typed in by hand.
   *
   * Only possible with a student chosen: a mark has to belong to somebody.
   */
  const handleSave = async () => {
    if (!selectedStudent || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      const token = getToken();
      const res = await fetch(`${API}/api/v1/corrections/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: `Auto Correct — ${selectedTopic || "paper"}`,
          assessment_date: new Date().toISOString().slice(0, 10),
          student_id: Number(selectedStudent),
          marks_obtained: results.total,
          max_marks: results.max,
          assessment_id: assessmentId.current,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || `Error ${res.status}`);
      assessmentId.current = data.assessment_id;
      setSavedFor(prev => [...prev, String(selectedStudent)]);
    } catch (err) {
      setSaveError(err.message || "Could not save this result.");
    } finally {
      setSaving(false);
    }
  };

  const handleAnswerChange = (qId, val) => {
    setAnswers(prev => ({ ...prev, [qId]: val }));
  };

  const handleCorrect = async () => {
    setIsProcessing(true);
    try {
      const token = getToken();
      const corrected = await Promise.all(
        questions.map(async (q) => {
          try {
            const res = await fetch(`${API}/api/v1/corrections/check`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                question: q.question,
                studentAnswer: answers[q.id] || "(no answer)",
                maxMarks: q.maxMarks,
                rubric: `${selectedTopic} — ${q.type} question`,
              }),
            });
            const data = await res.json();
            const awarded = data.marksAwarded ?? data.marks_awarded ?? data.score ?? 0;
            const feedback = data.feedback ?? data.comment ?? data.remarks ?? "No feedback returned.";
            return {
              question_id: q.id,
              question: q.question,
              answer: answers[q.id] || "(no answer)",
              marks_awarded: typeof awarded === "number" ? awarded : 0,
              max_marks: q.maxMarks,
              feedback,
              is_correct: awarded === q.maxMarks,
            };
          } catch {
            return {
              question_id: q.id,
              question: q.question,
              answer: answers[q.id] || "(no answer)",
              marks_awarded: 0,
              max_marks: q.maxMarks,
              feedback: "Could not evaluate. Please try again.",
              is_correct: false,
            };
          }
        })
      );
      const total = corrected.reduce((s, r) => s + r.marks_awarded, 0);
      setResults({ items: corrected, total, max: totalMarks, percentage: totalMarks ? Math.round((total / totalMarks) * 100) : 0 });
      setStep(3);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setSaveError("");
    setAnswers({});
    setResults(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
          style={{ background: "linear-gradient(135deg,#10B981,#06B6D4)" }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#F1F5F9", fontFamily: "var(--font-space-grotesk)" }}>
            Automatic Correction
          </h1>
          <p className="text-sm" style={{ color: "#94A3B8" }}>AI-powered answer evaluation and grading</p>
        </div>
        <span className="ml-auto text-xs font-semibold px-3 py-1 rounded-full"
          style={{ background: "#ECFDF5", color: "#10B981", border: "1px solid #A7F3D0" }}>
          AI Connected
        </span>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {["Setup", "Enter Answers", "Results"].map((s, i) => {
          const n = i + 1;
          const isDone    = step > n;
          const isActive  = step === n;
          return (
            <div key={s} className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    background: isDone ? "#10B981" : isActive ? "#6366F1" : "#E2E8F0",
                    color: isDone || isActive ? "white" : "#94A3B8",
                  }}>
                  {isDone ? "✓" : n}
                </div>
                <span className="text-xs font-semibold" style={{ color: isActive ? "#6366F1" : "#94A3B8" }}>{s}</span>
              </div>
              {i < 2 && <div className="flex-1 h-px w-8" style={{ background: step > n ? "#10B981" : "#E2E8F0" }} />}
            </div>
          );
        })}
      </div>

      {/* Step 1: Setup */}
      {step === 1 && (
        <div className="bg-white rounded-2xl p-6 space-y-5" style={{ border: "1px solid rgba(99,102,241,0.1)" }}>
          <h2 className="text-base font-bold" style={{ color: "#0F172A" }}>Setup Correction</h2>

          <div>
            <label className="text-xs font-semibold block mb-2" style={{ color: "#64748B" }}>Topic / Chapter</label>
            <select value={selectedTopic} onChange={e => setSelectedTopic(e.target.value)}
              className="w-full text-sm rounded-xl px-3 py-2.5 outline-none"
              style={{ border: "1px solid #E2E8F0", color: "#0F172A", background: "#F8FAFC" }}>
              <option value="">-- Select topic --</option>
              {topics.map(t => (
                <option key={t.chapter_id} value={t.content_title}>{t.content_title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold block mb-2" style={{ color: "#64748B" }}>Correct for</label>
            <div className="flex gap-3">
              {[
                { value: "class",   label: "Entire Class",   icon: "👥" },
                { value: "student", label: "Single Student", icon: "👤" },
              ].map(opt => (
                <button key={opt.value} onClick={() => setStudentMode(opt.value)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer"
                  style={{
                    background: studentMode === opt.value ? "#EEF2FF" : "#F8FAFC",
                    border: `1px solid ${studentMode === opt.value ? "#6366F1" : "#E2E8F0"}`,
                    color: studentMode === opt.value ? "#6366F1" : "#64748B",
                  }}>
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>
          </div>

          {studentMode === "student" && (
            <div>
              <label className="text-xs font-semibold block mb-2" style={{ color: "#64748B" }}>Select Student</label>
              <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}
                className="w-full text-sm rounded-xl px-3 py-2.5 outline-none"
                style={{ border: "1px solid #E2E8F0", color: "#0F172A", background: "#F8FAFC" }}>
                <option value="">-- Select student --</option>
                {students.map(s => (
                  <option key={s.student_id} value={s.student_id}>{s.roll_no}. {s.full_name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Upload question paper (PDF) */}
          <div>
            <label className="text-xs font-semibold block mb-2" style={{ color: "#64748B" }}>Question Paper (PDF)</label>
            <label className="flex items-center justify-center gap-2 w-full py-4 rounded-xl cursor-pointer transition-all text-sm font-semibold"
              style={{ border: "1.5px dashed #C7D2FE", color: "#6366F1", background: "#F8FAFC" }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.9A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              {uploading ? "Reading PDF…" : questions.length > 0 ? "Replace question paper (PDF)" : "Upload question paper (PDF)"}
              <input type="file" accept="application/pdf" className="hidden" onChange={handleUploadPdf} disabled={uploading} />
            </label>
            {uploadError && <p className="text-xs mt-2" style={{ color: "#EF4444" }}>{uploadError}</p>}
          </div>

          {/* Extracted questions — review & remove any mis-read ones */}
          {questions.length > 0 && (
            <div className="p-4 rounded-xl" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
              <p className="text-xs font-semibold mb-2.5" style={{ color: "#64748B" }}>
                {questions.length} question{questions.length > 1 ? "s" : ""} extracted · {totalMarks} marks
                <span className="font-normal" style={{ color: "#94A3B8" }}> — review & remove any that look wrong</span>
              </p>
              <ul className="space-y-1.5 max-h-44 overflow-y-auto">
                {questions.map((q, i) => (
                  <li key={q.id} className="flex items-start justify-between gap-2 text-xs" style={{ color: "#475569" }}>
                    <span className="min-w-0">
                      <span className="font-semibold">{i + 1}.</span> {q.question}{" "}
                      <span style={{ color: "#94A3B8" }}>({q.maxMarks})</span>
                    </span>
                    <button onClick={() => setQuestions(qs => qs.filter(x => x.id !== q.id))}
                      className="shrink-0 cursor-pointer" style={{ color: "#94A3B8" }} title="Remove question">✕</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button onClick={() => setStep(2)} disabled={questions.length === 0}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(135deg,#6366F1,#8B5CF6)" }}>
            Start Entering Answers →
          </button>
        </div>
      )}

      {/* Step 2: Enter Answers */}
      {step === 2 && (
        <div className="space-y-4">
          {questions.map((q, idx) => (
            <div key={q.id} className="bg-white rounded-2xl p-5"
              style={{ border: "1px solid rgba(99,102,241,0.1)" }}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-start gap-2.5">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5"
                    style={{ background: "linear-gradient(135deg,#6366F1,#8B5CF6)" }}>
                    {idx + 1}
                  </span>
                  <p className="text-sm font-semibold" style={{ color: "#0F172A" }}>{q.question}</p>
                </div>
                <span className="text-xs font-bold shrink-0 px-2 py-0.5 rounded-full"
                  style={{ background: "#EEF2FF", color: "#6366F1" }}>
                  {q.maxMarks} {q.maxMarks === 1 ? "mark" : "marks"}
                </span>
              </div>

              {q.type === "mcq" ? (
                <div className="grid grid-cols-2 gap-2 pl-8">
                  {q.options.map(opt => (
                    <button key={opt} onClick={() => handleAnswerChange(q.id, opt)}
                      className="py-2 px-3 rounded-xl text-sm transition-all cursor-pointer text-left"
                      style={{
                        background: answers[q.id] === opt ? "#EEF2FF" : "#F8FAFC",
                        border: `1px solid ${answers[q.id] === opt ? "#6366F1" : "#E2E8F0"}`,
                        color: answers[q.id] === opt ? "#6366F1" : "#475569",
                        fontWeight: answers[q.id] === opt ? "600" : "400",
                      }}>
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <textarea
                  value={answers[q.id] || ""}
                  onChange={e => handleAnswerChange(q.id, e.target.value)}
                  placeholder="Type the student's answer here…"
                  className="w-full ml-8 p-3 text-sm rounded-xl resize-none outline-none"
                  style={{
                    border: "1px solid #E2E8F0",
                    color: "#0F172A",
                    minHeight: q.type === "long" ? "100px" : "60px",
                    width: "calc(100% - 2rem)",
                  }}
                />
              )}
            </div>
          ))}

          <div className="flex gap-3">
            <button onClick={() => setStep(1)}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all"
              style={{ background: "#F1F5F9", color: "#64748B", border: "1px solid #E2E8F0" }}>
              ← Back
            </button>
            <button onClick={handleCorrect} disabled={isProcessing}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer transition-all disabled:opacity-60"
              style={{ background: "linear-gradient(135deg,#10B981,#06B6D4)" }}>
              {isProcessing ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  AI Evaluating…
                </span>
              ) : "Submit for AI Correction →"}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Results */}
      {step === 3 && results && (
        <div className="space-y-4">
          {/* Score summary */}
          <div className="bg-white rounded-2xl p-6 text-center"
            style={{ border: "1px solid rgba(99,102,241,0.1)" }}>
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold"
              style={{ background: `linear-gradient(135deg,${GRADE_STYLE[getGrade(results.percentage)]?.color || "#6366F1"},#8B5CF6)` }}>
              {getGrade(results.percentage)}
            </div>
            <p className="text-3xl font-bold mb-1" style={{ color: "#0F172A", fontFamily: "var(--font-space-grotesk)" }}>
              {results.total} / {results.max}
            </p>
            <p className="text-sm" style={{ color: "#94A3B8" }}>{results.percentage}% · {selectedTopic}</p>
            <div className="mt-4 h-2 rounded-full overflow-hidden" style={{ background: "#EEF2FF" }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${results.percentage}%`, background: "linear-gradient(90deg,#6366F1,#10B981)" }} />
            </div>
          </div>

          {/* Keeping the result. Only a named student can have a mark, so the
              class-wide mode explains itself rather than offering a dead button. */}
          <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid rgba(99,102,241,0.1)" }}>
            {!selectedStudent ? (
              <p className="text-sm" style={{ color: "#64748B" }}>
                Pick a student on the first step to save this result against them.
                Without one it can be read here but not recorded.
              </p>
            ) : savedFor.includes(String(selectedStudent)) ? (
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs"
                  style={{ background: "#10B981" }}>✓</span>
                <p className="text-sm font-semibold" style={{ color: "#059669" }}>
                  Saved. It will show in the marks reports for this class.
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div style={{ minWidth: 0 }}>
                  <p className="text-sm font-semibold" style={{ color: "#0F172A" }}>
                    Save {results.total} / {results.max} for this student
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
                    {assessmentId.current
                      ? "Added to the test you started this sitting."
                      : "Creates the test; the next student joins the same one."}
                  </p>
                </div>
                <button onClick={handleSave} disabled={saving}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold text-white cursor-pointer ai-gradient disabled:opacity-60"
                  style={{ boxShadow: "0 4px 12px rgba(99,102,241,0.3)" }}>
                  {saving ? "Saving…" : "Save result"}
                </button>
              </div>
            )}
            {saveError && (
              <p className="text-xs mt-3" style={{ color: "#DC2626" }}>{saveError}</p>
            )}
          </div>

          {/* Per-question breakdown */}
          {results.items.map((r, idx) => (
            <div key={r.question_id} className="bg-white rounded-2xl p-5"
              style={{ border: `1px solid ${r.is_correct ? "rgba(16,185,129,0.2)" : "rgba(99,102,241,0.1)"}` }}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-start gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs text-white shrink-0 mt-0.5 ${r.is_correct ? "" : ""}`}
                    style={{ background: r.is_correct ? "#10B981" : "#F59E0B" }}>
                    {r.is_correct ? "✓" : "~"}
                  </span>
                  <p className="text-sm font-semibold" style={{ color: "#0F172A" }}>Q{idx + 1}. {r.question}</p>
                </div>
                <span className="text-xs font-bold shrink-0 px-2 py-0.5 rounded-full"
                  style={{ background: r.is_correct ? "#ECFDF5" : "#EEF2FF", color: r.is_correct ? "#10B981" : "#6366F1" }}>
                  {r.marks_awarded}/{r.max_marks}
                </span>
              </div>
              <div className="ml-7 space-y-1.5">
                <p className="text-xs" style={{ color: "#64748B" }}>
                  <span className="font-semibold">Answer:</span> {r.answer}
                </p>
                <p className="text-xs p-2.5 rounded-lg" style={{ background: "#F8FAFC", color: "#64748B", border: "1px solid #E2E8F0" }}>
                  <span className="font-semibold" style={{ color: "#6366F1" }}>AI Feedback:</span> {r.feedback}
                </p>
              </div>
            </div>
          ))}

          <button onClick={handleReset}
            className="w-full py-3 rounded-xl text-sm font-semibold cursor-pointer transition-all"
            style={{ background: "#EEF2FF", color: "#6366F1", border: "1px solid #C7D2FE" }}>
            ← Start New Correction
          </button>
        </div>
      )}

    </div>
  );
}
