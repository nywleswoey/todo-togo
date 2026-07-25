/**
 * Client-safe shared types. No `server-only` import here — both server data
 * access and client components import this module.
 */

export type TodoStatus = "open" | "done" | "archived";

export interface Todo {
  id: string;
  title: string;
  status: TodoStatus;
  /** Date-only, `YYYY-MM-DD`, or null when undated. */
  dueDate: string | null;
  /** Raw utterance this todo was parsed from; null for tap-created todos. */
  sourceTranscript: string | null;
  createdAt: string;
  updatedAt: string;
}
