"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  Copy,
  LogIn,
  LogOut,
  Plus,
  Video,
  UsersRound,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

type Meeting = {
  id: string;
  room_code: string;
  title: string;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  status: string;
};

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [upcoming, setUpcoming] = useState<Meeting[]>([]);
  const [recent, setRecent] = useState<Meeting[]>([]);
  const [needsGuest, setNeedsGuest] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  const effectiveName = user?.name || name;

  const loadMeetings = useCallback(async () => {
    try {
      const [upcomingResponse, recentResponse] = await Promise.all([
        fetch("/api/meetings?kind=upcoming"),
        fetch("/api/meetings?kind=recent"),
      ]);
      if (upcomingResponse.status === 401) {
        setNeedsGuest(true);
        setName(window.localStorage.getItem("vibemeet-name") ?? "");
        return;
      }
      const upcomingData = await upcomingResponse.json();
      const recentData = await recentResponse.json();
      if (!upcomingResponse.ok)
        throw new Error(upcomingData.error ?? "Could not load your meetings.");
      if (!recentResponse.ok)
        throw new Error(
          recentData.error ?? "Could not load your meeting history.",
        );
      setUpcoming(upcomingData.meetings);
      setRecent(recentData.meetings);
      setNeedsGuest(false);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not load meetings.",
      );
    }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void loadMeetings();
    });
    return () => {
      active = false;
    };
  }, [loadMeetings]);

  async function continueAsGuest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const response = await fetch("/api/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Could not start your guest session.");
      window.localStorage.setItem("vibemeet-name", data.displayName);
      setNeedsGuest(false);
      await loadMeetings();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not start your guest session.",
      );
    }
  }

  async function copyLink(code: string) {
    await navigator.clipboard.writeText(
      `${window.location.origin}/meeting/${code}/lobby`,
    );
    setCopied(code);
    window.setTimeout(() => setCopied(""), 1800);
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
        <nav className="header-nav-group">
          <Link href="/schedule">Schedule</Link>
          <Link href="/recordings">Recordings</Link>
          <Link href="/">Home</Link>
          {user && !user.isGuest ? (
            <div className="header-user-section">
              <span className="user-profile-badge">
                <span className="user-initials">
                  {user.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="user-name-text">{user.name}</span>
              </span>
              <button
                onClick={() => logout()}
                className="button-icon-subtle"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <Link
              href="/login?redirect=/dashboard"
              className="button button-dark button-small"
            >
              <LogIn size={14} /> Log in
            </Link>
          )}
        </nav>
      </header>
      <section className="app-main">
        <div className="dashboard-welcome">
          <div>
            <span className="page-kicker">YOUR MEETING SPACE</span>
            <h1 className="page-title">
              Good to see you{effectiveName ? `, ${effectiveName}` : ""}.
            </h1>
            <p className="page-description">
              A place for your conversations, all in one spot.
            </p>
          </div>
          <Link className="button button-dark" href="/schedule">
            <Plus size={16} /> Schedule a meeting
          </Link>
        </div>
        {error && (
          <div className="message-box" role="alert">
            {error}
          </div>
        )}
        {user?.isGuest && (
          <div className="guest-banner">
            <div>
              <strong>Guest mode:</strong> You are viewing meetings for this guest session.{" "}
              <Link href="/login?redirect=/dashboard" className="guest-banner-link">
                Log in or create a free account
              </Link>{" "}
              to sync your meetings permanently across devices.
            </div>
          </div>
        )}
        {needsGuest ? (
          <div className="panel guest-setup-panel">
            <div className="empty-state-icon">
              <UsersRound size={19} />
            </div>
            <h2 className="panel-title">Sign in to your meeting space</h2>
            <p className="muted">
              Log in with your account to access your meetings, or continue as a guest.
            </p>
            <div style={{ marginTop: 20, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/login?redirect=/dashboard" className="button button-dark">
                <LogIn size={15} /> Log in to account
              </Link>
              <Link href="/login?tab=signup&redirect=/dashboard" className="button button-secondary">
                Create free account
              </Link>
            </div>
            <div className="auth-divider" style={{ margin: "22px auto", maxWidth: 280 }}>
              <span>or enter guest name</span>
            </div>
            <form className="guest-setup-form" onSubmit={continueAsGuest} style={{ maxWidth: 380, margin: "0 auto" }}>
              <input
                className="form-input"
                required
                maxLength={60}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Guest display name"
              />
              <button className="button button-green">
                Continue as Guest <ArrowRight size={14} />
              </button>
            </form>
          </div>
        ) : (
          <>
            <div className="dashboard-section-title">
              <div>
                <CalendarDays size={17} />
                <h2>Coming up</h2>
              </div>
              <Link href="/schedule">
                Plan a meeting <ArrowRight size={13} />
              </Link>
            </div>
            {upcoming.length ? (
              <div className="meeting-list">
                {upcoming.map((meeting) => (
                  <MeetingRow
                    key={meeting.id}
                    meeting={meeting}
                    onCopy={copyLink}
                    copied={copied === meeting.room_code}
                  />
                ))}
              </div>
            ) : (
              <div className="panel empty-state">
                <span className="empty-state-icon">
                  <CalendarDays size={19} />
                </span>
                <h3>No meetings on the calendar.</h3>
                <p className="muted">
                  Plan a catch-up or start a room right now.
                </p>
                <Link className="button button-green" href="/schedule">
                  Schedule your first meeting <ArrowRight size={14} />
                </Link>
              </div>
            )}
            <div className="dashboard-section-title recent-title">
              <div>
                <Clock3 size={17} />
                <h2>Recent conversations</h2>
              </div>
            </div>
            {recent.length ? (
              <div className="meeting-list">
                {recent.map((meeting) => (
                  <MeetingRow
                    key={meeting.id}
                    meeting={meeting}
                    onCopy={copyLink}
                    copied={copied === meeting.room_code}
                  />
                ))}
              </div>
            ) : (
              <div className="panel empty-state compact-empty">
                <span className="empty-state-icon">
                  <Video size={19} />
                </span>
                <p className="muted">
                  Your finished meetings will show up here.
                </p>
              </div>
            )}
          </>
        )}
        <div className="personal-room-card">
          <span className="personal-room-icon">
            <Video size={18} />
          </span>
          <div>
            <h3>Your personal room</h3>
            <p className="muted">
              Create a fresh, private room whenever you need one.
            </p>
          </div>
          <Link href="/" className="button button-green">
            Start a meeting <ArrowRight size={14} />
          </Link>
        </div>
      </section>
    </main>
  );
}

function MeetingRow({
  meeting,
  onCopy,
  copied,
}: {
  meeting: Meeting;
  onCopy: (code: string) => void;
  copied: boolean;
}) {
  return (
    <article className="meeting-row">
      <div>
        <span className="meeting-code">{meeting.room_code}</span>
        <h3>{meeting.title}</h3>
        <span className="muted">
          {meeting.scheduled_at
            ? new Date(meeting.scheduled_at).toLocaleString()
            : meeting.started_at
              ? new Date(meeting.started_at).toLocaleDateString()
              : "Meeting"}
        </span>
      </div>
      <div className="meeting-row-actions">
        <span className="status-pill">
          {meeting.status === "scheduled"
            ? "Upcoming"
            : meeting.status === "active"
              ? "In progress"
              : "Past meeting"}
        </span>
        <button
          className="toggle-button"
          onClick={() => onCopy(meeting.room_code)}
          aria-label="Copy invitation link"
        >
          {copied ? (
            <span>Copied</span>
          ) : (
            <>
              <Copy size={14} /> Copy link
            </>
          )}
        </button>
        {meeting.status !== "ended" && (
          <Link
            className="button button-dark button-small"
            href={`/meeting/${meeting.room_code}/lobby`}
          >
            Join <ArrowRight size={13} />
          </Link>
        )}
      </div>
    </article>
  );
}
