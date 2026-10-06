"use client";

import { useState, useEffect, useRef } from "react";
import { todayISO } from "@/lib/dates";
import { withClass } from "@/lib/activeClass";
import { sendParentNotification } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

const GENDER_STYLE = {
  male:   { bg: "#EFF6FF", color: "#3B82F6" },
  female: { bg: "#FDF2F8", color: "#EC4899" },
  other:  { bg: "#F8FAFC", color: "#64748B" },
};

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

function PercentBar({ value }) {
  const pct = value ?? 0;
  const gradient =
    pct >= 75 ? "linear-gradient(90deg,#10B981,#06B6D4)" :
    pct >= 50 ? "linear-gradient(90deg,#6366F1,#8B5CF6)" :
    pct >= 35 ? "linear-gradient(90deg,#F59E0B,#EF4444)" :
               "linear-gradient(90deg,#EF4444,#EC4899)";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "#EEF2FF" }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: gradient }} />
      </div>
      <span className="text-xs font-bold w-10 text-right" style={{ color: "#475569" }}>
        {value != null ? `${value}%` : "—"}
      </span>
    </div>
  );
}

/* ─── Notify Parent Modal ──────────────────────────────────────────── */
function NotifyModal({ student, onClose }) {
  const [msgType, setMsgType] = useState("performance");
  const [message, setMessage] = useState("");
  const [sent,    setSent]    = useState(false);

  const TYPES = [
    { value: "performance",  label: "📊 Performance Update" },
    { value: "homework",     label: "📚 Homework Reminder" },
    { value: "attendance",   label: "📅 Attendance Alert" },
    { value: "general",      label: "📢 General Notice" },
  ];

  const [sending, setSending] = useState(false);
  const [error,   setError]   = useState("");

  // This used to be `setSent(true)` and nothing else — the modal claimed the
  // parent had been notified while storing nothing and telling no one.
  const handleSend = async () => {
    if (!message.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      await sendParentNotification({
        studentId: student.student_id,
        type: msgType,
        message: message.trim(),
      });
      setSent(true);
    } catch (err) {
      setError(err.message || "Could not send. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* gradient top bar */}
        <div className="h-1 ai-gradient" />

        <div className="px-6 py-5">
          {sent ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: "#ECFDF5" }}>
                <svg className="w-7 h-7" style={{ color: "#10B981" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-base font-bold mb-1" style={{ color: "#0F172A" }}>Notification Sent!</h3>
              <p className="text-sm" style={{ color: "#94A3B8" }}>
                Parent of <span className="font-semibold" style={{ color: "#6366F1" }}>{student.full_name}</span> has been notified.
              </p>
              {student.guardian_phone && (
                <p className="text-xs mt-1 font-mono" style={{ color: "#94A3B8" }}>📱 {student.guardian_phone}</p>
              )}
              <button onClick={onClose}
                className="mt-5 px-5 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-all"
                style={{ background: "#EEF2FF", color: "#6366F1" }}
                onMouseEnter={e => e.currentTarget.style.background = "#C7D2FE"}
                onMouseLeave={e => e.currentTarget.style.background = "#EEF2FF"}>
                Done
              </button>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h2 className="text-base font-bold" style={{ color: "#0F172A", fontFamily: "var(--font-space-grotesk)" }}>
                    Inform Parent
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
                    {student.full_name} &nbsp;·&nbsp;
                    <span className="font-mono">{student.guardian_phone || "No phone on record"}</span>
                  </p>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-lg cursor-pointer"
                  style={{ color: "#94A3B8" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#FEF2F2"; e.currentTarget.style.color = "#EF4444"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#94A3B8"; }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Parent info pill */}
              <div className="flex items-center gap-3 p-3 rounded-xl mb-5"
                style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: "rgba(99,102,241,0.1)" }}>
                  <svg className="w-4 h-4" style={{ color: "#6366F1" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold" style={{ color: "#0F172A" }}>{student.guardian_name || "Parent / Guardian"}</p>
                  <p className="text-xs font-mono" style={{ color: "#94A3B8" }}>{student.guardian_phone || "—"}</p>
                </div>
              </div>

              {/* Type selector */}
              <p className="text-xs font-semibold mb-2" style={{ color: "#475569" }}>Notification Type</p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {TYPES.map(t => (
                  <button key={t.value}
                    onClick={() => setMsgType(t.value)}
                    className="px-3 py-2 rounded-xl text-xs font-medium text-left cursor-pointer transition-all"
                    style={{
                      border: msgType === t.value ? "1.5px solid #6366F1" : "1.5px solid #E2E8F0",
                      background: msgType === t.value ? "#EEF2FF" : "white",
                      color: msgType === t.value ? "#4F46E5" : "#64748B",
                    }}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Message */}
              <p className="text-xs font-semibold mb-2" style={{ color: "#475569" }}>Message</p>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={4}
                placeholder={`Write your message to ${student.guardian_name || "the parent"}…`}
                className="w-full px-3 py-2.5 text-sm rounded-xl resize-none focus:outline-none transition-all"
                style={{ border: "1.5px solid #E2E8F0", color: "#0F172A" }}
                onFocus={e => { e.target.style.border = "1.5px solid #6366F1"; e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.1)"; }}
                onBlur={e  => { e.target.style.border = "1.5px solid #E2E8F0"; e.target.style.boxShadow = "none"; }}
              />

              {/* Actions */}
              <div className="flex gap-2 mt-4">
                <button onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all"
                  style={{ background: "#F8FAFC", color: "#64748B", border: "1px solid #E2E8F0" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#E2E8F0"}
                  onMouseLeave={e => e.currentTarget.style.background = "#F8FAFC"}>
                  Cancel
                </button>
                <button onClick={handleSend}
                  disabled={!message.trim() || sending}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all disabled:cursor-not-allowed"
                  style={{
                    background: message.trim() && !sending ? "linear-gradient(135deg,#6366F1,#8B5CF6)" : "#E2E8F0",
                    color: message.trim() && !sending ? "white" : "#94A3B8",
                  }}>
                  {sending ? "Sending…" : "Send Notification"}
                </button>
              </div>
              {error && (
                <p className="text-xs mt-2 text-center" style={{ color: "#DC2626" }}>{error}</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Assign Homework Modal — single OR bulk ──────────────────────── */
function AssignModal({ students: initialStudents, onClose, onSuccess }) {
  // Snapshot the list on open. onSuccess clears the parent's selection while
  // this modal is still showing its "done" view, and that view names the
  // students — reading the live prop after the clear crashed the page with
  // "students[0] is undefined".
  const [students] = useState(() => initialStudents ?? []);
  // length 1 = single, >1 = bulk
  const isBulk = students.length > 1;
  const [title,   setTitle]   = useState("");
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [chapters, setChapters] = useState([]);
  // Selected students by default; the toggle sends it to the whole roll instead.
  const [entireClass, setEntireClass] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [desc,    setDesc]    = useState("");
  const [done,    setDone]    = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");
  const [attachment, setAttachment] = useState(null);   // optional — any file type
  const attachRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem("swais_faculty_token");
    fetch(`${API}/api/v1/subjects`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setSubjects(d.subjects || []))
      .catch(() => setSubjects([]));
  }, []);

  // Chapters follow the subject. The subject <select> clears the chapter on
  // change (see handleSubjectChange) so a chapter from the previous subject
  // can't be sent by mistake; this only loads the new list.
  useEffect(() => {
    if (!subject) return;
    let alive = true;
    const token = localStorage.getItem("swais_faculty_token");
    fetch(`${API}/api/v1/chapters?subject_id=${subject}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { if (alive) setChapters(d.chapters || []); })
      .catch(() => { if (alive) setChapters([]); });
    return () => { alive = false; };
  }, [subject]);

  const handleSubjectChange = (value) => {
    setSubject(value);
    setChapter("");
    if (!value) setChapters([]);
  };

  const handleAssign = async () => {
    if (!title.trim() || !dueDate || saving) return;
    setSaving(true);
    setError("");
    const token = localStorage.getItem("swais_faculty_token");
    try {
      const res = await fetch(withClass(`${API}/api/v1/assignments`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: title.trim(),
          text: desc || null,
          subject_id: subject ? Number(subject) : null,
          chapter_id: chapter ? Number(chapter) : null,
          due_date: dueDate,
          // Omitted = whole class; otherwise exactly the students in this modal.
          ...(entireClass ? {} : { student_ids: students.map(st => st.student_id) }),
        }),
      });
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try { const b = await res.json(); detail = typeof b.detail === "string" ? b.detail : (b.detail?.[0]?.msg || detail); } catch {}
        throw new Error(detail);
      }
      const created = await res.json();

      // Attachment is optional — only uploaded when the teacher picked a file.
      // A failed upload must not lose the assignment that was just created.
      if (attachment && created?.assignment_id) {
        try {
          const body = new FormData();
          body.append("file", attachment);
          const up = await fetch(`${API}/api/v1/assignments/${created.assignment_id}/files`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body,
          });
          if (!up.ok) throw new Error(`HTTP ${up.status}`);
        } catch {
          setError("Assignment created, but the attachment could not be uploaded.");
        }
      }

      setDone(true);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message && !err.message.startsWith("HTTP") ? err.message : "Couldn't create the assignment. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="h-1 ai-gradient" />
        <div className="px-6 py-5 overflow-y-auto">
          {done ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: "#EEF2FF" }}>
                <svg className="w-7 h-7" style={{ color: "#6366F1" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h3 className="text-base font-bold mb-1" style={{ color: "#0F172A" }}>Assignment Created!</h3>
              <p className="text-sm" style={{ color: "#94A3B8" }}>
                <span className="font-semibold" style={{ color: "#6366F1" }}>{title}</span> assigned to{" "}
                <span className="font-semibold">
                  {entireClass ? "the whole class" : isBulk ? `${students.length} students` : (students[0]?.full_name ?? "the student")}
                </span>
              </p>
              <p className="text-xs mt-1" style={{ color: "#94A3B8" }}>
                Due: {new Date(dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </p>
              <button onClick={onClose}
                className="mt-5 px-5 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-all"
                style={{ background: "#EEF2FF", color: "#6366F1" }}
                onMouseEnter={e => e.currentTarget.style.background = "#C7D2FE"}
                onMouseLeave={e => e.currentTarget.style.background = "#EEF2FF"}>
                Done
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between mb-5">
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-bold" style={{ color: "#0F172A", fontFamily: "var(--font-space-grotesk)" }}>
                    {isBulk ? "Assign Homework — Bulk" : "Assign Homework"}
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
                    {isBulk
                      ? <>To: <span className="font-semibold" style={{ color: "#6366F1" }}>{students.length} students</span> selected</>
                      : <>To: {students[0].full_name} · {students[0].roll_no}</>
                    }
                  </p>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-lg cursor-pointer"
                  style={{ color: "#94A3B8" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#FEF2F2"; e.currentTarget.style.color = "#EF4444"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#94A3B8"; }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Recipients */}
              <div className="mb-4 p-3 rounded-xl"
                style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", maxHeight: "140px", overflowY: "auto" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#94A3B8" }}>
                    {entireClass ? "Recipients: entire class" : `Recipients (${students.length})`}
                  </p>
                  <label className="flex items-center gap-1.5 text-[11px] font-medium cursor-pointer select-none" style={{ color: "#475569" }}>
                    <input type="checkbox" checked={entireClass} onChange={e => setEntireClass(e.target.checked)}
                      className="w-3.5 h-3.5 rounded accent-[#6366F1]" />
                    Assign to entire class
                  </label>
                </div>
                {!entireClass && (
                  <div className="flex flex-wrap gap-1.5">
                    {students.map(s => (
                      <span key={s.student_id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                        style={{ background: "white", color: "#475569", border: "1px solid #E2E8F0" }}>
                        <span className="font-mono text-[10px]" style={{ color: "#94A3B8" }}>{s.roll_no}</span>
                        {s.full_name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Assignment title */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "#475569" }}>Assignment Title *</label>
                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Chapter 5 Questions 1–10"
                    className="w-full px-3 py-2.5 text-sm rounded-xl focus:outline-none transition-all"
                    style={{ border: "1.5px solid #E2E8F0", color: "#0F172A" }}
                    onFocus={e => { e.target.style.border = "1.5px solid #6366F1"; e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.1)"; }}
                    onBlur={e  => { e.target.style.border = "1.5px solid #E2E8F0"; e.target.style.boxShadow = "none"; }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: "#475569" }}>Subject</label>
                    <select
                      value={subject}
                      onChange={e => handleSubjectChange(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm rounded-xl focus:outline-none transition-all"
                      style={{ border: "1.5px solid #E2E8F0", color: "#0F172A", background: "white" }}
                      onFocus={e => e.target.style.border = "1.5px solid #6366F1"}
                      onBlur={e  => e.target.style.border = "1.5px solid #E2E8F0"}>
                      <option value="">-- Select subject --</option>
                      {subjects.map(s => (
                        <option key={s.subject_id} value={s.subject_id}>{s.subject_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: "#475569" }}>Chapter</label>
                    <select
                      value={chapter}
                      onChange={e => setChapter(e.target.value)}
                      disabled={!subject}
                      className="w-full px-3 py-2.5 text-sm rounded-xl focus:outline-none transition-all disabled:opacity-60"
                      style={{ border: "1.5px solid #E2E8F0", color: "#0F172A", background: "white" }}
                      onFocus={e => e.target.style.border = "1.5px solid #6366F1"}
                      onBlur={e  => e.target.style.border = "1.5px solid #E2E8F0"}>
                      <option value="">{subject ? "-- Optional --" : "Select subject first"}</option>
                      {chapters.map(c => (
                        <option key={c.chapter_id} value={c.chapter_id}>{c.chapter_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: "#475569" }}>Due Date *</label>
                    <input
                      type="date"
                      min={todayISO()}
                      value={dueDate}
                      onChange={e => setDueDate(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm rounded-xl focus:outline-none transition-all"
                      style={{ border: "1.5px solid #E2E8F0", color: "#0F172A" }}
                      onFocus={e => { e.target.style.border = "1.5px solid #6366F1"; e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.1)"; }}
                      onBlur={e  => { e.target.style.border = "1.5px solid #E2E8F0"; e.target.style.boxShadow = "none"; }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "#475569" }}>Description (optional)</label>
                  <textarea
                    value={desc}
                    onChange={e => setDesc(e.target.value)}
                    rows={3}
                    placeholder="Instructions or notes for the student…"
                    className="w-full px-3 py-2.5 text-sm rounded-xl resize-none focus:outline-none transition-all"
                    style={{ border: "1.5px solid #E2E8F0", color: "#0F172A" }}
                    onFocus={e => { e.target.style.border = "1.5px solid #6366F1"; e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.1)"; }}
                    onBlur={e  => { e.target.style.border = "1.5px solid #E2E8F0"; e.target.style.boxShadow = "none"; }}
                  />
                </div>

                {/* Attachment — optional, any file type */}
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "#475569" }}>
                    Attachment (optional)
                  </label>
                  <input
                    ref={attachRef}
                    type="file"
                    className="hidden"
                    onChange={e => setAttachment(e.target.files?.[0] || null)}
                  />
                  {attachment ? (
                    <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl"
                      style={{ border: "1.5px solid #E2E8F0", background: "#F8FAFC" }}>
                      <span className="text-sm truncate" style={{ color: "#0F172A" }}>{attachment.name}</span>
                      <button type="button"
                        onClick={() => { setAttachment(null); if (attachRef.current) attachRef.current.value = ""; }}
                        className="text-xs font-semibold cursor-pointer shrink-0"
                        style={{ color: "#EF4444" }}>
                        Remove
                      </button>
                    </div>
                  ) : (
                    <button type="button"
                      onClick={() => attachRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm rounded-xl cursor-pointer transition-all"
                      style={{ border: "1.5px dashed #E2E8F0", color: "#64748B", background: "white" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "#6366F1"; e.currentTarget.style.color = "#6366F1"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.color = "#64748B"; }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      Attach worksheet or PDF
                    </button>
                  )}
                </div>
              </div>

              {error && (
                <p className="mt-4 text-sm font-medium" style={{ color: "#B91C1C" }}>{error}</p>
              )}

              <div className="flex gap-2 mt-5">
                <button onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all"
                  style={{ background: "#F8FAFC", color: "#64748B", border: "1px solid #E2E8F0" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#E2E8F0"}
                  onMouseLeave={e => e.currentTarget.style.background = "#F8FAFC"}>
                  Cancel
                </button>
                <button onClick={handleAssign}
                  disabled={!title.trim() || !dueDate || saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all"
                  style={{
                    background: (title.trim() && dueDate && !saving) ? "linear-gradient(135deg,#6366F1,#8B5CF6)" : "#E2E8F0",
                    color: (title.trim() && dueDate && !saving) ? "white" : "#94A3B8",
                  }}>
                  {saving ? "Assigning…" : isBulk ? `Assign to ${students.length} Students` : "Assign"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Student Detail Drawer ────────────────────────────────────────── */
function StudentDrawer({ student, perf, onNotify, onAssign, onClose }) {
  const gStyle   = GENDER_STYLE[(student.gender || "other").toLowerCase()] || GENDER_STYLE.other;
  const grade    = getGrade(perf?.average_percent);
  const gc       = GRADE_COLOR[grade] || GRADE_COLOR["—"];
  const initials = (student.full_name || "").split(" ").map(w => w[0]).slice(0, 2).join("");

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-md bg-white h-full shadow-2xl flex flex-col"
        style={{ animation: "slideInRight 0.25s ease-out" }}>

        <div className="absolute top-0 left-0 right-0 h-1 ai-gradient" />

        {/* Header */}
        <div className="px-6 pt-6 pb-5" style={{ borderBottom: "1px solid #F1F5F9" }}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold text-white shrink-0"
                style={{ background: "linear-gradient(135deg,#6366F1,#8B5CF6)" }}>
                {initials}
              </div>
              <div>
                <h2 className="text-lg font-bold" style={{ color: "#0F172A", fontFamily: "var(--font-space-grotesk)" }}>
                  {student.full_name}
                </h2>
                <p className="text-sm font-mono" style={{ color: "#94A3B8" }}>{student.roll_no}</p>
                <div className="flex items-center gap-2 mt-1">
                  {student.gender && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold capitalize"
                      style={{ background: gStyle.bg, color: gStyle.color }}>{student.gender}</span>
                  )}
                  {grade !== "—" && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                      style={{ background: gc.bg, color: gc.color }}>Grade {grade}</span>
                  )}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl cursor-pointer transition-all"
              style={{ color: "#94A3B8" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#FEF2F2"; e.currentTarget.style.color = "#EF4444"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#94A3B8"; }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Quick action buttons */}
          <div className="flex gap-2 mt-4">
            <button onClick={() => { onClose(); onNotify(student); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all"
              style={{ background: "#EEF2FF", color: "#6366F1" }}
              onMouseEnter={e => e.currentTarget.style.background = "#C7D2FE"}
              onMouseLeave={e => e.currentTarget.style.background = "#EEF2FF"}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              Inform Parent
            </button>
            <button onClick={() => { onClose(); onAssign(student); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all"
              style={{ background: "#F5F3FF", color: "#8B5CF6" }}
              onMouseEnter={e => e.currentTarget.style.background = "#DDD6FE"}
              onMouseLeave={e => e.currentTarget.style.background = "#F5F3FF"}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Assign
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Performance */}
          {perf ? (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "#94A3B8" }}>
                Performance Summary
              </p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: "🏆 Rank",    value: `#${perf.rank}` },
                  { label: "📊 Average", value: perf.average_percent != null ? `${perf.average_percent}%` : "—" },
                  { label: "⬆️ Highest", value: perf.highest_marks ?? "—" },
                  { label: "⬇️ Lowest",  value: perf.lowest_marks  ?? "—" },
                ].map(s => (
                  <div key={s.label} className="rounded-xl p-3" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                    <p className="text-[10px] font-semibold mb-1" style={{ color: "#94A3B8" }}>{s.label}</p>
                    <p className="text-xl font-bold" style={{ color: "#0F172A" }}>{s.value}</p>
                  </div>
                ))}
              </div>
              <div>
                <div className="flex justify-between text-xs mb-2" style={{ color: "#94A3B8" }}>
                  <span>Overall Performance</span>
                  <span>{perf.total_assessed} assessments</span>
                </div>
                <PercentBar value={perf.average_percent} />
              </div>
            </div>
          ) : (
            <div className="rounded-xl p-4 text-center text-sm" style={{ background: "#F8FAFC", color: "#94A3B8" }}>
              No assessment data yet
            </div>
          )}

          {/* Parent info */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "#94A3B8" }}>
              Parent / Guardian
            </p>
            <div className="rounded-xl p-4 space-y-3" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(99,102,241,0.1)" }}>
                  <svg className="w-4 h-4" style={{ color: "#6366F1" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px]" style={{ color: "#94A3B8" }}>Name</p>
                  <p className="text-sm font-semibold" style={{ color: "#0F172A" }}>{student.guardian_name || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(16,185,129,0.1)" }}>
                  <svg className="w-4 h-4" style={{ color: "#10B981" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px]" style={{ color: "#94A3B8" }}>Phone</p>
                  <p className="text-sm font-mono font-semibold" style={{ color: "#0F172A" }}>{student.guardian_phone || "—"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Class info */}
          <div className="flex gap-3">
            <div className="flex-1 rounded-xl p-3 text-center" style={{ background: "#EEF2FF", border: "1px solid #C7D2FE" }}>
              <p className="text-[10px] font-semibold" style={{ color: "#6366F1" }}>CLASS</p>
              <p className="text-2xl font-bold" style={{ color: "#4F46E5" }}>{student.class_id ?? "—"}</p>
            </div>
            <div className="flex-1 rounded-xl p-3 text-center" style={{ background: "#F5F3FF", border: "1px solid #DDD6FE" }}>
              <p className="text-[10px] font-semibold" style={{ color: "#8B5CF6" }}>SECTION</p>
              <p className="text-2xl font-bold" style={{ color: "#7C3AED" }}>{student.section || "A"}</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}

/* ─── Main Page ────────────────────────────────────────────────────── */
export default function StudentsPage() {
  const { user } = useAuth();
  const [students,      setStudents]      = useState([]);
  const [reportMap,     setReportMap]     = useState({});
  const [isLoading,     setIsLoading]     = useState(true);
  const [error,         setError]         = useState(null);
  const [search,        setSearch]        = useState("");
  const [drawerStudent, setDrawerStudent] = useState(null);
  const [notifyStudent, setNotifyStudent] = useState(null);
  const [assignStudent, setAssignStudent] = useState(null);
  const [selectedIds,   setSelectedIds]   = useState(new Set());
  const [bulkAssignOpen,setBulkAssignOpen]= useState(false);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  useEffect(() => {
    const token = localStorage.getItem("swais_faculty_token");
    if (!token) {
      setError("Session expired. Please log out and log in again.");
      setIsLoading(false);
      return;
    }
    const headers = { Authorization: `Bearer ${token}` };

    const safeFetch = (url) =>
      fetch(url, { headers }).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.detail || `Error ${r.status}`);
        }
        return r.json();
      });

    Promise.all([
      safeFetch(withClass(`${API}/api/v1/students`)),
      safeFetch(withClass(`${API}/api/v1/reports`)),
    ])
      .then(([sd, rd]) => {
        setStudents(sd.students || []);
        const map = {};
        (rd.students || []).forEach(s => { map[s.student_id] = s; });
        setReportMap(map);
      })
      .catch((err) => {
        // API unreachable — show empty state, no mock data
        setStudents([]);
        setReportMap({});
        setError(err?.message || "Unable to load students.");
      })
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = students.filter(s =>
    (s.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (s.roll_no || "").toLowerCase().includes(search.toLowerCase()) ||
    (s.guardian_name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <div className="w-8 h-8 rounded-lg ai-gradient flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold" style={{ color: "#F1F5F9", fontFamily: "var(--font-space-grotesk)" }}>
                Students
              </h1>
            </div>
            <p className="text-sm pl-10" style={{ color: "#94A3B8" }}>
              {user?.class ? `Class ${user.class}` : ""}{user?.section ? ` — Section ${user.section}` : ""} &nbsp;·&nbsp;
              <span className="font-semibold" style={{ color: "#6366F1" }}>{students.length}</span> students enrolled
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#94A3B8" }}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, roll or parent…"
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl focus:outline-none transition-all"
              style={{ border: "1.5px solid #E2E8F0", background: "white", color: "#0F172A" }}
              onFocus={e => { e.target.style.border = "1.5px solid #6366F1"; e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.1)"; }}
              onBlur={e  => { e.target.style.border = "1.5px solid #E2E8F0"; e.target.style.boxShadow = "none"; }}
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(99,102,241,0.1)", boxShadow: "0 1px 3px rgba(99,102,241,0.06)" }}>
          {isLoading ? (
            <div className="p-12 text-center">
              <div className="w-10 h-10 rounded-full ai-gradient mx-auto mb-3 animate-pulse" />
              <p className="text-sm" style={{ color: "#94A3B8" }}>Loading students…</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-sm" style={{ color: "#EF4444" }}>{error}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "linear-gradient(135deg,#EEF2FF,#F5F3FF)", borderBottom: "1px solid rgba(99,102,241,0.12)" }}>
                    <th className="px-4 py-3.5 w-10">
                      <input
                        type="checkbox"
                        checked={filtered.length > 0 && filtered.every(s => selectedIds.has(s.student_id))}
                        ref={el => {
                          if (el) {
                            const someSelected = filtered.some(s => selectedIds.has(s.student_id));
                            const allSelected  = filtered.length > 0 && filtered.every(s => selectedIds.has(s.student_id));
                            el.indeterminate = someSelected && !allSelected;
                          }
                        }}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(new Set(filtered.map(s => s.student_id)));
                          } else {
                            clearSelection();
                          }
                        }}
                        className="w-4 h-4 cursor-pointer accent-indigo-500"
                        title="Select all"
                      />
                    </th>
                    {["Roll No.", "Name", "Gender", "Parent / Guardian", "Phone", "Avg %", "Grade", "Actions"].map(h => (
                      <th key={h} className="text-left px-4 py-3.5 text-[10px] font-bold uppercase tracking-widest"
                        style={{ color: "#6366F1" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s, i) => {
                    const gStyle = GENDER_STYLE[(s.gender || "other").toLowerCase()] || GENDER_STYLE.other;
                    const perf   = reportMap[s.student_id];
                    const grade  = getGrade(perf?.average_percent);
                    const gc     = GRADE_COLOR[grade] || GRADE_COLOR["—"];
                    const isActive = drawerStudent?.student_id === s.student_id;

                    const isChecked = selectedIds.has(s.student_id);
                    return (
                      <tr key={s.student_id}
                        className="transition-colors"
                        style={{
                          borderBottom: "1px solid #F1F5F9",
                          borderLeft: isActive ? "3px solid #6366F1" : isChecked ? "3px solid #8B5CF6" : "3px solid transparent",
                          background: isChecked ? "#F5F3FF40" : "transparent",
                        }}
                        onMouseEnter={e => { if (!isActive && !isChecked) e.currentTarget.style.background = "#EEF2FF30"; }}
                        onMouseLeave={e => { if (!isActive && !isChecked) e.currentTarget.style.background = "transparent"; }}>

                        <td className="px-4 py-3.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelect(s.student_id)}
                            className="w-4 h-4 cursor-pointer accent-indigo-500"
                            onClick={e => e.stopPropagation()}
                          />
                        </td>

                        <td className="px-4 py-3.5 font-mono text-xs" style={{ color: "#94A3B8" }}>{s.roll_no}</td>

                        <td className="px-4 py-3.5">
                          <button
                            onClick={() => setDrawerStudent(s)}
                            className="flex items-center gap-2.5 cursor-pointer group">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                              style={{ background: `linear-gradient(135deg,${i % 2 === 0 ? "#6366F1,#8B5CF6" : "#8B5CF6,#06B6D4"})` }}>
                              {(s.full_name || "").split(" ").map(w => w[0]).slice(0, 2).join("")}
                            </div>
                            <span className="font-medium group-hover:underline" style={{ color: "#0F172A" }}>{s.full_name}</span>
                          </button>
                        </td>

                        <td className="px-4 py-3.5">
                          {s.gender && (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize"
                              style={{ background: gStyle.bg, color: gStyle.color }}>{s.gender}</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5" style={{ color: "#475569" }}>{s.guardian_name || "—"}</td>
                        <td className="px-4 py-3.5 font-mono text-xs" style={{ color: "#94A3B8" }}>{s.guardian_phone || "—"}</td>

                        <td className="px-4 py-3.5">
                          <span className="text-sm font-semibold" style={{ color: "#0F172A" }}>
                            {perf?.average_percent != null ? `${perf.average_percent}%` : "—"}
                          </span>
                        </td>

                        <td className="px-4 py-3.5">
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                            style={{ background: gc.bg, color: gc.color }}>{grade}</span>
                        </td>

                        {/* Action buttons */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={e => { e.stopPropagation(); setNotifyStudent(s); }}
                              title="Inform Parent"
                              className="p-1.5 rounded-lg cursor-pointer transition-all"
                              style={{ color: "#6366F1" }}
                              onMouseEnter={e => { e.currentTarget.style.background = "#EEF2FF"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                              </svg>
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); setAssignStudent(s); }}
                              title="Assign Homework"
                              className="p-1.5 rounded-lg cursor-pointer transition-all"
                              style={{ color: "#8B5CF6" }}
                              onMouseEnter={e => { e.currentTarget.style.background = "#F5F3FF"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-5 py-12 text-center text-sm" style={{ color: "#94A3B8" }}>
                        No students found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!isLoading && !error && (
          <p className="text-xs text-right" style={{ color: "#94A3B8" }}>
            Showing <span className="font-semibold" style={{ color: "#6366F1" }}>{filtered.length}</span> of {students.length} students
          </p>
        )}
      </div>

      {/* ── Modals & Drawer — outside animate-fade-in so position:fixed works ── */}
      {drawerStudent && (
        <StudentDrawer
          student={drawerStudent}
          perf={reportMap[drawerStudent.student_id]}
          onNotify={setNotifyStudent}
          onAssign={setAssignStudent}
          onClose={() => setDrawerStudent(null)}
        />
      )}
      {notifyStudent && (
        <NotifyModal student={notifyStudent} onClose={() => setNotifyStudent(null)} />
      )}
      {assignStudent && (
        <AssignModal students={[assignStudent]} onClose={() => setAssignStudent(null)} />
      )}
      {bulkAssignOpen && (
        <AssignModal
          students={students.filter(s => selectedIds.has(s.student_id))}
          onClose={() => setBulkAssignOpen(false)}
          onSuccess={() => clearSelection()}
        />
      )}

      {/* ── Floating selection bar ── */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl"
          style={{ background: "#0F172A", border: "1px solid rgba(99,102,241,0.3)", animation: "slideUp 0.25s ease-out" }}>
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
              style={{ background: "linear-gradient(135deg,#6366F1,#8B5CF6)" }}>
              {selectedIds.size}
            </span>
            <span className="text-sm font-medium text-white">
              student{selectedIds.size === 1 ? "" : "s"} selected
            </span>
          </div>
          <div className="w-px h-6" style={{ background: "rgba(255,255,255,0.15)" }} />
          <button onClick={clearSelection}
            className="text-xs font-semibold cursor-pointer transition-all"
            style={{ color: "#94A3B8" }}
            onMouseEnter={e => e.currentTarget.style.color = "white"}
            onMouseLeave={e => e.currentTarget.style.color = "#94A3B8"}>
            Clear
          </button>
          <button onClick={() => setBulkAssignOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer transition-all"
            style={{ background: "linear-gradient(135deg,#6366F1,#8B5CF6)" }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = "0 0 20px rgba(139,92,246,0.5)"}
            onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Assign Homework
          </button>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translate(-50%, 20px); opacity: 0; }
          to   { transform: translate(-50%, 0);     opacity: 1; }
        }
      `}</style>
    </>
  );
}
