"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Copy,
  LogIn,
  Video,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function SchedulePage() {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [needsName, setNeedsName] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [meeting, setMeeting] = useState<{
    room_code: string;
    title: string;
    scheduled_at: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const effectiveDisplayName = displayName || user?.name || "";

  async function schedule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (new Date(scheduledAt).getTime() <= Date.now()) {
        throw new Error("Choose a date and time in the future.");
      }
      const guestResponse = await fetch("/api/guest");
      const guestData = await guestResponse.json();
      if (!guestData.guest) {
        const nameToUse = effectiveDisplayName.trim();
        if (!nameToUse) {
          setNeedsName(true);
          setBusy(false);
          return;
        }
        const sessionResponse = await fetch("/api/guest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayName: nameToUse }),
        });
        const session = await sessionResponse.json();
        if (!sessionResponse.ok)
          throw new Error(
            session.error ?? "Could not start your guest session.",
          );
        window.localStorage.setItem("vibemeet-name", session.displayName);
      }
      const response = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          scheduledAt: new Date(scheduledAt).toISOString(),
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Could not schedule your meeting.");
      setMeeting(data.meeting);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not schedule your meeting.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite() {
    if (!meeting) return;
    await navigator.clipboard.writeText(
      `${window.location.origin}/meeting/${meeting.room_code}/lobby`,
    );
    setCopied(true);
  }

  return (
    <main className="page-shell">
      <header className="app-header">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <Video size={18} />
          </span>
          vibe<span className="brand-light">meet</span>
        </Link>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          {user && !user.isGuest ? (
            <span className="user-profile-badge" style={{ padding: "4px 10px" }}>
              <span className="user-initials" style={{ width: 22, height: 22, fontSize: 10 }}>
                {user.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="user-name-text">{user.name}</span>
            </span>
          ) : (
            <Link href="/login?redirect=/schedule" className="text-link">
              <LogIn size={14} /> Log in
            </Link>
          )}
          <Link href="/dashboard" className="text-link">
            <ArrowLeft size={14} /> Dashboard
          </Link>
        </div>
      </header>
      <section className="app-main schedule-page">
        <span className="page-kicker">MAKE A LITTLE TIME</span>
        <h1 className="page-title">
          Put something good
          <br />
          on the calendar.
        </h1>
        <p className="page-description">
          We&apos;ll make a room and an invite link for your people.
        </p>
        {error && (
          <div className="message-box schedule-error" role="alert">
            {error}
          </div>
        )}
        <div className="schedule-grid">
          <form className="panel schedule-form" onSubmit={schedule}>
            {needsName && (
              <div className="form-group">
                <label className="form-label" htmlFor="schedule-name">
                  Your name
                </label>
                <input
                  id="schedule-name"
                  className="form-input"
                  required
                  maxLength={60}
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="How should we introduce you?"
                />
              </div>
            )}
            <div className="form-group">
              <label className="form-label" htmlFor="meeting-title">
                Meeting title
              </label>
              <input
                id="meeting-title"
                className="form-input"
                required
                maxLength={100}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Coffee catch-up, project kickoff…"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="meeting-time">
                Date and time
              </label>
              <input
                id="meeting-time"
                className="form-input"
                required
                type="datetime-local"
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="meeting-description">
                A note for your guests <span className="muted">(optional)</span>
              </label>
              <textarea
                id="meeting-description"
                className="form-textarea"
                maxLength={1000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What are we getting together for?"
              />
            </div>
            <button
              type="submit"
              className="button button-dark"
              disabled={busy}
            >
              {busy ? "Saving…" : "Create meeting invite"}{" "}
              <ArrowRight size={14} />
            </button>
          </form>
          <aside className="schedule-aside">
            <div className="schedule-aside-art">
              <CalendarDays size={32} />
              <span className="schedule-aside-star">✳</span>
            </div>
            <h2>
              Good plans start
              <br />
              with a hello.
            </h2>
            <p className="muted">
              Your invite link is ready to copy as soon as your room is created.
              Guests can join with their name—no account needed.
            </p>
            {meeting && (
              <div className="invite-result">
                <span className="page-kicker">
                  YOUR MEETING IS ON THE CALENDAR
                </span>
                <strong>{meeting.title}</strong>
                <span className="meeting-code">{meeting.room_code}</span>
                <span className="muted">
                  {new Date(meeting.scheduled_at).toLocaleString()}
                </span>
                <div className="invite-actions">
                  <button
                    className="button button-green button-small"
                    onClick={copyInvite}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? "Copied" : "Copy invite link"}
                  </button>
                  <Link
                    className="button button-dark button-small"
                    href={`/meeting/${meeting.room_code}/lobby`}
                  >
                    Open lobby <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}
