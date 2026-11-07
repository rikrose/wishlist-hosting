import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { siteConfig, turnstileSiteKey } from "#/config";
import type { WishlistPageData } from "#/lib/types";
import { env } from "#/server/env";
import { getItem, listPublicItems } from "#/server/items";
import { addEntry, readLedger, removeEntry } from "#/server/ledger-store";
import { enabledProviders } from "#/server/oauth";
import { getViewer } from "#/server/session";
import { buildItemStates, type UserSummary } from "#/server/state";
import { checkRateLimit } from "#/server/rate-limit";
import { verifyTurnstile } from "#/server/turnstile";

/**
 * Per-account limits. These apply whether or not Turnstile is on, in addition
 * to the Workers Rate Limiting binding (see src/server/rate-limit.ts).
 */
const MAX_ACTIVE_ENTRIES_PER_USER = 40;
const MAX_ENTRIES_PER_USER_PER_MINUTE = 6;
const NOTE_MAX = 200;

async function loadUsers(ids: string[]): Promise<Map<string, UserSummary>> {
  const map = new Map<string, UserSummary>();
  const unique = [...new Set(ids)];
  // D1 limits bound parameters per statement, so chunk the lookup.
  for (let i = 0; i < unique.length; i += 90) {
    const chunk = unique.slice(i, i + 90);
    const { results } = await env.DB.prepare(
      `SELECT id, display_name, avatar_url FROM users WHERE id IN (${chunk.map(() => "?").join(",")})`,
    )
      .bind(...chunk)
      .all<{ id: string; display_name: string; avatar_url: string | null }>();
    for (const row of results)
      map.set(row.id, { displayName: row.display_name, avatarUrl: row.avatar_url });
  }
  return map;
}

export const getWishlistPage = createServerFn({ method: "GET" }).handler(
  async (): Promise<WishlistPageData> => {
    const request = getRequest();
    const [viewer, items] = await Promise.all([getViewer(request), listPublicItems()]);

    let states: WishlistPageData["states"] = null;
    // The owner never receives purchase/group state, and neither do signed-out
    // visitors (otherwise the owner could just sign out to peek).
    if (viewer && !viewer.isOwner) {
      const entries = await readLedger();
      const users = await loadUsers(entries.map((e) => e.userId));
      states = buildItemStates(
        items.map((i) => i.id),
        entries,
        users,
        viewer.id,
      );
    }

    return {
      siteTitle: siteConfig.siteTitle,
      ownerName: siteConfig.ownerName,
      intro: siteConfig.intro,
      items,
      states,
      viewer: viewer
        ? { displayName: viewer.displayName, avatarUrl: viewer.avatarUrl, isOwner: viewer.isOwner }
        : null,
      providers: enabledProviders(),
      turnstileSiteKey,
    };
  },
);

const claimInput = z.object({
  itemId: z.string().min(1).max(64),
  kind: z.enum(["buy", "group"]),
  note: z.string().trim().max(NOTE_MAX).default(""),
  /** Required only when Turnstile is on. */
  turnstileToken: z.string().max(4096).default(""),
});

export const claimItem = createServerFn({ method: "POST" })
  .validator(claimInput)
  .handler(async ({ data }) => {
    const request = getRequest();
    const viewer = await getViewer(request);
    if (!viewer) throw new Error("Please sign in first.");
    if (viewer.isOwner) throw new Error("Nice try! The owner can't claim their own gifts.");

    await checkRateLimit(viewer.id);
    if (turnstileSiteKey !== null && !(await verifyTurnstile(request, data.turnstileToken))) {
      throw new Error("The bot check failed or expired. Please try again.");
    }

    const item = await getItem(data.itemId);
    if (!item || item.archived) throw new Error("That item is no longer on the list.");

    const entries = await readLedger();
    const mine = entries.filter((e) => e.userId === viewer.id);
    if (mine.length >= MAX_ACTIVE_ENTRIES_PER_USER)
      throw new Error("You've reached the limit of claims.");
    const recent = mine.filter((e) => e.createdAt > Date.now() - 60_000);
    if (recent.length >= MAX_ENTRIES_PER_USER_PER_MINUTE) {
      throw new Error("Slow down a little, then try again in a minute.");
    }

    const forItem = entries.filter((e) => e.itemId === item.id);
    if (forItem.some((e) => e.userId === viewer.id && e.kind === data.kind)) return { ok: true };
    const bought = forItem.filter((e) => e.kind === "buy").length;
    if (bought >= item.quantity) throw new Error("Someone has already got this one.");

    await addEntry({
      itemId: item.id,
      userId: viewer.id,
      kind: data.kind,
      note: data.note,
      createdAt: Date.now(),
    });
    return { ok: true };
  });

const releaseInput = z.object({
  itemId: z.string().min(1).max(64),
  kind: z.enum(["buy", "group"]),
});

export const releaseItem = createServerFn({ method: "POST" })
  .validator(releaseInput)
  .handler(async ({ data }) => {
    const viewer = await getViewer(getRequest());
    if (!viewer || viewer.isOwner) throw new Error("Please sign in first.");
    await checkRateLimit(viewer.id);
    const entries = await readLedger();
    const mine = entries.filter(
      (e) => e.userId === viewer.id && e.itemId === data.itemId && e.kind === data.kind,
    );
    for (const entry of mine) await removeEntry(entry.rowId);
    return { ok: true };
  });
