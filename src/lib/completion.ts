/**
 * Decide how a spoken completion command is presented — always gated behind a
 * tap, never auto-applied. Pure and client-safe so the branching is unit-tested.
 *
 *   - exactly one high-confidence match → a single confirm sheet
 *   - more than one match, or any low-confidence match → a tap-list to pick from
 *   - nothing matched → no sheet (caller shows a "couldn't find that" warning)
 */
import type { Candidate } from "./intent";

export type CompletionDecision =
  | { kind: "none" }
  | { kind: "confirm"; candidate: Candidate }
  | { kind: "list"; candidates: Candidate[] };

export function decideCompletionUi(
  candidates: Candidate[],
): CompletionDecision {
  if (candidates.length === 0) return { kind: "none" };
  if (candidates.length === 1 && candidates[0].confidence === "high") {
    return { kind: "confirm", candidate: candidates[0] };
  }
  return { kind: "list", candidates };
}
