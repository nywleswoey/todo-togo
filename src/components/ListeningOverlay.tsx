"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ListeningOverlay.module.css";

const BAR_COUNT = 21;

/**
 * Full-screen listening feedback: pulsing mic, live waveform (driven by the
 * recorder's input level), a status line, and — while the model runs — a
 * "Thinking…" state. Tapping Stop ends recording early.
 */
export default function ListeningOverlay({
  phase,
  level,
  transcript,
  onStop,
}: {
  phase: "recording" | "thinking";
  level: number;
  transcript?: string;
  onStop: () => void;
}) {
  return (
    <div className={styles.overlay} role="dialog" aria-label="Listening">
      <div className={`${styles.mic} ${phase === "thinking" ? styles.micThinking : ""}`}>
        🎙️
      </div>

      {phase === "recording" ? (
        <Waveform level={level} />
      ) : (
        <div className={styles.wave} aria-hidden />
      )}

      <div>
        <div className={styles.status}>
          {phase === "recording" ? (
            "Listening…"
          ) : (
            <span className={styles.dots}>Thinking</span>
          )}
        </div>
        {transcript ? (
          <p className={styles.transcript}>{transcript}</p>
        ) : (
          <p className={styles.hint}>
            {phase === "recording" ? "Stops when you go quiet" : ""}
          </p>
        )}
      </div>

      {phase === "recording" && (
        <button className={styles.stop} onClick={onStop}>
          Stop
        </button>
      )}
    </div>
  );
}

/** A rolling bar waveform fed by the recorder's level updates. */
function Waveform({ level }: { level: number }) {
  const [bars, setBars] = useState<number[]>(() =>
    new Array(BAR_COUNT).fill(0.05),
  );
  // Kept in a ref so the interval below reads the newest level without being
  // torn down and recreated on every level change. Written in an effect rather
  // than during render: refs must not be mutated while rendering.
  const levelRef = useRef(level);
  useEffect(() => {
    levelRef.current = level;
  }, [level]);

  useEffect(() => {
    const id = setInterval(() => {
      setBars((prev) => {
        const next = prev.slice(1);
        // Slight per-tick variation so it reads as organic, not a flat block.
        const jitter = 0.85 + Math.random() * 0.3;
        next.push(Math.max(0.05, Math.min(1, levelRef.current * jitter)));
        return next;
      });
    }, 60);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={styles.wave}>
      {bars.map((b, i) => (
        <span
          key={i}
          className={styles.bar}
          style={{ height: `${Math.round(b * 60) + 4}px` }}
        />
      ))}
    </div>
  );
}
