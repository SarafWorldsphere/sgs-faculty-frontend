"use client";

/**
 * Papers and blueprints kept from before.
 *
 * Two lists side by side because they answer two different questions: "print
 * the one I made last week" and "set up another one like the last one".
 *
 * There is no Assign here, and that is deliberate. Assigning wrote rows into
 * the assignment tables that nothing reads — there is no student app, and the
 * parent app does not list assignments — so a class of forty would sit at
 * "Assigned" forever. Printing is the whole flow until students have somewhere
 * to receive a paper.
 */

import { useEffect, useState } from "react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { fetchQuestionPapers, fetchQuestionPaper, deleteQuestionPaper } from "@/lib/api";
import { listBlueprints, deleteBlueprint, describeBlueprint } from "@/lib/savedBlueprints";

const card = {
  background: "#fff", borderRadius: 16,
  border: "1px solid rgba(99,102,241,0.1)", padding: "20px 22px",
};

const small = {
  padding: "5px 10px", borderRadius: 8, fontSize: 11.5, fontWeight: 600,
  cursor: "pointer", border: "1px solid #C7D2FE", color: "#6366F1", background: "#fff",
};

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

function Head({ title, hint, right }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: "#0F172A",
                     fontFamily: "var(--font-space-grotesk)" }}>{title}</h2>
        {right}
      </div>
      {hint && <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#64748B" }}>{hint}</p>}
    </div>
  );
}

export default function SavedPapers({ refreshKey, onPrint, onUseBlueprint }) {
  const [papers, setPapers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId]   = useState(null);
  const [target, setTarget]   = useState(null);   // paper pending delete
  const [error, setError]     = useState("");
  const [tick, setTick]       = useState(0);

  const [blueprints, setBlueprints] = useState([]);

  // `loading` starts true and is only ever cleared — a refresh after Save or
  // Delete replaces the list in place rather than flashing the skeleton.
  useEffect(() => {
    let alive = true;
    fetchQuestionPapers()
      .then((p) => { if (alive) { setPapers(p); setError(""); } })
      .catch((err) => { if (alive) setError(err.message || "Couldn't load saved papers."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [refreshKey, tick]);

  // localStorage is only readable in the browser, so never during the server
  // render — read it after mount.
  useEffect(() => { setBlueprints(listBlueprints()); }, [refreshKey]);

  // List rows are summaries; printing needs the full paper.
  const withFull = async (id, mode) => {
    setBusyId(id);
    try { onPrint(await fetchQuestionPaper(id), mode); }
    catch (err) { setError(err.message || "Couldn't open the paper."); }
    finally { setBusyId(null); }
  };

  const confirmDelete = async () => {
    if (!target) return;
    setBusyId(target.paper_id);
    try {
      await deleteQuestionPaper(target.paper_id);
      setTarget(null);
      setTick((t) => t + 1);
    } catch (err) {
      setError(err.message || "Couldn't delete the paper.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "flex-start" }}>

      <div style={{ ...card, flex: "1 1 420px", minWidth: 0 }}>
        <Head
          title="Saved papers"
          hint="Every paper you kept, newest first."
          right={<span style={{ fontSize: 11.5, color: "#94A3B8" }}>{papers.length} saved</span>}
        />
        {error && <p style={{ margin: "0 0 10px", fontSize: 12, color: "#DC2626" }}>{error}</p>}

        {loading ? (
          <div style={{ height: 48, borderRadius: 12, background: "#F1F5F9" }} className="animate-pulse" />
        ) : papers.length === 0 ? (
          <p style={{ padding: "18px 0", textAlign: "center", fontSize: 13, color: "#94A3B8" }}>
            Nothing saved yet — generate a paper and click Save.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {papers.map((p) => (
              <li key={p.paper_id} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center",
                                            padding: "11px 0", borderTop: "1px solid #F1F5F9" }}>
                <div style={{ flex: "1 1 180px", minWidth: 0 }}>
                  <b style={{ display: "block", fontSize: 13, color: "#0F172A", fontWeight: 600,
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</b>
                  <span style={{ display: "block", fontSize: 11.5, color: "#94A3B8" }}>
                    {[p.subject, p.total_marks != null ? `${p.total_marks} marks` : null,
                      p.question_count ? `${p.question_count} questions` : null,
                      fmtDate(p.created_at)].filter(Boolean).join(" · ")}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button type="button" disabled={busyId === p.paper_id}
                    onClick={() => withFull(p.paper_id, "paper")} style={small}>Paper</button>
                  <button type="button" disabled={busyId === p.paper_id}
                    onClick={() => withFull(p.paper_id, "key")}
                    style={{ ...small, borderColor: "#E2E8F0", color: "#475569" }}>Key</button>
                  <button type="button" disabled={busyId === p.paper_id}
                    onClick={() => setTarget(p)} aria-label={`Delete ${p.title}`}
                    style={{ ...small, borderColor: "#FECACA", color: "#DC2626" }}>✕</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ ...card, flex: "1 1 300px", minWidth: 0 }}>
        <Head
          title="Saved blueprints"
          hint="Start the next paper from one of these instead of setting it up again."
        />
        {blueprints.length === 0 ? (
          <p style={{ padding: "18px 0", textAlign: "center", fontSize: 13, color: "#94A3B8" }}>
            None yet — set up a paper and click Save as blueprint.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {blueprints.map((b) => (
              <li key={b.id} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center",
                                      padding: "11px 0", borderTop: "1px solid #F1F5F9" }}>
                <div style={{ flex: "1 1 150px", minWidth: 0 }}>
                  <b style={{ display: "block", fontSize: 13, color: "#0F172A", fontWeight: 600,
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</b>
                  <span style={{ display: "block", fontSize: 11.5, color: "#94A3B8" }}>{describeBlueprint(b)}</span>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button type="button" onClick={() => onUseBlueprint(b)} style={small}>Use</button>
                  <button type="button" aria-label={`Delete ${b.name}`}
                    onClick={() => setBlueprints(deleteBlueprint(b.id))}
                    style={{ ...small, borderColor: "#FECACA", color: "#DC2626" }}>✕</button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p style={{ margin: "14px 0 0", padding: "11px 13px", borderRadius: 11, background: "#F8FAFC",
                    border: "1px solid #E2E8F0", fontSize: 11.5, lineHeight: 1.55, color: "#64748B" }}>
          Blueprints are kept in this browser, not on the server — they are how you like to shape a
          paper, not school data.
        </p>
      </div>

      <ConfirmDialog
        isOpen={!!target}
        title="Delete this paper?"
        message={target ? `"${target.title}" will be removed from your saved papers.` : ""}
        confirmLabel="Delete" danger
        busy={!!target && busyId === target.paper_id}
        onConfirm={confirmDelete}
        onCancel={() => setTarget(null)}
      />
    </div>
  );
}
