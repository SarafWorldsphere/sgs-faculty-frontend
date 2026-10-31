"use client";

import { useState, useEffect } from "react";
import { withClass } from "@/lib/activeClass";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

/* ── helpers ─────────────────────────────────────── */
function getGrade(pct) {
  if (pct == null) return "—";
  if (pct >= 90) return "A+";
  if (pct >= 75) return "A";
  if (pct >= 60) return "B";
  if (pct >= 45) return "C";
  return "D";
}

const GRADE_COLOR = {
  "A+": { color: "#10B981", bg: "#ECFDF5" },
  "A":  { color: "#10B981", bg: "#ECFDF5" },
  "B":  { color: "#6366F1", bg: "#EEF2FF" },
  "C":  { color: "#F59E0B", bg: "#FFFBEB" },
  "D":  { color: "#EF4444", bg: "#FEF2F2" },
  "—":  { color: "#94A3B8", bg: "#F8FAFC" },
};

function gradeColor(pct) {
  if (pct == null) return "#94A3B8";
  if (pct >= 90) return "#10B981";
  if (pct >= 75) return "#06B6D4";
  if (pct >= 60) return "#6366F1";
  if (pct >= 45) return "#F59E0B";
  return "#EF4444";
}

/* ── PercentBar ──────────────────────────────────── */
function PercentBar({ value }) {
  const pct = value ?? 0;
  const gradient =
    pct >= 75 ? "linear-gradient(90deg,#10B981,#06B6D4)" :
    pct >= 50 ? "linear-gradient(90deg,#6366F1,#8B5CF6)" :
    pct >= 35 ? "linear-gradient(90deg,#F59E0B,#EF4444)" :
               "linear-gradient(90deg,#EF4444,#EC4899)";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#EEF2FF" }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: gradient }} />
      </div>
      <span className="text-xs font-semibold w-10 text-right" style={{ color: "#475569" }}>
        {value != null ? `${value}%` : "—"}
      </span>
    </div>
  );
}

/* ── Donut chart (pure CSS/SVG) ──────────────────── */
// `empty` is "no assessments recorded", which is not the same as scoring zero.
// Showing a bold 0% for it is what made an absent-data screen look like a
// calculation that had run and returned nothing.
function DonutChart({ pct, color, size = 120, empty = false }) {
  const r   = 46;
  const circ = 2 * Math.PI * r;
  const fill = empty ? 0 : ((pct ?? 0) / 100) * circ;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#EEF2FF" strokeWidth="10" />
      <circle cx="50" cy="50" r={r} fill="none"
        stroke={color} strokeWidth="10"
        strokeDasharray={`${fill} ${circ - fill}`}
        strokeLinecap="round"
        strokeDashoffset={circ / 4}
        style={{ transition: "stroke-dasharray 0.8s ease" }} />
      <text x="50" y="46" textAnchor="middle" fontSize="16" fontWeight="700"
        fill={empty ? "#94A3B8" : "#0F172A"}>{empty ? "—" : `${pct ?? 0}%`}</text>
      <text x="50" y="60" textAnchor="middle" fontSize="8" fill="#94A3B8">
        {empty ? "no data" : "avg score"}
      </text>
    </svg>
  );
}

/* ── AI Insights panel ───────────────────────────── */
function AIInsightsPanel({ text, onClose }) {
  return (
    <div className="rounded-2xl p-5 space-y-3 mt-4"
      style={{ background: "linear-gradient(135deg,#EEF2FF,#F5F3FF)", border: "1px solid rgba(99,102,241,0.2)" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg ai-gradient flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <span className="text-sm font-bold" style={{ color: "#4338CA" }}>AI Insights</span>
        </div>
        <button onClick={onClose} className="text-xs px-2.5 py-1 rounded-lg cursor-pointer"
          style={{ color: "#6366F1", background: "white" }}>Close</button>
      </div>
      <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#1E293B" }}>{text}</p>
    </div>
  );
}

/* ── StudentSpotlight ────────────────────────────── */
function StudentSpotlight({ student, totalAssessments, subject, onBack }) {
  const [aiText,      setAiText]      = useState(null);
  const [aiLoading,   setAiLoading]   = useState(false);

  const handleStudentAnalytics = async () => {
    const token = localStorage.getItem("swais_faculty_token");
    setAiLoading(true);
    setAiText(null);
    try {
      const res = await fetch(`${API}/api/v1/analytics/student`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ studentName: student.name, subject }),
      });
      const data = await res.json();
      setAiText(data?.analysis || data?.message || JSON.stringify(data));
    } catch {
      setAiText("Failed to get AI analysis. Please try again.");
    } finally {
      setAiLoading(false);
    }
  };

  // With no assessments there is nothing to rank or average. Showing "0%" and
  // "Rank #1" here reads as a measured result rather than missing data, which
  // is what made this look like a broken calculation.
  const scored = student.total_assessed > 0;

  const pct   = student.average_percent ?? 0;
  const grade = getGrade(pct);
  const gc    = GRADE_COLOR[grade] || GRADE_COLOR["—"];
  const color = gradeColor(pct);
  const initials = student.name.split(" ").map(w => w[0]).slice(0, 2).join("");

  const stats = [
    { label: "Class Rank",    value: scored ? `#${student.rank}` : "—",             sub: scored ? "of class" : "not ranked" },
    { label: "Average Score", value: scored ? `${pct}%` : "—",                      sub: "overall" },
    { label: "Highest Marks", value: scored ? (student.highest_marks ?? "—") : "—", sub: "best score" },
    { label: "Assessments",   value: `${student.total_assessed}/${totalAssessments}`, sub: "attempted" },
  ];

  return (
    <div className="bg-white rounded-2xl p-6 space-y-5"
      style={{ border: "1px solid rgba(99,102,241,0.12)", boxShadow: "0 4px 20px rgba(99,102,241,0.08)" }}>

      {/* Back + title */}
      <div className="flex items-center justify-between">
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-all"
          style={{ color: "#6366F1", background: "#EEF2FF" }}
          onMouseEnter={e => e.currentTarget.style.background = "#C7D2FE"}
          onMouseLeave={e => e.currentTarget.style.background = "#EEF2FF"}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Class Overview
        </button>
        <div className="flex items-center gap-2">
          <button onClick={handleStudentAnalytics} disabled={aiLoading}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-all"
            style={{ color: "white", background: aiLoading ? "#A5B4FC" : "linear-gradient(135deg,#6366F1,#8B5CF6)" }}>
            {aiLoading ? "Analysing…" : "AI Analysis"}
          </button>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg"
            style={{ background: "#F8FAFC", color: "#94A3B8" }}>Student Spotlight</span>
        </div>
      </div>
      {aiText && <AIInsightsPanel text={aiText} onClose={() => setAiText(null)} />}

      {/* Profile + donut */}
      <div className="flex items-center gap-5">
        <DonutChart pct={pct} color={color} size={110} empty={!scored} />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
              style={{ background: "linear-gradient(135deg,#6366F1,#8B5CF6)" }}>{initials}</div>
            <div>
              <p className="font-bold text-sm leading-tight" style={{ color: "#0F172A" }}>{student.name}</p>
              <p className="font-mono text-xs" style={{ color: "#94A3B8" }}>{student.roll_number}</p>
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            {scored ? (
              <>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold"
                  style={{ background: gc.bg, color: gc.color }}>Grade {grade}</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold"
                  style={{ background: "#EEF2FF", color: "#6366F1" }}>Rank #{student.rank}</span>
              </>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold"
                style={{ background: "#F1F5F9", color: "#94A3B8" }}>Not assessed yet</span>
            )}
          </div>
          {scored && (
            <div className="mt-3">
              <PercentBar value={pct} />
            </div>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className="rounded-xl p-3 text-center"
            style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
            <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: "#94A3B8" }}>{s.label}</p>
            <p className="text-lg font-bold" style={{ color: "#0F172A" }}>{s.value}</p>
            <p className="text-[10px]" style={{ color: "#CBD5E1" }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Grade band strip */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#94A3B8" }}>Grade Bands</p>
        <div className="flex rounded-lg overflow-hidden text-center text-[10px] font-bold">
          {[
            { label: "A+ ≥90%", color: "#10B981", active: scored && pct >= 90 },
            { label: "A ≥75%",  color: "#06B6D4", active: scored && pct >= 75 && pct < 90 },
            { label: "B ≥60%",  color: "#6366F1", active: scored && pct >= 60 && pct < 75 },
            { label: "C ≥45%",  color: "#F59E0B", active: scored && pct >= 45 && pct < 60 },
            { label: "D <45%",  color: "#EF4444", active: scored && pct < 45 },
          ].map(b => (
            <div key={b.label} className="flex-1 py-1.5"
              style={{
                background: b.active ? b.color : `${b.color}22`,
                color: b.active ? "white" : b.color,
                transition: "all 0.3s",
              }}>
              {b.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Podium config ───────────────────────────────── */
const PODIUM_CONFIG = [
  { medal: "🥇", ring: "2px solid #F59E0B", bg: "linear-gradient(135deg,#FFFBEB,#FEF3C7)", textColor: "#D97706", size: "w-12 h-12", text: "text-xl" },
  { medal: "🥈", ring: "2px solid #9CA3AF", bg: "linear-gradient(135deg,#F9FAFB,#F3F4F6)", textColor: "#6B7280", size: "w-10 h-10", text: "text-base" },
  { medal: "🥉", ring: "2px solid #F97316", bg: "linear-gradient(135deg,#FFF7ED,#FFEDD5)", textColor: "#EA580C", size: "w-9 h-9",  text: "text-sm"  },
];

/* ── Main page ───────────────────────────────────── */
export default function ReportsPage() {
  const [report,          setReport]          = useState(null);
  const [isLoading,       setIsLoading]       = useState(true);
  const [search,          setSearch]          = useState("");
  const [sortBy,          setSortBy]          = useState("rank");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [classAiText,     setClassAiText]     = useState(null);
  const [classAiLoading,  setClassAiLoading]  = useState(false);

  // The AI service treats "all" as "no subject filter" and anything else as
  // a name to match. An empty string would be matched literally, so send the
  // sentinel when the teacher has no subject on record.
  const subject = report?.subject || "all";

  const handleClassAnalytics = async () => {
    const token = localStorage.getItem("swais_faculty_token");
    setClassAiLoading(true);
    setClassAiText(null);
    try {
      const res = await fetch(`${API}/api/v1/analytics/class`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subject }),
      });
      const data = await res.json();
      setClassAiText(data?.analysis || data?.message || JSON.stringify(data));
    } catch {
      setClassAiText("Failed to get AI analysis. Please try again.");
    } finally {
      setClassAiLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("swais_faculty_token");
    if (!token) {
      setReport(null);
      setIsLoading(false);
      return;
    }
    fetch(withClass(`${API}/api/v1/reports`), { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.detail || `Error ${r.status}`);
        }
        return r.json();
      })
      .then(d => setReport(d))
      .catch(() => {
        // API unavailable — show empty state, no mock data
        setReport(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const students = report?.students || [];
  const totalAssessments = report?.total_assessments || 0;

  const filtered = students
    .filter(s =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.roll_number.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === "rank") return a.rank - b.rank;
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return (b.average_percent ?? 0) - (a.average_percent ?? 0);
    });

  const top3 = [...students].sort((a, b) => a.rank - b.rank).slice(0, 3);

  const handleSelect = (s) => {
    setSelectedStudent(prev => prev?.student_id === s.student_id ? null : s);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <div className="w-8 h-8 rounded-lg ai-gradient flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "#F1F5F9", fontFamily: "var(--font-space-grotesk)" }}>Reports</h1>
        </div>
        <div className="flex items-center justify-between pl-10">
          <p className="text-sm" style={{ color: "#94A3B8" }}>
            {report?.class_name ? `Class ${report.class_name}` : ""}{report?.section ? ` — Section ${report.section}` : ""} &nbsp;·&nbsp;
            <span className="font-semibold" style={{ color: "#6366F1" }}>{report?.total_assessments || 0}</span> assessments ·{" "}
            <span className="font-semibold" style={{ color: "#6366F1" }}>{report?.total_students || 0}</span> students
            &nbsp;·&nbsp; <span className="text-xs">Click a student to see their spotlight</span>
          </p>
          <button onClick={handleClassAnalytics} disabled={classAiLoading}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-all shrink-0"
            style={{ color: "white", background: classAiLoading ? "#A5B4FC" : "linear-gradient(135deg,#6366F1,#8B5CF6)" }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            {classAiLoading ? "Analysing…" : "Class AI Analysis"}
          </button>
        </div>
        {classAiText && <div className="pl-10"><AIInsightsPanel text={classAiText} onClose={() => setClassAiText(null)} /></div>}
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <div className="w-10 h-10 rounded-full ai-gradient animate-pulse" />
          <p className="text-sm" style={{ color: "#94A3B8" }}>Loading report…</p>
        </div>
      ) : (
        <>
          {/* ── Spotlight OR Podium ─────────────────────── */}
          {selectedStudent ? (
            <StudentSpotlight
              student={selectedStudent}
              totalAssessments={totalAssessments}
              subject={subject}
              onBack={() => setSelectedStudent(null)}
            />
          ) : totalAssessments === 0 ? (
            /* No assessments recorded — a podium here would award medals for
               nothing. Say why the numbers are empty instead. */
            <div className="bg-white rounded-2xl p-8 text-center"
              style={{ border: "1px solid rgba(99,102,241,0.12)" }}>
              <p className="text-sm font-semibold mb-1" style={{ color: "#0F172A" }}>
                No assessments recorded yet
              </p>
              <p className="text-xs" style={{ color: "#94A3B8" }}>
                Ranks, averages and grades appear here once assessments are recorded for this class.
              </p>
            </div>
          ) : (
            top3.length >= 1 && (
              <div className="grid grid-cols-3 gap-4">
                {[1, 0, 2].map((origIdx, podiumPos) => {
                  const s = top3[origIdx];
                  if (!s) return <div key={podiumPos} />;
                  const cfg = PODIUM_CONFIG[origIdx];
                  return (
                    <button key={s.student_id}
                      onClick={() => handleSelect(s)}
                      className="flex flex-col items-center text-center p-5 rounded-2xl transition-all cursor-pointer"
                      style={{ background: cfg.bg, border: cfg.ring, boxShadow: origIdx === 0 ? "0 8px 24px rgba(245,158,11,0.2)" : "none" }}
                      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 12px 30px rgba(99,102,241,0.15)"; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = origIdx === 0 ? "0 8px 24px rgba(245,158,11,0.2)" : "none"; }}>
                      <span className={cfg.text + " mb-2"}>{cfg.medal}</span>
                      <div className={`${cfg.size} rounded-full flex items-center justify-center font-bold text-white mb-2 shrink-0`}
                        style={{ background: "linear-gradient(135deg,#6366F1,#8B5CF6)" }}>
                        {s.name.split(" ").map(w => w[0]).slice(0, 2).join("")}
                      </div>
                      <p className="text-xs font-bold leading-tight mb-0.5" style={{ color: "#0F172A" }}>{s.name}</p>
                      <p className="text-[10px] font-mono mb-1.5" style={{ color: "#94A3B8" }}>{s.roll_number}</p>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold"
                        style={{ background: "white", color: cfg.textColor, border: `1px solid ${cfg.textColor}40` }}>
                        {s.average_percent}%
                      </span>
                    </button>
                  );
                })}
              </div>
            )
          )}

          {/* ── Controls ───────────────────────────────── */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#94A3B8" }}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
              </svg>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search student by name or roll…"
                className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl focus:outline-none transition-all"
                style={{ border: "1.5px solid #E2E8F0", background: "white", color: "#0F172A" }}
                onFocus={e => { e.target.style.border = "1.5px solid #6366F1"; e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.1)"; }}
                onBlur={e  => { e.target.style.border = "1.5px solid #E2E8F0"; e.target.style.boxShadow = "none"; }}
              />
            </div>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              className="px-4 py-2.5 text-sm rounded-xl focus:outline-none transition-all"
              style={{ border: "1.5px solid #E2E8F0", background: "white", color: "#0F172A" }}
              onFocus={e => e.target.style.border = "1.5px solid #6366F1"}
              onBlur={e  => e.target.style.border = "1.5px solid #E2E8F0"}>
              <option value="rank">Sort by Rank</option>
              <option value="avg">Sort by Average</option>
              <option value="name">Sort by Name</option>
            </select>
          </div>

          {/* ── Full Table ──────────────────────────────── */}
          <div className="bg-white rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(99,102,241,0.1)" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "linear-gradient(135deg,#EEF2FF,#F5F3FF)", borderBottom: "1px solid rgba(99,102,241,0.1)" }}>
                    {[
                      { label: "Rank",        cls: "text-center w-12" },
                      { label: "Student",     cls: "text-left" },
                      { label: "Assessed",    cls: "text-center" },
                      { label: "Avg Marks",   cls: "text-right" },
                      { label: "High",        cls: "text-right w-12" },
                      { label: "Low",         cls: "text-right w-12" },
                      { label: "Performance", cls: "w-40" },
                    ].map(h => (
                      <th key={h.label} className={`px-4 py-3.5 text-[10px] font-bold uppercase tracking-widest ${h.cls}`}
                        style={{ color: "#6366F1" }}>{h.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => {
                    // Ranks are still numbered 1..N when nobody has been
                    // assessed, so guard the medals on an actual score.
                    const isTop3    = s.rank <= 3 && s.total_assessed > 0;
                    const isActive  = selectedStudent?.student_id === s.student_id;
                    return (
                      <tr key={s.student_id}
                        onClick={() => handleSelect(s)}
                        className="cursor-pointer transition-colors"
                        style={{
                          borderBottom: "1px solid #F1F5F9",
                          borderLeft: isActive ? "3px solid #6366F1" : "3px solid transparent",
                          background: isActive ? "#EEF2FF40" : "transparent",
                        }}
                        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#EEF2FF30"; }}
                        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>

                        {/* Rank */}
                        <td className="px-4 py-3 text-center">
                          {isTop3 ? (
                            <span className="text-base">{"🥇🥈🥉"[s.rank - 1]}</span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold"
                              style={{ background: "#F1F5F9", color: "#64748B" }}>{s.rank}</span>
                          )}
                        </td>

                        {/* Student */}
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                              style={{ background: isTop3 ? "linear-gradient(135deg,#F59E0B,#EF4444)" : "linear-gradient(135deg,#6366F1,#8B5CF6)" }}>
                              {s.name.split(" ").map(w => w[0]).slice(0, 2).join("")}
                            </div>
                            <div>
                              <p className="font-semibold" style={{ color: "#0F172A" }}>{s.name}</p>
                              <p className="text-xs font-mono" style={{ color: "#94A3B8" }}>{s.roll_number}</p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-center text-xs" style={{ color: "#94A3B8" }}>{s.total_assessed}</td>
                        <td className="px-4 py-3 text-right font-semibold" style={{ color: "#0F172A" }}>
                          {s.average_marks != null ? s.average_marks : "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-semibold" style={{ color: "#10B981" }}>
                          {s.highest_marks ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-semibold" style={{ color: "#EF4444" }}>
                          {s.lowest_marks ?? "—"}
                        </td>
                        <td className="px-5 py-3">
                          <PercentBar value={s.average_percent} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-right" style={{ color: "#94A3B8" }}>
            Showing <span className="font-semibold" style={{ color: "#6366F1" }}>{filtered.length}</span> of {students.length} students
          </p>
        </>
      )}
    </div>
  );
}
