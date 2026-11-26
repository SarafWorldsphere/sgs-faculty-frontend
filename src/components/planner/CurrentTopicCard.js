"use client";

/**
 * "Your plan says you are here" — the end of the blank box.
 *
 * The lesson planner used to open on an empty chapter picker and ask the
 * teacher to remember where the class had reached. The syllabus plan already
 * knows, so this offers it: one tap fills the topic and the period count.
 *
 * It offers rather than forces. The teacher may genuinely be taking something
 * else today — a revision period, a topic brought forward — and overwriting
 * her choice would make the planner feel like it was arguing with her.
 *
 * Which class and subject comes from today's timetable rather than a picker.
 * She is planning the lesson she is about to teach, and the timetable already
 * says what that is.
 */

import { useEffect, useState } from "react";
import { fetchCurrentLesson, fetchToday } from "@/lib/plannerApi";
import { getActiveClass } from "@/lib/activeClass";

export default function CurrentTopicCard({ onUse }) {
  const [topic, setTopic]   = useState(null);
  const [used, setUsed]     = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const today = await fetchToday();
        const periods = today?.items ?? [];
        if (periods.length === 0) return;

        // Prefer the class selected in the header, when she takes several.
        const activeClass = getActiveClass();
        const slot =
          periods.find((p) => activeClass && p.class_id === activeClass) || periods[0];
        if (!slot?.subject_id) return;

        const current = await fetchCurrentLesson(slot.class_id, slot.subject_id);
        if (alive && current?.topic_name) setTopic(current);
      } catch {
        // No plan, no timetable, or the planner is unreachable. The card simply
        // does not appear and the chapter picker below works as it always did.
      }
    })();
    return () => { alive = false; };
  }, []);

  if (!topic || hidden) return null;

  return (
    <div className="rounded-2xl p-4 mb-4"
      style={{ background: "#EEF2FF", border: "1px solid #C7D2FE" }}>
      <div className="flex items-start gap-3">
        <span className="w-8 h-8 rounded-lg ai-gradient flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold mb-0.5" style={{ color: "#4F46E5" }}>
            Your plan says you are here
          </p>
          <p className="text-sm font-bold truncate" style={{ color: "#0F172A" }}>
            {topic.topic_name}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>
            {topic.planned_periods ? `${topic.planned_periods} periods planned` : "No period estimate"}
            {!topic.plan?.chapter_id && " · chapter not matched yet, pick it below"}
          </p>
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          <button type="button"
            onClick={() => {
              onUse({
                topicName: topic.topic_name,
                periods: topic.planned_periods || undefined,
                chapterId: topic.plan?.chapter_id ?? null,
              });
              setUsed(true);
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white cursor-pointer"
            style={{ background: used ? "#10B981" : "#6366F1" }}>
            {used ? "Filled ✓" : "Use this"}
          </button>
          <button type="button" onClick={() => setHidden(true)}
            className="px-3 py-1 rounded-lg text-[11px] font-medium cursor-pointer"
            style={{ color: "#64748B" }}>
            Not today
          </button>
        </div>
      </div>
    </div>
  );
}
