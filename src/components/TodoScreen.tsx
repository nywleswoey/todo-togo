"use client";

import { useEffect, useRef, useState } from "react";
import type { Todo } from "@/lib/types";
import type { CaptureResponse } from "@/lib/capture-result";
import { formatDue } from "@/lib/date";
import {
  createTodoApi,
  deleteTodoApi,
  fetchTodos,
  patchTodoApi,
  uploadCapture,
} from "@/lib/api";
import { VoiceRecorder } from "@/lib/recorder";
import ListeningOverlay from "./ListeningOverlay";
import Toast, { type ToastAction } from "./Toast";
import styles from "./TodoScreen.module.css";

type RecPhase = "idle" | "recording" | "thinking";

interface ToastState {
  message: string;
  variant: "info" | "warning";
  action?: ToastAction;
}

/** The one screen: open todos, sorted, tap-managed, plus push-to-talk capture. */
export default function TodoScreen() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");

  const [recPhase, setRecPhase] = useState<RecPhase>("idle");
  const [level, setLevel] = useState(0);
  const [toast, setToast] = useState<ToastState | null>(null);
  const recorderRef = useRef<VoiceRecorder | null>(null);

  useEffect(() => {
    fetchTodos()
      .then(setTodos)
      .catch(() => setTodos([]))
      .finally(() => setLoading(false));
  }, []);

  async function reload() {
    setTodos(await fetchTodos());
  }

  async function addTodo() {
    const title = draftTitle.trim();
    if (!title) return;
    setDraftTitle("");
    try {
      const todo = await createTodoApi({ title });
      setTodos((prev) => sortOpen([todo, ...prev]));
    } catch {
      await reload();
    }
  }

  async function complete(id: string) {
    setTodos((prev) => prev.filter((t) => t.id !== id));
    try {
      await patchTodoApi(id, { status: "done" });
    } catch {
      await reload();
    }
  }

  async function saveEdit(id: string, title: string, dueDate: string | null) {
    setEditingId(null);
    setTodos((prev) =>
      sortOpen(prev.map((t) => (t.id === id ? { ...t, title, dueDate } : t))),
    );
    try {
      await patchTodoApi(id, { title, dueDate });
    } catch {
      await reload();
    }
  }

  async function remove(id: string) {
    setEditingId(null);
    setTodos((prev) => prev.filter((t) => t.id !== id));
    try {
      await deleteTodoApi(id);
    } catch {
      await reload();
    }
  }

  // --- Voice capture ---

  function startRecording() {
    if (recPhase !== "idle") return;
    setToast(null);
    const rec = new VoiceRecorder({
      onLevel: setLevel,
      onComplete: async ({ blob }) => {
        setRecPhase("thinking");
        try {
          handleCaptureResponse(await uploadCapture(blob));
        } catch {
          setRecPhase("idle");
          setToast({
            message: "Didn't catch that.",
            variant: "warning",
            action: { label: "Retry", onAction: startRecording },
          });
        }
      },
      onError: () => {
        setRecPhase("idle");
        setToast({ message: "Didn't catch that.", variant: "warning" });
      },
    });
    recorderRef.current = rec;
    rec
      .start()
      .then(() => setRecPhase("recording"))
      .catch(() => {
        setRecPhase("idle");
        setToast({
          message: "Microphone unavailable — check permissions.",
          variant: "warning",
        });
      });
  }

  function stopRecording() {
    recorderRef.current?.stop();
  }

  function handleCaptureResponse(res: CaptureResponse) {
    setRecPhase("idle");
    if (res.intent === "capture") {
      setTodos((prev) => sortOpen([...res.created, ...prev]));
    } else if (res.intent === "command") {
      // Gated completion UI arrives in ticket 07.
      setToast({ message: "Heard a completion command.", variant: "info" });
    } else {
      setToast({
        message: res.transcript
          ? `Heard “${res.transcript}” — no task caught.`
          : "Didn't catch that.",
        variant: "warning",
        action: { label: "Retry", onAction: startRecording },
      });
    }
  }

  return (
    <div className={styles.screen}>
      <header className={styles.header}>Togo</header>
      <main className={styles.list}>
        {loading ? null : todos.length === 0 ? (
          <p className={styles.empty}>Nothing left to do.</p>
        ) : (
          todos.map((t) =>
            editingId === t.id ? (
              <EditRow
                key={t.id}
                todo={t}
                onSave={saveEdit}
                onDelete={remove}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <TodoRow
                key={t.id}
                todo={t}
                onComplete={() => complete(t.id)}
                onEdit={() => setEditingId(t.id)}
              />
            ),
          )
        )}
      </main>

      <div className={styles.composer}>
        <input
          className={styles.composerInput}
          placeholder="Add a todo…"
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addTodo();
          }}
          aria-label="New todo title"
        />
        {draftTitle.trim() ? (
          <button className={styles.btnPrimary} onClick={addTodo}>
            Add
          </button>
        ) : (
          <button
            className={styles.micBtn}
            onClick={startRecording}
            aria-label="Record a todo by voice"
          >
            🎙️
          </button>
        )}
      </div>

      {recPhase !== "idle" && (
        <ListeningOverlay
          phase={recPhase === "thinking" ? "thinking" : "recording"}
          level={level}
          onStop={stopRecording}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          action={toast.action}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}

function TodoRow({
  todo,
  onComplete,
  onEdit,
}: {
  todo: Todo;
  onComplete: () => void;
  onEdit: () => void;
}) {
  const due = formatDue(todo.dueDate);
  return (
    <div className={styles.row}>
      <button
        className={styles.check}
        onClick={onComplete}
        aria-label={`Complete ${todo.title}`}
      />
      <button className={styles.rowBody} onClick={onEdit}>
        <span className={styles.title}>{todo.title}</span>
        {due && (
          <span
            className={`${styles.due} ${due.overdue ? styles.dueOverdue : ""}`}
          >
            {due.label}
          </span>
        )}
      </button>
    </div>
  );
}

function EditRow({
  todo,
  onSave,
  onDelete,
  onCancel,
}: {
  todo: Todo;
  onSave: (id: string, title: string, dueDate: string | null) => void;
  onDelete: (id: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(todo.title);
  const [dueDate, setDueDate] = useState(todo.dueDate ?? "");
  return (
    <div className={styles.edit}>
      <input
        className={styles.input}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        aria-label="Edit title"
        autoFocus
      />
      <input
        className={styles.input}
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        aria-label="Edit due date"
      />
      <div className={styles.editActions}>
        <button
          className={styles.btnPrimary}
          onClick={() => onSave(todo.id, title.trim() || todo.title, dueDate || null)}
        >
          Save
        </button>
        <button className={styles.btn} onClick={onCancel}>
          Cancel
        </button>
        <button className={styles.btnDanger} onClick={() => onDelete(todo.id)}>
          Delete
        </button>
      </div>
    </div>
  );
}

/** Client-side mirror of the server sort: due date asc, undated last, newest first. */
function sortOpen(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    if (a.dueDate && b.dueDate) {
      if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
    } else if (a.dueDate) return -1;
    else if (b.dueDate) return 1;
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}
