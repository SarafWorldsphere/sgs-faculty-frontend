"use client";
import { useEffect, useState } from "react";
import { fetchClasses, fetchSubjects, fetchChaptersBySubject } from "@/lib/api";

const fieldStyle = {
  border: "1.5px solid #E2E8F0",
  color: "#0F172A",
  background: "white",
};

function PickerField({ label, options, value, onChange, disabled, placeholder, getId, getLabel }) {
  if (!disabled && options.length === 1) {
    return (
      <div
        className="w-full px-3 py-2.5 rounded-xl text-sm flex items-center"
        style={{ ...fieldStyle, background: "#F8FAFC" }}
        title={`Only one ${label.toLowerCase()} available`}
      >
        <span className="truncate">{getLabel(options[0])}</span>
      </div>
    );
  }
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className="w-full min-w-0 max-w-full px-3 py-2.5 rounded-xl text-sm truncate cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none"
      style={fieldStyle}
    >
      <option value="">{placeholder}</option>
      {options.map(o => (
        <option key={getId(o)} value={getId(o)}>{getLabel(o)}</option>
      ))}
    </select>
  );
}

/**
 * Cascading Class → Subject → Chapter picker.
 * Auto-selects and shows as read-only when only one option exists for a level.
 * Calls onChapterChange(chapterId, chapterLabel) whenever the chapter selection changes.
 */
export default function ChapterPicker({ onChapterChange }) {
  const [classes,   setClasses]   = useState([]);
  const [subjects,  setSubjects]  = useState([]);
  const [chapters,  setChapters]  = useState([]);
  const [classId,   setClassId]   = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");

  useEffect(() => {
    fetchClasses()
      .then(list => {
        const arr = Array.isArray(list) ? list : [];
        setClasses(arr);
        if (arr.length === 1) setClassId(String(arr[0].class_id));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setSubjects([]); setSubjectId("");
    setChapters([]); setChapterId("");
    if (!classId) return;
    fetchSubjects(classId)
      .then(list => {
        const arr = Array.isArray(list) ? list : [];
        setSubjects(arr);
        if (arr.length === 1) setSubjectId(String(arr[0].subject_id));
      })
      .catch(() => {});
  }, [classId]);

  useEffect(() => {
    setChapters([]); setChapterId("");
    if (!subjectId) return;
    fetchChaptersBySubject(subjectId)
      .then(list => {
        const arr = Array.isArray(list) ? list : [];
        setChapters(arr);
        if (arr.length === 1) setChapterId(String(arr[0].chapter_id));
      })
      .catch(() => {});
  }, [subjectId]);

  // Notify parent whenever chapterId resolves or clears
  useEffect(() => {
    const ch = chapters.find(c => String(c.chapter_id) === String(chapterId));
    onChapterChange(
      chapterId ? Number(chapterId) : "",
      ch ? (ch.content_title || ch.chapter_name || "") : ""
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId]);

  // min-w-0 on the children: a grid track is sized by its content, so a long
  // chapter name ("Chapter 1 - Natural Resources and Their Use") pushed the
  // track wider than the phone screen and the page scrolled sideways.
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 [&>*]:min-w-0">
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
  );
}
