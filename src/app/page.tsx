/**
 * Placeholder landing shell (ticket 01). The real one-screen todo list replaces
 * this in ticket 02. Kept static so `next build` needs no database at build time.
 */
export default function Home() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: "24px",
        textAlign: "center",
      }}
    >
      <h1 style={{ margin: 0, fontSize: 40 }}>Togo</h1>
      <p style={{ margin: 0, color: "var(--muted)", maxWidth: 320 }}>
        Voice-driven todos. Tap the mic, say it, it lands.
      </p>
    </main>
  );
}
