"use client";

/**
 * Setting up a paper.
 *
 * Replaces a screen that asked for one difficulty, one question type and a
 * marks slider. None of those could describe a real paper: a PT carries seven
 * kinds of question across several chapters, and the slider could not even
 * produce the 12.5 a CT is marked out of.
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
import ChapterPicker from "@/components/chapters/ChapterPicker";
import {
  TEST_TYPES, EXAM_PATTERNS, DIFFICULTIES, DEFAULT_MIX, COMPETITIVE_MIX,
  ASSUMED_SUPPORTED, rowsForTestType, blueprintTotal, testTypeById,
} from "@/lib/testBlueprints";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("swais_faculty_token") : null;
}

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
    fetch(`${API}/api/v1/question-papers/capabilities`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && Array.isArray(d?.questionTypes) && d.questionTypes.length) {
          setSupported(d.questionTypes);
        }
      })
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

export default function ConfigStep({ onGenerate }) {
  const supported = useSupportedTypes();

  const [testType, setTestType] = useState("pt");
  const [examNo, setExamNo] = useState("PT-1");
  const [chapterId, setChapterId] = useState("");
  const [chapterName, setChapterName] = useState("");
  const [mix, setMix] = useState(DEFAULT_MIX);
  const [rows, setRows] = useState(() => rowsForTestType("pt"));
  const [pattern, setPattern] = useState("ntse");
  const [qCount, setQCount] = useState(50);
  const [qMarks, setQMarks] = useState(1);
  const [minutes, setMinutes] = useState(45);
  const [negative, setNegative] = useState(false);

  const type = testTypeById(testType);
  const isCompetitive = type.group === "competitive";

  // Changing the test type rebuilds the blueprint and the difficulty mix,
  // because both are properties of the kind of test being set.
  const chooseType = (id) => {
    setTestType(id);
    setRows(rowsForTestType(id));
    setMix(testTypeById(id).group === "competitive" ? COMPETITIVE_MIX : DEFAULT_MIX);
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
  const target = type.totalMarks;
  const balanced = Math.abs(total - target) < 0.01;

  const unsupported = rows.filter((r) => r.count > 0 && !supported.includes(r.id));

  const submit = () => {
    onGenerate({
      testType, examNo: type.numbered ? examNo : null,
      chapterId, chapterName,
      difficultyMix: mix,
      totalMarks: total,
      minutes: isCompetitive ? minutes : null,
      negativeMarking: isCompetitive ? negative : false,
      pattern: isCompetitive ? pattern : null,
      blueprint: isCompetitive
        ? [{ id: "mcq", count: qCount, each: qMarks }]
        : rows.filter((r) => r.count > 0).map(({ id, count, each }) => ({ id, count, each })),
      // Kept so the screen can say which questions it had to leave blank.
      unsupported: unsupported.map((r) => r.id),
    });
  };

  const school = TEST_TYPES.filter((t) => t.group === "school");
  const competitive = TEST_TYPES.filter((t) => t.group === "competitive");

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
                <button key={t.id} type="button" onClick={() => chooseType(t.id)} aria-pressed={on}
                  style={{
                    textAlign: "left", padding: "13px 14px", minHeight: 62, cursor: "pointer",
                    borderRadius: 12,
                    border: `1.5px solid ${on ? "#6366F1" : "#E2E8F0"}`,
                    background: on ? "#EEF2FF" : "#fff",
                  }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: on ? 700 : 600, color: on ? "#3730A3" : "#334155" }}>
                    {t.label}
                  </span>
                  <span style={{ display: "block", fontSize: 12, marginTop: 2, color: on ? "#4F46E5" : "#94A3B8" }}>
                    {t.note}
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
                style={{
                  width: "100%", boxSizing: "border-box", textAlign: "left", padding: "13px 14px",
                  minHeight: 62, cursor: "pointer", borderRadius: 12,
                  border: `1.5px solid ${on ? "#6366F1" : "#E2E8F0"}`,
                  background: on ? "#EEF2FF" : "#fff",
                }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: on ? 700 : 600, color: on ? "#3730A3" : "#334155" }}>
                  {t.label}
                </span>
                <span style={{ display: "block", fontSize: 12, marginTop: 2, color: on ? "#4F46E5" : "#94A3B8" }}>
                  {t.note}
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
            Class, subject and the chapters this paper draws from.
          </p>
          <ChapterPicker onChapterChange={(id, name) => { setChapterId(id); setChapterName(name); }} />
        </section>

        <section style={card}>
          <Eyebrow>Step 3</Eyebrow>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#0F172A", fontFamily: "var(--font-space-grotesk)" }}>
            Difficulty mix
          </h2>
          <p style={{ margin: "5px 0 14px", fontSize: 13, color: "#64748B" }}>
            A real paper carries all three. Share of the total.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
            {DIFFICULTIES.map((d) => {
              const tone = { Easy: ["#ECFDF5", "#A7F3D0", "#065F46"], Medium: ["#FFFBEB", "#FDE68A", "#92400E"], Hard: ["#FEF2F2", "#FECACA", "#991B1B"] }[d];
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
                Reset to {type.label} default
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
            {balanced
              ? `Matches the ${target} marks a ${type.label.toLowerCase()} carries.`
              : `${total} marks, but a ${type.label.toLowerCase()} is out of ${target}. Adjust before generating.`}
          </p>
        </section>

        {unsupported.length > 0 && (
          <section style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 16, padding: "18px 20px" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "#78350F" }}>
              {unsupported.length === 1 ? "One type is not generated yet" : `${unsupported.length} types are not generated yet`}
            </h3>
            <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.6, color: "#92400E" }}>
              {listOut(unsupported.map((r) => r.label))} will print as numbered headings with answer
              space, so the paper is complete and the marks still add up. The AI fills them in the day the
              service returns them — nothing to change here.
            </p>
          </section>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <button type="button" onClick={submit} disabled={!chapterId || !balanced}
            className="ai-gradient"
            style={{
              flex: "1 1 220px", minHeight: 48, padding: "14px 20px", border: 0, borderRadius: 12,
              color: "#fff", fontSize: 14, fontWeight: 700,
              cursor: !chapterId || !balanced ? "not-allowed" : "pointer",
              opacity: !chapterId || !balanced ? 0.5 : 1,
              boxShadow: "0 4px 16px rgba(99,102,241,0.35)",
            }}>
            Generate paper
          </button>
          {!chapterId && (
            <span style={{ fontSize: 12, color: "#94A3B8" }}>Pick a chapter first.</span>
          )}
        </div>
      </div>
    </div>
  );
}
