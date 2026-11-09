import Link from "next/link";
import { ArrowLeft, Video } from "lucide-react";

export default function NotFound() {
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
          <h1 className="page-title">We couldn&apos;t find that page.</h1>
          <p className="muted">
            The link may have changed, or the meeting may have ended.
          </p>
          <Link className="button button-dark" href="/">
            <ArrowLeft size={14} /> Back to VibeMeet
          </Link>
        </div>
      </section>
    </main>
  );
}
