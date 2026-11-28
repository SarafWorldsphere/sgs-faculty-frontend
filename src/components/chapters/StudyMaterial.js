"use client";

/**
 * StudyMaterial — upload and manage chapter PDFs.
 *
 * Class → Subject → Chapter selection, then upload / view / replace / delete
 * the PDFs held for that chapter. Files live in S3; replace and delete are
 * soft (the previous copy is retained until the year-end cleanup).
 */

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  fetchClasses,
  fetchSubjects,
  fetchChaptersBySubject,
  fetchChapterFiles,
  uploadChapterFile,
  replaceChapterFile,
  deleteChapterFile,
} from "@/lib/api";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

const selectStyle = {
  background: "white",
  border: "1px solid rgba(99,102,241,0.15)",
  color: "#0F172A",
};

/**
 * Shows a dropdown only when there is a real choice to make. With a single
 * option it renders as a read-only label (already selected), and it becomes a
 * dropdown by itself as soon as a second class/subject is added to the data.
 */
function PickerField({ label, options, value, onChange, disabled, placeholder, getId, getLabel }) {
  if (!disabled && options.length === 1) {
    return (
      <div
        className="w-full px-3 py-2.5 rounded-xl text-sm flex items-center gap-2"
        style={{ ...selectStyle, background: "#F8FAFC" }}
        title={`Only one ${label.toLowerCase()} available`}
      >
        <span className="truncate" style={{ color: "#0F172A" }}>{getLabel(options[0])}</span>
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className="w-full px-3 py-2.5 rounded-xl text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      style={selectStyle}
    >
      <option value="">{placeholder}</option>
      {options.map(o => (
        <option key={getId(o)} value={getId(o)}>{getLabel(o)}</option>
      ))}
    </select>
  );
}

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  return isNaN(d) ? "" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function StudyMaterial() {
  const { activeClassId } = useAuth();
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [chapters, setChapters] = useState([]);

  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");

  const [files, setFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [busy, setBusy] = useState("");        // "upload" | "replace:<id>" | "delete:<id>"
  const [message, setMessage] = useState(null); // { type: "ok" | "err", text }

  const uploadRef = useRef(null);
  const replaceRef = useRef(null);
  const replaceTarget = useRef(null);

  // Classes on mount.
  //
  // The class defaults to the one selected in the header. This panel used to
  // open on "Select class" while the header already said which class the
  // teacher was working in — two controls contradicting each other, directly
  // above a chapter list, which is what made people read this as a filter
  // rather than as the destination for an upload.
  //
  // It stays changeable: uploading to a class you are not currently viewing
  // is a real case, just not the common one.
  useEffect(() => {
    fetchClasses()
      .then(d => {
        const list = Array.isArray(d) ? d : [];
        setClasses(list);
        if (list.length === 1) {
          setClassId(String(list[0].class_id));
          return;
        }
        const active = list.find(c => String(c.class_id) === String(activeClassId));
        if (active) setClassId(String(active.class_id));
      })
      .catch(() => setClasses([]));
  }, [activeClassId]);

  // Class -> subjects
  useEffect(() => {
    setSubjects([]); setSubjectId("");
    setChapters([]); setChapterId("");
    setFiles([]);
    if (!classId) return;
    fetchSubjects(classId)
      .then(d => {
        const list = Array.isArray(d) ? d : [];
        setSubjects(list);
        if (list.length === 1) setSubjectId(String(list[0].subject_id));
      })
      .catch(() => setSubjects([]));
  }, [classId]);

  // Subject -> chapters
  useEffect(() => {
    setChapters([]); setChapterId("");
    setFiles([]);
    if (!subjectId) return;
    fetchChaptersBySubject(subjectId)
      .then(d => {
        const list = Array.isArray(d) ? d : [];
        setChapters(list);
        if (list.length === 1) setChapterId(String(list[0].chapter_id));
      })
      .catch(() => setChapters([]));
  }, [subjectId]);

  // Chapter -> files
  const loadFiles = async (id = chapterId) => {
    if (!id) { setFiles([]); return; }
    setFilesLoading(true);
    try {
      setFiles(await fetchChapterFiles(id));
    } catch {
      setFiles([]);
    } finally {
      setFilesLoading(false);
    }
  };

  useEffect(() => { loadFiles(chapterId); /* eslint-disable-next-line */ }, [chapterId]);

  const notify = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !chapterId) return;
    setBusy("upload");
    try {
      await uploadChapterFile(chapterId, file);
      await loadFiles();
      notify("ok", `"${file.name}" uploaded.`);
    } catch (err) {
      notify("err", err.message || "Upload failed.");
    } finally {
      setBusy("");
    }
  };

  const handleReplace = async (e) => {
    const file = e.target.files?.[0];
    const fileId = replaceTarget.current;
    e.target.value = "";
    if (!file || !fileId) return;
    setBusy(`replace:${fileId}`);
    try {
      await replaceChapterFile(fileId, file);
      await loadFiles();
      notify("ok", "File replaced — the previous copy is kept for this academic year.");
    } catch (err) {
      notify("err", err.message || "Replace failed.");
    } finally {
      setBusy("");
      replaceTarget.current = null;
    }
  };

  const askReplace = (fileId) => {
    replaceTarget.current = fileId;
    replaceRef.current?.click();
  };

  // Delete is two steps: the icon sets the file to confirm, the dialog acts.
  const [deleteTarget, setDeleteTarget] = useState(null);

  const handleDelete = (file) => setDeleteTarget(file);

  const confirmDelete = async () => {
    const file = deleteTarget;
    if (!file) return;
    setBusy(`delete:${file.file_id}`);
    try {
      await deleteChapterFile(file.file_id);
      await loadFiles();
      notify("ok", "File removed.");
      setDeleteTarget(null);
    } catch (err) {
      notify("err", err.message || "Delete failed.");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="bg-white rounded-2xl p-5 mb-5" style={{ border: "1px solid rgba(99,102,241,0.1)" }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="w-8 h-8 rounded-lg ai-gradient flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </span>
        <h2 className="text-base font-bold" style={{ color: "#0F172A", fontFamily: "var(--font-space-grotesk)" }}>
          Study material
        </h2>
      </div>
      <p className="text-xs mb-4 pl-10" style={{ color: "#94A3B8" }}>
        Upload chapter study material — any file type
      </p>

      {/* Cascading selection */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <PickerField
          label="Class"
          options={classes}
          value={classId}
          onChange={setClassId}
          placeholder="Select class"
          getId={c => c.class_id}
          getLabel={c => c.label || c.class_name}
        />
        <PickerField
          label="Subject"
          options={subjects}
          value={subjectId}
          onChange={setSubjectId}
          disabled={!classId}
          placeholder={classId ? "Select subject" : "Select class first"}
          getId={s => s.subject_id}
          getLabel={s => s.subject_name}
        />
        <PickerField
          label="Chapter"
          options={chapters}
          value={chapterId}
          onChange={setChapterId}
          disabled={!subjectId}
          placeholder={subjectId ? "Select chapter" : "Select subject first"}
          getId={ch => ch.chapter_id}
          getLabel={ch => ch.content_title || ch.chapter_name}
        />
      </div>

      {/* Hidden inputs — any file type is allowed */}
      <input ref={uploadRef} type="file" className="hidden" onChange={handleUpload} />
      <input ref={replaceRef} type="file" className="hidden" onChange={handleReplace} />

      {message && (
        <div
          className="mt-4 px-3 py-2 rounded-xl text-xs"
          style={message.type === "ok"
            ? { background: "#ECFDF5", color: "#059669" }
            : { background: "#FEF2F2", color: "#DC2626" }}
        >
          {message.text}
        </div>
      )}

      {/* Upload — always visible, enabled once a chapter is chosen */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold" style={{ color: "#64748B" }}>
          {!chapterId
            ? "Select a chapter to upload or view its files"
            : filesLoading
              ? "Loading files…"
              : `${files.length} file${files.length === 1 ? "" : "s"} in this chapter`}
        </p>
        <button
          type="button"
          onClick={() => uploadRef.current?.click()}
          disabled={!chapterId || busy === "upload"}
          title={chapterId ? "Upload a file for this chapter" : "Select a class, subject and chapter first"}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white shrink-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed enabled:cursor-pointer"
          style={{ background: "linear-gradient(135deg,#6366F1,#8B5CF6)" }}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {busy === "upload" ? "Uploading…" : "Upload file"}
        </button>
      </div>

      {/* Files */}
      {chapterId && (
        <div className="mt-3">

          {!filesLoading && files.length === 0 && (
            <div className="text-center py-8 rounded-xl" style={{ background: "#F8FAFC" }}>
              <p className="text-sm font-medium" style={{ color: "#94A3B8" }}>No study material yet.</p>
              <p className="text-xs mt-1" style={{ color: "#CBD5E1" }}>Upload a file to get started.</p>
            </div>
          )}

          <div className="space-y-2">
            {files.map(f => (
              <div
                key={f.file_id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl"
                style={{ background: "#F8FAFC", border: "1px solid rgba(99,102,241,0.08)" }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#FEF2F2" }}>
                    <svg className="w-4 h-4" fill="none" stroke="#EF4444" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "#0F172A" }}>{f.file_name}</p>
                    <p className="text-[11px]" style={{ color: "#94A3B8" }}>
                      {f.uploaded_by ? `${f.uploaded_by} · ` : ""}{formatDate(f.uploaded_at)}
                      {f.version_no > 1 ? ` · v${f.version_no}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <a
                    href={f.view_url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: "#EEF2FF", color: "#6366F1" }}
                  >
                    View
                  </a>
                  <button
                    type="button"
                    onClick={() => askReplace(f.file_id)}
                    disabled={busy === `replace:${f.file_id}`}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-60"
                    style={{ background: "#F1F5F9", color: "#475569" }}
                  >
                    {busy === `replace:${f.file_id}` ? "Replacing…" : "Replace"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(f)}
                    disabled={busy === `delete:${f.file_id}`}
                    className="p-1.5 rounded-lg cursor-pointer disabled:opacity-60"
                    style={{ color: "#94A3B8" }}
                    aria-label="Delete file"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Remove this file?"
        message={deleteTarget ? `"${deleteTarget.file_name}" will be removed from this chapter.\n\nIt stays recoverable until the end of the academic year.` : ""}
        confirmLabel="Remove"
        danger
        busy={!!deleteTarget && busy === `delete:${deleteTarget.file_id}`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
