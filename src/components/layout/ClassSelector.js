"use client";

/**
 * Which class the teacher is working in.
 *
 * Renders nothing for a teacher with one class — which is most of them — so the
 * header looks exactly as it did. Teachers who take several classes get a
 * dropdown, and everything on the page follows it: roll, reports, assignments,
 * parent notifications.
 *
 * A native <select> on purpose: it is keyboard and screen-reader correct for
 * free, and it cannot be clipped by a parent's overflow the way a custom
 * dropdown panel can.
 */

import { useAuth } from "@/context/AuthContext";

function label(option) {
  const sections = option.sections?.length ? ` – ${option.sections.join("/")}` : "";
  return `${option.class_name || `Class ${option.class_id}`}${sections}`;
}

export default function ClassSelector() {
  const { classes, activeClassId, switchClass } = useAuth();

  if (!classes || classes.length < 2) return null;

  return (
    <label className="flex items-center gap-1.5">
      <span className="sr-only">Class</span>
      <select
        value={activeClassId ?? ""}
        onChange={(e) => switchClass(e.target.value)}
        className="text-xs font-medium rounded-full px-2.5 py-1 cursor-pointer outline-none"
        style={{
          background: "#EEF2FF",
          color: "#4F46E5",
          border: "1px solid #DDD6FE",
        }}
        title="Switch class"
      >
        {classes.map((option) => (
          <option key={option.class_id} value={option.class_id}>
            {label(option)}
            {option.is_primary ? " ★" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
