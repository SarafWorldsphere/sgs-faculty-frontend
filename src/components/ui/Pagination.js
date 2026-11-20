"use client";

/**
 * Pagination — the footer under a long list.
 *
 * Shared by Students and Reports so the two do not drift apart in look. Both
 * already hold every row in memory and filter in the browser, so this paginates
 * what is on screen; nothing is fetched per page.
 *
 * Numbered pages need room, so they are desktop only. On a phone the same
 * control reads "Page 2 of 4" between two arrows — five number buttons do not
 * fit at 360px without wrapping into a second line.
 *
 * Renders nothing when everything fits on one page: a pagination bar under a
 * list of six students is noise.
 */

const ACCENT = "#6366F1";
const BORDER = "#E2E8F0";
const MUTED  = "#94A3B8";

/** 1 … 4 5 6 … 12 — the current page always keeps a neighbour on each side. */
function pageNumbers(page, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const out = [1];
  const from = Math.max(2, page - 1);
  const to   = Math.min(totalPages - 1, page + 1);
  if (from > 2) out.push("…");
  for (let p = from; p <= to; p++) out.push(p);
  if (to < totalPages - 1) out.push("…");
  out.push(totalPages);
  return out;
}

export default function Pagination({
  page,
  totalPages,
  total,
  perPage,
  onChange,
  noun = "records",
}) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * perPage + 1;
  const to   = Math.min(page * perPage, total);

  const arrow = (dir) => {
    const disabled = dir === -1 ? page <= 1 : page >= totalPages;
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(page + dir)}
        aria-label={dir === -1 ? "Previous page" : "Next page"}
        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
        style={{
          border: `1px solid ${BORDER}`,
          background: "white",
          color: disabled ? "#CBD5E1" : "#475569",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
        onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = "#F8FAFC"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "white"; }}
      >
        {dir === -1 ? "Prev" : "Next"}
      </button>
    );
  };

  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4"
      style={{ borderTop: `1px solid ${BORDER}` }}
    >
      <p className="text-xs" style={{ color: MUTED }}>
        Showing <span className="font-semibold" style={{ color: ACCENT }}>{from}–{to}</span> of {total} {noun}
      </p>

      <div className="flex items-center gap-1.5">
        {arrow(-1)}

        {/* Numbered pages — desktop only. */}
        <div className="hidden sm:flex items-center gap-1.5">
          {pageNumbers(page, totalPages).map((p, i) =>
            p === "…" ? (
              <span key={`gap-${i}`} className="px-1 text-xs" style={{ color: "#CBD5E1" }}>…</span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onChange(p)}
                aria-current={p === page ? "page" : undefined}
                className="min-w-[32px] px-2 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                style={p === page
                  ? { border: `1px solid ${ACCENT}`, background: "#EEF2FF", color: ACCENT }
                  : { border: `1px solid ${BORDER}`, background: "white", color: "#475569" }}
              >
                {p}
              </button>
            )
          )}
        </div>

        {/* Phones get a counter instead of buttons that would wrap. */}
        <span className="sm:hidden px-2 text-xs font-semibold" style={{ color: "#475569" }}>
          Page {page} of {totalPages}
        </span>

        {arrow(1)}
      </div>
    </div>
  );
}
