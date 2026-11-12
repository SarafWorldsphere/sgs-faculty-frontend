"use client";

/**
 * Auto test — build a question paper, review it, print it.
 *
 * Three steps: Configure sets the blueprint, the AI writes what it can, and
 * Review is where the teacher fixes anything before printing.
 *
 * The paper on screen is ours, not the AI's. The blueprint decides what the
 * paper contains and what each question is worth; the AI is asked for a count
 * and a type and nothing about totals. Whatever it cannot write still takes
 * its place on the paper as a numbered heading with answer space, so the
 * sections and the marks are right whether or not the service has caught up.
 */

import { useState } from "react";
import ConfigStep from "@/components/autotest/ConfigStep";
import ReviewStep from "@/components/autotest/ReviewStep";
import PrintSheet from "@/components/autotest/PrintSheet";
import SavedPapers from "@/components/autotest/SavedPapers";
import Modal from "@/components/ui/Modal";
import {
  generateQuestionPaper, regenerateQuestion, saveQuestionPaper,
} from "@/lib/api";
import { saveBlueprint } from "@/lib/savedBlueprints";
import { questionTypeLabel } from "@/lib/testBlueprints";

const STEPS = ["Configure", "Review", "Print"];

/* ─── Reading the AI's answer ─────────────────────────────── */

/** The questions out of whatever envelope the service wrapped them in. */
function unwrap(data) {
  if (Array.isArray(data)) return data;
  for (const key of ["questions", "data", "questionPaper", "question_paper", "items"]) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return null;
}

/**
 * The seven ids, from whatever the service called it.
 *
 * The design asks for the id outright. Until that lands, a few obvious
 * spellings are accepted and the shape of the question is the last resort —
 * four options is a multiple choice whatever it is labelled.
 */
const TYPE_ALIASES = {
  mcq: "mcq", multiplechoice: "mcq", multiple_choice: "mcq", objective: "mcq",
  fill: "fill", fillintheblanks: "fill", fill_in_the_blanks: "fill", blanks: "fill",
  truefalse: "truefalse", true_false: "truefalse", tf: "truefalse",
  oneword: "oneword", one_word: "oneword", onewordanswer: "oneword",
  short: "short", shortanswer: "short", short_answer: "short",
  long: "long", longanswer: "long", long_answer: "long", essay: "long",
  match: "match", matchthefollowing: "match", matching: "match",
};

function readType(q) {
  const raw = q?.type ?? q?.questionType ?? q?.question_type ?? "";
  const key = String(raw).toLowerCase().replace(/[^a-z_]/g, "");
  if (TYPE_ALIASES[key]) return TYPE_ALIASES[key];
  if (Array.isArray(q?.options) && q.options.length >= 2) return "mcq";
  if (typeof q?.answer === "boolean") return "truefalse";
  return null;
}

/** One question in the shape the review and print screens read. */
function normalise(q, type, marks) {
  const answerIndex =
    Number.isInteger(q?.answer_index) ? q.answer_index :
    Number.isInteger(q?.answerIndex)  ? q.answerIndex  :
    Array.isArray(q?.options) && typeof q?.answer === "string"
      ? q.options.findIndex((o) => String(typeof o === "string" ? o : o?.text).trim().toLowerCase()
                                   === q.answer.trim().toLowerCase())
      : undefined;

  return {
    type,
    marks,
    question:  q?.question ?? q?.q ?? q?.questionText ?? q?.text ?? "",
    sentence:  q?.sentence ?? undefined,
    statement: q?.statement ?? undefined,
    options:   Array.isArray(q?.options) ? q.options : (q?.choices ?? undefined),
    answer_index: answerIndex >= 0 ? answerIndex : undefined,
    answer:    q?.answer ?? q?.correctAnswer ?? q?.correct_answer ?? undefined,
    key_points: q?.key_points ?? q?.keyPoints ?? undefined,
    column_a:  q?.column_a ?? q?.columnA ?? undefined,
    column_b:  q?.column_b ?? q?.columnB ?? undefined,
    pairs:     q?.pairs ?? undefined,
    pending:   false,
  };
}

/**
 * Lay the AI's questions onto the blueprint.
 *
 * The blueprint is the authority: it says the paper has five short answers
 * worth two each, so the paper has five, filled from the response where the
 * service produced them and left blank where it did not. Anything the service
 * returned that the blueprint did not ask for is kept at the end rather than
 * discarded — a question too many is visible and droppable, a question
 * silently thrown away is not.
 */
function buildPaper(config, raw) {
  const pool = new Map();           // type → questions still unused
  const spare = [];

  for (const q of raw ?? []) {
    const type = readType(q);
    if (!type) { spare.push(q); continue; }
    if (!pool.has(type)) pool.set(type, []);
    pool.get(type).push(q);
  }

  const paper = [];
  for (const row of config.blueprint ?? []) {
    const available = pool.get(row.id) ?? [];
    for (let i = 0; i < row.count; i += 1) {
      const q = available.shift();
      paper.push(q
        ? normalise(q, row.id, row.each)
        : { type: row.id, marks: row.each, pending: true, question: "" });
    }
  }

  // Whatever the blueprint did not claim.
  for (const [type, left] of pool) {
    for (const q of left) paper.push(normalise(q, type, 0));
  }
  for (const q of spare) paper.push(normalise(q, "other", 0));

  return paper;
}

/* ─── Generating ──────────────────────────────────────────── */

function GeneratingStep({ config }) {
  const lines = [
    "Reading the chapters…",
    "Applying the difficulty mix…",
    "Writing questions to the blueprint…",
    "Preparing the answer key…",
    "Laying out the sections…",
  ];
  return (
    <div className="bg-white rounded-2xl p-12 shadow-sm max-w-xl mx-auto text-center"
      style={{ border: "1px solid rgba(99,102,241,0.1)" }}>
      <div className="w-16 h-16 rounded-2xl ai-gradient mx-auto mb-5 flex items-center justify-center pulse-glow">
        <svg className="w-8 h-8 text-white animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </div>
      <h2 className="text-lg font-bold mb-1" style={{ color: "#0F172A", fontFamily: "var(--font-space-grotesk)" }}>
        Writing your paper…
      </h2>
      <p className="text-xs mb-8" style={{ color: "#94A3B8" }}>
        {config?.label} · {config?.totalMarks} marks
        {config?.chapterNames?.length ? ` · ${config.chapterNames.join(", ")}` : ""}
      </p>
      <div className="space-y-2.5 text-left">
        {lines.map((s, i) => (
          <div key={i} className="flex items-center gap-2.5 animate-fade-in" style={{ animationDelay: `${i * 0.3}s` }}>
            <div className="w-4 h-4 rounded-full ai-gradient flex items-center justify-center flex-shrink-0">
              <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-xs" style={{ color: "#64748B" }}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────── */

export default function AutoTestPage() {
  const [step, setStep]           = useState(0);
  const [config, setConfig]       = useState(null);
  const [initial, setInitial]     = useState(null);   // a blueprint being reused
  const [questions, setQuestions] = useState([]);
  const [rawResponse, setRaw]     = useState(null);
  const [error, setError]         = useState("");

  const [printing, setPrinting]   = useState(null);   // { paper, mode }
  const [saved, setSaved]         = useState(null);
  const [saving, setSaving]       = useState(false);
  const [savedKey, setSavedKey]   = useState(0);

  const [namingFor, setNamingFor] = useState(null);   // config pending a blueprint name
  const [blueprintName, setName]  = useState("");

  const handleGenerate = async (cfg) => {
    setConfig(cfg);
    setError("");
    setSaved(null);
    setStep(1);
    try {
      const data = await generateQuestionPaper(cfg);
      const raw = unwrap(data);
      setRaw(raw ? null : (typeof data?.questionPaper === "string" ? data.questionPaper : data));
      setQuestions(buildPaper(cfg, raw));
      setStep(2);
    } catch (err) {
      setError(err.message || "Couldn't generate the paper. Please try again.");
      setStep(0);
    }
  };

  /** Rewrite and Replace — one question, same type and marks. */
  const handleRegenerate = async (index, exclude) => {
    const current = questions[index];
    if (!current) return;
    setError("");
    try {
      const fresh = await regenerateQuestion({
        type: current.type,
        marks: current.marks,
        chapterIds: config?.chapterIds ?? [],
        difficulty: current.difficulty ?? null,
        exclude: exclude ? [current.question || current.sentence || current.statement || ""] : [],
      });
      const one = Array.isArray(fresh) ? fresh[0] : (unwrap(fresh)?.[0] ?? fresh);
      if (!one) throw new Error("The service sent nothing back.");
      setQuestions((prev) => prev.map((q, i) =>
        i === index ? normalise(one, current.type, current.marks) : q));
    } catch (err) {
      setError(
        err.status === 404
          ? `Rewriting one question isn't available yet — the AI service hasn't shipped that endpoint. Drop the question, or regenerate the whole paper.`
          : (err.message || "Couldn't rewrite that question.")
      );
    }
  };

  const handleSave = async (paper) => {
    if (saving || saved) return;
    if (!paper.title?.trim()) { setError("Give the paper a title before saving."); return; }
    setSaving(true);
    setError("");
    try {
      const stored = await saveQuestionPaper({
        title: paper.title.trim(),
        chapterId: config?.chapterIds?.[0] ?? null,
        subject: config?.subject ?? null,
        difficulty: null,
        totalMarks: paper.total_marks ?? null,
        questionType: null,
        paperText: paper.paper_text ?? null,
        questions: paper.questions ?? null,
      });
      setSaved(stored);
      setSavedKey((k) => k + 1);
    } catch (err) {
      setError(err.message || "Couldn't save the paper.");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setStep(0);
    setQuestions([]);
    setRaw(null);
    setSaved(null);
    setError("");
  };

  const confirmBlueprintName = () => {
    if (!blueprintName.trim() || !namingFor) return;
    saveBlueprint(blueprintName, namingFor);
    setNamingFor(null);
    setName("");
    setSavedKey((k) => k + 1);
  };

  const useBlueprint = (b) => {
    setInitial(b);
    reset();
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-8 h-8 rounded-lg ai-gradient flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold" style={{ color: "#F1F5F9", fontFamily: "var(--font-space-grotesk)" }}>
              Auto test
            </h1>
          </div>
          <p className="text-sm pl-10" style={{ color: "#94A3B8" }}>
            Build a question paper for your class, then edit it before you print.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className="w-6 h-px" style={{ background: step > i - 1 ? "#6366F1" : "#E2E8F0" }} />}
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={step === i
                    ? { background: "linear-gradient(135deg,#6366F1,#8B5CF6)", color: "#fff" }
                    : step > i
                    ? { background: "#ECFDF5", color: "#059669" }
                    : { background: "#F1F5F9", color: "#94A3B8" }}>
                  {step > i ? "✓" : i + 1}
                </div>
                <span className="text-xs font-medium hidden sm:block"
                  style={{ color: step === i ? "#6366F1" : step > i ? "#059669" : "#94A3B8" }}>{s}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl p-4 flex items-start gap-3"
          style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
          <svg className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#EF4444" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm" style={{ color: "#991B1B" }}>{error}</p>
        </div>
      )}

      {step === 0 && (
        <ConfigStep
          key={initial?.id ?? "fresh"}
          initial={initial}
          onGenerate={handleGenerate}
          onSaveBlueprint={(cfg) => { setNamingFor(cfg); setName(""); }}
        />
      )}
      {step === 1 && <GeneratingStep config={config} />}
      {step === 2 && (
        <ReviewStep
          config={config}
          questions={questions}
          rawResponse={rawResponse}
          saved={saved}
          saving={saving}
          error=""
          onBack={reset}
          onPrint={(paper, mode) => setPrinting({ paper, mode })}
          onSave={handleSave}
          onQuestionsChange={setQuestions}
          onRegenerate={handleRegenerate}
        />
      )}

      <SavedPapers
        refreshKey={savedKey}
        onPrint={(paper, mode) => setPrinting({ paper, mode })}
        onUseBlueprint={useBlueprint}
      />

      <PrintSheet
        paper={printing?.paper}
        mode={printing?.mode}
        onDone={() => setPrinting(null)}
      />

      <Modal isOpen={!!namingFor} onClose={() => setNamingFor(null)} title="Save as blueprint" maxWidth="max-w-md">
        <div className="px-6 py-5">
          <p className="text-sm mb-4" style={{ color: "#64748B" }}>
            Keeps the test type, the blueprint and the difficulty mix — not the chapters, which
            change with every paper.
          </p>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "#475569" }}>Name</label>
          <input
            value={blueprintName}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") confirmBlueprintName(); }}
            placeholder="PT — Science standard"
            autoFocus
            className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
            style={{ border: "1.5px solid #E2E8F0", color: "#0F172A" }} />
          {namingFor && (
            <p className="text-xs mt-2" style={{ color: "#94A3B8" }}>
              {namingFor.blueprint?.map((b) => `${b.count} × ${questionTypeLabel(b.id)}`).join(", ")}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2.5">
            <button onClick={() => setNamingFor(null)}
              className="px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer"
              style={{ border: "1.5px solid #E2E8F0", color: "#334155" }}>Cancel</button>
            <button onClick={confirmBlueprintName} disabled={!blueprintName.trim()}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white cursor-pointer ai-gradient disabled:opacity-60 disabled:cursor-not-allowed">
              Save
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
