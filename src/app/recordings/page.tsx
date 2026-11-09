"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, LogIn, Play, Video } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

type Recording = {
  id: string;
  url: string;
  duration: number | null;
  created_at: string;
  meetings: { room_code: string; title: string };
};

export default function RecordingsPage() {
  const { user } = useAuth();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/recordings")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error ?? "Could not load recordings.");
        setRecordings(data.recordings);
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not load recordings.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

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
            <Link href="/login?redirect=/recordings" className="text-link">
              <LogIn size={14} /> Log in
            </Link>
          )}
          <Link href="/dashboard" className="text-link">
            <ArrowLeft size={14} /> Dashboard
          </Link>
        </div>
      </header>
      <section className="app-main">
        <span className="page-kicker">SAVE THE GOOD ONES</span>
        <h1 className="page-title">Your recordings.</h1>
        <p className="page-description">
          Meetings you&apos;ve chosen to keep, all together.
        </p>
        {error && (
          <div className="message-box" role="alert">
            {error}
          </div>
        )}
        {loading ? (
          <div className="panel empty-state">
            <div className="spinner" />
            <p className="muted">Looking for recordings…</p>
          </div>
        ) : recordings.length ? (
          <div className="panel recording-list">
            {recordings.map((recording) => (
              <article className="recording-row" key={recording.id}>
                <span className="recording-icon">
                  <Play size={16} />
                </span>
                <div className="recording-info">
                  <h3>{recording.meetings.title}</h3>
                  <span className="muted">
                    {recording.meetings.room_code} ·{" "}
                    {new Date(recording.created_at).toLocaleString()}
                  </span>
                </div>
                <a
                  className="button button-green button-small"
                  href={recording.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Watch recording <Play size={13} />
                </a>
              </article>
            ))}
          </div>
        ) : (
          <div className="panel empty-state">
            <span className="empty-state-icon">
              <Video size={19} />
            </span>
            <h2>No recordings yet.</h2>
            <p className="muted">
              When you enable LiveKit Egress and record a room, your saved
              recordings will appear here.
            </p>
            <Link href="/dashboard" className="button button-dark">
              Back to your meetings <ArrowLeft size={14} />
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
