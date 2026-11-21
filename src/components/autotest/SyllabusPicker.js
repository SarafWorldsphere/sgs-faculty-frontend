"use client";

/**
 * Class → Subject → Chapters, where chapters is a multi-select.
 *
 * Separate from ChapterPicker rather than an option on it. ChapterPicker
 * returns one chapter id and nothing else, and the lesson planner depends on
 * exactly that; a paper needs several chapters and also the class and subject
 * *names*, because the AI service is told "Class 8" and "Science", not ids.
 *
 * Reports the whole selection upward in one object, so the parent never has to
 * reassemble it from separate callbacks.
 */

import { useEffect, useRef, useState } from "react";
import { fetchClasses, fetchSubjects, fetchChaptersBySubject } from "@/lib/api";

const field = {
  border: "1.5px solid #E2E8F0",
  color: "#0F172A",
  background: "white",
};

const chapterLabel = (ch) => ch.content_title || ch.chapter_name || `Chapter ${ch.chapter_id}`;

function Select({ label, options, value, onChange, disabled, placeholder, getId, getLabel }) {
  // One option is not a choice — show it as settled rather than asking.
  if (!disabled && options.length === 1) {
    return (
      <div>
        <label className="block text-xs font-semibold mb-1.5" style={{ color: "#475569" }}>{label}</label>
        <div className="w-full px-3 py-2.5 rounded-xl text-sm flex items-center"
          style={{ ...field, background: "#F8FAFC" }}>
          <span className="truncate">{getLabel(options[0])}</span>
        </div>
      </div>
    );
  }
  return (
    <div className="min-w-0">
      <label className="block text-xs font-semibold mb-1.5" style={{ color: "#475569" }}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full min-w-0 max-w-full px-3 py-2.5 rounded-xl text-sm truncate cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none"
        style={field}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={getId(o)} value={getId(o)}>{getLabel(o)}</option>
        ))}
      </select>
    </div>
  );
}

export default function SyllabusPicker({ onChange, chaptersOptional = false }) {
  const [classes,  setClasses]  = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [chapters, setChapters] = useState([]);

  const [classId,   setClassId]   = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [picked,    setPicked]    = useState([]);   // chapter ids, in the order chosen

  useEffect(() => {
    fetchClasses()
      .then((list) => {
        const arr = Array.isArray(list) ? list : [];
        setClasses(arr);
        if (arr.length === 1) setClassId(String(arr[0].class_id));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setSubjects([]); setSubjectId("");
    setChapters([]); setPicked([]);
    if (!classId) return;
    fetchSubjects(classId)
      .then((list) => {
        const arr = Array.isArray(list) ? list : [];
        setSubjects(arr);
        if (arr.length === 1) setSubjectId(String(arr[0].subject_id));
      })
      .catch(() => {});
  }, [classId]);

  useEffect(() => {
    setChapters([]); setPicked([]);
    if (!subjectId) return;
    fetchChaptersBySubject(subjectId)
      .then((list) => setChapters(Array.isArray(list) ? list : []))
      .catch(() => {});
  }, [subjectId]);

  // Report upward. `onChange` is usually an inline arrow, so a new function
  // every render — keeping it in a ref stops that from re-running this effect
  // on every keystroke elsewhere on the page.
  const report = useRef(onChange);
  report.current = onChange;

  useEffect(() => {
    const cls = classes.find((c) => String(c.class_id) === String(classId));
    const sub = subjects.find((s) => String(s.subject_id) === String(subjectId));
    report.current?.({
      classId:   classId ? Number(classId) : null,
      className: cls ? (cls.label || cls.class_name || "") : "",
      subjectId: subjectId ? Number(subjectId) : null,
      subject:   sub ? (sub.subject_name || "") : "",
      chapterIds: picked,
      chapterNames: picked.map((id) => {
        const ch = chapters.find((c) => String(c.chapter_id) === String(id));
        return ch ? chapterLabel(ch) : String(id);
      }),
    });
  }, [classId, subjectId, picked, classes, subjects, chapters]);

  const add = (value) => {
    if (!value) return;
    const id = Number(value);
    setPicked((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };
  const remove = (id) => setPicked((prev) => prev.filter((x) => x !== id));

  const unpicked = chapters.filter((c) => !picked.includes(Number(c.chapter_id)));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 [&>*]:min-w-0">
        <Select
          label="Class"
          options={classes} value={classId} onChange={setClassId}
          placeholder="Select class"
          getId={(c) => c.class_id} getLabel={(c) => c.label || c.class_name}
        />
        <Select
          label="Subject"
          options={subjects} value={subjectId} onChange={setSubjectId}
          disabled={!classId}
          placeholder={classId ? "Select subject" : "Select class first"}
          getId={(s) => s.subject_id} getLabel={(s) => s.subject_name}
        />
      </div>

      <div>
        <label className="block text-xs font-semibold mb-1.5" style={{ color: "#475569" }}>
          Chapters
          {chaptersOptional && (
            <span className="ml-2 font-normal" style={{ color: "#94A3B8" }}>
              optional — leave empty for the whole syllabus
            </span>
          )}
        </label>

        {picked.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {picked.map((id) => {
              const ch = chapters.find((c) => String(c.chapter_id) === String(id));
              return (
                <span key={id}
                  className="inline-flex items-center gap-1.5 rounded-full text-xs font-medium pl-3 pr-1.5 py-1.5"
                  style={{ background: "#EEF2FF", color: "#3730A3" }}>
                  <span className="truncate max-w-[220px]">{ch ? chapterLabel(ch) : id}</span>
                  <button type="button" onClick={() => remove(id)}
                    aria-label={`Remove ${ch ? chapterLabel(ch) : "chapter"}`}
                    className="w-4 h-4 rounded-full leading-none cursor-pointer shrink-0"
                    style={{ color: "#4F46E5" }}>×</button>
                </span>
              );
            })}
          </div>
        )}

        {/* The select is the "add" control: it never holds a value, so the same
            chapter list keeps working after each pick. */}
        <select
          value=""
          onChange={(e) => add(e.target.value)}
          disabled={!subjectId || unpicked.length === 0}
          className="w-full px-3 py-2.5 rounded-xl text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none"
          style={field}
        >
          <option value="">
            {!subjectId
              ? "Select subject first"
              : unpicked.length === 0
              ? (chapters.length ? "All chapters added" : "No chapters for this subject")
              : picked.length ? "+ Add another chapter" : "Select a chapter"}
          </option>
          {unpicked.map((c) => (
            <option key={c.chapter_id} value={c.chapter_id}>{chapterLabel(c)}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
