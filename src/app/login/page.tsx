"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";

export default function LoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !pin) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (res.ok) {
        posthog.identify("togo_user");
        router.replace("/");
        router.refresh();
      } else {
        const body = await res.json().catch(() => ({}));
        posthog.capture("login_failed", { reason: body.error ?? "Incorrect PIN" });
        setError(body.error ?? "Incorrect PIN");
        setPin("");
      }
    } catch (err) {
      posthog.captureException(err);
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        padding: 24,
      }}
    >
      <h1 style={{ margin: 0, fontSize: 32 }}>Togo</h1>
      <form
        onSubmit={submit}
        style={{ display: "flex", flexDirection: "column", gap: 12, width: 240 }}
      >
        <input
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="Enter PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          aria-label="PIN"
          autoFocus
          style={{
            padding: "14px 16px",
            fontSize: 20,
            textAlign: "center",
            letterSpacing: 6,
            border: "1px solid var(--border)",
            borderRadius: 12,
            background: "var(--surface)",
          }}
        />
        <button
          type="submit"
          disabled={busy}
          style={{
            padding: "14px 16px",
            fontSize: 17,
            border: "none",
            borderRadius: 12,
            background: "var(--brand)",
            color: "var(--brand-fg)",
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? "Unlocking…" : "Unlock"}
        </button>
        {error && (
          <p style={{ color: "var(--danger)", margin: 0, textAlign: "center" }}>
            {error}
          </p>
        )}
      </form>
    </main>
  );
}
