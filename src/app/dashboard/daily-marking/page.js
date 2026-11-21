"use client";

/**
 * Daily Marking — what was actually taught today, one tap per period.
 *
 * This is the screen the whole syllabus planner rests on. Coverage, the
 * headmaster's dashboard and the scoping of auto test are all derived from
 * what gets saved here, and nothing else in the feature produces data.
 *
 * So the bar is thirty seconds for a full day. The periods come pre-filled
 * from the timetable with the topic the plan says is next, and the teacher
 * taps a status against each one. Nothing to type unless she wants to add a
 * remark.
 *
 * Deliberately not sending X-Class-Id: a teacher has periods in several
 * classes on the same day, so the class travels on each row. See plannerApi.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchCurrentLesson, fetchToday, saveDay } from "@/lib/plannerApi";
import { fetchClasses } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const STATUSES = [
  { key: "taught",    label: "Taught",     bg: "#ECFDF5", color: "#059669", border: "#A7F3D0" },
  { key: "partly",    label: "Partly",     bg: "#FFFBEB", color: "#D97706", border: "#FDE68A" },
  { key: "not_taken", label: "Not taken",  bg: "#FEF2F2", color: "#DC2626", border: "#FECACA" },
];

const todayISO = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local

const pretty = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "short",
  });

export default function DailyMarkingPage() {
  const { user } = useAuth();
  const [date, setDate]         = useState(todayISO);
  const [day, setDay]           = useState(null);
  const [marks, setMarks]       = useState({});   // period_no -> status
  const [remarks, setRemarks]   = useState({});   // period_no -> text
  const [openRemark, setOpenRemark] = useState(null);
  const [classNames, setClassNames] = useState({});
  const [isLoading, setIsLoading]   = useState(true);
  const [isSaving, setIsSaving]     = useState(false);
  const [error, setError]           = useState("");
  const [saved, setSaved]           = useState("");

  // The planner returns class_id and subject_id, not names — it has no access
  // to this school's class master. The faculty backend does, so names are
  // resolved here rather than asking the planner to grow a lookup.
  useEffect(() => {
    fetchClasses()
      .then((d) => {
        const map = {};
        (d?.classes || d?.items || []).forEach((c) => {
          map[c.class_id] = [c.class_name, c.section_name].filter(Boolean).join(" ");
        });
        setClassNames(map);
      })
      .catch(() => setClassNames({}));
  }, []);

  /**
   * Attach the topic each period should be covering.
   *
   * A period that comes from the timetable arrives with plan_id and topic_name
   * null — the planner's prefill does not look up the plan. Saving it that way
   * writes a teaching_log row with no plan_id, and coverage counts periods per
   * plan row, so the whole day would mark as done and coverage would stay at
   * zero. One call per class and subject fills it in.
   */
  const withTopics = useCallback(async (data) => {
    const rows = data?.items ?? [];
    const pairs = [
      ...new Set(
        rows.filter((r) => !r.plan_id && r.subject_id).map((r) => `${r.class_id}|${r.subject_id}`)
      ),
    ];
    if (pairs.length === 0) return data;

    const current = {};
    await Promise.all(
      pairs.map(async (key) => {
        const [classId, subjectId] = key.split("|").map(Number);
        try {
          current[key] = await fetchCurrentLesson(classId, subjectId);
        } catch {
          // No plan for that class and subject yet. The period still shows,
          // flagged as not in the plan, so she can record what she taught.
          current[key] = null;
        }
      })
    );

    return {
      ...data,
      items: rows.map((row) => {
        if (row.plan_id) return row;
        const hit = current[`${row.class_id}|${row.subject_id}`];
        return hit ? { ...row, plan_id: hit.plan_id, topic_name: hit.topic_name } : row;
      }),
    };
  }, []);

  const load = useCallback(async (forDate) => {
    setIsLoading(true);
    setError("");
    setSaved("");
    try {
      const data = await withTopics(await fetchToday(forDate));
      setDay(data);
      // Pre-tick whatever is already saved, so a second visit shows the day
      // as it stands rather than blank.
      const existing = {};
      const existingRemarks = {};
      (data?.items || []).forEach((item) => {
        if (item.status) existing[item.period_no] = item.status;
        if (item.remarks) existingRemarks[item.period_no] = item.remarks;
      });
      setMarks(existing);
      setRemarks(existingRemarks);
    } catch (err) {
      setDay(null);
      setError(err.message || "Could not load today's periods.");
    } finally {
      setIsLoading(false);
    }
  }, [withTopics]);

  useEffect(() => { load(date); }, [date, load]);

  const items = day?.items ?? [];
  const markedCount = useMemo(
    () => items.filter((i) => marks[i.period_no]).length,
    [items, marks]
  );
  const allMarked = items.length > 0 && markedCount === items.length;

  const setStatus = (periodNo, status) => {
    setSaved("");
    setMarks((prev) => ({ ...prev, [periodNo]: prev[periodNo] === status ? undefined : status }));
  };

  // "Everything went as planned" — the common case, and the reason this screen
  // can be a few seconds rather than a minute.
  const markAllTaught = () => {
    setSaved("");
    const next = {};
    items.forEach((i) => { next[i.period_no] = marks[i.period_no] || "taught"; });
    setMarks(next);
  };

  const onSave = async () => {
    const entries = items
      .filter((i) => marks[i.period_no])
      .map((i) => ({
        period_no:  i.period_no,
        class_id:   i.class_id,
        subject_id: i.subject_id,
        plan_id:    i.plan_id ?? null,
        status:     marks[i.period_no],
        remarks:    remarks[i.period_no] || null,
      }));

    if (entries.length === 0) {
      setError("Nothing marked yet. Tap a status against at least one period.");
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      const data = await withTopics(await saveDay(date, entries));
      setDay(data);
      setSaved(`Saved ${entries.length} period${entries.length === 1 ? "" : "s"}.`);
    } catch (err) {
      setError(err.message || "Could not save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const shiftDate = (days) => {
    const d = new Date(`${date}T00:00:00`);
    d.setDate(d.getDate() + days);
    setDate(d.toLocaleDateString("en-CA"));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-8 h-8 rounded-lg ai-gradient flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold" style={{ color: "#F1F5F9", fontFamily: "var(--font-space-grotesk)" }}>
              Daily Marking
            </h1>
          </div>
          <p className="text-sm pl-10" style={{ color: "#94A3B8" }}>
            {user?.name ? `${user.name} · ` : ""}{pretty(date)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => shiftDate(-1)} aria-label="Previous day"
            className="px-2.5 py-2 rounded-lg text-sm cursor-pointer"
            style={{ border: "1px solid #E2E8F0", background: "white", color: "#475569" }}>←</button>
          <input type="date" value={date} max={todayISO()}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg focus:outline-none"
            style={{ border: "1.5px solid #E2E8F0", background: "white", color: "#0F172A" }} />
          <button onClick={() => shiftDate(1)} aria-label="Next day"
            disabled={date >= todayISO()}
            className="px-2.5 py-2 rounded-lg text-sm"
            style={{
              border: "1px solid #E2E8F0", background: "white",
              color: date >= todayISO() ? "#CBD5E1" : "#475569",
              cursor: date >= todayISO() ? "not-allowed" : "pointer",
            }}>→</button>
        </div>
      </div>

      {/* Progress + mark-all */}
      {!isLoading && day?.is_working_day && items.length > 0 && (
        <div className="bg-white rounded-2xl p-4 flex items-center gap-4"
          style={{ border: "1px solid rgba(99,102,241,0.1)" }}>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold" style={{ color: "#475569" }}>
                {markedCount} of {items.length} periods marked
              </span>
              {allMarked && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "#ECFDF5", color: "#10B981" }}>Day complete</span>
              )}
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#EEF2FF" }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${items.length ? (markedCount / items.length) * 100 : 0}%`,
                  background: allMarked ? "#10B981" : "linear-gradient(90deg,#6366F1,#8B5CF6)",
                }} />
            </div>
          </div>
          <button onClick={markAllTaught}
            className="text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer shrink-0 transition-colors"
            style={{ color: "#6366F1", background: "#EEF2FF" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#E0E7FF")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#EEF2FF")}>
            All taught
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl px-4 py-3 text-sm"
          style={{ background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA" }}>
          {error}
        </div>
      )}
      {saved && (
        <div className="rounded-xl px-4 py-3 text-sm"
          style={{ background: "#ECFDF5", color: "#047857", border: "1px solid #A7F3D0" }}>
          {saved}
        </div>
      )}

      {/* Periods */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-white animate-pulse"
              style={{ border: "1px solid rgba(99,102,241,0.1)" }} />
          ))}
        </div>
      ) : !day?.is_working_day ? (
        <div className="text-center py-16 bg-white rounded-2xl" style={{ border: "1px solid rgba(99,102,241,0.1)" }}>
          <p className="text-sm font-medium" style={{ color: "#64748B" }}>School is closed on this day.</p>
          <p className="text-xs mt-1" style={{ color: "#94A3B8" }}>Sunday or a holiday — nothing to mark.</p>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl" style={{ border: "1px solid rgba(99,102,241,0.1)" }}>
          <p className="text-sm font-medium" style={{ color: "#64748B" }}>No periods scheduled for you today.</p>
          <p className="text-xs mt-1" style={{ color: "#94A3B8" }}>
            If that looks wrong, your timetable may not be set up yet.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const chosen = marks[item.period_no];
            const className = classNames[item.class_id] || `Class ${item.class_id}`;
            return (
              <div key={item.period_no} className="bg-white rounded-2xl p-4"
                style={{ border: `1px solid ${chosen ? "rgba(16,185,129,0.25)" : "rgba(99,102,241,0.1)"}` }}>

                <div className="flex items-start gap-3 mb-3">
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold"
                    style={{ background: "#EEF2FF", color: "#6366F1" }}>
                    P{item.period_no}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate" style={{ color: "#0F172A" }}>
                      {item.topic_name || "No topic planned"}
                    </p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: "#94A3B8" }}>
                      {className}
                      {!item.plan_id && (
                        <span className="ml-2" style={{ color: "#D97706" }}>· not in the plan</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {STATUSES.map((s) => {
                    const on = chosen === s.key;
                    return (
                      <button key={s.key} onClick={() => setStatus(item.period_no, s.key)}
                        className="px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                        style={{
                          background: on ? s.bg : "white",
                          color: on ? s.color : "#64748B",
                          border: `1px solid ${on ? s.border : "#E2E8F0"}`,
                        }}>
                        {s.label}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setOpenRemark(openRemark === item.period_no ? null : item.period_no)}
                    className="ml-auto text-xs font-medium cursor-pointer px-2 py-2 rounded-lg"
                    style={{ color: remarks[item.period_no] ? "#6366F1" : "#94A3B8" }}>
                    {remarks[item.period_no] ? "Edit note" : "Add note"}
                  </button>
                </div>

                {openRemark === item.period_no && (
                  <input
                    value={remarks[item.period_no] || ""}
                    onChange={(e) => setRemarks((p) => ({ ...p, [item.period_no]: e.target.value }))}
                    placeholder="Why it went differently — optional"
                    maxLength={300}
                    className="w-full mt-3 px-3 py-2 text-sm rounded-xl focus:outline-none"
                    style={{ border: "1.5px solid #E2E8F0", color: "#0F172A" }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Save */}
      {!isLoading && day?.is_working_day && items.length > 0 && (
        <div className="sticky bottom-4">
          <button onClick={onSave} disabled={isSaving}
            className="w-full py-3.5 rounded-2xl text-sm font-bold text-white transition-all"
            style={{
              background: isSaving ? "#A5B4FC" : "linear-gradient(135deg,#6366F1,#8B5CF6)",
              cursor: isSaving ? "not-allowed" : "pointer",
              boxShadow: "0 8px 24px rgba(99,102,241,0.25)",
            }}>
            {isSaving ? "Saving…" : `Save ${markedCount || ""} ${markedCount === 1 ? "period" : "periods"}`.trim()}
          </button>
        </div>
      )}
    </div>
  );
}
