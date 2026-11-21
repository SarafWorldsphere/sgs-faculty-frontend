"use client";

/**
 * My Syllabus Plan — what the board expects of this class, and how far along it is.
 *
 * The teacher's read-only view of the plan. Editing belongs to Admin and the
 * Headmaster; the planner refuses a PATCH from Faculty, so nothing here writes.
 *
 * Progress is counted here rather than fetched: /coverage is restricted to
 * Admin and Headmaster, so a teacher cannot ask the planner how far along she
 * is. The teaching log is hers to read, so the taught periods per topic are
 * counted from it client-side. Same arithmetic the coverage service uses.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchMyPlan, fetchTeachingHistory } from "@/lib/plannerApi";
import { fetchClasses, fetchSubjects } from "@/lib/api";
import { fetchToday } from "@/lib/plannerApi";

// Mirrors app/utils/current_topic.py — a null planned_periods is finished by a
// single taught mark. Kept identical on purpose: if the two ever disagree, the
// teacher sees a different "current topic" from the one the lesson planner opens.
const isFullyTaught = (plannedPeriods, taught) =>
  !plannedPeriods ? taught >= 1 : taught >= plannedPeriods;

export default function SyllabusPlanPage() {
  const [pairs, setPairs]       = useState([]);     // [{classId, className, subjectId, subjectName}]
  const [selected, setSelected] = useState(null);
  const [plan, setPlan]         = useState([]);
  const [taught, setTaught]     = useState({});     // plan_id -> taught period count
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]       = useState("");

  // Which class and subject this teacher can look at.
  //
  // The faculty backend knows her assignments; the planner does not. When that
  // backend is unreachable we fall back to whatever classes appear in today's
  // timetable, so the screen still works rather than showing an empty picker.
  useEffect(() => {
    let alive = true;
    const fromBackend = async () => {
      const classes = await fetchClasses();
      const list = classes?.classes || classes?.items || [];
      const out = [];
      for (const cls of list) {
        const subjects = await fetchSubjects(cls.class_id).catch(() => null);
        (subjects?.subjects || subjects?.items || []).forEach((s) => {
          out.push({
            classId: cls.class_id,
            className: [cls.class_name, cls.section_name].filter(Boolean).join(" "),
            subjectId: s.subject_id,
            subjectName: s.subject_name,
          });
        });
      }
      if (out.length === 0) throw new Error("no assignments");
      return out;
    };

    const fromTimetable = async () => {
      const today = await fetchToday();
      const seen = new Map();
      (today?.items || []).forEach((item) => {
        const key = `${item.class_id}|${item.subject_id}`;
        if (!seen.has(key)) {
          seen.set(key, {
            classId: item.class_id,
            className: `Class ${item.class_id}`,
            subjectId: item.subject_id,
            subjectName: `Subject ${item.subject_id}`,
          });
        }
      });
      return [...seen.values()];
    };

    (async () => {
      let out = [];
      try {
        out = await fromBackend();
      } catch {
        out = await fromTimetable().catch(() => []);
      }
      if (!alive) return;
      setPairs(out);
      setSelected(out[0] ?? null);
      if (out.length === 0) setIsLoading(false);
    })();

    return () => { alive = false; };
  }, []);

  const load = useCallback(async (pair) => {
    if (!pair) return;
    setIsLoading(true);
    setError("");
    try {
      const [planData, history] = await Promise.all([
        fetchMyPlan({ classId: pair.classId, subjectId: pair.subjectId }),
        fetchTeachingHistory({ classId: pair.classId }).catch(() => ({ items: [] })),
      ]);

      const counts = {};
      (history?.items || []).forEach((row) => {
        if (row.plan_id && row.status === "taught") {
          counts[row.plan_id] = (counts[row.plan_id] || 0) + 1;
        }
      });

      setPlan(planData?.items || []);
      setTaught(counts);
    } catch (err) {
      setPlan([]);
      setError(err.message || "Could not load the plan.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(selected); }, [selected, load]);

  // The first active topic that is not finished — the one she is on now.
  const currentPlanId = useMemo(() => {
    const open = plan.find(
      (row) => row.is_active && !isFullyTaught(row.planned_periods, taught[row.plan_id] || 0)
    );
    return open?.plan_id ?? null;
  }, [plan, taught]);

  const done = plan.filter(
    (row) => row.is_active && isFullyTaught(row.planned_periods, taught[row.plan_id] || 0)
  ).length;
  const active = plan.filter((row) => row.is_active).length;

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">

      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <div className="w-8 h-8 rounded-lg ai-gradient flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "#F1F5F9", fontFamily: "var(--font-space-grotesk)" }}>
            My Syllabus Plan
          </h1>
        </div>
        <p className="text-sm pl-10" style={{ color: "#94A3B8" }}>
          What the board expects, and where this class has reached
        </p>
      </div>

      {/* Class and subject picker — only when she has more than one */}
      {pairs.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {pairs.map((pair) => {
            const on = selected?.classId === pair.classId && selected?.subjectId === pair.subjectId;
            return (
              <button key={`${pair.classId}|${pair.subjectId}`} onClick={() => setSelected(pair)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                style={on
                  ? { background: "#EEF2FF", color: "#4F46E5", border: "1px solid #A5B4FC" }
                  : { background: "white", color: "#64748B", border: "1px solid #E2E8F0" }}>
                {pair.className} · {pair.subjectName}
              </button>
            );
          })}
        </div>
      )}

      {/* Progress across the whole plan */}
      {!isLoading && plan.length > 0 && (
        <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid rgba(99,102,241,0.1)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold" style={{ color: "#0F172A" }}>
              {done} of {active} topics finished
            </span>
            <span className="text-xs font-bold" style={{ color: "#6366F1" }}>
              {active ? Math.round((done / active) * 100) : 0}%
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "#EEF2FF" }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${active ? (done / active) * 100 : 0}%`,
                background: done === active ? "#10B981" : "linear-gradient(90deg,#6366F1,#8B5CF6)",
              }} />
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl px-4 py-3 text-sm"
          style={{ background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA" }}>
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-white animate-pulse"
              style={{ border: "1px solid rgba(99,102,241,0.1)" }} />
          ))}
        </div>
      ) : plan.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl" style={{ border: "1px solid rgba(99,102,241,0.1)" }}>
          <p className="text-sm font-medium" style={{ color: "#64748B" }}>No plan for this class yet.</p>
          <p className="text-xs mt-1" style={{ color: "#94A3B8" }}>
            The school admin sets this up once at the start of the year.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {plan.map((row) => {
            const used = taught[row.plan_id] || 0;
            const finished = isFullyTaught(row.planned_periods, used);
            const isCurrent = row.plan_id === currentPlanId;
            const pct = row.planned_periods
              ? Math.min(100, Math.round((used / row.planned_periods) * 100))
              : (used ? 100 : 0);

            return (
              <div key={row.plan_id} className="bg-white rounded-2xl p-4"
                style={{
                  border: isCurrent ? "1.5px solid #6366F1" : "1px solid rgba(99,102,241,0.1)",
                  opacity: row.is_active ? 1 : 0.55,
                }}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold" style={{ color: "#0F172A" }}>{row.topic_name}</p>
                      {isCurrent && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: "#EEF2FF", color: "#6366F1" }}>Current</span>
                      )}
                      {finished && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: "#ECFDF5", color: "#10B981" }}>Done</span>
                      )}
                      {!row.is_active && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: "#F1F5F9", color: "#64748B" }}>Switched off</span>
                      )}
                      {row.source === "admin" && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: "#FFF7ED", color: "#D97706" }}>Added by school</span>
                      )}
                    </div>
                    <p className="text-xs mt-1" style={{ color: "#94A3B8" }}>
                      {row.block_name || "No block"}
                      {row.planned_periods ? ` · ${row.planned_periods} periods planned` : " · no period estimate"}
                    </p>
                  </div>
                  <span className="text-xs font-bold shrink-0" style={{ color: finished ? "#10B981" : "#6366F1" }}>
                    {used}{row.planned_periods ? `/${row.planned_periods}` : ""}
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#EEF2FF" }}>
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: finished ? "#10B981" : "linear-gradient(90deg,#6366F1,#8B5CF6)" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
