"use client";

import { useAuth } from "@/context/AuthContext";

/**
 * The class the page is showing, printed beside its title.
 *
 * Scope is chosen once in the header and then applies to every screen —
 * students, marks, reports, assignments. That works, but it leaves the
 * current class stated in exactly one place, in a small control at the top
 * of the window. A teacher entering marks had nothing on the marks screen
 * itself telling them which class the marks were going to, and the cost of
 * being wrong there is a column of marks against the wrong children.
 *
 * So this states it, next to the thing it applies to. It is deliberately
 * not a control: choosing still happens in one place, and two selectors
 * that can disagree is the problem this is meant to prevent, not repeat.
 *
 * Renders nothing when no class has resolved, rather than a placeholder —
 * an empty tag beside a title reads as a loading fault.
 */
export default function ActiveClassTag() {
  const { activeClass } = useAuth();

  const name = activeClass?.class_name;
  if (!name) return null;

  const sections = activeClass.sections ?? [];
  const label = sections.length ? `${name} – ${sections.join(", ")}` : name;

  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium align-middle"
      style={{ background: "#EEF2FF", color: "#4338CA", border: "1px solid #DDD6FE" }}
      title="The class this page is showing — change it in the header"
    >
      {label}
    </span>
  );
}
