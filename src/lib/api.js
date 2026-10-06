"use client";

/**
 * ============================================================
 * API Integration Layer — SWAIS Faculty Module
 * ============================================================
 * All calls go to the FastAPI backend at NEXT_PUBLIC_API_BASE_URL.
 * JWT token is read from localStorage (set by AuthContext on login).
 * ============================================================
 */

import { clearActiveClass, withClass } from "@/lib/activeClass";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

// Where to send the user once their session ends — the login app.
// Comes from the environment so each deployment points at its own login app.
// The fallback is a relative path, which resolves against whatever domain this
// app is served from, so it is never a hardcoded host.
export const LOGIN_URL = process.env.NEXT_PUBLIC_LOGIN_URL || "/";

const TOKEN_KEY = "swais_faculty_token";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    // 401 on a protected endpoint means token is invalid/expired — clear session and send to login
    // Skip this for the login endpoint itself (it legitimately returns 401 for bad credentials)
    if (res.status === 401 && !path.includes("/auth/login")) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem("swais_faculty_auth");
      if (typeof window !== "undefined") {
        window.location.href = LOGIN_URL;
      }
    }
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      /* ignore */
    }
    const err = new Error(detail);
    err.status = res.status;   // mark as an HTTP error so callers can distinguish from network errors
    throw err;
  }

  // 204 No Content — no body
  if (res.status === 204) return null;
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────────────

/**
 * Authenticate teacher — POST /api/v1/auth/login
 * Stores JWT in localStorage on success.
 */
export async function loginTeacher(email, password) {
  try {
    const data = await request("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    // Persist token separately so request() can pick it up
    localStorage.setItem(TOKEN_KEY, data.access_token);

    // Build a user object matching what the rest of the frontend expects
    const user = {
      id: `T${String(data.teacher_id).padStart(3, "0")}`,
      teacher_id: data.teacher_id,
      name: data.name,
      email: data.email,
      avatar: data.avatar_initials || data.name.slice(0, 2).toUpperCase(),
      subject: data.subject,
      class: data.class_assigned,
      section: data.section,
      school: data.school_name,
      totalStudents: data.total_students ?? null,
      // Every class this teacher takes. One entry for a single-class teacher,
      // so the header can simply hide the selector when there is nothing to pick.
      classes: data.classes ?? [],
    };

    return { success: true, user };
  } catch (err) {
    // Surface the real error — no offline/demo fallback.
    if (err.status) {
      return { success: false, error: err.message || "Invalid email or password." };
    }
    return { success: false, error: "Unable to reach the server. Please try again." };
  }
}

/**
 * Fetch current user profile from token — GET /api/v1/auth/me
 * Called on app load when a JWT exists but no user profile is cached.
 */
function toProfile(data) {
  return {
    id: `T${String(data.teacher_id).padStart(3, "0")}`,
    teacher_id: data.teacher_id,
    name: data.name,
    email: data.email,
    avatar: data.avatar_initials || data.name.slice(0, 2).toUpperCase(),
    subject: data.subject,
    class: data.class_assigned,
    section: data.section,
    school: data.school_name,
    totalStudents: data.total_students ?? null,
    classes: data.classes ?? [],
  };
}

export async function fetchMe() {
  try {
    // Carries the selected class, so the class name and headcount in the header
    // describe the class the teacher is actually looking at.
    const data = await request(withClass("/api/v1/auth/me"));
    return toProfile(data);
  } catch (err) {
    // A stored class the teacher is no longer assigned to — reassignment, or a
    // deleted map row. Forget the selection and fall back to their primary
    // class rather than leaving the app stuck on a class it cannot read.
    if (err?.status === 403) {
      clearActiveClass();
      try {
        return toProfile(await request("/api/v1/auth/me"));
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Log out — POST /api/v1/auth/logout then clear local token.
 */
export async function logoutTeacher() {
  try {
    await request("/api/v1/auth/logout", { method: "POST" });
  } catch {
    /* ignore server errors on logout */
  } finally {
    localStorage.removeItem(TOKEN_KEY);
  }
}

// ── Notes ─────────────────────────────────────────────────────────────────────

/**
 * Fetch all notes for the current teacher — GET /api/v1/notes
 */
export async function fetchNotes() {
  const data = await request("/api/v1/notes");
  return data.notes; // array of NoteOut
}

/**
 * Create a new note — POST /api/v1/notes
 */
export async function createNote(noteData) {
  return request("/api/v1/notes", {
    method: "POST",
    body: JSON.stringify({
      title: noteData.title,
      content: noteData.content || null,
      chapter: noteData.chapter,
      content_type: noteData.contentType || "typed",
      canvas_image_url: noteData.canvasImageUrl || null,
      tags: noteData.tags || [],
    }),
  });
}

/**
 * Update an existing note — PUT /api/v1/notes/:numericId
 * Accepts id in "N123" format (strips the "N" prefix).
 */
export async function updateNote(id, updates) {
  const numericId = String(id).replace(/^N/, "");
  return request(`/api/v1/notes/${numericId}`, {
    method: "PUT",
    body: JSON.stringify({
      title: updates.title,
      content: updates.content,
      chapter: updates.chapter,
      content_type: updates.contentType,
      canvas_image_url: updates.canvasImageUrl,
      tags: updates.tags,
    }),
  });
}

/**
 * Delete a note — DELETE /api/v1/notes/:numericId
 */
export async function deleteNote(id) {
  const numericId = String(id).replace(/^N/, "");
  await request(`/api/v1/notes/${numericId}`, { method: "DELETE" });
  return { success: true };
}

// ── Chapters ──────────────────────────────────────────────────────────────────

/**
 * Fetch chapter list — GET /api/v1/chapters
 */
export async function fetchChapters() {
  const data = await request("/api/v1/chapters");
  return data.chapters;
}

/**
 * Fetch a single chapter's full text — GET /api/v1/chapters/:id
 */
export async function fetchChapterDetail(chapterId) {
  return request(`/api/v1/chapters/${chapterId}`);
}

// ── Classes / subjects (cascading selection) ─────────────────────────────────

/** GET /api/v1/classes */
export async function fetchClasses() {
  const data = await request("/api/v1/classes");
  return data.classes;
}

/** GET /api/v1/subjects?class_id= */
export async function fetchSubjects(classId) {
  const qs = classId ? `?class_id=${classId}` : "";
  const data = await request(`/api/v1/subjects${qs}`);
  return data.subjects;
}

/** GET /api/v1/chapters?subject_id= */
export async function fetchChaptersBySubject(subjectId) {
  const data = await request(`/api/v1/chapters?subject_id=${subjectId}`);
  return data.chapters;
}

// ── Chapter study material (PDFs) ────────────────────────────────────────────

/** GET /api/v1/chapters/:id/files */
export async function fetchChapterFiles(chapterId) {
  const data = await request(`/api/v1/chapters/${chapterId}/files`);
  return data.files;
}

/**
 * Upload / replace a study-material PDF. Uses multipart, so the Content-Type
 * header is left to the browser (it must set the multipart boundary).
 */
async function uploadRequest(path, file, method = "POST") {
  const token = getToken();
  const body = new FormData();
  body.append("file", file);

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body,
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const b = await res.json();
      detail = b.detail || detail;
    } catch { /* ignore */ }
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

/** POST /api/v1/chapters/:id/files */
export async function uploadChapterFile(chapterId, file) {
  return uploadRequest(`/api/v1/chapters/${chapterId}/files`, file, "POST");
}

/** PUT /api/v1/chapters/files/:fileId — replaces, old copy kept as Inactive */
export async function replaceChapterFile(fileId, file) {
  return uploadRequest(`/api/v1/chapters/files/${fileId}`, file, "PUT");
}

/** DELETE /api/v1/chapters/files/:fileId — soft delete */
export async function deleteChapterFile(fileId) {
  return request(`/api/v1/chapters/files/${fileId}`, { method: "DELETE" });
}

/**
 * Fetch teacher profile from stored login data (no extra API call needed).
 * Profile is already returned at login and stored in AuthContext.
 */
export async function fetchTeacherProfile() {
  // Profile already in localStorage via AuthContext — no need to re-fetch.
  return null;
}

/* ─── Question papers (auto test) ───────────────────────────────────────────
   Generated papers are not stored until the teacher saves one. Saved papers
   are what Print and "Assign to students" work from. */

export async function saveQuestionPaper(paper) {
  // paper: { title, chapterId, subject, difficulty, totalMarks, questionType, paperText | questions }
  return request("/api/v1/question-papers", { method: "POST", body: JSON.stringify(paper) });
}

export async function fetchQuestionPapers() {
  const data = await request("/api/v1/question-papers");
  return data?.papers ?? [];
}

export async function fetchQuestionPaper(id) {
  return request(`/api/v1/question-papers/${id}`);
}

export async function deleteQuestionPaper(id) {
  return request(`/api/v1/question-papers/${id}`, { method: "DELETE" });
}

/** Turn a saved paper into an assignment for the class being worked in. */
export async function assignQuestionPaper(paper, dueDate) {
  return request(withClass("/api/v1/assignments"), {
    method: "POST",
    body: JSON.stringify({
      title: paper.title,
      text: paper.paper_text || (Array.isArray(paper.questions)
        ? paper.questions.map((q, i) => `${i + 1}. ${q.question ?? q.text ?? ""}`).join("\n")
        : null),
      due_date: dueDate,
    }),
  });
}

/* ─── Parent notifications ──────────────────────────────────────────────────
   The teacher's record of what was sent to a student's parents. `sent_via` is
   "manual" — the row is the record, not proof of delivery. */

export async function sendParentNotification({ studentId, type, message }) {
  // The class is sent so the backend checks the child is on that class's roll.
  return request(withClass("/api/v1/parent-notifications"), {
    method: "POST",
    body: JSON.stringify({ student_id: studentId, notification_type: type, message }),
  });
}

export async function fetchParentNotifications(studentId) {
  const qs = studentId ? `?student_id=${studentId}` : "";
  const data = await request(`/api/v1/parent-notifications${qs}`);
  return data?.notifications ?? [];
}

/** Who an assignment went to, with what each student submitted. */
export async function fetchAssignmentStudents(assignmentId) {
  return request(withClass(`/api/v1/assignments/${assignmentId}/students`));
}
