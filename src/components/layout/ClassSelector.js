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

  const primary = classes.filter((o) => o.is_primary);
  const others  = classes.filter((o) => !o.is_primary);

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
        {/*
          The teacher's own class is separated into its own group rather
          than marked with a star.

          This is a native select, so the options are drawn by the operating
          system: colour and background set on an <option> are ignored by
          Safari on macOS and by the mobile pickers, which is most of the
          phones this is used on. An optgroup is honoured everywhere, is
          read out by screen readers, and says in words what a colour would
          only imply — which also covers teachers who cannot distinguish it.
        */}
        {primary.length > 0 && (
          <optgroup label="Your class">
            {primary.map((option) => (
              <option key={option.class_id} value={option.class_id}>{label(option)}</option>
            ))}
          </optgroup>
        )}
        {others.length > 0 && (
          <optgroup label={primary.length ? "Also teaching" : "Classes"}>
            {others.map((option) => (
              <option key={option.class_id} value={option.class_id}>{label(option)}</option>
            ))}
          </optgroup>
        )}
      </select>
    </label>
  );
}
