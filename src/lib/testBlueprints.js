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
  { id: "mcq",       label: "Multiple choice",    defaultMarks: 1 },
  { id: "fill",      label: "Fill in the blanks", defaultMarks: 1 },
  { id: "truefalse", label: "True or false",      defaultMarks: 1 },
  { id: "oneword",   label: "One word answer",    defaultMarks: 1 },
  { id: "short",     label: "Short answer",       defaultMarks: 2 },
  { id: "match",     label: "Match the following", defaultMarks: 5 },
  { id: "long",      label: "Long answer",        defaultMarks: 5 },
];

/**
 * Until the AI service publishes what it can do, assume the three it has
 * always returned. Guessing high would promise papers it cannot write;
 * guessing low only means a teacher writes a few questions by hand.
 */
export const ASSUMED_SUPPORTED = ["mcq", "truefalse", "short"];

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
    note: "10 marks · 1 chapter",
    totalMarks: 10,
    group: "school",
    blueprint: { mcq: [5, 1], truefalse: [3, 1], short: [1, 2] },
  },
  {
    id: "ct",
    label: "Class test (CT)",
    note: "12.5 marks · 1–2 chapters",
    totalMarks: 12.5,
    group: "school",
    blueprint: { mcq: [5, 1], fill: [5, 1], short: [1, 2.5] },
  },
  {
    id: "pt",
    label: "Periodic test (PT)",
    note: "50 marks · 2–3 chapters",
    totalMarks: 50,
    group: "school",
    numbered: ["PT-1", "PT-2", "PT-3", "PT-4"],
    blueprint: { mcq: [10, 1], fill: [5, 1], truefalse: [5, 1], oneword: [5, 1], short: [5, 2], match: [1, 5], long: [2, 5] },
  },
  {
    id: "term",
    label: "Term exam",
    note: "80 marks · full syllabus",
    totalMarks: 80,
    group: "school",
    blueprint: { mcq: [15, 1], fill: [5, 1], truefalse: [5, 1], oneword: [5, 1], short: [10, 2], match: [1, 5], long: [5, 5] },
  },
  {
    id: "competitive",
    label: "Competitive test",
    note: "Multiple choice only",
    totalMarks: 50,
    group: "competitive",
    // One type throughout, so there is nothing to balance and the screen asks
    // for a count instead of a blueprint.
    blueprint: { mcq: [50, 1] },
  },
];

/** Patterns that only fill in the numbers; nothing here is locked. */
export const EXAM_PATTERNS = [
  { id: "ntse",    label: "NTSE — stage 1 practice", questions: 50, marks: 1, minutes: 45 },
  { id: "nmms",    label: "NMMS practice",           questions: 45, marks: 1, minutes: 45 },
  { id: "science", label: "Science olympiad",        questions: 35, marks: 1, minutes: 60 },
  { id: "maths",   label: "Maths olympiad",          questions: 35, marks: 1, minutes: 60 },
  { id: "custom",  label: "Custom",                  questions: 50, marks: 1, minutes: 45 },
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

/**
 * Turn a test type's marks-per-type into editable rows.
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
