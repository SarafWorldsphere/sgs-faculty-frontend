/**
 * What a test is made of.
 *
 * A paper is described by a blueprint: how many questions of each type, and
 * what each one is worth. Picking a test type fills the blueprint in; the
 * teacher then adjusts it. The total has to match the paper's marks, and the
 * screen says so rather than quietly generating the wrong length of paper.
 *
 * The seven question types are fixed here rather than read from the AI
 * service. A paper's shape is the school's decision — the service only decides
 * which of them it can write for you, and the ones it cannot are printed as
 * headings with answer space so the paper is still complete.
 */

/** The seven, in the order they appear on a paper. */
export const QUESTION_TYPES = [
  { id: "mcq",       label: "Multiple choice",     defaultMarks: 1 },
  { id: "fill",      label: "Fill in the blanks",  defaultMarks: 1 },
  { id: "truefalse", label: "True or false",       defaultMarks: 1 },
  { id: "oneword",   label: "One word answer",     defaultMarks: 1 },
  { id: "short",     label: "Short answer",        defaultMarks: 2 },
  { id: "match",     label: "Match the following", defaultMarks: 5 },
  { id: "long",      label: "Long answer",         defaultMarks: 5 },
];

/**
 * Until the AI service publishes what it can do, assume the three it has
 * always returned. Guessing high would promise papers it cannot write;
 * guessing low only means a teacher writes a few questions by hand.
 */
export const ASSUMED_SUPPORTED = ["mcq", "truefalse", "short"];

/**
 * The order sections appear on the printed paper, which is not the order of
 * QUESTION_TYPES: match the following sits before the written answers on the
 * school's own paper, so the tally reads A–G down the page.
 */
export const SECTION_ORDER = ["mcq", "fill", "truefalse", "oneword", "match", "short", "long"];

/**
 * The test types, and the paper each one implies.
 *
 * `blueprint` states the count and the marks each outright, as [count, each].
 * An earlier version stored marks per type and divided to get counts, which
 * cannot express a CT: 2.5 marks of one-mark questions rounds to 3, and the
 * paper quietly came out at 14 instead of 12.5. Stating both removes the
 * arithmetic, and every default below adds up exactly.
 */
export const TEST_TYPES = [
  {
    id: "weekly",
    label: "Weekly test",
    shortLabel: "weekly test",
    note: "10 marks · 1 chapter",
    totalMarks: 10,
    minutes: 30,
    group: "school",
    examType: "Weekly",
    blueprint: { mcq: [5, 1], truefalse: [3, 1], short: [1, 2] },
  },
  {
    id: "ct",
    label: "Class test (CT)",
    shortLabel: "class test",
    note: "12.5 marks · 1–2 chapters",
    totalMarks: 12.5,
    minutes: 30,
    group: "school",
    examType: "CT",
    blueprint: { mcq: [5, 1], fill: [5, 1], short: [1, 2.5] },
  },
  {
    id: "pt",
    label: "Periodic test (PT)",
    shortLabel: "periodic test",
    note: "50 marks · 2–3 chapters",
    totalMarks: 50,
    minutes: 60,
    group: "school",
    numbered: ["PT-1", "PT-2", "PT-3", "PT-4"],
    blueprint: { mcq: [10, 1], fill: [5, 1], truefalse: [5, 1], oneword: [5, 1], short: [5, 2], match: [1, 5], long: [2, 5] },
  },
  {
    id: "term",
    label: "Term exam",
    shortLabel: "term exam",
    note: "80 marks · full syllabus",
    totalMarks: 80,
    minutes: 150,
    group: "school",
    examType: "Term",
    blueprint: { mcq: [15, 1], fill: [5, 1], truefalse: [5, 1], oneword: [5, 1], short: [10, 2], match: [1, 5], long: [5, 5] },
  },
  {
    id: "competitive",
    label: "Competitive test",
    shortLabel: "competitive test",
    note: "Multiple choice only",
    totalMarks: 50,
    minutes: 45,
    group: "competitive",
    // One type throughout, so there is nothing to balance and the screen asks
    // for a count instead of a blueprint.
    blueprint: { mcq: [50, 1] },
  },
];

/** Patterns that only fill in the numbers; nothing here is locked. */
export const EXAM_PATTERNS = [
  { id: "ntse",    label: "NTSE — stage 1 practice", target: "NTSE",    questions: 50, marks: 1, minutes: 45 },
  { id: "nmms",    label: "NMMS practice",           target: "NMMS",    questions: 45, marks: 1, minutes: 45 },
  { id: "science", label: "Science olympiad",        target: "Science", questions: 35, marks: 1, minutes: 60 },
  { id: "maths",   label: "Maths olympiad",          target: "Maths",   questions: 35, marks: 1, minutes: 60 },
  { id: "custom",  label: "Custom",                  target: "Custom",  questions: 50, marks: 1, minutes: 45 },
];

export const DIFFICULTIES = ["Easy", "Medium", "Hard"];

/** A real paper carries all three; these are shares of the total. */
export const DEFAULT_MIX = { Easy: 40, Medium: 40, Hard: 20 };
export const COMPETITIVE_MIX = { Easy: 20, Medium: 40, Hard: 40 };

export function testTypeById(id) {
  return TEST_TYPES.find((t) => t.id === id) ?? TEST_TYPES[0];
}

export function questionTypeById(id) {
  return QUESTION_TYPES.find((q) => q.id === id) ?? null;
}

export function questionTypeLabel(id) {
  return questionTypeById(id)?.label ?? id;
}

/**
 * Turn a test type's blueprint into editable rows.
 *
 * A row carries both the count and the marks each, because that is what a
 * teacher thinks in — "five one-mark questions", not "five marks of MCQ".
 */
export function rowsForTestType(typeId) {
  const type = testTypeById(typeId);
  return QUESTION_TYPES
    .filter((q) => type.blueprint[q.id])
    .map((q) => {
      const [count, each] = type.blueprint[q.id];
      return { id: q.id, label: q.label, count, each };
    });
}

/** What the rows add up to. */
export function blueprintTotal(rows) {
  return rows.reduce((sum, r) => sum + (Number(r.count) || 0) * (Number(r.each) || 0), 0);
}

/**
 * The exam this paper belongs to, as the AI service names it.
 *
 * A PT carries its number ("PT-2" → "PT2") because marks entry files results
 * against that exam. The others have one of each per term, so the type alone
 * identifies them.
 */
export function examTypeFor(typeId, examNo) {
  const type = testTypeById(typeId);
  if (type.numbered && examNo) return examNo.replace(/[^A-Za-z0-9]/g, "");
  return type.examType ?? null;
}

/**
 * Group a flat list of questions into printed sections.
 *
 * Every question carries a `type`. One without it cannot be placed, so it goes
 * to the end under "Other" rather than being dropped — a paper the teacher can
 * see and fix beats a paper that silently lost a question.
 */
export function groupIntoSections(questions = []) {
  const byType = new Map();
  for (const q of questions) {
    const key = SECTION_ORDER.includes(q?.type) ? q.type : "other";
    if (!byType.has(key)) byType.set(key, []);
    byType.get(key).push(q);
  }

  const letters = "ABCDEFGH";
  const ordered = [...SECTION_ORDER.filter((id) => byType.has(id)), ...(byType.has("other") ? ["other"] : [])];

  let number = 0;
  return ordered.map((id, i) => {
    const items = byType.get(id);
    const marks = items.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
    const section = {
      id,
      letter: letters[i] ?? "?",
      label: id === "other" ? "Other" : questionTypeLabel(id),
      marks,
      // Numbering runs across the whole paper, not per section — question 11
      // is the eleventh question, whichever section it sits in.
      questions: items.map((q) => ({ ...q, number: ++number })),
    };
    return section;
  });
}
