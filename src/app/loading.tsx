export default function Loading() {
  return (
    <main className="page-shell">
      <section className="app-main">
        <div className="panel empty-state">
          <div className="spinner" />
          <p className="muted">Getting things ready…</p>
        </div>
      </section>
    </main>
  );
}
