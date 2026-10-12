"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { LOGIN_URL } from "@/lib/api";

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    label: "Notes/Chapters",
    href: "/dashboard/notes",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    label: "Students",
    href: "/dashboard/students",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
      </svg>
    ),
  },
  {
    label: "Marks Entry",
    href: "/dashboard/marks-entry",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    label: "Assessments",
    href: "/dashboard/assessments",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    label: "Reports",
    href: "/dashboard/reports",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    label: "Lesson Planner",
    href: "/dashboard/lesson-planner",
    badge: "AI",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  {
    label: "Auto Test",
    href: "/dashboard/auto-test",
    badge: "AI",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  /* Auto Correct — hidden from the menu (page & route kept intact; re-enable by uncommenting)
  {
    label: "Auto Correct",
    href: "/dashboard/auto-correct",
    badge: "AI",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  */
  {
    label: "Translator",
    href: "/dashboard/translator",
    badge: "AI",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
      </svg>
    ),
  },
  {
    label: "Audio Translator",
    href: "/dashboard/audio-translator",
    badge: "AI",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-7V4a3 3 0 00-3-3H9" />
      </svg>
    ),
  },
];

export default function Sidebar({ isOpen, onClose }) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    window.location.href = LOGIN_URL;
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={onClose} aria-hidden="true" />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 flex flex-col transition-transform duration-300 ease-in-out dot-grid ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
        style={{ background: "#0F172A" }}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <img
            src={`${process.env.NODE_ENV === "production" ? "/faculty" : ""}/sgs-logo.png`}
            alt="SGS Senior Secondary School"
            className="w-10 h-10 rounded-full object-cover shrink-0"
          />
          <div className="flex-1 min-w-0">
            <h1 className="text-[15px] font-bold leading-tight tracking-tight ai-gradient-text">SGS Portal</h1>
            <p className="text-[10px] leading-tight mt-0.5" style={{ color: "#94A3B8" }}>AI-Powered Faculty Portal</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg lg:hidden cursor-pointer" style={{ color: "#475569" }} aria-label="Close sidebar">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
          <p className="px-3 mb-3 text-[9px] font-semibold uppercase tracking-widest" style={{ color: "#94A3B8" }}>
            Main Menu
          </p>

          {navItems.map((item, idx) => {
            const isActive = item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
            const isFirstAI = item.badge === "AI" && (idx === 0 || navItems[idx - 1].badge !== "AI");

            return (
              <div key={item.label}>
              {isFirstAI && (
                <p className="px-3 mt-4 mb-3 text-[9px] font-semibold uppercase tracking-widest" style={{ color: "#94A3B8" }}>
                  AI Features
                </p>
              )}
              <Link
                href={item.href}
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group"
                style={isActive
                  ? { background: "rgba(99,102,241,0.15)", color: "#A5B4FC", boxShadow: "inset 3px 0 0 #6366F1" }
                  : { color: "#64748B" }
                }
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "#CBD5E1"; } }}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#64748B"; } }}
              >
                <span style={{ color: isActive ? "#818CF8" : "inherit" }}>{item.icon}</span>
                <span>{item.label}</span>
                {item.badge && (
                  <span className="ml-auto px-1.5 py-0.5 rounded-md text-[9px] font-bold"
                    style={{ background: "linear-gradient(135deg,#6366F1,#8B5CF6)", color: "white" }}>
                    {item.badge}
                  </span>
                )}
                {isActive && !item.badge && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400" />}
              </Link>
              </div>
            );
          })}
        </nav>

        {/* Footer — AI badge */}
        <div className="px-4 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl" style={{ background: "rgba(99,102,241,0.1)" }}>
            <div className="w-7 h-7 rounded-lg ai-gradient flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <p className="text-[11px] font-semibold" style={{ color: "#A5B4FC" }}>AI Active</p>
              <p className="text-[9px]" style={{ color: "#475569" }}>Powered by SWAIS Intelligence</p>
            </div>
          </div>

          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full mt-3 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-all duration-200"
            style={{ color: "#94A3B8" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.12)"; e.currentTarget.style.color = "#FCA5A5"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#94A3B8"; }}
          >
            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Logout confirmation — rendered via portal so the sidebar's transform
          doesn't hijack the fixed positioning */}
      {showLogoutConfirm && createPortal(
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center px-4"
          style={{ background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
          onClick={() => !loggingOut && setShowLogoutConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
            style={{ background: "#FFFFFF", border: "1px solid rgba(99,102,241,0.1)" }}
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sidebar-logout-title"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#FEF2F2" }}>
                <svg className="w-5 h-5" fill="none" stroke="#EF4444" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </div>
              <h2 id="sidebar-logout-title" className="text-base font-bold" style={{ color: "#0F172A", fontFamily: "var(--font-space-grotesk)" }}>
                Sign out?
              </h2>
            </div>
            <p className="text-sm mb-5" style={{ color: "#64748B" }}>
              You will be signed out and taken back to the SGS Portal login page.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                disabled={loggingOut}
                className="px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-all"
                style={{ color: "#64748B", background: "#F1F5F9" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#E2E8F0"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#F1F5F9"; }}
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-all"
                style={{ color: "#FFFFFF", background: "#EF4444", opacity: loggingOut ? 0.7 : 1 }}
                onMouseEnter={e => { if (!loggingOut) e.currentTarget.style.background = "#DC2626"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#EF4444"; }}
              >
                {loggingOut ? "Signing out..." : "Yes, Sign Out"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
