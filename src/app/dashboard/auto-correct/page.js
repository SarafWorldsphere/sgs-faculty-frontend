"use client";

import { useState, useEffect, useRef } from "react";

// ?? and not ||: an empty value means "same origin as this app", which is
// what a deployment behind nginx wants. || would read it as missing and send
// the browser to localhost:8000.
const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("swais_faculty_token") : null;
}

const GRADE_STYLE = {
  "A+": { color: "#10B981", bg: "#ECFDF5" },
  "A":  { color: "#10B981", bg: "#ECFDF5" },
  "B":  { color: "#6366F1", bg: "#EEF2FF" },
  "C":  { color: "#F59E0B", bg: "#FFFBEB" },
  "D":  { color: "#EF4444", bg: "#FEF2F2" },
};

/* What the paper was. The value is what `assessments.assessment_type` stores,
   so these four are the enum the backend accepts and not a free list. It does
   not change how the AI marks — the scanner is never told — it decides how the
   result is filed and grouped in the headmaster's reports. */
const TEST_TYPES = [
  { value: "test",       label: "Class Test" },
  { value: "quiz",       label: "Quiz" },
  { value: "exam",       label: "Exam" },
  { value: "assignment", label: "Assignment" },
];

function getGrade(pct) {
  if (pct >= 90) return "A+";
  if (pct >= 75) return "A";
  if (pct >= 60) return "B";
  if (pct >= 45) return "C";
  return "D";
}

export default function AutoCorrectPage() {
  const [step,          setStep]          = useState(1); // 1=setup, 2=answers, 3=results
  /* Subject and chapter are held as ids, not names.
     The chapter select used to carry the chapter *title* as its value, and
     that title was then sent to the AI as the subject — so a paper on
     "Photosynthesis" was marked with no idea it was Biology. Holding the id
     lets the rest of the screen read the subject, the chapter name and the
     class off the chapter row itself. */
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedChapter, setSelectedChapter] = useState("");
  const [testType,        setTestType]        = useState("test");
  const [answers,       setAnswers]       = useState({});
  const [studentMode,   setStudentMode]   = useState("class");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [isProcessing,  setIsProcessing]  = useState(false);
  const [results,       setResults]       = useState(null);
  const [students,      setStudents]      = useState([]);
  const [topics,        setTopics]        = useState([]);
  const [questions,     setQuestions]     = useState([]);   // extracted from an uploaded PDF
  /* The question paper PDF itself, kept after extraction.
     /questions/extract reads text, so a scanned or photographed paper comes
     back with nothing. The scanner can read one, so the file is held here and
     sent along with the answer sheets — it is also what lets the marker match
     "Section B, 1" on the sheet to question 3 on the paper. */
  const [paperFile,     setPaperFile]     = useState(null);
  const [uploading,     setUploading]     = useState(false);
  const [uploadError,   setUploadError]   = useState("");
  const [saving,        setSaving]        = useState(false);
  const [saveError,     setSaveError]     = useState("");
  const [savedFor,      setSavedFor]      = useState([]);   // student ids kept this sitting

  /* Scanning an answer sheet.

     `scanMode` is the teacher's intent, not a setting: direct_grade is an
     unmarked paper, verify_teacher is one already marked in pen that she wants
     checked. `audit` only ever holds something in the second case. */
  const [sheets,        setSheets]        = useState([]);
  const [scanMode,      setScanMode]      = useState("direct_grade");
  const [scanning,      setScanning]      = useState(false);
  const [scanError,     setScanError]     = useState("");
  const [scanned,       setScanned]       = useState(null);  // { name, roll } off the cover sheet
  const [audit,         setAudit]         = useState(null);
  // Per-question marks the scanner already worked out, keyed by question id.
  const [scanMarks,     setScanMarks]     = useState({});

  /* Marking happens one paper at a time, but a class belongs on one test row.
     The first save creates the assessment and hands back its id; every paper
     after it is added to the same one. */
  // Authoritative for the save path: avoids a stale read when two students
  // are saved in quick succession. `hasAssessment` mirrors it for rendering.
  const assessmentId = useRef(null);
  const [hasAssessment, setHasAssessment] = useState(false);

  const handleUploadPdf = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    // Kept whatever the text extractor makes of it. A scanned paper yields no
    // questions here but is still the reference the scanner needs.
    setPaperFile(file);
    const token = getToken();
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API}/api/v1/questions/extract`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`);
      if (!data.questions?.length) {
        setQuestions([]);
        // Not a dead end any more: the paper is still sent with the answer
        // sheets, and the scanner reads a scanned one. Only the on-screen
        // question list is lost, so the message says what that costs.
        setUploadError(
          "No text could be read from that PDF, so the questions can't be " +
          "listed here — it looks like a scan. The paper will still be sent " +
          "with the answer sheets for the scanner to read."
        );
      } else {
        setQuestions(data.questions);
      }
    } catch (err) {
      setQuestions([]);
      setUploadError(err.message || "Couldn't read the PDF. Please try again.");
    } finally {
      setUploading(false);
      e.target.value = "";   // allow re-uploading the same file
    }
  };

  /* The scanner's field names are read defensively.

     The scanner answers with three parts: student_details, summary, and a
     questions array. Those names are taken from its controller, not guessed —
     an earlier draft read `transcription` and `detected_name` at the top level
     and would have shown a paper of empty answers, which looks like an OCR
     failure rather than the mapping mistake it is. */
  /**
   * Stable keys for the rows the scanner returned.
   *
   * question_number is the paper's own numbering, which is what the teacher
   * reads, so it is used when it can be. But a handwritten sheet often
   * restarts the count in each section — "Section B, 1, 2" are questions 3
   * and 4 — and if the scanner echoes that, several rows arrive numbered "1".
   * Keying on it then would file three different answers under one id and
   * silently drop two of them. Position is used instead the moment the
   * numbers are not unique.
   */
  const scanRowIds = (rows) => {
    const given = rows.map((row, i) => String(row?.question_number ?? i + 1));
    const unique = new Set(given).size === given.length;
    return unique ? given : rows.map((_, i) => String(i + 1));
  };

  /**
   * Read the paper, then let the teacher check it.
   *
   * A vision model reading handwriting is a suggestion, so the transcribed
   * answers land in step 2 as editable text rather than going straight to a
   * mark. Where she would have typed each answer, she now reads what the
   * scanner made of it and fixes anything it misread. A misread costs an edit
   * instead of a wrong mark on a student's record.
   *
   * The scanner also returns a mark per question, so those are kept. Sending
   * the same answers back through /check would pay for a second AI call and
   * could return a different number for the same work, which is impossible to
   * explain to a teacher. Its marks stand unless she edits the answer.
   */
  const handleScan = async () => {
    if (!sheets.length || scanning) return;
    setScanning(true);
    setScanError("");
    setAudit(null);
    try {
      const fd = new FormData();
      sheets.forEach(file => fd.append("answer_sheets", file));
      fd.append("mode", scanMode);
      // Both, when both exist. The JSON carries the wording and the marks the
      // teacher reviewed on screen; the file carries everything the extractor
      // could not read — the layout, the section numbering, and the answer
      // key printed under the paper.
      if (paperFile) fd.append("question_paper_file", paperFile);
      if (questions.length) {
        fd.append("question_paper_json", JSON.stringify(questions));
        fd.append("max_marks", String(totalMarks));
      }
      /* The scanner marks an answer against the subject and the class level.
         Without them it reads the handwriting and judges the content on the
         question wording alone, which is how a two-line answer that is right
         for Class 6 gets full marks on a Class 10 paper.

         The chapter name is deliberately not sent as rubric_or_answer_key:
         that field is read as the marking key, and a chapter title there
         would be treated as the expected answer. */
      if (subjectName) fd.append("subject", subjectName);
      if (classLevel)  fd.append("class_level", classLevel);
      const student = students.find(s => String(s.student_id) === String(selectedStudent));
      if (student) {
        fd.append("student_name", student.full_name || "");
        if (student.roll_no) fd.append("roll_number", String(student.roll_no));
      }

      const token = getToken();
      const res = await fetch(`${API}/api/v1/corrections/scan`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.detail || `HTTP ${res.status}`);

      /* The AI service wraps its whole answer in `evaluation`. The backend
         unwraps it, but this reads either shape: the two deploy separately,
         and the one thing worse than the wrapper is the wrapper coming back
         on a day only one side has been updated. */
      const data = (body && typeof body.evaluation === "object" && body.evaluation)
        ? body.evaluation
        : body;

      const rows = Array.isArray(data?.questions) ? data.questions : [];
      if (!rows.length) {
        setScanError("Nothing could be read from those pages. Try a flatter scan in better light.");
        return;
      }

      // An uploaded question paper is the authority on wording and marks. Only
      // when there is none do the rows come from what the scanner matched.
      const rowIds = scanRowIds(rows);

      if (!questions.length) {
        setQuestions(rows.map((row, i) => {
          const marks = Number(row.max_marks) || 1;
          return {
            id: rowIds[i],
            question: row.question_text || `Question ${i + 1}`,
            maxMarks: marks,
            type: marks > 3 ? "long" : "short",
          };
        }));
      }

      const marked = {};
      setAnswers(prev => {
        const next = { ...prev };
        rows.forEach((row, i) => {
          const id = rowIds[i];
          if (row.transcribed_answer != null) next[id] = String(row.transcribed_answer);
          marked[id] = {
            marks: Number(row.ai_evaluated_marks) || 0,
            teacherMarks: row.teacher_awarded_marks,
            feedback: row.feedback || row.step_wise_breakdown || "",
            breakdown: row.step_wise_breakdown || "",
            flagged: Boolean(row.discrepancy_flag),
            reason: row.discrepancy_reason || "",
            answer: row.transcribed_answer == null ? "" : String(row.transcribed_answer),
          };
        });
        return next;
      });
      setScanMarks(marked);

      const who = data.student_details || {};
      setScanned({ name: who.detected_name || "", roll: who.detected_roll_no || "" });

      const sum = data.summary || {};
      if (scanMode === "verify_teacher") {
        setAudit({
          status: sum.audit_status,
          totallingError: Boolean(sum.totaling_error_detected),
          aiTotal: sum.ai_total_marks,
          teacherTotal: sum.calculated_teacher_sum ?? sum.teacher_written_total,
          difference: sum.score_difference,
        });
      }

      setStep(2);
    } catch (err) {
      setScanError(err.message || "Could not read the answer sheet. Please try again.");
    } finally {
      setScanning(false);
    }
  };

  // Load real students + chapters from the API (no mock data)
  useEffect(() => {
    const token = getToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`${API}/api/v1/students`, { headers })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setStudents(d.students || []))
      .catch(() => setStudents([]));
    fetch(`${API}/api/v1/chapters`, { headers })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setTopics(d.chapters || []))
      .catch(() => setTopics([]));
  }, []);

  const totalMarks = questions.reduce((s, q) => s + q.maxMarks, 0);

  /* The subject list is built from the chapters rather than fetched from
     /subjects. A subject with no chapters loaded would be a dead option here:
     picking it could only ever leave the next field empty. */
  const subjects = [];
  const seenSubjects = new Set();
  topics.forEach(t => {
    if (t.subject_id == null || seenSubjects.has(t.subject_id)) return;
    seenSubjects.add(t.subject_id);
    subjects.push({ id: t.subject_id, name: t.subject_name || `Subject ${t.subject_id}` });
  });

  // Older chapter rows carry no subject at all. Rather than block the screen
  // behind an empty dropdown, the subject step is skipped for them.
  const hasSubjects = subjects.length > 0;

  const chaptersForSubject = selectedSubject
    ? topics.filter(t => String(t.subject_id) === String(selectedSubject))
    : topics;

  const chapter = topics.find(t => String(t.chapter_id) === String(selectedChapter)) || null;
  const chapterName = chapter ? (chapter.chapter_name || chapter.content_title || "") : "";
  const subjectName =
    chapter?.subject_name ||
    subjects.find(s => String(s.id) === String(selectedSubject))?.name ||
    "";
  /* The class is already chosen in the header, and the chapter list is scoped
     to it, so the class travels on every chapter row. The AI uses it to judge
     how much a given answer is worth at that level.

     Read off any chapter in the list, not only the selected one: the chapter
     is optional here, and a paper covering a whole subject still belongs to a
     class. */
  const classLevel =
    chapter?.class_name || chaptersForSubject[0]?.class_name || topics[0]?.class_name || "";

  const testTypeLabel =
    TEST_TYPES.find(t => t.value === testType)?.label || "Class Test";

  // Nothing can be marked against the wrong subject, so it gates the scan.
  const needsSubject = hasSubjects && !selectedSubject;

  // Subject, chapter and test type are stamped on the assessment created by
  // the first save. Every paper after it joins that same assessment, so
  // changing them halfway through would silently not apply.
  const setupLocked = hasAssessment;

  /**
   * Keep the result.
   *
   * The screen used to mark a paper, show the score and forget it, so nothing
   * built on sgs_assessments ever saw a corrected paper. This writes it through
   * the same path as marks entry, which is what makes it show up in the
   * headmaster's reports alongside marks typed in by hand.
   *
   * Only possible with a student chosen: a mark has to belong to somebody.
   */
  const handleSave = async () => {
    if (!selectedStudent || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      const token = getToken();
      const res = await fetch(`${API}/api/v1/corrections/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          // Reads as a test in the reports, because that is what it is. The
          // title used to say "Auto Correct", which described how the marks
          // were produced rather than what was marked.
          title: `${testTypeLabel} — ${chapterName || subjectName || "paper"}`,
          // Both were missing, so every corrected paper was stored with no
          // subject and counted as a class test. Reports group on these.
          subject: subjectName || null,
          assessment_type: testType,
          assessment_date: new Date().toISOString().slice(0, 10),
          student_id: Number(selectedStudent),
          marks_obtained: results.total,
          max_marks: results.max,
          assessment_id: assessmentId.current,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || `Error ${res.status}`);
      assessmentId.current = data.assessment_id;
      setHasAssessment(Boolean(data.assessment_id));
      setSavedFor(prev => [...prev, String(selectedStudent)]);
    } catch (err) {
      setSaveError(err.message || "Could not save this result.");
    } finally {
      setSaving(false);
    }
  };

  const handleAnswerChange = (qId, val) => {
    setAnswers(prev => ({ ...prev, [qId]: val }));
  };

  const handleCorrect = async () => {
    setIsProcessing(true);
    try {
      const token = getToken();
      const corrected = await Promise.all(
        questions.map(async (q) => {
          // The scanner already marked this one, and the teacher did not
          // change what it read. Sending the same answer back would pay for a
          // second opinion on work already judged, and a different number for
          // identical text is not something anyone can explain to a teacher.
          const scored = scanMarks[q.id];
          if (scored && scored.answer === (answers[q.id] ?? "")) {
            return {
              question_id: q.id,
              question: q.question,
              answer: answers[q.id] || "(no answer)",
              marks_awarded: scored.marks,
              max_marks: q.maxMarks,
              feedback: scored.feedback || "No feedback returned.",
              breakdown: scored.breakdown,
              flagged: scored.flagged,
              reason: scored.reason,
              teacher_marks: scored.teacherMarks,
              is_correct: scored.marks === q.maxMarks,
            };
          }
          try {
            const res = await fetch(`${API}/api/v1/corrections/check`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                question: q.question,
                studentAnswer: answers[q.id] || "(no answer)",
                maxMarks: q.maxMarks,
                rubric: [subjectName, chapterName, classLevel]
                  .filter(Boolean)
                  .concat(`${q.type} question`)
                  .join(" — "),
              }),
            });
            const data = await res.json();
            const awarded = data.marksAwarded ?? data.marks_awarded ?? data.score ?? 0;
            const feedback = data.feedback ?? data.comment ?? data.remarks ?? "No feedback returned.";
            return {
              question_id: q.id,
              question: q.question,
              answer: answers[q.id] || "(no answer)",
              marks_awarded: typeof awarded === "number" ? awarded : 0,
              max_marks: q.maxMarks,
              feedback,
              is_correct: awarded === q.maxMarks,
            };
          } catch {
            return {
              question_id: q.id,
              question: q.question,
              answer: answers[q.id] || "(no answer)",
              marks_awarded: 0,
              max_marks: q.maxMarks,
              feedback: "Could not evaluate. Please try again.",
              is_correct: false,
            };
          }
        })
      );
      const total = corrected.reduce((s, r) => s + r.marks_awarded, 0);
      setResults({ items: corrected, total, max: totalMarks, percentage: totalMarks ? Math.round((total / totalMarks) * 100) : 0 });
      setStep(3);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setSaveError("");
    setAnswers({});
    setResults(null);
    // The next paper is a different student's. Leaving the scan behind would
    // carry one student's transcription and marking check onto the next.
    setSheets([]);
    setScanned(null);
    setAudit(null);
    setScanError("");
    setScanMarks({});
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
          style={{ background: "linear-gradient(135deg,#10B981,#06B6D4)" }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#F1F5F9", fontFamily: "var(--font-space-grotesk)" }}>
            Automatic Correction
          </h1>
          <p className="text-sm" style={{ color: "#94A3B8" }}>AI-powered answer evaluation and grading</p>
        </div>
        <span className="ml-auto text-xs font-semibold px-3 py-1 rounded-full"
          style={{ background: "#ECFDF5", color: "#10B981", border: "1px solid #A7F3D0" }}>
          AI Connected
        </span>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {["Setup", "Enter Answers", "Results"].map((s, i) => {
          const n = i + 1;
          const isDone    = step > n;
          const isActive  = step === n;
          return (
            <div key={s} className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    background: isDone ? "#10B981" : isActive ? "#6366F1" : "#E2E8F0",
                    color: isDone || isActive ? "white" : "#94A3B8",
                  }}>
                  {isDone ? "✓" : n}
                </div>
                <span className="text-xs font-semibold" style={{ color: isActive ? "#6366F1" : "#94A3B8" }}>{s}</span>
              </div>
              {i < 2 && <div className="flex-1 h-px w-8" style={{ background: step > n ? "#10B981" : "#E2E8F0" }} />}
            </div>
          );
        })}
      </div>

      {/* Step 1: Setup */}
      {step === 1 && (
        <div className="bg-white rounded-2xl p-6 space-y-5" style={{ border: "1px solid rgba(99,102,241,0.1)" }}>
          <h2 className="text-base font-bold" style={{ color: "#0F172A" }}>Setup Correction</h2>

          {setupLocked && (
            <p className="text-xs p-3 rounded-xl" style={{ background: "#F8FAFC", color: "#64748B", border: "1px solid #E2E8F0" }}>
              Subject, chapter and test type are fixed for this sitting — the
              papers saved so far all belong to{" "}
              <span className="font-semibold">{testTypeLabel} — {chapterName || subjectName || "this paper"}</span>.
              Finish the class, then start a new correction to change them.
            </p>
          )}

          {hasSubjects && (
            <div>
              <label className="text-xs font-semibold block mb-2" style={{ color: "#64748B" }}>Subject</label>
              <select value={selectedSubject} disabled={setupLocked}
                onChange={e => {
                  setSelectedSubject(e.target.value);
                  // The chapter in hand belongs to the subject just left.
                  setSelectedChapter("");
                }}
                className="w-full text-sm rounded-xl px-3 py-2.5 outline-none disabled:opacity-60"
                style={{ border: "1px solid #E2E8F0", color: "#0F172A", background: "#F8FAFC" }}>
                <option value="">-- Select subject --</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <p className="text-xs mt-1.5" style={{ color: "#94A3B8" }}>
                The marker needs this: the same answer is worth different marks
                in different subjects.
                {classLevel ? ` Class is ${classLevel}, from the class you are working in.` : ""}
              </p>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold block mb-2" style={{ color: "#64748B" }}>
              Topic / Chapter <span className="font-normal" style={{ color: "#94A3B8" }}>— optional</span>
            </label>
            <select value={selectedChapter} onChange={e => setSelectedChapter(e.target.value)}
              disabled={setupLocked || needsSubject}
              className="w-full text-sm rounded-xl px-3 py-2.5 outline-none disabled:opacity-60"
              style={{ border: "1px solid #E2E8F0", color: "#0F172A", background: "#F8FAFC" }}>
              <option value="">
                {needsSubject ? "-- Choose a subject first --" : "-- Whole subject --"}
              </option>
              {chaptersForSubject.map(t => (
                <option key={t.chapter_id} value={t.chapter_id}>
                  {t.chapter_name || t.content_title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold block mb-2" style={{ color: "#64748B" }}>Test type</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {TEST_TYPES.map(opt => (
                <button key={opt.value} type="button" disabled={setupLocked}
                  onClick={() => setTestType(opt.value)}
                  className="py-2.5 px-2 rounded-xl text-xs font-semibold cursor-pointer transition-all disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    background: testType === opt.value ? "#EEF2FF" : "#F8FAFC",
                    border: `1px solid ${testType === opt.value ? "#6366F1" : "#E2E8F0"}`,
                    color: testType === opt.value ? "#6366F1" : "#64748B",
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-xs mt-1.5" style={{ color: "#94A3B8" }}>
              How the result is filed in the reports. It does not change the
              marking.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold block mb-2" style={{ color: "#64748B" }}>Correct for</label>
            <div className="flex gap-3">
              {[
                { value: "class",   label: "Entire Class",   icon: "👥" },
                { value: "student", label: "Single Student", icon: "👤" },
              ].map(opt => (
                <button key={opt.value} onClick={() => setStudentMode(opt.value)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer"
                  style={{
                    background: studentMode === opt.value ? "#EEF2FF" : "#F8FAFC",
                    border: `1px solid ${studentMode === opt.value ? "#6366F1" : "#E2E8F0"}`,
                    color: studentMode === opt.value ? "#6366F1" : "#64748B",
                  }}>
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>
          </div>

          {studentMode === "student" && (
            <div>
              <label className="text-xs font-semibold block mb-2" style={{ color: "#64748B" }}>Select Student</label>
              <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}
                className="w-full text-sm rounded-xl px-3 py-2.5 outline-none"
                style={{ border: "1px solid #E2E8F0", color: "#0F172A", background: "#F8FAFC" }}>
                <option value="">-- Select student --</option>
                {students.map(s => (
                  <option key={s.student_id} value={s.student_id}>{s.roll_no}. {s.full_name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Upload question paper (PDF) */}
          <div>
            <label className="text-xs font-semibold block mb-2" style={{ color: "#64748B" }}>Question Paper (PDF)</label>
            <label className="flex items-center justify-center gap-2 w-full py-4 rounded-xl cursor-pointer transition-all text-sm font-semibold"
              style={{ border: "1.5px dashed #C7D2FE", color: "#6366F1", background: "#F8FAFC" }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.9A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              {uploading ? "Reading PDF…" : questions.length > 0 ? "Replace question paper (PDF)" : "Upload question paper (PDF)"}
              <input type="file" accept="application/pdf" className="hidden" onChange={handleUploadPdf} disabled={uploading} />
            </label>
            {uploadError && <p className="text-xs mt-2" style={{ color: "#EF4444" }}>{uploadError}</p>}
          </div>

          {/* Extracted questions — review & remove any mis-read ones */}
          {questions.length > 0 && (
            <div className="p-4 rounded-xl" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
              <p className="text-xs font-semibold mb-2.5" style={{ color: "#64748B" }}>
                {questions.length} question{questions.length > 1 ? "s" : ""} extracted · {totalMarks} marks
                <span className="font-normal" style={{ color: "#94A3B8" }}> — review & remove any that look wrong</span>
              </p>
              <ul className="space-y-1.5 max-h-44 overflow-y-auto">
                {questions.map((q, i) => (
                  <li key={q.id} className="flex items-start justify-between gap-2 text-xs" style={{ color: "#475569" }}>
                    <span className="min-w-0">
                      <span className="font-semibold">{i + 1}.</span> {q.question}{" "}
                      <span style={{ color: "#94A3B8" }}>({q.maxMarks})</span>
                    </span>
                    <button onClick={() => setQuestions(qs => qs.filter(x => x.id !== q.id))}
                      className="shrink-0 cursor-pointer" style={{ color: "#94A3B8" }} title="Remove question">✕</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Answer sheet — optional. Without it the teacher types the answers
              in, exactly as before; with it the scanner transcribes them and
              she corrects what it got wrong. */}
          <div>
            <label className="text-xs font-semibold block mb-2" style={{ color: "#64748B" }}>
              Answer Sheet <span className="font-normal" style={{ color: "#94A3B8" }}>— optional, scan or photo</span>
            </label>

            <div className="flex gap-2 mb-2.5">
              {[
                { id: "direct_grade",   label: "Not yet marked" },
                { id: "verify_teacher", label: "Already marked — check it" },
              ].map(option => (
                <button key={option.id} type="button" onClick={() => setScanMode(option.id)}
                  className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold cursor-pointer transition-all"
                  style={{
                    background: scanMode === option.id ? "#EEF2FF" : "#F8FAFC",
                    border: `1px solid ${scanMode === option.id ? "#6366F1" : "#E2E8F0"}`,
                    color: scanMode === option.id ? "#6366F1" : "#64748B",
                  }}>
                  {option.label}
                </button>
              ))}
            </div>

            <label className="flex items-center justify-center gap-2 w-full py-4 rounded-xl cursor-pointer transition-all text-sm font-semibold"
              style={{ border: "1.5px dashed #C7D2FE", color: "#6366F1", background: "#F8FAFC" }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {sheets.length
                ? `${sheets.length} page${sheets.length > 1 ? "s" : ""} selected — replace`
                : "Upload answer sheet (PDF or photo)"}
              <input type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={e => { setSheets(Array.from(e.target.files || [])); setScanError(""); }}
                disabled={scanning} />
            </label>

            {sheets.length > 0 && (
              <button onClick={handleScan} disabled={scanning || needsSubject}
                className="w-full mt-2.5 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(135deg,#10B981,#06B6D4)" }}>
                {scanning ? "Reading the handwriting…" : "Read answer sheet →"}
              </button>
            )}
            {sheets.length > 0 && needsSubject && (
              <p className="text-xs mt-2" style={{ color: "#B45309" }}>
                Choose the subject above first — the marker needs it to know
                what it is reading.
              </p>
            )}
            {scanning && (
              <p className="text-xs mt-2" style={{ color: "#94A3B8" }}>
                A multi-page paper can take a minute or two.
              </p>
            )}
            {scanError && <p className="text-xs mt-2" style={{ color: "#EF4444" }}>{scanError}</p>}
          </div>

          <button onClick={() => setStep(2)} disabled={questions.length === 0 || needsSubject}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(135deg,#6366F1,#8B5CF6)" }}>
            Start Entering Answers →
          </button>
        </div>
      )}

      {/* Step 2: Enter Answers */}
      {step === 2 && (
        <div className="space-y-4">

          {/* Said plainly, because a teacher who trusts the transcription
              without reading it is the one way this puts a wrong mark on a
              student's record. */}
          {scanned !== null && (
            <div className="rounded-2xl p-4" style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
              <p className="text-sm font-semibold" style={{ color: "#92400E" }}>
                These answers were read off the scan — please check them before grading.
              </p>
              {(scanned.name || scanned.roll) && (
                <p className="text-xs mt-1" style={{ color: "#B45309" }}>
                  Cover sheet reads{scanned.name ? ` ${scanned.name}` : ""}
                  {scanned.roll ? `, roll no ${scanned.roll}` : ""}. Confirm the student selected above matches.
                </p>
              )}
            </div>
          )}

          {questions.map((q, idx) => (
            <div key={q.id} className="bg-white rounded-2xl p-5"
              style={{ border: "1px solid rgba(99,102,241,0.1)" }}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-start gap-2.5">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5"
                    style={{ background: "linear-gradient(135deg,#6366F1,#8B5CF6)" }}>
                    {idx + 1}
                  </span>
                  <p className="text-sm font-semibold" style={{ color: "#0F172A" }}>{q.question}</p>
                </div>
                <span className="text-xs font-bold shrink-0 px-2 py-0.5 rounded-full"
                  style={{ background: "#EEF2FF", color: "#6366F1" }}>
                  {q.maxMarks} {q.maxMarks === 1 ? "mark" : "marks"}
                </span>
              </div>

              {q.type === "mcq" ? (
                <div className="grid grid-cols-2 gap-2 pl-8">
                  {q.options.map(opt => (
                    <button key={opt} onClick={() => handleAnswerChange(q.id, opt)}
                      className="py-2 px-3 rounded-xl text-sm transition-all cursor-pointer text-left"
                      style={{
                        background: answers[q.id] === opt ? "#EEF2FF" : "#F8FAFC",
                        border: `1px solid ${answers[q.id] === opt ? "#6366F1" : "#E2E8F0"}`,
                        color: answers[q.id] === opt ? "#6366F1" : "#475569",
                        fontWeight: answers[q.id] === opt ? "600" : "400",
                      }}>
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <textarea
                  value={answers[q.id] || ""}
                  onChange={e => handleAnswerChange(q.id, e.target.value)}
                  placeholder="Type the student's answer here…"
                  className="w-full ml-8 p-3 text-sm rounded-xl resize-none outline-none"
                  style={{
                    border: "1px solid #E2E8F0",
                    color: "#0F172A",
                    minHeight: q.type === "long" ? "100px" : "60px",
                    width: "calc(100% - 2rem)",
                  }}
                />
              )}
            </div>
          ))}

          <div className="flex gap-3">
            <button onClick={() => setStep(1)}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all"
              style={{ background: "#F1F5F9", color: "#64748B", border: "1px solid #E2E8F0" }}>
              ← Back
            </button>
            <button onClick={handleCorrect} disabled={isProcessing}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer transition-all disabled:opacity-60"
              style={{ background: "linear-gradient(135deg,#10B981,#06B6D4)" }}>
              {isProcessing ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  AI Evaluating…
                </span>
              ) : "Submit for AI Correction →"}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Results */}
      {step === 3 && results && (
        <div className="space-y-4">
          {/* Score summary */}
          <div className="bg-white rounded-2xl p-6 text-center"
            style={{ border: "1px solid rgba(99,102,241,0.1)" }}>
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold"
              style={{ background: `linear-gradient(135deg,${GRADE_STYLE[getGrade(results.percentage)]?.color || "#6366F1"},#8B5CF6)` }}>
              {getGrade(results.percentage)}
            </div>
            <p className="text-3xl font-bold mb-1" style={{ color: "#0F172A", fontFamily: "var(--font-space-grotesk)" }}>
              {results.total} / {results.max}
            </p>
            <p className="text-sm" style={{ color: "#94A3B8" }}>
              {[`${results.percentage}%`, testTypeLabel, subjectName, chapterName]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <div className="mt-4 h-2 rounded-full overflow-hidden" style={{ background: "#EEF2FF" }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${results.percentage}%`, background: "linear-gradient(90deg,#6366F1,#10B981)" }} />
            </div>
          </div>

          {/* Checking the teacher's own marking.

              Only in verify_teacher mode, and deliberately framed as a second
              opinion rather than a verdict: the scanner is reading pen marks
              off a photograph, and a disagreement is a prompt to look again,
              not proof that the teacher was wrong. */}
          {audit && (
            <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid rgba(99,102,241,0.1)" }}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <h3 className="text-sm font-bold" style={{ color: "#0F172A" }}>Marking check</h3>
                {audit.status && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={
                      audit.status === "accurate"
                        ? { background: "#ECFDF5", color: "#10B981" }
                        : { background: "#FFFBEB", color: "#B45309" }
                    }>
                    {String(audit.status).replace(/_/g, " ")}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { label: "On the paper", value: audit.teacherTotal },
                  { label: "Scanner's total", value: audit.aiTotal },
                  { label: "Difference", value: audit.difference },
                ].map(cell => (
                  <div key={cell.label} className="p-3 rounded-xl" style={{ background: "#F8FAFC" }}>
                    <p className="text-lg font-bold" style={{ color: "#0F172A" }}>
                      {cell.value ?? "—"}
                    </p>
                    <p className="text-xs" style={{ color: "#94A3B8" }}>{cell.label}</p>
                  </div>
                ))}
              </div>

              {audit.totallingError && (
                <p className="text-xs mt-3 p-3 rounded-xl" style={{ background: "#FEF2F2", color: "#B91C1C" }}>
                  The marks written on the paper do not add up to the total on the front page.
                </p>
              )}

              <p className="text-xs mt-3" style={{ color: "#94A3B8" }}>
                A second opinion, not a correction. Check the paper yourself before changing a mark.
              </p>
            </div>
          )}

          {/* Keeping the result. Only a named student can have a mark, so the
              class-wide mode explains itself rather than offering a dead button. */}
          <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid rgba(99,102,241,0.1)" }}>
            {!selectedStudent ? (
              <p className="text-sm" style={{ color: "#64748B" }}>
                Pick a student on the first step to save this result against them.
                Without one it can be read here but not recorded.
              </p>
            ) : savedFor.includes(String(selectedStudent)) ? (
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs"
                  style={{ background: "#10B981" }}>✓</span>
                <p className="text-sm font-semibold" style={{ color: "#059669" }}>
                  Saved. It will show in the marks reports for this class.
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div style={{ minWidth: 0 }}>
                  <p className="text-sm font-semibold" style={{ color: "#0F172A" }}>
                    Save {results.total} / {results.max} for this student
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
                    {hasAssessment
                      ? "Added to the test you started this sitting."
                      : "Creates the test; the next student joins the same one."}
                  </p>
                </div>
                <button onClick={handleSave} disabled={saving}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold text-white cursor-pointer ai-gradient disabled:opacity-60"
                  style={{ boxShadow: "0 4px 12px rgba(99,102,241,0.3)" }}>
                  {saving ? "Saving…" : "Save result"}
                </button>
              </div>
            )}
            {saveError && (
              <p className="text-xs mt-3" style={{ color: "#DC2626" }}>{saveError}</p>
            )}
          </div>

          {/* Per-question breakdown */}
          {results.items.map((r, idx) => (
            <div key={r.question_id} className="bg-white rounded-2xl p-5"
              style={{ border: `1px solid ${r.is_correct ? "rgba(16,185,129,0.2)" : "rgba(99,102,241,0.1)"}` }}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-start gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs text-white shrink-0 mt-0.5 ${r.is_correct ? "" : ""}`}
                    style={{ background: r.is_correct ? "#10B981" : "#F59E0B" }}>
                    {r.is_correct ? "✓" : "~"}
                  </span>
                  <p className="text-sm font-semibold" style={{ color: "#0F172A" }}>Q{idx + 1}. {r.question}</p>
                </div>
                <span className="text-xs font-bold shrink-0 px-2 py-0.5 rounded-full"
                  style={{ background: r.is_correct ? "#ECFDF5" : "#EEF2FF", color: r.is_correct ? "#10B981" : "#6366F1" }}>
                  {r.marks_awarded}/{r.max_marks}
                </span>
              </div>
              <div className="ml-7 space-y-1.5">
                <p className="text-xs" style={{ color: "#64748B" }}>
                  <span className="font-semibold">Answer:</span> {r.answer}
                </p>
                <p className="text-xs p-2.5 rounded-lg" style={{ background: "#F8FAFC", color: "#64748B", border: "1px solid #E2E8F0" }}>
                  <span className="font-semibold" style={{ color: "#6366F1" }}>AI Feedback:</span> {r.feedback}
                </p>
              </div>
            </div>
          ))}

          <button onClick={handleReset}
            className="w-full py-3 rounded-xl text-sm font-semibold cursor-pointer transition-all"
            style={{ background: "#EEF2FF", color: "#6366F1", border: "1px solid #C7D2FE" }}>
            ← Start New Correction
          </button>
        </div>
      )}

    </div>
  );
}
