import { Link } from "@tanstack/react-router";
import { EyeOff } from "lucide-react";
import { useMemo, useState } from "react";
import { ClaimDialog, type ClaimKind } from "#/components/ClaimDialog";
import { ItemCard } from "#/components/ItemCard";
import { SignInButtons, SiteHeader } from "#/components/SiteHeader";
import type { WishItem, WishlistPageData } from "#/lib/types";
import { useTheme } from "#/themes/context";
import { Mascot } from "#/themes/decor";

export interface WishlistActions {
  claim: (itemId: string, kind: ClaimKind, note: string, turnstileToken: string) => Promise<void>;
  release: (itemId: string, kind: ClaimKind) => Promise<void>;
}

/**
 * The whole public page, rendered purely from `data`. Used by the real
 * route and by the /demo route (fixture data, for theme screenshots).
 */
export function WishlistView({
  data,
  actions,
  notice,
  demo,
}: {
  data: WishlistPageData;
  actions: WishlistActions;
  notice?: string | null;
  demo?: boolean;
}) {
  const theme = useTheme();
  const [dialog, setDialog] = useState<{ item: WishItem; kind: ClaimKind } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canAct = !!data.viewer && !data.viewer.isOwner && !!data.states;

  // Signed-in gift givers see fully bought items at the bottom.
  const items = useMemo(() => {
    if (!data.states) return data.items;
    const states = data.states;
    const done = (i: WishItem) => ((states[i.id]?.boughtCount ?? 0) >= i.quantity ? 1 : 0);
    return [...data.items].sort((a, b) => done(a) - done(b));
  }, [data.items, data.states]);

  async function release(itemId: string, kind: ClaimKind) {
    setError(null);
    try {
      await actions.release(itemId, kind);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
      <SiteHeader
        title={data.siteTitle}
        ownerName={data.ownerName}
        viewer={data.viewer}
        providers={data.providers}
        demo={demo}
      />

      {data.intro ? <p className="mb-6 max-w-2xl text-lg">{data.intro}</p> : null}

      {notice ? (
        <p className="mb-6 rounded-lg border border-destructive/40 bg-card p-3 text-sm text-destructive">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="mb-6 rounded-lg border border-destructive/40 bg-card p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {data.viewer?.isOwner ? (
        <div className="mb-8 flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 text-sm shadow-card">
          <EyeOff className="size-5 shrink-0 text-primary" />
          <p className="flex-1">
            This is your list, so who bought what is hidden from you. No peeking!
          </p>
          {demo ? null : (
            <Link
              to="/admin"
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              Add or edit items →
            </Link>
          )}
        </div>
      ) : null}

      {!data.viewer ? (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-card">
          <p className="text-sm">
            Sign in to see what's already been bought, claim a gift, or join a group gift.
          </p>
          <SignInButtons providers={data.providers} demo={demo} />
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center text-muted-foreground">
          <Mascot theme={theme.id} className="size-24 opacity-70" />
          <p>{theme.copy.empty}</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              state={data.states?.[item.id]}
              canAct={canAct}
              onClaim={(kind) => setDialog({ item, kind })}
              onRelease={(kind) => release(item.id, kind)}
            />
          ))}
        </div>
      )}

      {dialog ? (
        <ClaimDialog
          item={dialog.item}
          kind={dialog.kind}
          siteKey={data.turnstileSiteKey}
          onClose={() => setDialog(null)}
          onSubmit={(note, token) => actions.claim(dialog.item.id, dialog.kind, note, token)}
        />
      ) : null}
    </div>
  );
}
