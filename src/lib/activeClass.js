"use client";

/**
 * Which class the teacher is currently working in.
 *
 * Most teachers have one, and for them this changes nothing: no class_id is
 * sent and the backend uses their primary assignment, exactly as before.
 * Teachers who take several classes pick one in the header, and every
 * class-scoped request carries it.
 *
 * The choice is per-browser and deliberately not in the URL — every page reads
 * it from here, so a teacher does not have to carry a query string around the
 * app. The backend re-checks the id against the teacher's real assignments on
 * every request, so nothing here is trusted as authorisation.
 */

const KEY = "swais_faculty_active_class";

export function getActiveClass() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  const id = Number(raw);
  return raw && Number.isFinite(id) ? id : null;
}

export function setActiveClass(classId) {
  if (typeof window === "undefined") return;
  if (classId === null || classId === undefined || classId === "") {
    localStorage.removeItem(KEY);
  } else {
    localStorage.setItem(KEY, String(classId));
  }
}

export function clearActiveClass() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

/**
 * Append the active class to a URL. Handles a query string already being
 * there, so callers do not have to know whether one is.
 */
export function withClass(url) {
  const classId = getActiveClass();
  if (!classId) return url;
  return `${url}${url.includes("?") ? "&" : "?"}class_id=${classId}`;
}
