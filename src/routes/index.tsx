import { createFileRoute, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import { WishlistView, type WishlistActions } from "#/components/WishlistView";
import { claimItem, getWishlistPage, releaseItem } from "#/functions/wishlist";

export const Route = createFileRoute("/")({
  validateSearch: z.object({ login: z.literal("failed").optional().catch(undefined) }),
  loader: () => getWishlistPage(),
  component: Home,
});

function Home() {
  const data = Route.useLoaderData();
  const { login } = Route.useSearch();
  const router = useRouter();

  const actions: WishlistActions = {
    claim: async (itemId, kind, note, turnstileToken) => {
      await claimItem({ data: { itemId, kind, note, turnstileToken } });
      await router.invalidate();
    },
    release: async (itemId, kind) => {
      await releaseItem({ data: { itemId, kind } });
      await router.invalidate();
    },
  };

  return (
    <WishlistView
      data={data}
      actions={actions}
      notice={login === "failed" ? "Sign-in didn't work. Please try again." : null}
    />
  );
}
