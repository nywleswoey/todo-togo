"use client";

import type { Candidate } from "@/lib/intent";
import type { CompletionDecision } from "@/lib/completion";
import styles from "./CompletionSheet.module.css";

/**
 * Gated completion UI. A single high-confidence match gets a confirm sheet; any
 * ambiguity gets a tap-list. Either way completion happens only on a tap.
 */
export default function CompletionSheet({
  decision,
  onPick,
  onCancel,
}: {
  decision: Exclude<CompletionDecision, { kind: "none" }>;
  onPick: (candidate: Candidate) => void;
  onCancel: () => void;
}) {
  return (
    <div className={styles.backdrop} onClick={onCancel}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        {decision.kind === "confirm" ? (
          <>
            <p className={styles.prompt}>
              Complete “{decision.candidate.title}”?
            </p>
            <div className={styles.confirmActions}>
              <button
                className={styles.no}
                onClick={onCancel}
                aria-label="Cancel"
              >
                ✗
              </button>
              <button
                className={styles.yes}
                onClick={() => onPick(decision.candidate)}
                aria-label="Confirm complete"
              >
                ✓
              </button>
            </div>
          </>
        ) : (
          <>
            <p className={styles.prompt}>Which one?</p>
            {decision.candidates.map((cand) => (
              <button
                key={cand.id}
                className={styles.candidate}
                onClick={() => onPick(cand)}
              >
                <span>{cand.title}</span>
                {cand.confidence === "low" && (
                  <span className={styles.conf}>maybe</span>
                )}
              </button>
            ))}
            <button className={styles.cancel} onClick={onCancel}>
              None of these
            </button>
          </>
        )}
      </div>
    </div>
  );
}
