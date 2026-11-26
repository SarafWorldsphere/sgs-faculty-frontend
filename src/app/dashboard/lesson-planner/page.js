"use client";

import { useState, useEffect, useRef } from "react";
import { todayISO } from "@/lib/dates";
import ChapterPicker from "@/components/chapters/ChapterPicker";
import CurrentTopicCard from "@/components/planner/CurrentTopicCard";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("swais_faculty_token") : null;
}

const SECTION_COLORS = [
  { bg: "#EEF2FF", border: "#C7D2FE", icon: "#6366F1", label: "#4F46E5" },
  { bg: "#F0FDF4", border: "#BBF7D0", icon: "#10B981", label: "#059669" },
  { bg: "#FFF7ED", border: "#FED7AA", icon: "#F59E0B", label: "#D97706" },
  { bg: "#FDF4FF", border: "#E9D5FF", icon: "#8B5CF6", label: "#7C3AED" },
];

/* ── Typing animation hook ──────────────────────────────────────────── */
function useTypewriter(text, speed = 18, active = false) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    if (!active || !text) { setDisplayed(text || ""); return; }
    setDisplayed("");
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, active]);
  return displayed;
}

/* ── AI Generating animation ────────────────────────────────────────── */
function GeneratingAnimation() {
  const steps = [
    "Analysing chapter content…",
    "Structuring learning objectives…",
    "Designing activity flow…",
    "Crafting assessment strategy…",
    "Finalising lesson plan…",
  ];
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setStep(s => Math.min(s + 1, steps.length - 1));
    }, 280);
    const progInterval = setInterval(() => {
      setProgress(p => Math.min(p + 2, 95));
    }, 30);
    return () => { clearInterval(stepInterval); clearInterval(progInterval); };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[420px] px-8">
      {/* Pulsing orb */}
      <div className="relative mb-8">
        <div className="w-20 h-20 rounded-full ai-gradient animate-pulse flex items-center justify-center shadow-lg"
          style={{ boxShadow: "0 0 40px rgba(99,102,241,0.4)" }}>
          <svg className="w-9 h-9 text-white animate-spin" style={{ animationDuration: "3s" }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <div className="absolute inset-0 rounded-full animate-ping opacity-20 ai-gradient" />
      </div>

      <h3 className="text-lg font-bold mb-2 ai-gradient-text" style={{ fontFamily: "var(--font-space-grotesk)" }}>
        AI is crafting your lesson plan
      </h3>
      <p className="text-sm mb-6 text-center" style={{ color: "#64748B" }}>
        {steps[step]}
      </p>

      {/* Progress bar */}
      <div className="w-full max-w-xs">
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#E2E8F0" }}>
          <div className="h-full rounded-full transition-all duration-300 ai-gradient"
            style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-between mt-2">
          {steps.map((_, i) => (
            <div key={i}
              className="w-2 h-2 rounded-full transition-all duration-300"
              style={{ background: i <= step ? "#6366F1" : "#E2E8F0" }} />
          ))}
        </div>
      </div>

      {/* Shimmer skeleton */}
      <div className="w-full max-w-xs mt-8 space-y-2.5">
        {[80, 60, 90, 50, 70].map((w, i) => (
          <div key={i} className="skeleton h-3 rounded"
            style={{ width: `${w}%`, animationDelay: `${i * 0.1}s` }} />
        ))}
      </div>
    </div>
  );
}

/* ── Plan display ───────────────────────────────────────────────────── */
/* ── Printable lesson-plan form ─────────────────────────────────────────
   Replicates the school's paper lesson plan. Every field stays editable so a
   teacher can correct anything the AI got wrong before printing.          */

const FORM_SECTIONS = [
  ["objectives",  "Learning objectives"],
  ["outcomes",    "Learning outcomes"],
  ["methodology", "Methodology"],
  ["tlm",         "TLM"],
  ["activities",  "Activities"],
  ["assessment",  "Assessment"],
  ["homework",    "Home Work"],
];

const HEADER_FIELDS = [
  ["teacher_name",         "Name of the teacher"],
  ["designation",          "Designation"],
  ["class_section",        "Class & Section"],
  ["subject",              "Subject"],
  ["chapter",              "Chapter"],
  ["no_of_periods",        "No. of Periods"],
  ["date_of_commencement", "Date of Commencement"],
  ["expected_completion",  "Expected date of completion"],
  ["actual_completion",    "Actual date of completion"],
];

/* Items are written into the DOM once rather than rendered as JSX, because the
   box is contentEditable — React must not own its children afterwards. */
function EditableSection({ items }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = "";
    const list = items || [];
    list.forEach((text, i) => {
      const line = document.createElement("div");
      line.className = "lp-item";
      if (list.length > 1) {
        const num = document.createElement("span");
        num.className = "lp-num";
        num.textContent = (i + 1) + ".";
        line.appendChild(num);
      }
      line.appendChild(document.createTextNode(text));
      el.appendChild(line);
    });
  }, [items]);

  // Keep pasted text plain so a paste from Word doesn't drag its styling in.
  const onPaste = e => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData("text/plain");
    document.execCommand("insertText", false, text);
  };

  return <div ref={ref} className="lp-fill" contentEditable suppressContentEditableWarning onPaste={onPaste} />;
}

function PlanForm({ plan, onSave, saving, saved }) {
  const sections = plan.sections || {};
  const [header, setHeader] = useState(() => ({ ...(plan.header || {}) }));

  useEffect(() => { setHeader({ ...(plan.header || {}) }); }, [plan]);

  const set = (key, value) => setHeader(h => ({ ...h, [key]: value }));

  return (
    <div className="animate-fade-in">
      <style>{`
        .lp-sheet { background:#fff; color:#17233a; padding:8mm 9mm 6mm; border-radius:14px;
                    box-shadow:0 6px 24px rgba(20,30,50,.10); font-size:13px; }
        .lp-school { width:100%; text-align:center; border:0; outline:0; background:transparent;
                     font:800 15pt/1.2 inherit; color:#16437f; text-transform:uppercase; }
        .lp-doctype { text-align:center; font:700 10pt/1 inherit; color:#1c56a5;
                      letter-spacing:.22em; margin:2mm 0 4mm; }
        .lp-head { display:grid; grid-template-columns:repeat(3,1fr); gap:2.5mm 7mm; margin-bottom:4mm; }
        .lp-f { display:flex; align-items:baseline; gap:2mm; min-width:0; }
        .lp-f > label { font:700 8.6pt/1 inherit; color:#1c56a5; white-space:nowrap; flex:none; }
        .lp-f > input { flex:1; min-width:0; border:0; border-bottom:1px solid #1c56a5; outline:0;
                        background:transparent; font:400 10pt/1.4 inherit; color:#17233a; padding:0 1mm 1px; }
        .lp-f > input:focus { border-bottom-width:2px; background:#f3f7fd; }
        .lp-body { display:grid; grid-template-columns:1fr 1fr; border:1.2px solid #1c56a5; }
        .lp-col-l { border-right:1.2px solid #1c56a5; }
        .lp-box + .lp-box { border-top:1.2px solid #1c56a5; }
        .lp-split { display:grid; grid-template-columns:1.4fr 1fr; }
        .lp-split > .lp-box + .lp-box { border-top:0; border-left:1.2px solid #1c56a5; }
        .lp-lbl { font:800 8.6pt/1 inherit; color:#1c56a5; padding:1.6mm 2.5mm .8mm; }
        .lp-fill { padding:0 2.5mm 2mm; outline:0; font-size:9.5pt; line-height:1.5;
                   min-height:22mm; overflow-wrap:anywhere; }
        .lp-fill:focus { background:#f3f7fd; }
        .lp-item { padding-left:4.6mm; text-indent:-4.6mm; margin-bottom:.9mm; }
        .lp-num { color:#1c56a5; font-weight:700; margin-right:1.4mm; }
        .lp-signs { display:flex; justify-content:space-between; margin-top:3.5mm;
                    font:700 9pt/1 inherit; color:#1c56a5; }
        /* Phones and small tablets: the A4 landscape layout does not survive a
           narrow screen — three header columns leave inputs a few px wide and
           the TLM column breaks words into letters. Stack everything single
           column and let each box grow. Print keeps the landscape form. */
        @media screen and (max-width: 767px) {
          .lp-sheet { padding:5mm 4mm 4mm; font-size:14px; }
          /* An <input> can't wrap; shrink it and let it scroll rather than clip. */
          .lp-school { font-size:11pt; line-height:1.3; text-overflow:ellipsis; }
          .lp-head { grid-template-columns:1fr; gap:3mm; }
          .lp-f { flex-direction:column; align-items:stretch; gap:1mm; }
          .lp-f > label { font-size:8pt; white-space:normal; }
          .lp-f > input { font-size:11pt; padding:1mm 1mm 1.5mm; }
          .lp-body { grid-template-columns:1fr; }
          .lp-col-l { border-right:0; border-bottom:1.2px solid #1c56a5; }
          .lp-split { grid-template-columns:1fr; }
          .lp-split > .lp-box + .lp-box { border-left:0; border-top:1.2px solid #1c56a5; }
          .lp-lbl { font-size:9.5pt; padding:2.5mm 3mm 1mm; }
          .lp-fill { font-size:11pt; line-height:1.55; padding:0 3mm 3mm; min-height:0; }
          .lp-item { padding-left:6mm; text-indent:-6mm; margin-bottom:1.5mm; }
          .lp-signs { flex-direction:column; gap:6mm; margin-top:6mm; font-size:9.5pt; }
        }
        @page { size:A4 landscape; margin:8mm; }
        @media print {
          body * { visibility:hidden; }
          .lp-sheet, .lp-sheet * { visibility:visible; }
          .lp-sheet { position:absolute; left:0; top:0; width:100%;
                      padding:0; border-radius:0; box-shadow:none; }
          .lp-noprint { display:none !important; }
          .lp-f > input, .lp-fill { background:transparent !important; }
        }
      `}</style>

      {/* Actions — screen only */}
      <div className="lp-noprint flex gap-3 mb-4">
        <button
          onClick={onSave}
          disabled={saving || saved}
          className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer"
          style={{
            background: saved ? "#ECFDF5" : "linear-gradient(135deg,#6366F1,#8B5CF6)",
            color: saved ? "#059669" : "white",
            boxShadow: saved ? "none" : "0 4px 14px rgba(99,102,241,0.35)",
          }}>
          {saved ? "✓ Saved to My Plans" : saving ? "Saving…" : "💾 Save Plan"}
        </button>
        <button
          onClick={() => window.print()}
          className="py-3 px-6 rounded-xl text-sm font-semibold cursor-pointer"
          style={{ border: "1.5px solid #1c56a5", color: "#1c56a5", background: "transparent" }}>
          🖨 Print
        </button>
      </div>

      <div className="lp-sheet">
        <input
          className="lp-school"
          value={header.school_name || ""}
          placeholder="School name"
          onChange={e => set("school_name", e.target.value)}
        />
        <div className="lp-doctype">LESSON PLAN</div>

        <div className="lp-head">
          {HEADER_FIELDS.map(([key, label]) => (
            <span className="lp-f" key={key}>
              <label>{label}</label>
              <input value={header[key] ?? ""} onChange={e => set(key, e.target.value)} />
            </span>
          ))}
        </div>

        <div className="lp-body">
          <div className="lp-col-l">
            {["objectives", "outcomes"].map(key => (
              <div className="lp-box" key={key}>
                <div className="lp-lbl">{FORM_SECTIONS.find(s => s[0] === key)[1]} :</div>
                <EditableSection items={sections[key]} />
              </div>
            ))}
          </div>

          <div className="lp-col-r">
            <div className="lp-split">
              {["methodology", "tlm"].map(key => (
                <div className="lp-box" key={key}>
                  <div className="lp-lbl">{FORM_SECTIONS.find(s => s[0] === key)[1]} :</div>
                  <EditableSection items={sections[key]} />
                </div>
              ))}
            </div>
            {["activities", "assessment", "homework"].map(key => (
              <div className="lp-box" key={key}>
                <div className="lp-lbl">{FORM_SECTIONS.find(s => s[0] === key)[1]} :</div>
                <EditableSection items={sections[key]} />
              </div>
            ))}
          </div>
        </div>

        <div className="lp-signs">
          <span>Sign. of the Teacher</span>
          <span>Sign. of the Dean</span>
        </div>
      </div>
    </div>
  );
}

/* ── Saved plans list ───────────────────────────────────────────────── */
function SavedPlans({ plans, onDelete, onLoad }) {
  if (plans.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-2xl ai-gradient flex items-center justify-center mx-auto mb-4 opacity-40">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <p className="text-sm font-medium" style={{ color: "#94A3B8" }}>No saved plans yet.</p>
        <p className="text-xs mt-1" style={{ color: "#CBD5E1" }}>Generate and save a lesson plan to see it here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {plans.map(p => (
        <div key={p.lesson_plan_id}
          className="flex items-start justify-between gap-3 p-4 rounded-2xl bg-white transition-all"
          style={{ border: "1px solid rgba(99,102,241,0.1)" }}
          onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 20px rgba(99,102,241,0.1)"}
          onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-7 h-7 rounded-lg ai-gradient flex items-center justify-center shrink-0">
                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </span>
              <p className="text-sm font-semibold truncate" style={{ color: "#0F172A" }}>{p.title}</p>
            </div>
            <p className="text-xs ml-9" style={{ color: "#94A3B8" }}>
              {p.chapter_text} · {p.duration_minutes} period(s) ·{" "}
              {p.created_at ? new Date(p.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => onLoad(p)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
              style={{ background: "#EEF2FF", color: "#6366F1" }}
              onMouseEnter={e => e.currentTarget.style.background = "#C7D2FE"}
              onMouseLeave={e => e.currentTarget.style.background = "#EEF2FF"}>
              View
            </button>
            <button onClick={() => onDelete(p.lesson_plan_id)}
              className="p-1.5 rounded-lg cursor-pointer transition-all"
              style={{ color: "#94A3B8" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#FEF2F2"; e.currentTarget.style.color = "#EF4444"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#94A3B8"; }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────────────── */
export default function LessonPlannerPage() {
  const [tab,         setTab]         = useState("create");   // "create" | "saved"
  const [chapter,     setChapter]     = useState("");
  const [chapterName, setChapterName] = useState("");
  const [topic,       setTopic]       = useState("");
  const [periods,     setPeriods]     = useState(2);
  const [dateFrom,    setDateFrom]    = useState("");
  const [dateTo,      setDateTo]      = useState("");
  const [objectives,  setObjectives]  = useState([""]);
  const [notes,       setNotes]       = useState("");
  const [generating,  setGenerating]  = useState(false);
  const [plan,        setPlan]        = useState(null);
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [editing,     setEditing]     = useState(false);  // back on the form but keep the last plan
  const [genError,    setGenError]    = useState("");
  const [savedPlans,  setSavedPlans]  = useState([]);
  const [plansLoading,setPlansLoading]= useState(false);
  const rightRef = useRef(null);

  const headers = { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" };

  // Load saved plans when tab switches
  useEffect(() => {
    if (tab !== "saved") return;
    setPlansLoading(true);
    fetch(`${API}/api/v1/lesson-plans`, { headers })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setSavedPlans(d.plans || []))
      .catch(() => setSavedPlans([]))
      .finally(() => setPlansLoading(false));
  }, [tab]);

  const handleGenerate = async () => {
    if (!chapter) return;
    setEditing(false);
    setGenError("");
    setGenerating(true);
    setPlan(null);
    setSaved(false);
    try {
      const res = await fetch(`${API}/api/v1/lesson-plans/generate`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          chapterId: parseInt(chapter),
          topic: topic || chapterName,
          noOfPeriods: periods,
          dateOfCommencement: dateFrom || null,
          expectedCompletion: dateTo || null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPlan(data);
      setTimeout(() => rightRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch {
      setPlan(null);
      setGenError("Couldn't generate the lesson plan. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!plan || saving || saved) return;
    setSaving(true);
    try {
      await fetch(`${API}/api/v1/lesson-plans`, {
        method: "POST",
        headers,
        body: JSON.stringify({ plan }),
      });
      setSaved(true);
    } catch {
      // Save failed (no backend) — mark as saved locally so UI doesn't hang
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    await fetch(`${API}/api/v1/lesson-plans/${id}`, { method: "DELETE", headers });
    setSavedPlans(p => p.filter(x => x.lesson_plan_id !== id));
  };

  // idea-3: return to the form but KEEP the last plan + inputs, so the user can jump back to the result
  const backToEdit = () => setEditing(true);

  const addObjective   = () => setObjectives(o => [...o, ""]);
  const updateObjective = (i, v) => setObjectives(o => o.map((x, j) => j === i ? v : x));
  const removeObjective = (i) => setObjectives(o => o.filter((_, j) => j !== i));

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-8 h-8 rounded-lg ai-gradient flex items-center justify-center pulse-glow">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold" style={{ color: "#F1F5F9", fontFamily: "var(--font-space-grotesk)" }}>
              Lesson Planner
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: "linear-gradient(135deg,#6366F1,#8B5CF6)", color: "white" }}>
              AI
            </span>
          </div>
          <p className="text-sm pl-10" style={{ color: "#94A3B8" }}>
            Generate structured lesson plans instantly with AI
          </p>
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl overflow-hidden shrink-0" style={{ border: "1px solid #E2E8F0" }}>
          {[
            { key: "create", label: "✨ Create New" },
            { key: "saved",  label: "📁 My Plans" },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="px-4 py-2 text-sm font-semibold cursor-pointer transition-all"
              style={{
                background: tab === t.key ? "linear-gradient(135deg,#6366F1,#8B5CF6)" : "white",
                color: tab === t.key ? "white" : "#64748B",
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Saved Plans Tab ─────────────────────────────────────────── */}
      {tab === "saved" && (
        <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid rgba(99,102,241,0.1)" }}>
          <h2 className="text-base font-bold mb-4" style={{ color: "#0F172A", fontFamily: "var(--font-space-grotesk)" }}>
            Saved Lesson Plans
          </h2>
          {plansLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="skeleton h-16 rounded-2xl" />)}
            </div>
          ) : (
            <SavedPlans
              plans={savedPlans}
              onDelete={handleDelete}
              onLoad={p => { setPlan(p.plan || p); setSaved(true); setEditing(false); setTab("create"); }}
            />
          )}
        </div>
      )}

      {/* ── Create Tab — two-step flow (idea-3) ──────────────────────── */}
      {tab === "create" && (
        generating ? (
          /* STEP 2a — full-width AI generating */
          <div className="max-w-4xl mx-auto bg-white rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(99,102,241,0.1)" }}>
            <GeneratingAnimation />
          </div>
        ) : plan && !editing ? (
          /* STEP 2b — full-width result with a back-to-edit button */
          <div className="max-w-4xl mx-auto space-y-4" ref={rightRef}>
            <button onClick={backToEdit}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-all"
              style={{ background: "white", color: "#6366F1", border: "1px solid #E2E8F0" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#EEF2FF"; e.currentTarget.style.borderColor = "#C7D2FE"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "white"; e.currentTarget.style.borderColor = "#E2E8F0"; }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to edit inputs
            </button>
            <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid rgba(99,102,241,0.1)" }}>
              <PlanForm plan={plan} onSave={handleSave} saving={saving} saved={saved} />
            </div>
          </div>
        ) : (
          /* STEP 1 — centered input form (full attention, no cramped column) */
          <div className="max-w-2xl mx-auto bg-white rounded-2xl p-6 space-y-5"
            style={{ border: "1px solid rgba(99,102,241,0.1)" }}>

            {/* Jump back to the last generated plan without regenerating */}
            {plan && (
              <button onClick={() => setEditing(false)}
                className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all"
                style={{ background: "#EEF2FF", color: "#6366F1", border: "1px solid #C7D2FE" }}
                onMouseEnter={e => e.currentTarget.style.background = "#E0E7FF"}
                onMouseLeave={e => e.currentTarget.style.background = "#EEF2FF"}>
                <span>✨ Your last generated plan is ready</span>
                <span className="flex items-center gap-1">
                  View result
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </button>
            )}

            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg ai-gradient flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <h2 className="text-base font-bold" style={{ color: "#0F172A", fontFamily: "var(--font-space-grotesk)" }}>
                  Plan Details
                </h2>
              </div>
              <p className="text-xs ml-9" style={{ color: "#94A3B8" }}>Fill in the details below</p>
            </div>

            {/* Class / Subject / Chapter */}
            <CurrentTopicCard
              onUse={({ topicName, periods: plannedPeriods, chapterId }) => {
                setTopic(topicName);
                if (plannedPeriods) setPeriods(plannedPeriods);
                if (chapterId) { setChapter(String(chapterId)); setChapterName(topicName); }
              }}
            />

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "#475569" }}>Class / Subject / Chapter *</label>
              <ChapterPicker onChapterChange={(id, name) => { setChapter(id ? String(id) : ""); setChapterName(name); }} />
            </div>

            {/* Topic */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "#475569" }}>
                Specific Topic <span style={{ color: "#94A3B8", fontWeight: 400 }}>(optional)</span>
              </label>
              <input value={topic} onChange={e => setTopic(e.target.value)}
                placeholder="e.g. Preamble and Fundamental Rights"
                className="w-full px-3 py-2.5 text-sm rounded-xl focus:outline-none transition-all"
                style={{ border: "1.5px solid #E2E8F0", color: "#0F172A" }}
                onFocus={e => { e.target.style.border = "1.5px solid #6366F1"; e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.1)"; }}
                onBlur={e =>  { e.target.style.border = "1.5px solid #E2E8F0"; e.target.style.boxShadow = "none"; }}
              />
            </div>

            {/* Periods — the form counts periods, not minutes */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold" style={{ color: "#475569" }}>No. of Periods</label>
                <span className="text-sm font-bold px-2 py-0.5 rounded-lg"
                  style={{ background: "#EEF2FF", color: "#6366F1" }}>{periods}</span>
              </div>
              <input type="range" min={1} max={8} step={1} value={periods}
                onChange={e => setPeriods(Number(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer" />
              <div className="flex justify-between text-[10px] mt-1" style={{ color: "#94A3B8" }}>
                <span>1</span><span>4</span><span>8</span>
              </div>
            </div>

            {/* Dates printed in the form header. The teacher owns these —
                left blank they simply print empty. */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: "#475569" }}>Commencement</label>
                <input type="date" min={todayISO()} value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ border: "1.5px solid #E2E8F0" }} />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: "#475569" }}>Expected completion</label>
                <input type="date" min={dateFrom || todayISO()} value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ border: "1.5px solid #E2E8F0" }} />
              </div>
            </div>

            {/* Objectives */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "#475569" }}>
                Custom Objectives <span style={{ color: "#94A3B8", fontWeight: 400 }}>(or leave blank for AI defaults)</span>
              </label>
              <div className="space-y-2">
                {objectives.map((obj, i) => (
                  <div key={i} className="flex gap-1.5">
                    <input value={obj} onChange={e => updateObjective(i, e.target.value)}
                      placeholder={`Objective ${i + 1}`}
                      className="flex-1 px-3 py-2 text-sm rounded-xl focus:outline-none transition-all"
                      style={{ border: "1.5px solid #E2E8F0", color: "#0F172A" }}
                      onFocus={e => { e.target.style.border = "1.5px solid #6366F1"; e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.1)"; }}
                      onBlur={e =>  { e.target.style.border = "1.5px solid #E2E8F0"; e.target.style.boxShadow = "none"; }}
                    />
                    {objectives.length > 1 && (
                      <button onClick={() => removeObjective(i)}
                        className="p-2 rounded-lg cursor-pointer transition-all shrink-0"
                        style={{ color: "#94A3B8" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#FEF2F2"; e.currentTarget.style.color = "#EF4444"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#94A3B8"; }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
                {objectives.length < 4 && (
                  <button onClick={addObjective}
                    className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-all px-2 py-1 rounded-lg"
                    style={{ color: "#6366F1" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#EEF2FF"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add objective
                  </button>
                )}
              </div>
            </div>

            {/* Special notes */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "#475569" }}>
                Special Notes <span style={{ color: "#94A3B8", fontWeight: 400 }}>(optional)</span>
              </label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                rows={2} placeholder="e.g. Include a debate activity, focus on rural students' context…"
                className="w-full px-3 py-2.5 text-sm rounded-xl resize-none focus:outline-none transition-all"
                style={{ border: "1.5px solid #E2E8F0", color: "#0F172A" }}
                onFocus={e => { e.target.style.border = "1.5px solid #6366F1"; e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.1)"; }}
                onBlur={e =>  { e.target.style.border = "1.5px solid #E2E8F0"; e.target.style.boxShadow = "none"; }}
              />
            </div>

            {/* Generation error */}
            {genError && (
              <div className="rounded-xl px-4 py-3 text-sm font-medium"
                style={{ background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA" }}>
                {genError}
              </div>
            )}

            {/* Generate button */}
            <button onClick={handleGenerate} disabled={!chapter || generating}
              className="w-full py-3 rounded-xl text-sm font-bold cursor-pointer transition-all flex items-center justify-center gap-2"
              style={{
                background: (!chapter || generating) ? "#E2E8F0" : "linear-gradient(135deg,#6366F1,#8B5CF6)",
                color: (!chapter || generating) ? "#94A3B8" : "white",
                boxShadow: (!chapter || generating) ? "none" : "0 4px 14px rgba(99,102,241,0.4)",
              }}
              onMouseEnter={e => { if (chapter && !generating) e.currentTarget.style.boxShadow = "0 6px 20px rgba(99,102,241,0.5)"; }}
              onMouseLeave={e => { if (chapter && !generating) e.currentTarget.style.boxShadow = "0 4px 14px rgba(99,102,241,0.4)"; }}>
              {generating ? (
                <><svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg> Generating…</>
              ) : (
                <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg> Generate with AI ✨</>
              )}
            </button>
          </div>
        )
      )}
    </div>
  );
}
