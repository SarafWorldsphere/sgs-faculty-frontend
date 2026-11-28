"use client";

/**
 * ChaptersView — the list of chapters (used inside the Notes/Chapters tabbed page).
 * Clicking a chapter opens the full reading view at /dashboard/chapters/[id].
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchChapters } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import StudyMaterial from "@/components/chapters/StudyMaterial";

export default function ChaptersView() {
  const { user, isLoading: authLoading, activeClassId } = useAuth();
  const [chapters, setChapters] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setChapters([]); setIsLoading(false); return; }
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchChapters();
        setChapters(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Chapters API error:", err.message);
        setChapters([]);
        setError(err.message || "Unable to load chapters.");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [user, authLoading, activeClassId]);

  // The chapter list below the study-material panel, which always stays mounted.
  const renderChapters = () => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-white animate-pulse" style={{ border: "1px solid rgba(99,102,241,0.1)" }} />
          ))}
        </div>
      );
    }

    if (chapters.length === 0) {
      return (
        <div className="text-center py-20 bg-white rounded-2xl" style={{ border: "1px solid rgba(99,102,241,0.1)" }}>
        <div className="w-16 h-16 rounded-2xl ai-gradient flex items-center justify-center mx-auto mb-4 opacity-40">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13" />
          </svg>
        </div>
        <p className="text-sm font-medium" style={{ color: "#94A3B8" }}>
          {error ? "Chapters not available right now." : "No chapters found."}
        </p>
        <p className="text-xs mt-1" style={{ color: "#CBD5E1" }}>
          {error ? "Please try again shortly." : "Chapters added by the school will appear here."}
        </p>
      </div>
      );
    }

    // Grouped by class and subject, in the order the backend sent them.
    //
    // One flat list was the complaint: a teacher taking several classes saw
    // every chapter together with nothing saying which class or subject each
    // belonged to, and two chapters called "Chapter 3" were indistinguishable.
    // Headings do the organising; the chip on each card means a chapter is
    // still identifiable once you have scrolled past its heading.
    const groups = [];
    const byKey = new Map();
    for (const ch of chapters) {
      const key = `${ch.class_id ?? "-"}|${ch.subject_id ?? "-"}`;
      if (!byKey.has(key)) {
        const group = {
          key,
          className: ch.class_name || null,
          subjectName: ch.subject_name || null,
          items: [],
        };
        byKey.set(key, group);
        groups.push(group);
      }
      byKey.get(key).items.push(ch);
    }

    // Only worth a heading when there is more than one group. A teacher with
    // a single class and subject should not be made to read a label that
    // says what the whole screen already says.
    const showHeadings = groups.length > 1;

    return (
    <div className="flex flex-col gap-8">
      {groups.map((group) => (
        <section key={group.key}>
          {showHeadings && (
            <h3 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: "#64748B" }}>
              {[group.className, group.subjectName].filter(Boolean).join(" · ") || "Unassigned"}
              <span className="ml-2 font-medium normal-case" style={{ color: "#94A3B8" }}>
                {group.items.length} chapter{group.items.length === 1 ? "" : "s"}
              </span>
            </h3>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {group.items.map((ch) => {
        const title = ch.content_title || ch.chapter_name || `Chapter ${ch.chapter_id}`;
        return (
          <Link
            key={ch.chapter_id}
            href={`/dashboard/chapters/${ch.chapter_id}`}
            className="group flex flex-col justify-between gap-4 p-5 rounded-2xl bg-white transition-all"
            style={{ border: "1px solid rgba(99,102,241,0.1)" }}
            onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 8px 24px rgba(99,102,241,0.12)")}
            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
          >
            <div className="flex items-start gap-3">
              <span className="w-9 h-9 rounded-xl ai-gradient flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13" />
                </svg>
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-snug" style={{ color: "#0F172A" }}>{title}</p>
                {ch.chapter_name && ch.content_title && ch.chapter_name !== ch.content_title && (
                  <p className="text-xs mt-0.5 truncate" style={{ color: "#94A3B8" }}>{ch.chapter_name}</p>
                )}
                {(ch.class_name || ch.subject_name) && (
                  <p className="text-[11px] mt-1 truncate font-medium" style={{ color: "#6366F1" }}>
                    {[ch.class_name, ch.subject_name].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold self-start px-3 py-1.5 rounded-lg"
              style={{ background: "#EEF2FF", color: "#6366F1" }}>
              Read chapter
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </Link>
        );
      })}
          </div>
        </section>
      ))}
    </div>
    );
  };

  return (
    <div>
      <StudyMaterial />
      {renderChapters()}
    </div>
  );
}
