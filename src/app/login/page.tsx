"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Sparkles,
  User,
  UserCheck,
  Video,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "signup" ? "signup" : "login";
  const redirectPath = searchParams.get("redirect") || "/dashboard";

  const { login, signup, user } = useAuth();
  const [tab, setTab] = useState<"login" | "signup">(initialTab);

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Guest flow state
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestName, setGuestName] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setBusy(true);

    try {
      if (tab === "login") {
        await login(email, password);
        router.push(redirectPath);
      } else {
        if (!name.trim()) {
          throw new Error("Please enter your name.");
        }
        await signup(name, email, password);
        router.push(redirectPath);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGuestSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!guestName.trim()) {
      setError("Please enter a guest display name.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: guestName.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Could not create guest session.");
      }
      window.localStorage.setItem("vibemeet-name", data.displayName);
      router.push(redirectPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join as guest.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <Link href="/" className="brand" aria-label="VibeMeet home">
            <span className="brand-mark">
              <Video size={18} strokeWidth={2.5} />
            </span>
            <span>
              vibe<span className="brand-light">meet</span>
            </span>
          </Link>
          <h1 className="auth-title">
            {tab === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="auth-subtitle">
            {tab === "login"
              ? "Sign in to access your meetings, history, and recordings."
              : "Set up a free account to host and manage video meetings."}
          </p>
        </div>

        {user && !user.isGuest ? (
          <div
            className="message-box message-box-info"
            style={{ marginTop: 20 }}
          >
            <p>
              You are currently signed in as <strong>{user.name}</strong> (
              {user.email}).
            </p>
            <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
              <Link
                href="/dashboard"
                className="button button-dark button-small"
              >
                Go to Dashboard <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="auth-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === "login"}
                className={`auth-tab ${tab === "login" ? "active" : ""}`}
                onClick={() => {
                  setTab("login");
                  setError("");
                }}
              >
                Log In
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "signup"}
                className={`auth-tab ${tab === "signup" ? "active" : ""}`}
                onClick={() => {
                  setTab("signup");
                  setError("");
                }}
              >
                Create Account
              </button>
            </div>

            {error && (
              <div
                className="message-box"
                role="alert"
                style={{ marginTop: 16 }}
              >
                {error}
              </div>
            )}
            {success && (
              <div
                className="message-box message-box-success"
                role="status"
                style={{ marginTop: 16 }}
              >
                {success}
              </div>
            )}

            {!showGuestForm ? (
              <form onSubmit={handleSubmit} className="auth-form">
                {tab === "signup" && (
                  <div className="form-group">
                    <label className="form-label" htmlFor="name">
                      Full Name
                    </label>
                    <div className="input-with-icon">
                      <span className="input-icon">
                        <User size={16} />
                      </span>
                      <input
                        id="name"
                        type="text"
                        className="form-input"
                        placeholder="Alex Morgan"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        autoFocus={tab === "signup"}
                      />
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" htmlFor="email">
                    Email address
                  </label>
                  <div className="input-with-icon">
                    <span className="input-icon">
                      <Mail size={16} />
                    </span>
                    <input
                      id="email"
                      type="email"
                      className="form-input"
                      placeholder="alex@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus={tab === "login"}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 5,
                    }}
                  >
                    <label
                      className="form-label"
                      htmlFor="password"
                      style={{ margin: 0 }}
                    >
                      Password
                    </label>
                  </div>
                  <div className="input-with-icon">
                    <span className="input-icon">
                      <Lock size={16} />
                    </span>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      className="form-input"
                      placeholder={
                        tab === "signup" ? "At least 6 characters" : "••••••••"
                      }
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={tab === "signup" ? 6 : 1}
                      required
                    />
                    <button
                      type="button"
                      className="input-action-btn"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="button button-dark"
                  style={{ width: "100%", marginTop: 10 }}
                  disabled={busy}
                >
                  {busy ? (
                    <span className="button-loading">
                      <span className="spinner-inline" />{" "}
                      {tab === "login" ? "Signing in…" : "Creating account…"}
                    </span>
                  ) : (
                    <>
                      {tab === "login" ? "Log in" : "Create account"}{" "}
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleGuestSubmit} className="auth-form">
                <div className="guest-intro">
                  <span className="eyebrow-star">
                    <Sparkles size={14} />
                  </span>
                  <span>Quick guest session — no password needed</span>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="guestName">
                    Your Display Name
                  </label>
                  <div className="input-with-icon">
                    <span className="input-icon">
                      <UserCheck size={16} />
                    </span>
                    <input
                      id="guestName"
                      type="text"
                      className="form-input"
                      placeholder="e.g. Avery Stone"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="button button-green"
                  style={{ width: "100%", marginTop: 10 }}
                  disabled={busy}
                >
                  {busy ? "Joining…" : "Continue as Guest"}{" "}
                  <ArrowRight size={16} />
                </button>
                <button
                  type="button"
                  className="text-link"
                  style={{ alignSelf: "center", marginTop: 8 }}
                  onClick={() => setShowGuestForm(false)}
                >
                  ← Back to Email Log in
                </button>
              </form>
            )}

            {!showGuestForm && (
              <div className="auth-divider">
                <span>or</span>
              </div>
            )}

            {!showGuestForm && (
              <button
                type="button"
                className="button button-secondary"
                style={{ width: "100%" }}
                onClick={() => {
                  setShowGuestForm(true);
                  setError("");
                }}
              >
                <UserCheck size={16} /> Continue as Guest
              </button>
            )}
          </>
        )}

        <div className="auth-footer">
          <Link href="/" className="text-link">
            <ArrowLeft size={14} /> Back to VibeMeet Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="page-shell">
          <div className="panel empty-state">
            <div className="spinner" />
            <p className="muted">Loading…</p>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
