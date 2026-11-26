"use client";

/**
 * Notes & Chapters — single section with two tabs.
 *   • Chapters tab  → browse chapters; opening one goes to the full reader
 *   • Notes tab     → create / manage notes
 *
 * Active tab is driven by the URL (?tab=chapters|notes) so it's deep-linkable
 * (e.g. the chapter reader sends the user to ?tab=notes after creating a note).
 */

import { useState, useEffect } from "react";
import ChaptersView from "@/components/chapters/ChaptersView";
import NotesView from "@/components/notes/NotesView";

const TABS = [
  { key: "chapters", label: "Chapters" },
  { key: "notes",    label: "Notes" },
];

export default function NotesChaptersPage() {
  const [tab, setTab] = useState("chapters");

  // Read the initial tab from the URL (?tab=notes) on mount.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "notes" || t === "chapters") setTab(t);
  }, []);

  const switchTab = (key) => {
    setTab(key);
    /* Keep the URL in sync without a full navigation.
     *
     * The path comes from window.location, not a literal: next.config sets
     * basePath '/faculty', so this page is served at /faculty/dashboard/notes.
     * Writing "/dashboard/notes" here dropped that prefix from the address
     * bar, and the next full page load — switching class calls
     * window.location.reload() — asked the server for a path nginx does not
     * route, which answered 404. */
    window.history.replaceState(null, "", `${window.location.pathname}?tab=${key}`);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <div className="w-8 h-8 rounded-lg ai-gradient flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "#F1F5F9", fontFamily: "var(--font-space-grotesk)" }}>Notes</h1>
        </div>
        <p className="text-sm pl-10" style={{ color: "#94A3B8" }}>
          Read chapters and manage your notes
        </p>
      </div>

      {/* Tab bar — two equal buttons; full-width on mobile, compact on desktop */}
      <div className="flex w-full max-w-md gap-3">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => switchTab(t.key)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-center transition-all cursor-pointer"
              style={active
                ? { background: "linear-gradient(135deg,#6366F1,#8B5CF6)", color: "white", boxShadow: "0 4px 14px rgba(99,102,241,0.30)" }
                : { background: "white", color: "#64748B", border: "1px solid rgba(99,102,241,0.15)" }}
              onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = "#F8FAFC"; e.currentTarget.style.color = "#475569"; } }}
              onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = "white"; e.currentTarget.style.color = "#64748B"; } }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Active tab content */}
      {tab === "chapters" ? <ChaptersView /> : <NotesView />}
    </div>
  );
}
