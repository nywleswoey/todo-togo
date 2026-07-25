"use client";

import { useEffect, useReducer, useRef, useState } from "react";
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
import {
  draftReducer,
  initialDraftState,
  isDraft,
  SELF_CONFIRM_MS,
} from "@/lib/drafts";
import { decideCompletionUi, type CompletionDecision } from "@/lib/completion";
import type { Candidate } from "@/lib/intent";
import CompletionSheet from "./CompletionSheet";
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

  const [completion, setCompletion] = useState<Exclude<
    CompletionDecision,
    { kind: "none" }
  > | null>(null);

  const [draftState, dispatchDraft] = useReducer(
    draftReducer,
    initialDraftState,
  );
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  useEffect(() => {
    fetchTodos()
      .then(setTodos)
      .catch(() => setTodos([]))
      .finally(() => setLoading(false));
  }, []);

  // Backgrounding settles every pending draft — they're already persisted as
  // open todos, so a phone lock never loses a capture. Also clear timers on unmount.
  useEffect(() => {
    const timers = timersRef.current;
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        timers.forEach(clearTimeout);
        timers.clear();
        dispatchDraft({ type: "settleAll" });
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      timers.forEach(clearTimeout);
    };
  }, []);

  function clearTimer(id: string) {
    const t = timersRef.current.get(id);
    if (t) {
      clearTimeout(t);
      timersRef.current.delete(id);
    }
  }

  function scheduleSelfConfirm(id: string) {
    const t = setTimeout(() => {
      timersRef.current.delete(id);
      dispatchDraft({ type: "confirm", id });
    }, SELF_CONFIRM_MS);
    timersRef.current.set(id, t);
  }

  function keepDraft(id: string) {
    clearTimer(id);
    dispatchDraft({ type: "confirm", id });
  }

  function discardDraft(id: string) {
    clearTimer(id);
    dispatchDraft({ type: "discard", id });
    void remove(id);
  }

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

  /** Complete a todo, optimistically, and offer a one-tap Undo. */
  function completeWithUndo(todo: Todo) {
    setTodos((prev) => prev.filter((t) => t.id !== todo.id));
    patchTodoApi(todo.id, { status: "done" }).catch(() => reload());
    setToast({
      message: `Completed “${todo.title}”.`,
      variant: "info",
      action: { label: "Undo", onAction: () => undoComplete(todo) },
    });
  }

  function undoComplete(todo: Todo) {
    setTodos((prev) => sortOpen([{ ...todo, status: "open" }, ...prev]));
    patchTodoApi(todo.id, { status: "open" }).catch(() => reload());
  }

  /** Resolve a chosen completion candidate to a todo and complete it. */
  function completeCandidate(candidate: Candidate) {
    setCompletion(null);
    const todo =
      todos.find((t) => t.id === candidate.id) ??
      ({
        id: candidate.id,
        title: candidate.title,
        status: "open",
        dueDate: null,
        sourceTranscript: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } satisfies Todo);
    completeWithUndo(todo);
  }

  async function saveEdit(id: string, title: string, dueDate: string | null) {
    setEditingId(null);
    // Editing a draft is an explicit touch — settle it.
    clearTimer(id);
    dispatchDraft({ type: "confirm", id });
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
      dispatchDraft({ type: "captured", ids: res.created.map((t) => t.id) });
      res.created.forEach((t) => scheduleSelfConfirm(t.id));
    } else if (res.intent === "command") {
      const decision = decideCompletionUi(res.command?.candidates ?? []);
      if (decision.kind === "none") {
        setToast({ message: "Couldn't find that todo.", variant: "warning" });
      } else {
        setCompletion(decision);
      }
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
            ) : isDraft(draftState, t.id) ? (
              <DraftRow
                key={t.id}
                todo={t}
                onKeep={() => keepDraft(t.id)}
                onEdit={() => setEditingId(t.id)}
                onDiscard={() => discardDraft(t.id)}
              />
            ) : (
              <TodoRow
                key={t.id}
                todo={t}
                onComplete={() => completeWithUndo(t)}
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

      {completion && (
        <CompletionSheet
          decision={completion}
          onPick={completeCandidate}
          onCancel={() => setCompletion(null)}
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

/** A freshly-captured todo shown as a pending draft until it settles. */
function DraftRow({
  todo,
  onKeep,
  onEdit,
  onDiscard,
}: {
  todo: Todo;
  onKeep: () => void;
  onEdit: () => void;
  onDiscard: () => void;
}) {
  const due = formatDue(todo.dueDate);
  return (
    <div className={styles.draft}>
      <div className={styles.draftTop}>
        <span className={styles.draftBadge}>Draft</span>
        <div className={styles.rowBody} style={{ cursor: "default" }}>
          <span className={styles.title}>{todo.title}</span>
          {due && (
            <span
              className={`${styles.due} ${due.overdue ? styles.dueOverdue : ""}`}
            >
              {due.label}
            </span>
          )}
        </div>
      </div>
      {todo.sourceTranscript && (
        <p className={styles.transcriptNote}>“{todo.sourceTranscript}”</p>
      )}
      <div className={styles.draftActions}>
        <button className={styles.btnPrimary} onClick={onKeep}>
          Keep
        </button>
        <button className={styles.btn} onClick={onEdit}>
          Edit
        </button>
        <button className={styles.btnDanger} onClick={onDiscard}>
          Discard
        </button>
      </div>
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
      {todo.sourceTranscript && (
        <p className={styles.transcriptNote}>Heard: “{todo.sourceTranscript}”</p>
      )}
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
