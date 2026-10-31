"use client";

import { useState, useEffect } from "react";
import SubmissionsModal from "@/components/assignments/SubmissionsModal";
import { withClass } from "@/lib/activeClass";
import { useAuth } from "@/context/AuthContext";
import { useNotes } from "@/context/NotesContext";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;
const TODAY = new Date();

function getDueDays(dueDateStr) {
  const due = new Date(dueDateStr);
  const diff = Math.round((due - TODAY) / (1000 * 60 * 60 * 24));
  return diff;
}

function DueLabel({ days }) {
  if (days < 0)  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#FEF2F2", color: "#EF4444" }}>Overdue</span>;
  if (days === 0) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#FFF7ED", color: "#EA580C" }}>Due Today</span>;
  if (days === 1) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#FFFBEB", color: "#D97706" }}>Due Tomorrow</span>;
  return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#F1F5F9", color: "#64748B" }}>In {days} days</span>;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { notes, totalNotes, isLoading } = useNotes();
  const [assignments, setAssignments] = useState([]);
  // #88: the card used to show only a count; clicking it now lists who
  // submitted and what they turned in.
  const [openAssignment, setOpenAssignment] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("swais_faculty_token");
    if (!token) return;
    fetch(withClass(`${API}/api/v1/assignments`), { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setAssignments((d.assignments || []).map(a => ({
        id: a.assignment_id,
        title: a.title,
        subject: a.subject,
        dueDate: a.due_date,
        submittedCount: a.submitted_count,
        totalStudents: a.total_students,
      }))))
      .catch(() => setAssignments([]));
  }, []);

  const coveredChapters = [...new Set(notes.map((n) => n.chapter))].length;
  const recentNotes = notes.slice(0, 3);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };

  const stats = [
    {
      label: "Total Notes",
      value: totalNotes,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      gradient: "linear-gradient(135deg,#6366F1,#8B5CF6)",
      bg: "#EEF2FF",
      text: "#6366F1",
    },
    {
      label: "Students",
      value: user?.totalStudents ?? "—",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      ),
      gradient: "linear-gradient(135deg,#8B5CF6,#06B6D4)",
      bg: "#F5F3FF",
      text: "#8B5CF6",
    },
    {
      label: "Chapters Covered",
      value: coveredChapters,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
      gradient: "linear-gradient(135deg,#06B6D4,#6366F1)",
      bg: "#ECFEFF",
      text: "#0891B2",
    },
    {
      label: "AI Status",
      value: "Active",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      gradient: "linear-gradient(135deg,#10B981,#06B6D4)",
      bg: "#ECFDF5",
      text: "#10B981",
    },
  ];

  const quickActions = [
    {
      href: "/dashboard/notes",
      label: "Create Note",
      desc: "Add new study material",
      gradient: "linear-gradient(135deg,#6366F1,#8B5CF6)",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
    },
    {
      href: "/dashboard/students",
      label: "View Students",
      desc: "Class roster & parents",
      gradient: "linear-gradient(135deg,#8B5CF6,#06B6D4)",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      ),
    },
    {
      href: "/dashboard/assessments",
      label: "Assessments",
      desc: "Tests & quiz results",
      gradient: "linear-gradient(135deg,#06B6D4,#6366F1)",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      href: "/dashboard/reports",
      label: "Reports",
      desc: "Student performance",
      gradient: "linear-gradient(135deg,#10B981,#06B6D4)",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">

      {/* ── Welcome Banner ─────────────────────────────────────── */}
      <div
        className="relative rounded-2xl p-6 sm:p-8 text-white overflow-hidden animate-gradient"
        style={{ background: "linear-gradient(135deg,#6366F1,#8B5CF6,#06B6D4,#6366F1)", backgroundSize: "300% 300%" }}
      >
        {/* Floating orbs */}
        <div className="absolute -right-12 -top-12 w-52 h-52 rounded-full opacity-20 animate-float"
          style={{ background: "rgba(255,255,255,0.3)", filter: "blur(2px)" }} />
        <div className="absolute right-16 bottom-0 w-28 h-28 rounded-full opacity-15 animate-float-slow"
          style={{ background: "rgba(255,255,255,0.25)", filter: "blur(1px)" }} />
        <div className="absolute left-1/2 top-0 w-16 h-16 rounded-full opacity-10 animate-float-fast"
          style={{ background: "rgba(255,255,255,0.4)" }} />

        {/* Dot grid overlay */}
        <div className="absolute inset-0 rounded-2xl dot-grid opacity-20" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold mb-3"
            style={{ background: "rgba(255,255,255,0.18)", backdropFilter: "blur(8px)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            AI-Powered Classroom
          </div>
          <p className="text-white/80 text-sm mb-1">Welcome back,</p>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            {user?.name || ""} 👋
          </h1>
          <p className="text-white/80 text-sm max-w-lg">
            {user?.class ? `Managing Class ${user.class}${user?.section ? `-${user.section}` : ""}` : ""}
            {user?.subject ? ` · ${user.subject}` : ""} &nbsp;·&nbsp;
            <span className="font-semibold text-white">{totalNotes} notes</span>
            {user?.totalStudents != null && (
              <>&nbsp;&amp;&nbsp;<span className="font-semibold text-white">{user.totalStudents} students</span></>
            )}
          </p>
        </div>
      </div>

      {/* ── Stats Grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-2xl p-5 hover:shadow-[0_12px_28px_rgba(99,102,241,0.14)] transition-all duration-300 cursor-default"
            style={{ border: "1px solid rgba(99,102,241,0.1)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm"
                style={{ background: stat.gradient }}>
                {stat.icon}
              </div>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: stat.text }} />
            </div>
            <p className="text-2xl font-bold" style={{ color: "#0F172A", fontFamily: "var(--font-space-grotesk)" }}>
              {stat.value}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* ── Content Grid ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Recent Notes */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6" style={{ border: "1px solid rgba(99,102,241,0.1)" }}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg ai-gradient flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h2 className="text-base font-bold" style={{ color: "#0F172A", fontFamily: "var(--font-space-grotesk)" }}>
                Recent Notes
              </h2>
            </div>
            <Link href="/dashboard/notes"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
              style={{ color: "#6366F1", background: "#EEF2FF" }}
              onMouseEnter={e => e.currentTarget.style.background = "#E0E7FF"}
              onMouseLeave={e => e.currentTarget.style.background = "#EEF2FF"}>
              View All →
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 rounded-xl border border-slate-100">
                  <div className="skeleton h-4 w-2/3 mb-2" />
                  <div className="skeleton h-3 w-1/3" />
                </div>
              ))}
            </div>
          ) : recentNotes.length > 0 ? (
            <div className="space-y-2.5">
              {recentNotes.map((note) => (
                <Link key={note.id} href="/dashboard/notes"
                  className="flex items-start justify-between gap-3 p-4 rounded-xl transition-all duration-200 group"
                  style={{ border: "1px solid #E2E8F0" }}
                  onMouseEnter={e => { e.currentTarget.style.border = "1px solid #A5B4FC"; e.currentTarget.style.background = "#EEF2FF40"; }}
                  onMouseLeave={e => { e.currentTarget.style.border = "1px solid #E2E8F0"; e.currentTarget.style.background = "transparent"; }}>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold truncate transition-colors" style={{ color: "#0F172A" }}>
                      {note.title}
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>{note.chapter}</p>
                  </div>
                  <span className="text-[11px] shrink-0" style={{ color: "#CBD5E1" }}>
                    {formatDate(note.updatedAt)}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-center py-8" style={{ color: "#94A3B8" }}>
              No notes yet. Create your first note!
            </p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid rgba(99,102,241,0.1)" }}>
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg ai-gradient flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h2 className="text-base font-bold" style={{ color: "#0F172A", fontFamily: "var(--font-space-grotesk)" }}>
              Quick Actions
            </h2>
          </div>
          <div className="space-y-2.5">
            {quickActions.map((action) => (
              <Link key={action.label} href={action.href}
                className="flex items-center gap-3 p-3.5 rounded-xl transition-all duration-200 group"
                style={{ border: "1px solid #E2E8F0" }}
                onMouseEnter={e => { e.currentTarget.style.border = "1px solid #A5B4FC"; e.currentTarget.style.background = "#EEF2FF30"; }}
                onMouseLeave={e => { e.currentTarget.style.border = "1px solid #E2E8F0"; e.currentTarget.style.background = "transparent"; }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 transition-transform group-hover:scale-110"
                  style={{ background: action.gradient }}>
                  {action.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#0F172A" }}>{action.label}</p>
                  <p className="text-xs" style={{ color: "#94A3B8" }}>{action.desc}</p>
                </div>
                <svg className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#6366F1" }}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Assignment Alerts ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Due Date Alerts */}
        <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid rgba(234,88,12,0.15)" }}>
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
              style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)" }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: "#0F172A", fontFamily: "var(--font-space-grotesk)" }}>
                Due Date Alerts
              </h2>
              <p className="text-xs" style={{ color: "#94A3B8" }}>Upcoming assignment deadlines</p>
            </div>
            {assignments.filter(a => getDueDays(a.dueDate) <= 1).length > 0 && (
              <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full animate-pulse"
                style={{ background: "#FEF2F2", color: "#EF4444" }}>
                {assignments.filter(a => getDueDays(a.dueDate) <= 1).length} urgent
              </span>
            )}
          </div>
          <div className="space-y-2.5">
            {assignments.length === 0 && (
              <p className="text-sm text-center py-6" style={{ color: "#94A3B8" }}>No upcoming assignments.</p>
            )}
            {[...assignments].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)).map(a => {
              const days = getDueDays(a.dueDate);
              const isUrgent = days <= 1;
              return (
                <div key={a.id}
                  className="flex items-center justify-between gap-3 p-3.5 rounded-xl"
                  style={{
                    border: `1px solid ${isUrgent ? "rgba(239,68,68,0.2)" : "#E2E8F0"}`,
                    background: isUrgent ? "#FEF2F210" : "transparent",
                  }}>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "#0F172A" }}>{a.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>{a.subject} · {new Date(a.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                  </div>
                  <DueLabel days={days} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Completion Alerts */}
        <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid rgba(99,102,241,0.15)" }}>
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
              style={{ background: "linear-gradient(135deg,#6366F1,#10B981)" }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: "#0F172A", fontFamily: "var(--font-space-grotesk)" }}>
                Completion Alerts
              </h2>
              <p className="text-xs" style={{ color: "#94A3B8" }}>Assignment submission status</p>
            </div>
            {assignments.filter(a => a.submittedCount < a.totalStudents).length > 0 && (
              <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: "#EEF2FF", color: "#6366F1" }}>
                {assignments.filter(a => a.submittedCount < a.totalStudents).length} pending
              </span>
            )}
          </div>
          <div className="space-y-2.5">
            {assignments.length === 0 && (
              <p className="text-sm text-center py-6" style={{ color: "#94A3B8" }}>No submission data yet.</p>
            )}
            {assignments.map(a => {
              const pct = Math.round((a.submittedCount / a.totalStudents) * 100);
              const allDone = a.submittedCount === a.totalStudents;
              const pendingCount = a.totalStudents - a.submittedCount;
              return (
                <div key={a.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpenAssignment({ id: a.id, title: a.title })}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenAssignment({ id: a.id, title: a.title }); } }}
                  title="View submissions"
                  className="p-3.5 rounded-xl cursor-pointer transition-colors hover:bg-slate-50"
                  style={{ border: "1px solid #E2E8F0" }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold truncate" style={{ color: "#0F172A" }}>{a.title}</p>
                    {allDone ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-2"
                        style={{ background: "#ECFDF5", color: "#10B981" }}>All Submitted ✓</span>
                    ) : (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ml-2"
                        style={{ background: "#FFF7ED", color: "#D97706" }}>{pendingCount} pending</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#EEF2FF" }}>
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: allDone ? "#10B981" : "linear-gradient(90deg,#6366F1,#8B5CF6)" }} />
                    </div>
                    <span className="text-xs font-bold shrink-0" style={{ color: allDone ? "#10B981" : "#6366F1" }}>
                      {a.submittedCount}/{a.totalStudents}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {openAssignment && (
        <SubmissionsModal
          assignmentId={openAssignment.id}
          title={openAssignment.title}
          onClose={() => setOpenAssignment(null)}
        />
      )}
    </div>
  );
}
