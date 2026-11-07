import { createFileRoute, notFound } from "@tanstack/react-router";
import { z } from "zod";
import { WishlistView } from "#/components/WishlistView";
import { demoPage } from "#/demo/fixtures";

/**
 * Dev-only page that renders the wishlist with fake data. Combine with
 * ?theme=<id> to preview a theme; `pnpm run screenshots` uses it to make the
 * README images. Returns 404 in production builds.
 *
 *   /demo?theme=retro&view=guest|owner|anon
 */
export const Route = createFileRoute("/demo")({
  validateSearch: z.object({
    view: z.enum(["guest", "owner", "anon"]).catch("guest").default("guest"),
  }),
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  component: Demo,
});

function Demo() {
  const { view } = Route.useSearch();
  return (
    <WishlistView
      demo
      data={demoPage(view)}
      actions={{ claim: async () => {}, release: async () => {} }}
    />
  );
}
