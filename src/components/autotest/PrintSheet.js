"use client";

/**
 * The printed paper.
 *
 * One hidden sheet for the whole page: set `paper` to print it, and the sheet
 * mounts, prints and unmounts on afterprint. Being the only `.qp-sheet` on the
 * page means nothing else can leak into the printout.
 *
 * `mode` picks which of the two printouts this is. The question paper carries
 * no answers at all — not hidden with CSS, not rendered — because a sheet
 * handed to thirty children should not depend on a stylesheet loading.
 */

import { useEffect } from "react";
import { groupIntoSections, questionTypeLabel } from "@/lib/testBlueprints";

/** Ruled answer space, sized to what the question is worth. */
function Lines({ count }) {
  return (
    <div className="qp-lines">
      {Array.from({ length: count }).map((_, i) => <span key={i} />)}
    </div>
  );
}

function linesFor(q) {
  if (q.type === "long") return 8;
  if (q.type === "short") return 3;
  if (q.type === "oneword") return 1;
  return 0;
}

function QuestionPaperBody({ sections }) {
  return sections.map((s) => (
    <section key={s.id} className="qp-section">
      <h2>Section {s.letter} — {s.label}</h2>
      <p className="qp-sub">
        {s.questions.length} question{s.questions.length === 1 ? "" : "s"} · {s.marks} marks
      </p>
      {s.questions.map((q) => (
        <div key={q.number} className="qp-q">
          <p className="qp-qtext">
            <b>{q.number}.</b> {q.question ?? q.sentence ?? q.statement ?? ""}
            <span className="qp-marks">[{q.marks}]</span>
          </p>

          {Array.isArray(q.options) && q.options.length > 0 && (
            <ol className="qp-opts">
              {q.options.map((o, i) => (
                <li key={i}>{String.fromCharCode(65 + i)}) {typeof o === "string" ? o : o?.text ?? ""}</li>
              ))}
            </ol>
          )}

          {q.type === "truefalse" && <p className="qp-tf">True / False</p>}

          {q.type === "match" && (
            <table className="qp-match">
              <thead><tr><th>Column A</th><th>Column B</th></tr></thead>
              <tbody>
                {Array.from({ length: Math.max((q.column_a ?? []).length, (q.column_b ?? []).length, 4) }).map((_, i) => (
                  <tr key={i}>
                    <td>{(q.column_a ?? [])[i] ? `${i + 1}. ${q.column_a[i]}` : ""}</td>
                    <td>{(q.column_b ?? [])[i] ? `${String.fromCharCode(97 + i)}. ${q.column_b[i]}` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {linesFor(q) > 0 && <Lines count={linesFor(q)} />}
        </div>
      ))}
    </section>
  ));
}

function AnswerKeyBody({ sections }) {
  return sections.map((s) => (
    <section key={s.id} className="qp-section">
      <h2>Section {s.letter} — {s.label}</h2>
      {s.questions.map((q) => {
        let answer = "—";
        if (q.type === "mcq" && Number.isInteger(q.answer_index)) {
          const opt = q.options?.[q.answer_index];
          answer = `${String.fromCharCode(65 + q.answer_index)}) ${typeof opt === "string" ? opt : opt?.text ?? ""}`;
        } else if (q.type === "match" && Array.isArray(q.pairs)) {
          answer = q.pairs
            .map(([a, b]) => `${a + 1}–${String.fromCharCode(97 + b)}`)
            .join(", ");
        } else if (q.answer !== undefined && q.answer !== null && q.answer !== "") {
          answer = String(q.answer);
        }
        return (
          <div key={q.number} className="qp-a">
            <p className="qp-qtext"><b>{q.number}.</b> {answer}</p>
            {Array.isArray(q.key_points) && q.key_points.length > 0 && (
              <p className="qp-keys">Key points: {q.key_points.join(" · ")}</p>
            )}
          </div>
        );
      })}
    </section>
  ));
}

export default function PrintSheet({ paper, mode = "paper", schoolName = "", onDone }) {
  useEffect(() => {
    if (!paper) return;
    const done = () => onDone?.();
    window.addEventListener("afterprint", done);
    // Let the sheet paint before the print dialog snapshots it.
    const t = setTimeout(() => window.print(), 80);
    return () => { clearTimeout(t); window.removeEventListener("afterprint", done); };
  }, [paper, onDone]);

  if (!paper) return null;

  const isKey = mode === "key";
  const sections = groupIntoSections(paper.questions ?? []);
  const chapters = paper.chapter_names?.length ? paper.chapter_names.join(", ") : null;

  return (
    <>
      <style jsx global>{`
        .qp-sheet { display: none; }
        @page { size: A4; margin: 14mm; }
        @media print {
          body * { visibility: hidden; }
          .qp-sheet, .qp-sheet * { visibility: visible; }
          .qp-sheet { display: block; position: absolute; left: 0; top: 0; width: 100%;
                      font: 11pt/1.5 "Times New Roman", serif; color: #000; }
          .qp-school { text-align: center; font-size: 12pt; font-weight: bold; margin: 0 0 1mm; }
          .qp-sheet h1 { font-size: 14pt; margin: 0 0 2mm; text-align: center; }
          .qp-meta { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 3mm;
                     font-size: 10pt; border-bottom: 1px solid #000; border-top: 1px solid #000;
                     padding: 1.5mm 0; margin-bottom: 4mm; }
          .qp-section { margin-bottom: 5mm; break-inside: auto; }
          .qp-section h2 { font-size: 11pt; margin: 4mm 0 0.5mm; text-decoration: underline; }
          .qp-sub { font-size: 9.5pt; margin: 0 0 2mm; font-style: italic; }
          .qp-q, .qp-a { margin-bottom: 3mm; break-inside: avoid; }
          .qp-qtext { margin: 0; }
          .qp-marks { float: right; }
          .qp-opts { list-style: none; margin: 1mm 0 0; padding: 0 0 0 7mm;
                     display: grid; grid-template-columns: 1fr 1fr; gap: 0.5mm 4mm; }
          .qp-tf { margin: 1mm 0 0 7mm; }
          .qp-keys { margin: 0.5mm 0 0 7mm; font-size: 9.5pt; font-style: italic; }
          .qp-match { width: 100%; border-collapse: collapse; margin: 1.5mm 0 0 7mm; font-size: 10.5pt; }
          .qp-match th, .qp-match td { border: 1px solid #000; padding: 1.5mm 2mm; text-align: left; }
          .qp-lines { margin: 1.5mm 0 0 7mm; }
          .qp-lines span { display: block; border-bottom: 1px solid #999; height: 6mm; }
          .qp-text { white-space: pre-wrap; font: inherit; margin: 0; }
          .qp-foot { margin-top: 5mm; border-top: 1px solid #000; padding-top: 1.5mm;
                     font-size: 10pt; text-align: right; }
        }
      `}</style>

      <div className="qp-sheet" aria-hidden="true">
        {schoolName && <p className="qp-school">{schoolName}</p>}
        <h1>{paper.title}{isKey ? " — Answer key" : ""}</h1>

        <div className="qp-meta">
          {paper.class_label && <span>{paper.class_label}</span>}
          {paper.subject && <span>{paper.subject}</span>}
          {chapters && <span>Chapters: {chapters}</span>}
          {paper.total_marks != null && <span>Max marks: {paper.total_marks}</span>}
          {paper.minutes ? <span>Time: {paper.minutes} min</span> : null}
          {paper.negative_marking ? <span>Negative marking applies</span> : null}
        </div>

        {paper.questions?.length
          ? (isKey ? <AnswerKeyBody sections={sections} /> : <QuestionPaperBody sections={sections} />)
          : <pre className="qp-text">{paper.paper_text ?? ""}</pre>}

        {!isKey && paper.questions?.length > 0 && (
          <p className="qp-foot">Total: {paper.total_marks} marks</p>
        )}
      </div>
    </>
  );
}
