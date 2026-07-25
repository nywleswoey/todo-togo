/**
 * Pending-draft lifecycle as a pure reducer (client-safe, unit-tested).
 *
 * A captured todo is inserted server-side immediately (status 'open'), so it can
 * never be lost to a phone lock. On the client it's shown as a *pending draft*
 * with distinct styling and Keep / Edit / Discard controls until it settles —
 * either the user acts, a self-confirm timer fires, or the app backgrounds
 * (which settles every draft, since they're already persisted).
 */

/** Self-confirm delay (ms). Build-tune via NEXT_PUBLIC_SELF_CONFIRM_MS. */
export const SELF_CONFIRM_MS = Number(
  process.env.NEXT_PUBLIC_SELF_CONFIRM_MS ?? "4000",
);

export interface DraftState {
  /** Todo ids currently presented as pending drafts. */
  pendingIds: string[];
}

export type DraftEvent =
  | { type: "captured"; ids: string[] }
  | { type: "confirm"; id: string } // Keep, self-confirm timeout, or post-edit
  | { type: "discard"; id: string }
  | { type: "settleAll" }; // app backgrounded — persist/settle everything

export const initialDraftState: DraftState = { pendingIds: [] };

export function draftReducer(
  state: DraftState,
  event: DraftEvent,
): DraftState {
  switch (event.type) {
    case "captured": {
      // One draft per capture; ignore ids already tracked.
      const fresh = event.ids.filter((id) => !state.pendingIds.includes(id));
      if (fresh.length === 0) return state;
      return { pendingIds: [...fresh, ...state.pendingIds] };
    }
    case "confirm":
    case "discard": {
      if (!state.pendingIds.includes(event.id)) return state;
      return {
        pendingIds: state.pendingIds.filter((id) => id !== event.id),
      };
    }
    case "settleAll": {
      if (state.pendingIds.length === 0) return state;
      return { pendingIds: [] };
    }
    default:
      return state;
  }
}

export function isDraft(state: DraftState, id: string): boolean {
  return state.pendingIds.includes(id);
}
