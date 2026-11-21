"use client";

/**
 * Chapter Reader — shows the full text of a single chapter.
 * Provides a "Write Notes" action that jumps to the Notes page with this
 * chapter pre-selected, and a "Back" link to the chapter list.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { fetchChapterDetail, fetchChapterFiles } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import NoteForm from "@/components/notes/NoteForm";

export default function ChapterReaderPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [chapter, setChapter] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notesOpen, setNotesOpen] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setIsLoading(false); return; }
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchChapterDetail(id);
        setChapter(data);
      } catch (err) {
        console.error("Chapter detail error:", err.message);
        setChapter(null);
        setError(err.status === 404 ? "This chapter is not available." : (err.message || "Unable to load the chapter."));
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [id, user, authLoading]);

  /* A chapter can have no text and still have study material: the text lives
   * in chapter content, the PDFs are separate file records. Reading only the
   * first meant "Read Chapter" said the chapter was empty while the same
   * chapter's PDF was sitting under Study Material, openable from the list.
   *
   * Only fetched when there is no text, so chapters that do have content cost
   * nothing extra. null = not looked yet, [] = looked and there is none.
   */
  const [material, setMaterial] = useState(null);

  useEffect(() => {
    if (!chapter || chapter.content) return;
    let cancelled = false;
    fetchChapterFiles(id)
      .then((files) => { if (!cancelled) setMaterial(files || []); })
      .catch(() => { if (!cancelled) setMaterial([]); });
    return () => { cancelled = true; };
  }, [chapter, id]);

  const title = chapter?.content_title || chapter?.chapter_name || "Chapter";
  const chapterLabel = chapter?.content_title || chapter?.chapter_name || "";

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      {/* Back */}
      <Link href="/dashboard/notes?tab=chapters"
        className="inline-flex items-center gap-2 text-sm font-semibold"
        style={{ color: "#6366F1" }}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        All chapters
      </Link>

      {isLoading ? (
        <div className="space-y-3">
          <div className="h-16 rounded-2xl bg-white animate-pulse" style={{ border: "1px solid rgba(99,102,241,0.1)" }} />
          <div className="h-96 rounded-2xl bg-white animate-pulse" style={{ border: "1px solid rgba(99,102,241,0.1)" }} />
        </div>
      ) : error || !chapter ? (
        <div className="text-center py-20 bg-white rounded-2xl" style={{ border: "1px solid rgba(99,102,241,0.1)" }}>
          <p className="text-sm font-medium" style={{ color: "#94A3B8" }}>{error || "Chapter not found."}</p>
          <Link href="/dashboard/notes?tab=chapters" className="inline-block mt-3 text-sm font-semibold" style={{ color: "#6366F1" }}>
            Back to chapters
          </Link>
        </div>
      ) : (
        <>
          {/* Title bar + Write Notes */}
          <div className="rounded-2xl p-5 text-white relative overflow-hidden"
            style={{ background: "linear-gradient(135deg,#6366F1,#8B5CF6,#06B6D4)" }}>
            <div className="absolute inset-0 dot-grid opacity-20" />
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-widest opacity-70">Chapter</p>
                <h1 className="text-xl font-bold leading-tight" style={{ fontFamily: "var(--font-space-grotesk)" }}>{title}</h1>
              </div>
              <button type="button" onClick={() => setNotesOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold shrink-0 transition-all cursor-pointer"
                style={{ background: "white", color: "#6366F1" }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Write Notes
              </button>
            </div>
          </div>

          {/* Content */}
          <article className="bg-white rounded-2xl p-6 sm:p-8" style={{ border: "1px solid rgba(99,102,241,0.1)" }}>
            {chapter.content ? (
              <div
                className="text-[15px] leading-7 whitespace-pre-wrap"
                style={{ color: "#334155", fontFamily: "var(--font-geist-sans, system-ui)" }}
              >
                {chapter.content}
              </div>
            ) : material === null ? (
              <p className="text-sm" style={{ color: "#94A3B8" }}>Loading study material…</p>
            ) : material.length > 0 ? (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#6366F1" }}>
                  Study Material
                </p>
                <ul className="flex flex-col gap-2">
                  {material.map((f) => (
                    <li key={f.file_id}>
                      <a href={f.view_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all"
                        style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", color: "#0F172A" }}>
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "#6366F1" }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span className="truncate">{f.file_name}</span>
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="text-xs mt-3" style={{ color: "#94A3B8" }}>
                  This chapter has no typed text yet — opening the study material instead.
                </p>
              </div>
            ) : (
              <p className="text-sm" style={{ color: "#94A3B8" }}>This chapter has no content yet.</p>
            )}
          </article>

          {/* There used to be a second Write Notes button here, below the
              content. Teachers read the pair as a duplicate rather than as a
              convenience, so only the one in the header remains — it is visible
              without scrolling and does the same thing. */}
        </>
      )}

      {/* Note form modal — opens in place on the chapter.
          Cancel/close keeps you here; a successful create goes to Notes. */}
      <NoteForm
        isOpen={notesOpen}
        onClose={() => setNotesOpen(false)}
        initialChapter={chapterLabel}
        onCreated={() => { setNotesOpen(false); router.push("/dashboard/notes?tab=notes"); }}
      />
    </div>
  );
}
