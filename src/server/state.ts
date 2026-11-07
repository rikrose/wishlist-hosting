import type { ItemState, Participant } from "#/lib/types";
import type { LedgerEntry } from "#/server/ledger";

export interface UserSummary {
  displayName: string;
  avatarUrl: string | null;
}

/** Folds decrypted ledger entries into per-item state for one viewer. */
export function buildItemStates(
  itemIds: string[],
  entries: LedgerEntry[],
  users: Map<string, UserSummary>,
  viewerId: string,
): Record<string, ItemState> {
  const states: Record<string, ItemState> = {};
  for (const id of itemIds) {
    states[id] = { boughtCount: 0, boughtByYou: false, buyers: [], group: [], youInGroup: false };
  }
  const sorted = [...entries].sort((a, b) => a.createdAt - b.createdAt);
  for (const entry of sorted) {
    const state = states[entry.itemId];
    if (!state) continue; // orphaned (item deleted): ignore, behaves like a decoy
    const user = users.get(entry.userId);
    const isYou = entry.userId === viewerId;
    const participant: Participant = {
      name: user?.displayName ?? "Someone",
      avatarUrl: user?.avatarUrl ?? null,
      note: entry.note,
      isYou,
    };
    if (entry.kind === "buy") {
      state.boughtCount += 1;
      state.buyers.push(participant);
      if (isYou) state.boughtByYou = true;
    } else {
      state.group.push(participant);
      if (isYou) state.youInGroup = true;
    }
  }
  return states;
}
