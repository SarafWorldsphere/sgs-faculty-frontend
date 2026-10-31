"use client";

/**
 * Marks Entry.
 *
 * Until now the platform could display assessment results but had no way to
 * create them — every mark on screen was loaded into the database by hand.
 * This is where a teacher actually enters them.
 *
 * The screen is one page on purpose: pick the test at the top, fill the class
 * underneath, save once. A wizard would mean a half-entered test sitting in
 * state while a teacher is interrupted between periods.
 */

import { useState, useEffect, useMemo, useRef } from "react";
import { withClass } from "@/lib/activeClass";
import { useAuth } from "@/context/AuthContext";
import { todayISO } from "@/lib/dates";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

/* A weekly class test is not a scheduled school exam, so it has no row in
   sgs_exam_master. It is saved with exam_id omitted. */
const WEEKLY = "weekly";

const CARD = {
  background: "rgba(30,41,59,0.55)",
  border: "1px solid rgba(148,163,184,0.14)",
  borderRadius: 14,
};

const INPUT = {
  background: "rgba(15,23,42,0.6)",
  border: "1px solid rgba(148,163,184,0.2)",
  borderRadius: 9,
  color: "#F1F5F9",
  padding: "8px 11px",
  fontSize: 14,
  width: "100%",
  outline: "none",
};

const LABEL = {
  fontSize: 11,
  letterSpacing: ".06em",
  textTransform: "uppercase",
  color: "#94A3B8",
  fontWeight: 600,
  marginBottom: 6,
  display: "block",
};

function Field({ label, children }) {
  return (
    <div>
      <label style={LABEL}>{label}</label>
      {children}
    </div>
  );
}

export default function MarksEntryPage() {
  const { user } = useAuth();

  const [students, setStudents] = useState([]);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // The test being recorded
  const [examId, setExamId] = useState(WEEKLY);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState(todayISO());
  const [maxMarks, setMaxMarks] = useState("25");

  // student_id -> { marks, absent }
  const [entries, setEntries] = useState({});

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(null);

  const inputRefs = useRef({});

  useEffect(() => {
    const token = localStorage.getItem("swais_faculty_token");
    if (!token) {
      setLoadError("Session expired. Please log in again.");
      setLoading(false);
      return;
    }
    const headers = { Authorization: `Bearer ${token}` };
    const get = (url) =>
      fetch(url, { headers }).then(async (r) => {
        if (!r.ok) {
          const b = await r.json().catch(() => ({}));
          throw new Error(b.detail || `Error ${r.status}`);
        }
        return r.json();
      });

    Promise.all([
      get(withClass(`${API}/api/v1/students`)),
      get(`${API}/api/v1/assessments/exams`),
    ])
      .then(([sd, ed]) => {
        setStudents(sd.students || []);
        setExams(ed.exams || []);
      })
      .catch((err) => setLoadError(err?.message || "Unable to load the class."))
      .finally(() => setLoading(false));
  }, []);

  // The teacher's own subject is the usual answer, so offer it rather than
  // making them type it every time.
  useEffect(() => {
    if (!subject && user?.subject) setSubject(user.subject);
  }, [user, subject]);

  /* Suggest a title rather than making them invent one. CT marks are entered
     a subject at a time every week, so typing "Weekly Test — Maths" forty
     times a term is the kind of friction that stops a feature being used.

     suggestedTitle remembers what we last put there, so the suggestion keeps
     up with the exam and subject while the teacher hasn't touched it, and is
     left alone the moment they type their own. */
  const suggestedTitle = useRef("");
  useEffect(() => {
    if (title && title !== suggestedTitle.current) return;  // they edited it
    const exam = exams.find((e) => String(e.exam_id) === String(examId));
    const prefix = exam ? exam.exam_name : "Weekly Test";
    const next = subject ? `${prefix} — ${subject}` : prefix;
    if (next !== title) {
      suggestedTitle.current = next;
      setTitle(next);
    }
  }, [examId, subject, exams, title]);

  const max = parseFloat(maxMarks);
  const selectedExam = exams.find((e) => String(e.exam_id) === String(examId));

  const setEntry = (id, patch) =>
    setEntries((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));

  const toggleAbsent = (id) => {
    const absent = !entries[id]?.absent;
    // An absent child has no mark. Keeping a number beside the tick would save
    // a row claiming they scored and did not sit the test.
    setEntry(id, { absent, marks: absent ? "" : entries[id]?.marks || "" });
  };

  /* Enter moves to the next student — marks are entered from a paper list and
     reaching for the mouse every row is what makes this slow. */
  const onKeyDown = (e, index) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const next = students[index + 1];
    if (next) inputRefs.current[next.student_id]?.focus();
  };

  const filled = students.filter(
    (s) => entries[s.student_id]?.absent || entries[s.student_id]?.marks !== undefined
      && entries[s.student_id]?.marks !== ""
  ).length;

  const scored = students
    .map((s) => entries[s.student_id])
    .filter((e) => e && !e.absent && e.marks !== "" && e.marks !== undefined)
    .map((e) => parseFloat(e.marks))
    .filter((n) => !Number.isNaN(n));

  const average = scored.length
    ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 10) / 10
    : null;

  const overMax = students.filter((s) => {
    const v = parseFloat(entries[s.student_id]?.marks);
    return !Number.isNaN(v) && (v > max || v < 0);
  });

  const canSave =
    title.trim() && date && max > 0 && filled > 0 && !overMax.length && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError("");
    setSaved(null);

    const marks = students
      .map((s) => {
        const e = entries[s.student_id];
        if (!e) return null;
        if (e.absent) return { student_id: s.student_id, is_absent: true };
        if (e.marks === "" || e.marks === undefined) return null;
        return { student_id: s.student_id, marks_obtained: parseFloat(e.marks) };
      })
      .filter(Boolean);

    const body = {
      title: title.trim(),
      subject: subject || null,
      assessment_date: date,
      max_marks: max,
      assessment_type: "test",
      marks,
    };
    if (examId !== WEEKLY) body.exam_id = Number(examId);

    try {
      const token = localStorage.getItem("swais_faculty_token");
      const res = await fetch(withClass(`${API}/api/v1/assessments`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        const detail =
          typeof b.detail === "string" ? b.detail : b.detail?.[0]?.msg || `Error ${res.status}`;
        throw new Error(detail);
      }
      const created = await res.json();
      setSaved(created);
      setEntries({});
      // Clear the title so the suggestion regenerates — the subject, date and
      // maximum stay, because the next thing a teacher does is usually the
      // same test for the next subject.
      suggestedTitle.current = "";
      setTitle("");
    } catch (err) {
      setError(err?.message || "Could not save the marks. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  /* ── render ──────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto">
        <div style={{ ...CARD, padding: 48, textAlign: "center", color: "#94A3B8" }}>
          Loading the class…
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-fade-in">
      <div>
        <h1
          className="text-2xl font-bold"
          style={{ color: "#F1F5F9", fontFamily: "var(--font-space-grotesk)" }}
        >
          Marks Entry
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "#94A3B8" }}>
          {user?.class ? `Class ${user.class}` : ""}
          {user?.section ? ` — Section ${user.section}` : ""}
          {students.length ? ` · ${students.length} students` : ""}
        </p>
      </div>

      {loadError && (
        <div style={{ ...CARD, padding: 16, borderColor: "rgba(239,68,68,0.4)", color: "#FCA5A5" }}>
          {loadError}
        </div>
      )}

      {saved && (
        <div
          style={{
            ...CARD,
            padding: "14px 18px",
            borderColor: "rgba(16,185,129,0.4)",
            background: "rgba(16,185,129,0.08)",
          }}
        >
          <span style={{ color: "#6EE7B7", fontWeight: 600 }}>Saved.</span>{" "}
          <span style={{ color: "#A7F3D0" }}>
            {saved.title} — {saved.submitted} marks recorded
            {saved.absent_count ? `, ${saved.absent_count} absent` : ""}
            {saved.class_average != null ? `, class average ${saved.class_average}` : ""}.
          </span>
        </div>
      )}

      {/* ── the test ─────────────────────────────────────────── */}
      <div style={{ ...CARD, padding: 20 }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Exam">
            <select
              style={INPUT}
              value={examId}
              onChange={(e) => setExamId(e.target.value)}
            >
              <option value={WEEKLY}>Weekly class test</option>
              {exams.map((e) => (
                <option key={e.exam_id} value={e.exam_id}>
                  {e.exam_name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Subject">
            <input style={INPUT} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </Field>

          <Field label="Date">
            <input
              type="date"
              style={INPUT}
              value={date}
              max={todayISO()}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Title">
              <input
                style={INPUT}
                placeholder="PT-1 Mathematics"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Maximum marks">
            <input
              type="number"
              step="0.5"
              min="0.5"
              style={INPUT}
              value={maxMarks}
              onChange={(e) => setMaxMarks(e.target.value)}
            />
          </Field>
        </div>

        {examId === WEEKLY && (
          <p className="text-xs mt-3" style={{ color: "#94A3B8" }}>
            A weekly class test is recorded per subject. The monthly total is worked out from
            these when the reports are produced.
          </p>
        )}
        {selectedExam?.start_date && (
          <p className="text-xs mt-3" style={{ color: "#94A3B8" }}>
            {selectedExam.exam_name} runs {selectedExam.start_date}
            {selectedExam.end_date ? ` to ${selectedExam.end_date}` : ""}.
          </p>
        )}
      </div>

      {/* ── the class ────────────────────────────────────────── */}
      <div style={{ ...CARD, overflow: "hidden" }}>
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: "1px solid rgba(148,163,184,0.14)" }}
        >
          <span style={{ color: "#F1F5F9", fontWeight: 600, fontSize: 14 }}>
            {students.length} students
          </span>
          <span className="text-xs" style={{ color: "#94A3B8" }}>
            {filled} of {students.length} entered
            {average != null ? ` · average ${average}` : ""}
          </span>
        </div>

        {students.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm" style={{ color: "#94A3B8" }}>
            No students in this class.
          </div>
        ) : (
          <div>
            {students.map((s, i) => {
              const e = entries[s.student_id] || {};
              const v = parseFloat(e.marks);
              const bad = !Number.isNaN(v) && (v > max || v < 0);
              return (
                <div
                  key={s.student_id}
                  className="flex items-center gap-3 px-5 py-2"
                  style={{
                    borderBottom: "1px solid rgba(148,163,184,0.07)",
                    background: e.absent ? "rgba(148,163,184,0.05)" : "transparent",
                  }}
                >
                  <span
                    className="text-xs tabular-nums"
                    style={{ color: "#64748B", width: 38, flex: "none" }}
                  >
                    {s.roll_no || "—"}
                  </span>
                  <span
                    className="text-sm flex-1 truncate"
                    style={{ color: e.absent ? "#64748B" : "#E2E8F0" }}
                  >
                    {s.full_name}
                  </span>

                  <input
                    ref={(el) => (inputRefs.current[s.student_id] = el)}
                    type="number"
                    step="0.5"
                    inputMode="decimal"
                    disabled={e.absent}
                    value={e.marks ?? ""}
                    onChange={(ev) => setEntry(s.student_id, { marks: ev.target.value })}
                    onKeyDown={(ev) => onKeyDown(ev, i)}
                    style={{
                      ...INPUT,
                      width: 86,
                      textAlign: "center",
                      padding: "6px 8px",
                      opacity: e.absent ? 0.4 : 1,
                      borderColor: bad ? "rgba(239,68,68,0.6)" : INPUT.border.split(" ").pop(),
                      border: bad
                        ? "1px solid rgba(239,68,68,0.6)"
                        : "1px solid rgba(148,163,184,0.2)",
                    }}
                  />
                  <span className="text-xs" style={{ color: "#64748B", width: 42, flex: "none" }}>
                    / {Number.isNaN(max) ? "—" : max}
                  </span>

                  <label
                    className="flex items-center gap-1.5 cursor-pointer select-none"
                    style={{ flex: "none" }}
                  >
                    <input
                      type="checkbox"
                      checked={!!e.absent}
                      onChange={() => toggleAbsent(s.student_id)}
                    />
                    <span className="text-xs" style={{ color: e.absent ? "#F59E0B" : "#64748B" }}>
                      Absent
                    </span>
                  </label>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── save ─────────────────────────────────────────────── */}
      {overMax.length > 0 && (
        <div style={{ ...CARD, padding: 14, borderColor: "rgba(239,68,68,0.4)", color: "#FCA5A5" }}>
          {overMax.length} {overMax.length === 1 ? "mark is" : "marks are"} outside 0 to {max}.
        </div>
      )}
      {error && (
        <div style={{ ...CARD, padding: 14, borderColor: "rgba(239,68,68,0.4)", color: "#FCA5A5" }}>
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: "#64748B" }}>
          Students left blank are not recorded. Press Enter to move to the next student.
        </span>
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: canSave ? "linear-gradient(135deg,#6366F1,#8B5CF6)" : "rgba(99,102,241,0.25)",
            color: canSave ? "#fff" : "#94A3B8",
            cursor: canSave ? "pointer" : "not-allowed",
          }}
        >
          {saving ? "Saving…" : "Save marks"}
        </button>
      </div>
    </div>
  );
}
