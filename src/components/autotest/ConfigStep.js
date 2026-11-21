"use client";

/**
 * Setting up a paper.
 *
 * Replaces a screen that asked for one chapter, one difficulty, one question
 * type and a marks slider that stepped in tens. None of those could describe a
 * real paper: a PT carries seven kinds of question across several chapters,
 * and the slider could not even produce the 12.5 a CT is marked out of.
 *
 * The shape of the screen follows from that. Picking a test type fills in a
 * blueprint — how many of each question type and what each is worth — and the
 * teacher adjusts it. The total is shown against the paper's marks, because a
 * blueprint that does not add up is the one mistake worth catching before the
 * AI is asked for anything.
 *
 * Competitive tests are multiple choice throughout, so there is nothing to
 * balance and the blueprint gives way to a count.
 */

import { useEffect, useMemo, useState } from "react";
import SyllabusPicker from "@/components/autotest/SyllabusPicker";
import { fetchQuestionTypeCapabilities } from "@/lib/api";
import {
  TEST_TYPES, EXAM_PATTERNS, DIFFICULTIES, DEFAULT_MIX, COMPETITIVE_MIX,
  ASSUMED_SUPPORTED, rowsForTestType, blueprintTotal, testTypeById, examTypeFor,
  questionTypeLabel,
} from "@/lib/testBlueprints";

/**
 * Which question types the AI service can write today.
 *
 * Asked for rather than assumed, so a type added later appears on its own with
 * no release here. Until that endpoint exists the answer is the three it has
 * always returned — and a missing endpoint is a normal answer, not an error.
 */
function useSupportedTypes() {
  const [supported, setSupported] = useState(ASSUMED_SUPPORTED);
  useEffect(() => {
    let alive = true;
    fetchQuestionTypeCapabilities()
      .then((types) => { if (alive && types?.length) setSupported(types); })
      .catch(() => { /* not published yet — the assumed set stands */ });
    return () => { alive = false; };
  }, []);
  return supported;
}

const card = {
  background: "#fff",
  borderRadius: 16,
  border: "1px solid rgba(99,102,241,0.1)",
  padding: "22px 24px",
};

const numberBox = {
  width: 54, height: 34, textAlign: "center",
  border: "1.5px solid #E2E8F0", borderRadius: 8,
  background: "#fff", color: "#0F172A", fontVariantNumeric: "tabular-nums",
};

/** "A", "A and B", "A, B and C" — joining four with "and" three times reads badly. */
function listOut(items) {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function Eyebrow({ children }) {
  return (
    <p style={{
      margin: "0 0 3px", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em",
      textTransform: "uppercase", color: "#94A3B8",
    }}>{children}</p>
  );
}

const EMPTY_SYLLABUS = {
  classId: null, className: "", subjectId: null, subject: "",
  chapterIds: [], chapterNames: [],
};

export default function ConfigStep({ onGenerate, onSaveBlueprint, initial, syllabus: board = "State" }) {
  const supported = useSupportedTypes();

  const [testType, setTestType] = useState(initial?.testType ?? "pt");
  const [examNo,   setExamNo]   = useState(initial?.examNo ?? "PT-1");
  const [syllabus, setSyllabus] = useState(EMPTY_SYLLABUS);
  const [mix,      setMix]      = useState(initial?.difficultyMix ?? DEFAULT_MIX);
  // A saved blueprint stores ids, counts and marks but no labels — the label
  // belongs to the question type, not to someone's saved preference.
  const [rows,     setRows]     = useState(() =>
    initial?.blueprint?.length
      ? initial.blueprint.map((b) => ({ ...b, label: questionTypeLabel(b.id) }))
      : rowsForTestType(initial?.testType ?? "pt"));
  const [pattern,  setPattern]  = useState(initial?.pattern ?? "ntse");
  const [qCount,   setQCount]   = useState(initial?.questionCount ?? 50);
  const [qMarks,   setQMarks]   = useState(initial?.marksEach ?? 1);
  const [minutes,  setMinutes]  = useState(initial?.minutes ?? 45);
  const [negative, setNegative] = useState(initial?.negativeMarking ?? false);

  const type = testTypeById(testType);
  const isCompetitive = type.group === "competitive";

  // Changing the test type rebuilds the blueprint and the difficulty mix,
  // because both are properties of the kind of test being set.
  const chooseType = (id) => {
    setTestType(id);
    setRows(rowsForTestType(id));
    const next = testTypeById(id);
    setMix(next.group === "competitive" ? COMPETITIVE_MIX : DEFAULT_MIX);
    setMinutes(next.minutes);
  };

  const choosePattern = (id) => {
    setPattern(id);
    const p = EXAM_PATTERNS.find((x) => x.id === id);
    if (p) { setQCount(p.questions); setQMarks(p.marks); setMinutes(p.minutes); }
  };

  const setRow = (id, field, value) => {
    const n = value === "" ? 0 : Math.max(0, Number(value) || 0);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: n } : r)));
  };

  const total = useMemo(
    () => (isCompetitive ? qCount * qMarks : blueprintTotal(rows)),
    [isCompetitive, qCount, qMarks, rows]
  );
  // A school paper is marked out of a fixed number and the blueprint has to
  // reach it. A competitive paper has no such number — the pattern sets the
  // count, and 45 questions is a 45-mark paper. Checking it against the
  // competitive default of 50 would have failed NMMS and both olympiads.
  const target = isCompetitive ? total : type.totalMarks;
  const balanced = isCompetitive ? total > 0 : Math.abs(total - type.totalMarks) < 0.01;

  // What the AI service accepts today for a competitive paper. NMMS at 45 and
  // the olympiads at 35 fall outside it, so the teacher is told here rather
  // than by a failed generation a minute later.
  const ACCEPTED_TOTALS = [20, 30, 50, 70, 100];
  const totalRejected = isCompetitive && total > 0 && !ACCEPTED_TOTALS.includes(total);

  const unsupported = rows.filter((r) => r.count > 0 && !supported.includes(r.id));

  // Every paper needs at least one chapter, competitive included.
  //
  // A competitive paper ought to draw on the whole syllabus, and this screen
  // was written that way. The AI service cannot do it: it writes questions
  // from the chapter text it is given, so with no chapter it has no source
  // and answers "Please select a valid Class, Subject, and Chapter". The
  // teacher saw that a minute after pressing Generate, having been allowed
  // to proceed. Better to ask for the chapter up front and be honest about
  // what the generator can do today.
  const syllabusReady = Boolean(
    syllabus.classId && syllabus.subjectId && syllabus.chapterIds.length
  );

  const ready = syllabusReady && balanced;

  const buildConfig = () => {
    const activePattern = EXAM_PATTERNS.find((p) => p.id === pattern);
    return {
      testType,
      examNo:   type.numbered ? examNo : null,
      examType: examTypeFor(testType, examNo),
      label:      type.label,
      shortLabel: type.shortLabel,
      syllabus: board,

      classId:   syllabus.classId,
      classLevel: syllabus.className,
      subjectId: syllabus.subjectId,
      subject:   syllabus.subject,
      chapterIds: syllabus.chapterIds,
      chapterNames: syllabus.chapterNames,

      difficultyMix: mix,
      totalMarks: total,
      minutes,
      negativeMarking: isCompetitive ? negative : false,

      examTarget: isCompetitive ? (activePattern?.target ?? "Custom") : null,
      pattern:    isCompetitive ? pattern : null,
      questionCount: isCompetitive ? qCount : null,
      marksEach:     isCompetitive ? qMarks : null,

      blueprint: isCompetitive
        ? [{ id: "mcq", count: qCount, each: qMarks }]
        : rows.filter((r) => r.count > 0).map(({ id, count, each }) => ({ id, count, each })),

      // Kept so the review screen can say which questions it had to leave blank.
      unsupported: unsupported.map((r) => r.id),
    };
  };

  const submit = () => {
    if (!ready) return;
    onGenerate(buildConfig());
  };

  const school = TEST_TYPES.filter((t) => t.group === "school");
  const competitive = TEST_TYPES.filter((t) => t.group === "competitive");

  const tileStyle = (on) => ({
    textAlign: "left", padding: "13px 14px", minHeight: 62, cursor: "pointer",
    borderRadius: 12,
    border: `1.5px solid ${on ? "#6366F1" : "#E2E8F0"}`,
    background: on ? "#EEF2FF" : "#fff",
  });

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>

      {/* ── left column ─────────────────────────────────────────────── */}
      <div style={{ flex: "1 1 380px", minWidth: 0, display: "flex", flexDirection: "column", gap: 18 }}>

        <section style={card}>
          <Eyebrow>Step 1</Eyebrow>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#0F172A", fontFamily: "var(--font-space-grotesk)" }}>
            Test type
          </h2>
          <p style={{ margin: "5px 0 14px", fontSize: 13, color: "#64748B" }}>
            Sets the marks and the blueprint. You can still change both.
          </p>

          <p style={{ margin: "0 0 9px", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#94A3B8" }}>
            School assessment
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            {school.map((t) => {
              const on = t.id === testType;
              return (
                <button key={t.id} type="button" onClick={() => chooseType(t.id)} aria-pressed={on} style={tileStyle(on)}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: on ? 700 : 600, color: on ? "#3730A3" : "#334155" }}>
                    {t.label}
                  </span>
                  <span style={{ display: "block", fontSize: 12, marginTop: 2, color: on ? "#4F46E5" : "#94A3B8" }}>
                    {on ? `${t.totalMarks} marks · selected` : t.note}
                  </span>
                </button>
              );
            })}
          </div>

          <p style={{ margin: "16px 0 9px", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#94A3B8" }}>
            Competitive practice
          </p>
          {competitive.map((t) => {
            const on = t.id === testType;
            return (
              <button key={t.id} type="button" onClick={() => chooseType(t.id)} aria-pressed={on}
                style={{ ...tileStyle(on), width: "100%", boxSizing: "border-box" }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: on ? 700 : 600, color: on ? "#3730A3" : "#334155" }}>
                  {t.label}
                </span>
                <span style={{ display: "block", fontSize: 12, marginTop: 2, color: on ? "#4F46E5" : "#94A3B8" }}>
                  {on ? "Multiple choice only · selected" : t.note}
                </span>
              </button>
            );
          })}

          {type.numbered && (
            <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <label htmlFor="exam-no" style={{ fontSize: 13, color: "#475569" }}>Which one</label>
              <select id="exam-no" value={examNo} onChange={(e) => setExamNo(e.target.value)}
                style={{ height: 34, padding: "0 10px", border: "1.5px solid #E2E8F0", borderRadius: 8, background: "#fff" }}>
                {type.numbered.map((n) => <option key={n}>{n}</option>)}
              </select>
              <span style={{ fontSize: 12, color: "#94A3B8" }}>
                Links the paper to the exam record, so marks entry can use it later.
              </span>
            </div>
          )}

          {isCompetitive && (
            <div style={{ marginTop: 14 }}>
              <label htmlFor="pattern" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                Exam pattern
              </label>
              <select id="pattern" value={pattern} onChange={(e) => choosePattern(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box", height: 38, padding: "0 10px", border: "1.5px solid #E2E8F0", borderRadius: 9, background: "#fff" }}>
                {EXAM_PATTERNS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
              <p style={{ margin: "7px 0 0", fontSize: 12, color: "#94A3B8" }}>
                A pattern only fills in the numbers below. Nothing is locked.
              </p>
            </div>
          )}
        </section>

        <section style={card}>
          <Eyebrow>Step 2</Eyebrow>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#0F172A", fontFamily: "var(--font-space-grotesk)" }}>
            Syllabus covered
          </h2>
          <p style={{ margin: "5px 0 14px", fontSize: 13, color: "#64748B" }}>
            {isCompetitive
              ? "Leave chapters empty to draw from the whole syllabus."
              : "A paper can span several chapters, so chapters are a multi-select."}
          </p>
          <SyllabusPicker onChange={setSyllabus} chaptersOptional={isCompetitive} />
        </section>

        <section style={card}>
          <Eyebrow>Step 3</Eyebrow>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#0F172A", fontFamily: "var(--font-space-grotesk)" }}>
            Difficulty mix
          </h2>
          <p style={{ margin: "5px 0 14px", fontSize: 13, color: "#64748B" }}>
            {isCompetitive
              ? "Competitive leans harder than a school paper. Share of total marks."
              : "A real paper carries all three. Share of total marks."}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
            {DIFFICULTIES.map((d) => {
              const tone = {
                Easy:   ["#ECFDF5", "#A7F3D0", "#065F46"],
                Medium: ["#FFFBEB", "#FDE68A", "#92400E"],
                Hard:   ["#FEF2F2", "#FECACA", "#991B1B"],
              }[d];
              return (
                <div key={d} style={{ background: tone[0], border: `1px solid ${tone[1]}`, borderRadius: 12, padding: "12px 14px" }}>
                  <label htmlFor={`mix-${d}`} style={{ display: "block", fontSize: 12, fontWeight: 600, color: tone[2], marginBottom: 7 }}>{d}</label>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                    <input id={`mix-${d}`} value={mix[d]} inputMode="numeric"
                      onChange={(e) => setMix({ ...mix, [d]: Math.max(0, Number(e.target.value) || 0) })}
                      style={{ ...numberBox, borderColor: tone[1] }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: tone[2] }}>%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* ── right column ────────────────────────────────────────────── */}
      <div style={{ flex: "1 1 520px", minWidth: 0, display: "flex", flexDirection: "column", gap: 18 }}>

        <section style={card}>
          <Eyebrow>Step 4</Eyebrow>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "baseline", justifyContent: "space-between" }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#0F172A", fontFamily: "var(--font-space-grotesk)" }}>
              {isCompetitive ? "Paper" : "Paper blueprint"}
            </h2>
            {!isCompetitive && (
              <button type="button" onClick={() => setRows(rowsForTestType(testType))}
                style={{ padding: "6px 12px", borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#fff", fontSize: 12, fontWeight: 600, color: "#475569", cursor: "pointer" }}>
                Reset to default
              </button>
            )}
          </div>

          {isCompetitive ? (
            <>
              <p style={{ margin: "5px 0 16px", fontSize: 13, color: "#64748B" }}>
                No blueprint to balance — one question type, so a count is enough.
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "14px 16px", borderRadius: 12, background: "#EEF2FF", border: "1px solid #C7D2FE", marginBottom: 18 }}>
                <span style={{ flex: "0 0 auto", width: 26, height: 26, borderRadius: 8, background: "#6366F1", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>✓</span>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#3730A3" }}>Multiple choice throughout</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#4338CA" }}>
                    The type the AI already generates reliably, so this needs nothing new from the service.
                  </p>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
                {[
                  ["Questions", qCount, setQCount],
                  ["Marks each", qMarks, setQMarks],
                  ["Minutes", minutes, setMinutes],
                ].map(([label, value, set]) => (
                  <div key={label}>
                    <label htmlFor={`c-${label}`} style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>{label}</label>
                    <input id={`c-${label}`} value={value} inputMode="numeric"
                      onChange={(e) => set(Math.max(0, Number(e.target.value) || 0))}
                      style={{ ...numberBox, width: "100%", boxSizing: "border-box" }} />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, borderTop: "1px solid #F1F5F9", paddingTop: 14, display: "flex", alignItems: "flex-start", gap: 10 }}>
                <input type="checkbox" id="neg" checked={negative} onChange={(e) => setNegative(e.target.checked)}
                  style={{ width: 18, height: 18, marginTop: 1, accentColor: "#6366F1" }} />
                <div>
                  <label htmlFor="neg" style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>Negative marking</label>
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: "#94A3B8" }}>
                    Off by default. The real exams differ on this, so it is the teacher&rsquo;s call per paper.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              <p style={{ margin: "5px 0 16px", fontSize: 13, color: "#64748B" }}>
                How many of each question type, and what each one is worth.
              </p>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 440 }}>
                  <thead>
                    <tr>
                      {["Question type", "Qty", "Each", "Marks"].map((h, i) => (
                        <th key={h} scope="col" style={{
                          textAlign: i === 0 ? "left" : i === 3 ? "right" : "center",
                          padding: "0 8px 9px", fontSize: 11, fontWeight: 600,
                          letterSpacing: "0.06em", textTransform: "uppercase", color: "#94A3B8",
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
                    {rows.map((r) => {
                      const ok = supported.includes(r.id);
                      const used = r.count > 0;
                      return (
                        <tr key={r.id} style={{ borderTop: "1px solid #F1F5F9", background: !ok && used ? "#FFFBEB" : "transparent" }}>
                          <td style={{ padding: "11px 8px 11px 0" }}>
                            <span style={{ fontWeight: 600, color: "#0F172A" }}>{r.label}</span>
                            <span style={{ display: "block", fontSize: 11, fontWeight: 600, marginTop: 2, color: ok ? "#047857" : "#92400E" }}>
                              {ok ? "AI ready" : "Waiting on AI service"}
                            </span>
                          </td>
                          <td style={{ textAlign: "center", padding: "11px 8px" }}>
                            <input value={r.count} inputMode="numeric" aria-label={`Number of ${r.label} questions`}
                              onChange={(e) => setRow(r.id, "count", e.target.value)} style={numberBox} />
                          </td>
                          <td style={{ textAlign: "center", padding: "11px 8px" }}>
                            <input value={r.each} inputMode="numeric" aria-label={`Marks per ${r.label} question`}
                              onChange={(e) => setRow(r.id, "each", e.target.value)} style={numberBox} />
                          </td>
                          <td style={{ textAlign: "right", padding: "11px 0 11px 8px", fontWeight: 600 }}>
                            {r.count * r.each}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: "2px solid #0F172A" }}>
                      <td colSpan={3} style={{ padding: "13px 8px 0 0", fontWeight: 700, fontSize: 14 }}>Blueprint total</td>
                      <td style={{ padding: "13px 0 0 8px", textAlign: "right", fontWeight: 700, fontSize: 16, fontVariantNumeric: "tabular-nums" }}>
                        {total}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}

          <p style={{
            margin: "14px 0 0", display: "flex", alignItems: "center", gap: 8,
            padding: "9px 12px", borderRadius: 10, fontSize: 13, fontWeight: 600,
            background: balanced ? "#ECFDF5" : "#FEF2F2",
            border: `1px solid ${balanced ? "#A7F3D0" : "#FECACA"}`,
            color: balanced ? "#065F46" : "#991B1B",
          }}>
            {isCompetitive
              ? `${qCount} question${qCount === 1 ? "" : "s"} × ${qMarks} mark${qMarks === 1 ? "" : "s"} = ${total} marks · ${minutes} minutes.`
              : balanced
              ? `Matches the ${target} marks a ${type.shortLabel} carries.`
              : `${total} marks, but a ${type.shortLabel} is out of ${target}. Adjust before generating.`}
          </p>
        </section>

        {totalRejected && (
          <section style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 16, padding: "18px 20px" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "#78350F" }}>
              {total} marks will not generate yet
            </h3>
            <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.6, color: "#92400E" }}>
              The AI service accepts only {ACCEPTED_TOTALS.join(", ")} marks for a competitive paper,
              so this one fails before a question is written. Change the count, or pick a pattern that
              lands on one of those. Raised with the AI team.
            </p>
          </section>
        )}

        {unsupported.length > 0 && (
          <section style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 16, padding: "18px 20px" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "#78350F" }}>
              {unsupported.length === 1 ? "One type is not generated yet" : `${unsupported.length} types are not generated yet`}
            </h3>
            <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.6, color: "#92400E" }}>
              {listOut(unsupported.map((r) => r.label))} stay in the blueprint and come out as printed
              headings with answer space, so the paper is complete and the marks still add up to {target}.
              The AI fills them the day the service returns them — nothing to change here.
            </p>
          </section>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <button type="button" onClick={submit} disabled={!ready}
            className="ai-gradient"
            style={{
              flex: "1 1 220px", minHeight: 48, padding: "14px 20px", border: 0, borderRadius: 12,
              color: "#fff", fontSize: 14, fontWeight: 700,
              cursor: ready ? "pointer" : "not-allowed",
              opacity: ready ? 1 : 0.5,
              boxShadow: "0 4px 16px rgba(99,102,241,0.35)",
            }}>
            Generate paper
          </button>
          <button type="button" onClick={() => onSaveBlueprint?.(buildConfig())} disabled={!balanced}
            style={{
              minHeight: 48, padding: "14px 20px", borderRadius: 12, fontSize: 13, fontWeight: 700,
              border: "1.5px solid #E2E8F0", background: "#fff", color: "#475569",
              cursor: balanced ? "pointer" : "not-allowed", opacity: balanced ? 1 : 0.5,
            }}>
            Save as blueprint
          </button>
          {!syllabusReady && (
            <span style={{ fontSize: 12, color: "#94A3B8" }}>
              Pick a class, subject and at least one chapter first.
            </span>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 11.5, color: "#94A3B8" }}>
          Saved blueprints appear below this screen next time, so a repeat paper takes two clicks.
        </p>
      </div>
    </div>
  );
}
