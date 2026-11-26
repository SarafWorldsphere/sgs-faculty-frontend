"use client";

/**
 * Messages — the teacher's side of the parent-teacher Communication Centre.
 *
 * A list of threads on the left, the selected thread on the right. Parents
 * start the conversation; a teacher reads and replies. Opening a thread marks
 * the parent's messages read, which is what clears the unread badge.
 *
 * Not scoped to the selected class: a parent writes to a teacher, so the
 * teacher should see the thread whichever class the child is in.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchConversations,
  fetchConversation,
  replyToConversation,
} from "@/lib/api";

function when(value) {
  if (!value) return "";
  const d = new Date(value);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  const days = Math.floor((now - d) / 86400000);
  if (days < 7) return d.toLocaleDateString("en-IN", { weekday: "short" });
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function initials(name) {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

export default function MessagesPage() {
  /* Each piece of state carries what it describes, so "loading" is derived
     rather than set synchronously inside an effect — and a slow response for a
     thread you have already navigated away from cannot land on the one you are
     now reading. */
  const [inbox, setInbox] = useState(null);     // { conversations, unread_total } | { error }
  const [openId, setOpenId] = useState(null);
  const [thread, setThread] = useState(null);   // { forId, data } | { forId, error }
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);

  const endRef = useRef(null);

  const loadInbox = useCallback(
    () =>
      fetchConversations()
        .then((d) => setInbox(d))
        .catch((e) => setInbox({ error: e?.message || "Could not load messages." })),
    []
  );

  useEffect(() => { loadInbox(); }, [loadInbox]);

  useEffect(() => {
    if (openId == null) return;
    let cancelled = false;
    fetchConversation(openId)
      .then((d) => { if (!cancelled) setThread({ forId: openId, data: d }); })
      .catch((e) => {
        if (!cancelled) {
          setThread({ forId: openId, error: e?.message || "Could not open this conversation." });
        }
      });
    return () => { cancelled = true; };
  }, [openId]);

  const ready = thread && thread.forId === openId;
  const threadData = ready ? thread.data : null;
  const threadError = ready ? thread.error : null;

  // Opening a thread marks the parent's messages read on the server, so the
  // badges have to be refetched to stop showing them as unread.
  useEffect(() => {
    if (threadData) loadInbox();
  }, [threadData, loadInbox]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [threadData]);

  const conversations = useMemo(() => inbox?.conversations ?? [], [inbox]);
  const loading = inbox === null;
  const error = inbox?.error ?? null;

  const unreadTotal = inbox?.unread_total ?? 0;

  const open = useMemo(
    () => conversations.find((c) => c.conv_id === openId) ?? null,
    [conversations, openId]
  );

  async function send(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending || openId == null) return;
    setSending(true);
    setSendError(null);
    try {
      const msg = await replyToConversation(openId, text);
      setDraft("");
      // Append rather than refetch: the thread is already open and the server
      // returned the saved message, so there is nothing to go back for.
      setThread((t) =>
        t && t.data ? { ...t, data: { ...t.data, messages: [...(t.data.messages || []), msg] } } : t
      );
      loadInbox();
    } catch (err) {
      setSendError(err?.message || "Could not send your reply.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5 animate-fade-in">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <div className="w-8 h-8 rounded-lg ai-gradient flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.9 9.9 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "#F1F5F9", fontFamily: "var(--font-space-grotesk)" }}>
            Messages
          </h1>
          {unreadTotal > 0 && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "#FEF2F2", color: "#EF4444" }}>
              {unreadTotal} unread
            </span>
          )}
        </div>
        <p className="text-sm pl-10" style={{ color: "#94A3B8" }}>
          Messages from parents about their children
        </p>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center" style={{ border: "1px solid rgba(99,102,241,0.08)" }}>
          <div className="w-8 h-8 rounded-full ai-gradient mx-auto mb-3 animate-pulse" />
          <p className="text-sm" style={{ color: "#94A3B8" }}>Loading messages…</p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl p-8 text-center" style={{ border: "1px solid #FECACA" }}>
          <p className="text-sm" style={{ color: "#EF4444" }}>{error}</p>
        </div>
      ) : conversations.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center" style={{ border: "1px solid rgba(99,102,241,0.08)" }}>
          <p className="text-base font-semibold mb-1" style={{ color: "#0F172A" }}>No messages yet</p>
          <p className="text-sm" style={{ color: "#94A3B8" }}>
            When a parent writes to you about their child, the conversation appears here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: "minmax(260px, 340px) 1fr" }}>

          {/* Thread list */}
          <div className="bg-white rounded-2xl overflow-hidden self-start"
            style={{ border: "1px solid rgba(99,102,241,0.08)", maxHeight: "70vh", overflowY: "auto" }}>
            {conversations.map((c) => {
              const active = c.conv_id === openId;
              return (
                <button key={c.conv_id} onClick={() => setOpenId(c.conv_id)}
                  className="w-full text-left px-4 py-3 cursor-pointer transition-colors"
                  style={{
                    borderBottom: "1px solid #F1F5F9",
                    background: active ? "#EEF2FF" : "transparent",
                  }}>
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                      style={{ background: "#F5F3FF", color: "#6D28D9" }}>
                      {initials(c.student_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold truncate" style={{ color: "#0F172A" }}>
                          {c.student_name || "Student"}
                        </p>
                        <span className="text-[10px] shrink-0" style={{ color: "#94A3B8" }}>{when(c.last_at)}</span>
                      </div>
                      <p className="text-xs truncate" style={{ color: "#64748B" }}>{c.subject}</p>
                      <p className="text-xs truncate mt-0.5" style={{ color: "#94A3B8" }}>
                        {c.last_sender === "TEACHER" ? "You: " : ""}{c.last_message}
                      </p>
                    </div>
                    {c.unread > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                        style={{ background: "#EF4444", color: "#FFFFFF" }}>
                        {c.unread}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Thread */}
          <div className="bg-white rounded-2xl flex flex-col"
            style={{ border: "1px solid rgba(99,102,241,0.08)", height: "70vh" }}>
            {openId == null ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm" style={{ color: "#94A3B8" }}>Select a conversation to read it.</p>
              </div>
            ) : !ready ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm" style={{ color: "#94A3B8" }}>Loading conversation…</p>
              </div>
            ) : threadError ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm" style={{ color: "#EF4444" }}>{threadError}</p>
              </div>
            ) : (
              <>
                <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(99,102,241,0.1)" }}>
                  <p className="text-sm font-bold" style={{ color: "#0F172A" }}>{threadData.subject}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
                    {threadData.student_name}
                    {threadData.student_class ? ` · ${threadData.student_class}` : ""}
                    {threadData.category ? ` · ${threadData.category}` : ""}
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
                  {(threadData.messages || []).map((m) => {
                    const mine = m.sender_type === "TEACHER";
                    return (
                      <div key={m.message_id}
                        className="max-w-[78%] rounded-2xl px-3.5 py-2.5"
                        style={{
                          alignSelf: mine ? "flex-end" : "flex-start",
                          background: mine ? "#EEF2FF" : "#F8FAFC",
                          border: `1px solid ${mine ? "#C7D2FE" : "#E2E8F0"}`,
                        }}>
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-1"
                          style={{ color: mine ? "#6366F1" : "#94A3B8" }}>
                          {mine ? "You" : m.sender_name || "Parent"}
                        </p>
                        <p className="text-sm whitespace-pre-wrap" style={{ color: "#0F172A" }}>{m.message}</p>
                        <p className="text-[10px] mt-1" style={{ color: "#94A3B8" }}>{when(m.created_at)}</p>
                      </div>
                    );
                  })}
                  <div ref={endRef} />
                </div>

                <form onSubmit={send} className="px-4 py-3 flex items-end gap-2"
                  style={{ borderTop: "1px solid rgba(99,102,241,0.1)" }}>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      // Enter sends, Shift+Enter makes a new line — what a
                      // teacher typing a quick reply expects.
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(e); }
                    }}
                    rows={1}
                    placeholder={`Reply to ${open?.student_name ? open.student_name + "'s parent" : "the parent"}…`}
                    aria-label="Your reply"
                    className="flex-1 resize-none rounded-xl px-3 py-2 text-sm outline-none"
                    style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", color: "#0F172A", maxHeight: 120 }}
                  />
                  <button type="submit" disabled={sending || !draft.trim()}
                    className="text-sm font-semibold px-4 py-2 rounded-xl transition-all"
                    style={{
                      background: !draft.trim() ? "#E2E8F0" : "#6366F1",
                      color: !draft.trim() ? "#94A3B8" : "#FFFFFF",
                      cursor: sending || !draft.trim() ? "not-allowed" : "pointer",
                    }}>
                    {sending ? "Sending…" : "Send"}
                  </button>
                </form>
                {sendError && (
                  <p className="px-4 pb-3 text-xs" style={{ color: "#EF4444" }}>{sendError}</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
