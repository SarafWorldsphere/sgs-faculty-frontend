"use client";

/**
 * SubmissionsModal — who an assignment went to, and what each of them turned in.
 *
 * The dashboard used to show only "12/34" with no way to see who the 12 were.
 * This lists every student the assignment was given to, submitted first, with
 * their submission text, link or file name and marks where present.
 *
 * The file itself is not fetched here — only whether one exists and its name.
 */

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import { fetchAssignmentStudents } from "@/lib/api";

const fmt = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

const kb = (bytes) => (bytes ? `${Math.max(1, Math.round(bytes / 1024))} KB` : null);

export default function SubmissionsModal({ assignmentId, title, onClose }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [tab, setTab]         = useState("submitted");

  useEffect(() => {
    if (!assignmentId) return;
    let alive = true;
    fetchAssignmentStudents(assignmentId)
      .then(d => { if (alive) { setData(d); setError(""); } })
      .catch(err => { if (alive) setError(err.message || "Could not load submissions."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [assignmentId]);

  const all = data?.students ?? [];
  const submitted = all.filter(s => s.submitted_at);
  const pending   = all.filter(s => !s.submitted_at);
  const rows      = tab === "submitted" ? submitted : pending;

  const tabBtn = (key, label, count) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
      style={tab === key
        ? { background: "#EEF2FF", color: "#4F46E5" }
        : { background: "transparent", color: "#64748B" }}
    >
      {label} ({count})
    </button>
  );

  return (
    <Modal isOpen={!!assignmentId} onClose={onClose} title={title || "Submissions"} maxWidth="max-w-2xl">
      <div className="px-6 py-4">
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "#F1F5F9" }} />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm py-8 text-center" style={{ color: "#DC2626" }}>{error}</p>
        ) : (
          <>
            <div className="flex items-center gap-1 mb-3">
              {tabBtn("submitted", "Submitted", submitted.length)}
              {tabBtn("pending", "Not submitted", pending.length)}
            </div>

            {rows.length === 0 ? (
              <p className="text-sm py-10 text-center" style={{ color: "#94A3B8" }}>
                {tab === "submitted" ? "No submissions yet." : "Everyone has submitted."}
              </p>
            ) : (
              <ul className="divide-y max-h-[55vh] overflow-y-auto" style={{ borderColor: "#F1F5F9" }}>
                {rows.map(s => (
                  <li key={s.student_id} className="py-3 flex gap-3">
                    <span
                      className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-[11px] font-bold"
                      style={{ background: "#F1F5F9", color: "#475569" }}
                    >
                      {s.roll_no || "—"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2 flex-wrap">
                        <p className="text-sm font-semibold" style={{ color: "#0F172A" }}>{s.full_name}</p>
                        {s.submitted_at && (
                          <span className="text-[11px]" style={{ color: "#94A3B8" }}>{fmt(s.submitted_at)}</span>
                        )}
                      </div>

                      {s.submission_text && (
                        <p className="text-xs mt-1 whitespace-pre-wrap" style={{ color: "#475569" }}>
                          {s.submission_text}
                        </p>
                      )}

                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {s.submitted_file_name && (
                          <span className="text-xs" style={{ color: "#6366F1" }}>
                            📎 {s.submitted_file_name}{kb(s.submitted_file_size) ? ` · ${kb(s.submitted_file_size)}` : ""}
                          </span>
                        )}
                        {s.submission_link && (
                          <a
                            href={s.submission_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs underline"
                            style={{ color: "#6366F1" }}
                          >
                            Open link
                          </a>
                        )}
                        {s.marks_obtained != null && (
                          <span className="text-xs font-semibold" style={{ color: "#10B981" }}>
                            {s.marks_obtained}{s.total_marks != null ? ` / ${s.total_marks}` : ""}
                          </span>
                        )}
                        {s.submitted_at && !s.submission_text && !s.submitted_file_name && !s.submission_link && (
                          <span className="text-xs" style={{ color: "#94A3B8" }}>Marked submitted, no content attached</span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
