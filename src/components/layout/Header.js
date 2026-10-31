"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import ClassSelector from "@/components/layout/ClassSelector";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function Header({ onMenuToggle }) {
  const { user, classes } = useAuth();
  const router = useRouter();
  const [notices, setNotices] = useState([]);
  // The bell used to show a permanent red dot whenever any announcement
  // existed. It now counts announcements newer than the last time this
  // teacher opened the panel. Stored per teacher so a shared machine does
  // not clear someone else's badge; localStorage only, so it is per device.
  const [lastSeen, setLastSeen] = useState(() => {
    if (typeof window === "undefined") return null;
    try { return localStorage.getItem(`swais_notices_seen_${user?.email || "anon"}`); }
    catch { return null; }   // private mode — badge then shows everything
  });
  const [showNotices, setShowNotices] = useState(false);

  const seenKey = `swais_notices_seen_${user?.email || "anon"}`;

  // A notice with no date can't be compared, so it counts as unread once and
  // stops counting after the panel is opened.
  const unreadCount = notices.filter(n => {
    if (!lastSeen) return true;
    const when = n.notice_date || n.created_at;
    return when ? new Date(when) > new Date(lastSeen) : false;
  }).length;

  const openNotices = () => {
    setShowNotices(v => {
      const next = !v;
      if (next) {
        const now = new Date().toISOString();
        try { localStorage.setItem(seenKey, now); } catch { /* ignore */ }
        setLastSeen(now);
      }
      return next;
    });
  };

  useEffect(() => {
    const token = localStorage.getItem("swais_faculty_token");
    if (!token) return;
    fetch(`${API}/api/v1/notices`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setNotices(d.notices || []))
      .catch(() => setNotices([]));
  }, []);


  return (
    <header
      className="sticky top-0 z-30 px-4 sm:px-6 py-3"
      style={{ background: "rgba(248,250,252,0.88)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "1px solid rgba(99,102,241,0.1)" }}
    >
      <div className="flex items-center justify-between">
        {/* Left */}
        <div className="flex items-center gap-3">
          <button onClick={onMenuToggle} className="p-2 rounded-xl lg:hidden cursor-pointer transition-all" style={{ color: "#94A3B8" }}
            onMouseEnter={e => { e.currentTarget.style.background="#EEF2FF"; e.currentTarget.style.color="#6366F1"; }}
            onMouseLeave={e => { e.currentTarget.style.background="transparent"; e.currentTarget.style.color="#94A3B8"; }}
            aria-label="Toggle sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="hidden sm:flex items-center gap-2.5 flex-wrap">
            {user?.subject && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold" style={{ background: "#EEF2FF", color: "#6366F1" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                {user.subject}
              </span>
            )}
            {/* A teacher with several classes picks one here; everyone else sees
                the same static chip as before. */}
            {(classes?.length ?? 0) > 1 ? (
              <>
                <span style={{ color: "#CBD5E1" }}>·</span>
                <ClassSelector />
              </>
            ) : user?.class ? (
              <>
                <span style={{ color: "#CBD5E1" }}>·</span>
                <span className="text-xs font-medium" style={{ color: "#64748B" }}>
                  Class {user.class}{user?.section ? `-${user.section}` : ""}
                </span>
              </>
            ) : null}
            {user?.totalStudents != null && (
              <>
                <span style={{ color: "#CBD5E1" }}>·</span>
                <span className="flex items-center gap-1 text-xs font-medium" style={{ color: "#64748B" }}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13.5 7a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                  {user.totalStudents} Students
                </span>
              </>
            )}
            <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: "linear-gradient(135deg,#EEF2FF,#F5F3FF)", color: "#8B5CF6", border: "1px solid #DDD6FE" }}>
              ⚡ AI Active
            </span>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col text-right">
            <p className="text-sm font-semibold leading-tight" style={{ color: "#0F172A", fontFamily: "var(--font-space-grotesk)" }}>
              {user?.name || ""}
            </p>
            <p className="text-[11px] leading-tight" style={{ color: "#94A3B8" }}>{user?.email || ""}</p>
          </div>

          {/* Announcements bell (read-only) */}
          <div className="relative">
            <button onClick={openNotices}
              className="relative p-2 rounded-xl cursor-pointer transition-all" style={{ color: "#94A3B8" }}
              onMouseEnter={e => { e.currentTarget.style.color="#6366F1"; e.currentTarget.style.background="#EEF2FF"; }}
              onMouseLeave={e => { e.currentTarget.style.color="#94A3B8"; e.currentTarget.style.background="transparent"; }}
              aria-label="Announcements" title="Announcements">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ background: "#EF4444" }}
                  aria-label={`${unreadCount} unread announcements`}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {showNotices && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotices(false)} />
                <div className="absolute right-0 mt-2 w-80 max-h-[420px] overflow-y-auto rounded-2xl z-50"
                  style={{ background: "#fff", border: "1px solid #E2E8F0", boxShadow: "0 20px 45px rgba(15,23,42,0.15)" }}>
                  <div className="px-4 py-3 sticky top-0" style={{ background: "#fff", borderBottom: "1px solid #F1F5F9" }}>
                    <p className="text-sm font-bold" style={{ color: "#0F172A", fontFamily: "var(--font-space-grotesk)" }}>Announcements</p>
                  </div>
                  {notices.length === 0 ? (
                    <p className="px-4 py-10 text-center text-sm" style={{ color: "#94A3B8" }}>No announcements yet.</p>
                  ) : (
                    <ul>
                      {notices.map(n => (
                        <li key={n.notice_id} className="px-4 py-3" style={{ borderBottom: "1px solid #F8FAFC" }}>
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold" style={{ color: "#0F172A" }}>{n.title}</p>
                            {n.notice_date && (
                              <span className="text-[11px] shrink-0 mt-0.5" style={{ color: "#94A3B8" }}>
                                {new Date(n.notice_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                              </span>
                            )}
                          </div>
                          {n.text && <p className="text-xs mt-1" style={{ color: "#64748B" }}>{n.text}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Avatar with gradient ring */}
          <div className="relative">
            <div className="absolute -inset-0.5 rounded-full ai-gradient opacity-80 blur-[1px]" />
            <div className="relative w-9 h-9 rounded-full ai-gradient flex items-center justify-center text-white text-sm font-bold">
              {user?.avatar || ""}
            </div>
          </div>

        </div>
      </div>

    </header>
  );
}
