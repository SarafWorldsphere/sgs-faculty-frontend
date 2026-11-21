"use client";

/**
 * ============================================================
 * Syllabus Planner API — a second backend, not the faculty one
 * ============================================================
 * The planner is its own service (saraswati-syllabus-planner), reached at
 * NEXT_PUBLIC_PLANNER_BASE_URL. It is deliberately separate from the faculty
 * backend in lib/api.js, and two of its rules differ:
 *
 *   - No X-Class-Id. The planner ignores that header. A teacher marks several
 *     classes in one day, so class_id travels per row, not per request.
 *   - The school comes from the Host header, resolved by the tenant kit.
 *     There is no school id in any path.
 *
 * Same bearer token as the faculty backend until login mints the planner's
 * own claims. In development the service also accepts "dev-faculty".
 * ============================================================
 */

const PLANNER_BASE =
  process.env.NEXT_PUBLIC_PLANNER_BASE_URL || "http://localhost:8010";

const TOKEN_KEY = "swais_faculty_token";

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * A sentence a teacher can read, from whatever shape the error arrived in.
 *
 * Same reason as lib/api.js: FastAPI returns `detail` as a string for a
 * raised HTTPException but as an array of objects for a validation failure,
 * and passing that to new Error() prints "[object Object]".
 */
async function errorMessage(res) {
  const fallback = `HTTP ${res.status}`;
  let body;
  try {
    body = await res.json();
  } catch {
    return fallback;
  }

  const detail = body?.detail ?? body?.error ?? body?.message;
  if (!detail) return fallback;
  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    const parts = detail
      .map((d) => {
        if (typeof d === "string") return d;
        const field = Array.isArray(d?.loc) ? d.loc.filter((p) => p !== "body").join(".") : "";
        const msg = d?.msg || d?.message || "";
        return field ? `${field}: ${msg}` : msg;
      })
      .filter(Boolean);
    if (parts.length) return parts.join(", ");
  }
  return fallback;
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${PLANNER_BASE}/api/v1${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const err = new Error(await errorMessage(res));
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

const qs = (params) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, value);
  });
  const text = search.toString();
  return text ? `?${text}` : "";
};

// ── Daily marking ────────────────────────────────────────────────────────────

/**
 * Today's periods from the school timetable, with whatever is already marked.
 *
 * is_working_day false is a Sunday or a school holiday — the screen shows the
 * day as closed rather than an empty list, which would read as "no periods".
 */
export function fetchToday(date) {
  return request(`/teaching-log/today${qs({ date })}`);
}

/**
 * The whole day in one call, not one call per period.
 *
 * Re-sending a day updates what changed: the service keys on
 * (tenant, class, date, period), so a teacher correcting period 3 at 6pm
 * does not create a second row.
 */
export function saveDay(logDate, entries) {
  return request("/teaching-log", {
    method: "POST",
    body: JSON.stringify({ log_date: logDate, entries }),
  });
}

export function fetchTeachingHistory({ from, to, classId } = {}) {
  return request(`/teaching-log${qs({ from, to, class_id: classId })}`);
}

// ── The teacher's own plan ───────────────────────────────────────────────────

export function fetchMyPlan({ classId, subjectId } = {}) {
  return request(`/syllabus-plan/mine${qs({ class_id: classId, subject_id: subjectId })}`);
}

/**
 * Topics with at least one taught mark. With templateId the service narrows it
 * to the blocks that assessment covers, which is the rule the board published.
 */
export function fetchCoveredTopics({ classId, subjectId, templateId } = {}) {
  return request(
    `/syllabus-plan/covered${qs({ class_id: classId, subject_id: subjectId, template_id: templateId })}`
  );
}

// ── Lesson planner ───────────────────────────────────────────────────────────

/**
 * The topic the teacher is actually on, decided by the service — the first
 * active plan row, in order, that is not yet fully taught.
 *
 * The old lesson planner asked the teacher to type a chapter name. She should
 * not have to: the plan already knows where the class has reached.
 */
export function fetchCurrentLesson(classId, subjectId) {
  return request("/lesson-plans/current", {
    method: "POST",
    body: JSON.stringify({ class_id: classId, subject_id: subjectId }),
  });
}
