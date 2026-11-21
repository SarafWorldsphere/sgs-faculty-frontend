"use client";

import { useState, useEffect, useMemo } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

const DAYS = [
  { no: 1, label: "Mon", full: "Monday" },
  { no: 2, label: "Tue", full: "Tuesday" },
  { no: 3, label: "Wed", full: "Wednesday" },
  { no: 4, label: "Thu", full: "Thursday" },
  { no: 5, label: "Fri", full: "Friday" },
  { no: 6, label: "Sat", full: "Saturday" },
];

/* A stable colour per subject, so the same subject reads the same across the
   week without hardcoding a list of subject names the school may not use. */
const SUBJECT_TONES = [
  { bg: "#EEF2FF", border: "#C7D2FE", text: "#4338CA" },
  { bg: "#ECFDF5", border: "#A7F3D0", text: "#047857" },
  { bg: "#FFFBEB", border: "#FDE68A", text: "#B45309" },
  { bg: "#FEF2F2", border: "#FECACA", text: "#B91C1C" },
  { bg: "#F5F3FF", border: "#DDD6FE", text: "#6D28D9" },
  { bg: "#F0F9FF", border: "#BAE6FD", text: "#0369A1" },
];

function toneFor(subject) {
  let h = 0;
  for (let i = 0; i < subject.length; i++) h = (h * 31 + subject.charCodeAt(i)) >>> 0;
  return SUBJECT_TONES[h % SUBJECT_TONES.length];
}

function hhmm(t) {
  if (!t) return "";
  const [h, m] = String(t).split(":");
  const hour = parseInt(h, 10);
  const suffix = hour >= 12 ? "pm" : "am";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}:${m}${suffix}`;
}

export default function TimetablePage() {
  const [scheduleType, setSchedule] = useState("full");

  /* One piece of state carrying which schedule type it describes, so loading
     can be derived rather than set synchronously inside the effect. Switching
     between full and half day then shows the spinner without a second
     setState, and a slow response for the type you just left can never land
     on top of the one you are now looking at. */
  const [result, setResult] = useState(null);   // { forType, data, error }

  const loading = !result || result.forType !== scheduleType;
  const data    = result?.data  ?? null;
  const error   = result?.error ?? null;

  useEffect(() => {
    let cancelled = false;

    const token = typeof window !== "undefined"
      ? localStorage.getItem("swais_faculty_token")
      : null;

    fetch(`${API}/api/v1/timetable/me?schedule_type=${scheduleType}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (r) => {
        if (!r.ok) {
          const b = await r.json().catch(() => ({}));
          throw new Error(b.detail || `Error ${r.status}`);
        }
        return r.json();
      })
      .then((d) => {
        if (!cancelled) setResult({ forType: scheduleType, data: d, error: null });
      })
      .catch((err) => {
        if (!cancelled) {
          setResult({
            forType: scheduleType,
            data: null,
            error: err?.message || "Could not load your timetable.",
          });
        }
      });

    return () => { cancelled = true; };
  }, [scheduleType]);

  /* Slot lookup keyed by day and period. A teacher can legitimately appear
     twice in one period if the timetable has a clash, so each cell holds a
     list rather than a single slot — showing both is more useful than
     silently dropping one. */
  const byCell = useMemo(() => {
    const map = {};
    (data?.slots || []).forEach((s) => {
      const key = `${s.day_of_week}:${s.period_no}`;
      (map[key] = map[key] || []).push(s);
    });
    return map;
  }, [data]);

  const periods     = data?.periods || [];
  const totalPeriods = useMemo(
    () => (data?.slots || []).length,
    [data]
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-8 h-8 rounded-lg ai-gradient flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold" style={{ color: "#F1F5F9", fontFamily: "var(--font-space-grotesk)" }}>
              My Timetable
            </h1>
          </div>
          <p className="text-sm pl-10" style={{ color: "#94A3B8" }}>
            {data?.academic_year
              ? <><span className="font-semibold" style={{ color: "#6366F1" }}>{totalPeriods}</span> periods a week · {data.academic_year}</>
              : "Your weekly schedule"}
          </p>
        </div>

        {/* Full day / half day. Which weekdays are half days is a school rule
            that isn't recorded anywhere yet, so the teacher picks. */}
        <div className="flex gap-2">
          {[{ v: "full", l: "Full day" }, { v: "half", l: "Half day" }].map((o) => {
            const on = scheduleType === o.v;
            return (
              <button key={o.v} onClick={() => setSchedule(o.v)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-all"
                style={{
                  background: on ? "#EEF2FF" : "#FFFFFF",
                  color:      on ? "#6366F1" : "#64748B",
                  border:     `1px solid ${on ? "#C7D2FE" : "#E2E8F0"}`,
                }}>
                {o.l}
              </button>
            );
          })}
        </div>
      </div>

      {/* A teacher booked for two classes in the same period. The table's
          unique constraint is per class, so the database cannot catch this. */}
      {data?.clashes?.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: "#FEF2F2", border: "1px solid #FCA5A5" }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: "#DC2626" }}>
            Timetable clash
          </p>
          {data.clashes.map((c) => (
            <p key={c} className="text-sm" style={{ color: "#991B1B" }}>{c}</p>
          ))}
          <p className="text-xs mt-1.5" style={{ color: "#B91C1C" }}>
            You are scheduled for two classes at once. Please report this to the school office.
          </p>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center" style={{ border: "1px solid rgba(99,102,241,0.08)" }}>
          <div className="w-8 h-8 rounded-full ai-gradient mx-auto mb-3 animate-pulse" />
          <p className="text-sm" style={{ color: "#94A3B8" }}>Loading your timetable…</p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl p-8 text-center" style={{ border: "1px solid #FECACA" }}>
          <p className="text-sm" style={{ color: "#EF4444" }}>{error}</p>
        </div>
      ) : periods.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center" style={{ border: "1px solid rgba(99,102,241,0.08)" }}>
          <p className="text-base font-semibold mb-1" style={{ color: "#0F172A" }}>No timetable yet</p>
          <p className="text-sm" style={{ color: "#94A3B8" }}>
            Your timetable hasn&apos;t been set up for this year. The school office creates it from the Admin dashboard.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(99,102,241,0.08)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 820 }}>
              <thead style={{ background: "linear-gradient(135deg,#EEF2FF,#F5F3FF)", borderBottom: "1px solid rgba(99,102,241,0.1)" }}>
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest" style={{ color: "#6366F1", width: 150 }}>
                    Period
                  </th>
                  {DAYS.map((d) => (
                    <th key={d.no} className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-widest" style={{ color: "#6366F1" }}>
                      <span className="hidden sm:inline">{d.full}</span>
                      <span className="sm:hidden">{d.label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => {
                  // Assembly and breaks span the week — nothing is taught, and
                  // drawing six empty cells would imply a free period instead.
                  if (!p.is_teaching) {
                    return (
                      <tr key={p.period_no} style={{ background: "#F8FAFC", borderBottom: "1px solid #F1F5F9" }}>
                        <td className="px-4 py-2" style={{ color: "#94A3B8" }}>
                          <div className="text-xs font-semibold">{p.period_label}</div>
                          <div className="text-[10px]">{hhmm(p.start_time)} – {hhmm(p.end_time)}</div>
                        </td>
                        <td colSpan={DAYS.length} className="px-4 py-2 text-center text-xs" style={{ color: "#CBD5E1" }}>
                          {p.period_label}
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={p.period_no} style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td className="px-4 py-2.5 align-top">
                        <div className="text-xs font-bold" style={{ color: "#0F172A" }}>{p.period_label}</div>
                        <div className="text-[10px]" style={{ color: "#94A3B8" }}>
                          {hhmm(p.start_time)} – {hhmm(p.end_time)}
                        </div>
                      </td>

                      {DAYS.map((d) => {
                        const cell = byCell[`${d.no}:${p.period_no}`] || [];
                        if (cell.length === 0) {
                          return (
                            <td key={d.no} className="px-2 py-2.5 text-center text-xs" style={{ color: "#E2E8F0" }}>
                              —
                            </td>
                          );
                        }
                        return (
                          <td key={d.no} className="px-2 py-2 align-top">
                            <div className="flex flex-col gap-1">
                              {cell.map((s, i) => {
                                const tone = toneFor(s.subject_name || "");
                                return (
                                  <div key={`${s.class_id}-${s.section}-${i}`}
                                    className="rounded-lg px-2 py-1.5"
                                    style={{ background: tone.bg, border: `1px solid ${tone.border}` }}>
                                    <div className="text-xs font-bold leading-tight" style={{ color: tone.text }}>
                                      {s.subject_name}
                                    </div>
                                    <div className="text-[10px] mt-0.5" style={{ color: "#64748B" }}>
                                      {s.class_name} · {s.section}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
