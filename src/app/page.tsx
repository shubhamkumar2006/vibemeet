"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CircleHelp,
  Globe2,
  Headphones,
  LockKeyhole,
  LogIn,
  LogOut,
  Menu,
  Mic2,
  MonitorUp,
  MoreHorizontal,
  Plus,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UsersRound,
  Video,
  X,
} from "lucide-react";
import { isRoomCode } from "@/lib/validation";
import { useAuth } from "@/lib/auth-context";

function Logo({ small = false }: { small?: boolean }) {
  return (
    <Link href="/" className="brand" aria-label="VibeMeet home">
      <span className="brand-mark">
        <Video size={small ? 17 : 19} strokeWidth={2.5} />
      </span>
      <span>
        vibe<span className="brand-light">meet</span>
      </span>
    </Link>
  );
}

function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout } = useAuth();

  return (
    <header className="site-header">
      <div className="header-inner">
        <Logo />
        <nav className={`main-nav ${menuOpen ? "nav-open" : ""}`}>
          <a href="#features" onClick={() => setMenuOpen(false)}>
            Features
          </a>
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>
            How it works
          </a>
          <Link href="/schedule" onClick={() => setMenuOpen(false)}>
            Schedule
          </Link>
          {menuOpen && (
            <div className="mobile-auth-links">
              {user && !user.isGuest ? (
                <>
                  <div className="mobile-user-info">
                    <span className="user-initials">
                      {user.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span>{user.name}</span>
                  </div>
                  <Link href="/dashboard" onClick={() => setMenuOpen(false)}>
                    Dashboard
                  </Link>
                  <button
                    onClick={() => {
                      logout();
                      setMenuOpen(false);
                    }}
                    className="mobile-logout-btn"
                  >
                    <LogOut size={15} /> Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" onClick={() => setMenuOpen(false)}>
                    Log in
                  </Link>
                  <Link
                    href="/login?tab=signup"
                    className="button button-dark button-small"
                    onClick={() => setMenuOpen(false)}
                  >
                    Sign up free
                  </Link>
                </>
              )}
            </div>
          )}
        </nav>
        <div className="header-actions">
          {user && !user.isGuest ? (
            <div className="header-user-section">
              <Link href="/dashboard" className="user-profile-badge">
                <span className="user-initials">
                  {user.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="user-name-text">{user.name}</span>
              </Link>
              <Link href="/dashboard" className="text-link">
                My meetings <ArrowUpRight size={15} />
              </Link>
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
            <>
              <Link href="/login" className="text-link">
                <LogIn size={15} /> Log in
              </Link>
              <Link
                className="button button-dark button-small"
                href="/login?tab=signup"
              >
                Sign up free <ArrowRight size={15} />
              </Link>
            </>
          )}
        </div>
        <button
          className="menu-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
        >
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
      </div>
    </header>
  );
}

function MeetingPreview() {
  return (
    <div className="preview-card" aria-label="Illustration of a video meeting">
      <div className="preview-top">
        <div className="preview-title">
          <span className="live-dot" /> Design sync{" "}
          <span className="preview-time">12:48</span>
        </div>
        <MoreHorizontal size={19} color="#777a73" />
      </div>
      <div className="preview-grid">
        <div className="person-tile tile-coral">
          <span className="person-person">AS</span>
          <span className="person-name">Avery Stone</span>
          <span className="speaking-ring" />
        </div>
        <div className="person-tile tile-blue">
          <span className="person-person">JM</span>
          <span className="person-name">Jordan Miller</span>
        </div>
        <div className="person-tile tile-yellow">
          <span className="person-person">SK</span>
          <span className="person-name">Sam Kim</span>
        </div>
        <div className="person-tile tile-lavender">
          <span className="person-person">+3</span>
          <span className="person-name">3 more</span>
        </div>
      </div>
      <div className="preview-controls">
        <span className="control-icon">
          <Mic2 size={16} />
        </span>
        <span className="control-icon">
          <Video size={16} />
        </span>
        <span className="control-icon">
          <MonitorUp size={16} />
        </span>
        <span className="control-icon control-red">
          <X size={16} />
        </span>
      </div>
      <div className="floating-note">
        <span className="note-icon">
          <Sparkles size={16} />
        </span>
        <span>
          <b>Ideas are better</b>
          <br />
          when we share them.
        </span>
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const [roomCode, setRoomCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [displayName, setDisplayName] = useState("");

  async function createMeeting() {
    setBusy(true);
    setError("");
    try {
      const guestResponse = await fetch("/api/guest");
      const guestData = await guestResponse.json();
      if (!guestResponse.ok)
        throw new Error(guestData.error ?? "Could not check your guest session.");
      if (!guestData.guest) {
        setDisplayName(window.localStorage.getItem("vibemeet-name") ?? "");
        setShowNameDialog(true);
        return;
      }
      const response = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Instant meeting" }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Could not create meeting.");
      router.push(`/meeting/${data.meeting.roomCode}/lobby`);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not create meeting.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function continueAsGuest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const sessionResponse = await fetch("/api/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName }),
      });
      const sessionData = await sessionResponse.json();
      if (!sessionResponse.ok)
        throw new Error(
          sessionData.error ?? "Could not start your guest session.",
        );
      window.localStorage.setItem("vibemeet-name", sessionData.displayName);
      setShowNameDialog(false);
      setBusy(false);
      await createMeeting();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not start your guest session.",
      );
      setBusy(false);
    }
  }

  function joinMeeting(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = roomCode.trim().toUpperCase();
    if (!isRoomCode(code)) {
      setError("Enter a meeting code like RAJ-123-456.");
      return;
    }
    setError("");
    router.push(`/meeting/${code}/lobby`);
  }

  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero-section">
          <div className="hero-inner">
            <div className="hero-copy">
              <div className="eyebrow">
                <span className="eyebrow-star">
                  <Sparkles size={13} />
                </span>{" "}
                A little more human, a lot more together
              </div>
              <h1>
                Good things
                <br />
                happen <span className="headline-accent">face to face.</span>
              </h1>
              <p className="hero-description">
                Bring your people together, wherever they are. Thoughtful video
                meetings that just feel right.
              </p>
              <div className="hero-ctas">
                <button
                  className="button button-dark"
                  onClick={createMeeting}
                  disabled={busy}
                >
                  <Plus size={17} /> {busy ? "Creating…" : "Start a meeting"}{" "}
                  <ArrowRight size={15} />
                </button>
                <span className="cta-note">
                  {user && !user.isGuest ? (
                    <>
                      <UserCheck size={13} /> Hosting as {user.name}
                    </>
                  ) : (
                    <>
                      <LockKeyhole size={13} /> No account needed to join
                    </>
                  )}
                </span>
              </div>
              <div className="join-box" id="start">
                <span className="join-icon">
                  <UsersRound size={17} />
                </span>
                <form onSubmit={joinMeeting}>
                  <label htmlFor="room-code">Have a meeting code?</label>
                  <div className="join-input-row">
                    <input
                      id="room-code"
                      value={roomCode}
                      onChange={(event) =>
                        setRoomCode(event.target.value.toUpperCase())
                      }
                      placeholder="RAJ-123-456"
                      maxLength={11}
                      autoCapitalize="characters"
                    />
                    <button
                      className="button button-green button-small"
                      type="submit"
                    >
                      Join <ArrowRight size={14} />
                    </button>
                  </div>
                </form>
              </div>
              {error && (
                <p className="inline-error" role="alert">
                  {error}
                </p>
              )}
              <span className="share-hint">
                <span className="share-check">
                  <UsersRound size={11} />
                </span>
                Invite anyone with one simple link
              </span>
            </div>
            <div className="hero-art">
              <div className="art-sun" />
              <div className="art-sparkle sparkle-one">✳</div>
              <div className="art-sparkle sparkle-two">✳</div>
              <div className="art-caption">
                <span className="caption-dot" /> YOUR PEOPLE, RIGHT HERE
              </div>
              <MeetingPreview />
              <div className="tiny-tag">
                <Globe2 size={13} /> Together, from anywhere
              </div>
            </div>
          </div>
          <div className="hero-bottom">
            <span>MADE FOR THE MOMENTS THAT MATTER</span>
            <div className="trust-items">
              <span>
                <ShieldCheck size={14} /> Private by design
              </span>
              <span>
                <Headphones size={14} /> Clear as day
              </span>
              <span>
                <UsersRound size={14} /> Up to 25 people
              </span>
            </div>
          </div>
        </section>

        <section className="features-section" id="features">
          <div className="section-heading">
            <div>
              <span className="eyebrow">LESS FUSS. MORE FLOW.</span>
              <h2>
                Everything you need.
                <br />
                <span>Nothing in your way.</span>
              </h2>
            </div>
            <p>
              We made the little things feel effortless, so you can focus on the
              big things: being there for each other.
            </p>
          </div>
          <div className="feature-grid">
            <article className="feature-card feature-card-wide">
              <div className="feature-art feature-art-green">
                <div className="floating-bubble bubble-one">
                  <Video size={17} />
                </div>
                <div className="floating-bubble bubble-two">
                  <Mic2 size={17} />
                </div>
                <div className="feature-orbit">
                  <span className="orbit-person">A</span>
                  <span className="orbit-person">J</span>
                  <span className="orbit-person">S</span>
                  <span className="orbit-person orbit-add">+</span>
                </div>
              </div>
              <div className="feature-content">
                <span className="feature-number">01 / SHOW UP</span>
                <h3>One click to closer.</h3>
                <p>
                  No downloads, no drama. Just share a link and you&apos;re
                  together in seconds.
                </p>
                <ArrowDownRight className="feature-arrow" size={18} />
              </div>
            </article>
            <article className="feature-card">
              <div className="feature-art feature-art-yellow">
                <div className="sound-wave">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <div className="wave-label">
                  <span className="wave-dot" /> Sounds like you&apos;re in the
                  room
                </div>
              </div>
              <div className="feature-content">
                <span className="feature-number">02 / FEEL PRESENT</span>
                <h3>Crystal-clear, always.</h3>
                <p>
                  Thoughtful audio and video that make every conversation feel
                  natural.
                </p>
                <ArrowDownRight className="feature-arrow" size={18} />
              </div>
            </article>
            <article className="feature-card">
              <div className="feature-art feature-art-blue">
                <div className="collab-note">
                  <span className="note-top">
                    <span />
                    <span />
                    <span />
                  </span>
                  <span className="note-scribble">
                    Great ideas
                    <br />
                    start together
                    <span className="scribble-underline" />
                  </span>
                  <span className="note-heart">♡</span>
                </div>
              </div>
              <div className="feature-content">
                <span className="feature-number">03 / MAKE IT HAPPEN</span>
                <h3>Room for good ideas.</h3>
                <p>
                  Share your screen, bring everyone in, and make something
                  wonderful.
                </p>
                <ArrowDownRight className="feature-arrow" size={18} />
              </div>
            </article>
          </div>
        </section>

        <section className="closing-section" id="how-it-works">
          <div className="closing-star">✳</div>
          <span className="eyebrow">
            YOUR NEXT GOOD CONVERSATION IS ONE CLICK AWAY
          </span>
          <h2>
            Come on in.
            <br />
            <span>We saved you a seat.</span>
          </h2>
          <button
            className="button button-dark"
            onClick={createMeeting}
            disabled={busy}
          >
            {busy ? "Creating…" : "Start a free meeting"}{" "}
            <ArrowRight size={15} />
          </button>
          <div className="closing-foot">
            <span>Meet. Connect. Collaborate.</span>
            <span>
              Free to start · No credit card · Just good conversations
            </span>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="footer-main">
          <Logo small />
          <span className="footer-tagline">Good conversations start here.</span>
          <div className="footer-links">
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/schedule">Schedule a meeting</Link>
            <a href="mailto:hello@vibemeet.app">
              Say hello <ArrowUpRight size={13} />
            </a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} VibeMeet. Made for being together.
          </span>
          <span>
            <CircleHelp size={13} /> Your people are one link away.
          </span>
        </div>
      </footer>
      {showNameDialog && (
        <div
          className="dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowNameDialog(false);
          }}
        >
          <form className="guest-dialog" onSubmit={continueAsGuest}>
            <button
              type="button"
              className="dialog-close"
              onClick={() => setShowNameDialog(false)}
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <span className="page-kicker">WELCOME TO VIBEMEET</span>
            <h2>What should we call you?</h2>
            <p className="muted">
              Your name will be visible to people in your meeting.
            </p>
            <input
              className="form-input"
              required
              maxLength={60}
              autoFocus
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Your name"
            />
            <button
              className="button button-dark dialog-submit"
              disabled={busy}
            >
              {busy ? "One moment…" : "Continue as guest"}{" "}
              <ArrowRight size={15} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
