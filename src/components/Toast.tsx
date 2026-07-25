"use client";

import styles from "./Toast.module.css";

export interface ToastAction {
  label: string;
  onAction: () => void;
}

/** Non-blocking bottom toast. Optional action (e.g. Retry / Undo). */
export default function Toast({
  message,
  variant = "info",
  action,
  onDismiss,
}: {
  message: string;
  variant?: "info" | "warning";
  action?: ToastAction;
  onDismiss: () => void;
}) {
  return (
    <div className={`${styles.toast} ${variant === "warning" ? styles.warning : ""}`}>
      <span className={styles.message}>{message}</span>
      {action && (
        <button
          className={styles.action}
          onClick={() => {
            action.onAction();
            onDismiss();
          }}
        >
          {action.label}
        </button>
      )}
      <button className={styles.dismiss} onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
