"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw, Video } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application route error", error);
  }, [error]);

  return (
    <main className="page-shell">
      <header className="app-header">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <Video size={18} />
          </span>
          vibe<span className="brand-light">meet</span>
        </Link>
      </header>
      <section className="app-main">
        <div className="panel empty-state">
          <span className="empty-state-icon">
            <Video size={19} />
          </span>
          <h1 className="page-title">Something interrupted the moment.</h1>
          <p className="muted">Try again, or head back to the home page.</p>
          <div className="error-actions">
            <button className="button button-dark" onClick={reset}>
              <RefreshCw size={14} /> Try again
            </button>
            <Link className="button button-green" href="/">
              Go home
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
