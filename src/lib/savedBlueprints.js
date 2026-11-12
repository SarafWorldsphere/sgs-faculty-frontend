/**
 * Blueprints the teacher kept, so the next paper starts from the last one.
 *
 * Held in this browser, not on the server. A blueprint is a preference about
 * how someone likes to shape a paper — it is not school data, nothing else
 * reads it, and there is no table for it. Keeping it local means the feature
 * ships without a migration; if it later needs to follow a teacher between
 * devices, the shape below is what a table would store.
 *
 * Every read is wrapped: storage can be unavailable or hold something from an
 * older version of this file, and neither should stop the page rendering.
 */

const KEY = "swais_faculty_blueprints";
const LIMIT = 20;

function read() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((b) => b && b.id && b.name) : [];
  } catch {
    return [];
  }
}

function write(list) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, LIMIT)));
  } catch {
    /* quota or private mode — the list simply does not persist */
  }
}

export function listBlueprints() {
  return read();
}

/**
 * Keep a configuration under a name. Saving the same name twice replaces it,
 * which is what someone adjusting their standard PT expects.
 */
export function saveBlueprint(name, config) {
  const clean = String(name).trim().slice(0, 60);
  if (!clean) return read();

  const entry = {
    id: `${Date.now()}`,
    name: clean,
    savedAt: new Date().toISOString(),
    testType: config.testType,
    examNo: config.examNo ?? null,
    pattern: config.pattern ?? null,
    difficultyMix: config.difficultyMix,
    blueprint: config.blueprint,
    minutes: config.minutes ?? null,
    negativeMarking: config.negativeMarking ?? false,
    questionCount: config.questionCount ?? null,
    marksEach: config.marksEach ?? null,
    totalMarks: config.totalMarks,
  };

  const next = [entry, ...read().filter((b) => b.name.toLowerCase() !== clean.toLowerCase())];
  write(next);
  return next;
}

export function deleteBlueprint(id) {
  const next = read().filter((b) => b.id !== id);
  write(next);
  return next;
}

/** A one-line description for the list — "7 types · 50 marks · 40/40/20". */
export function describeBlueprint(b) {
  const types = b.blueprint?.length ?? 0;
  const mix = b.difficultyMix
    ? `${b.difficultyMix.Easy}/${b.difficultyMix.Medium}/${b.difficultyMix.Hard}`
    : null;
  return [
    types === 1 ? "MCQ only" : `${types} types`,
    b.totalMarks != null ? `${b.totalMarks} marks` : null,
    mix,
  ].filter(Boolean).join(" · ");
}
