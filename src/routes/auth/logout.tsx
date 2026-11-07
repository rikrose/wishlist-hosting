import { createFileRoute } from "@tanstack/react-router";
import { destroySession } from "#/server/session";

/** POST /auth/logout */
export const Route = createFileRoute("/auth/logout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Same-origin check: a plain form POST from our own pages only.
        const origin = request.headers.get("Origin");
        if (origin && origin !== new URL(request.url).origin) {
          return new Response("Forbidden", { status: 403 });
        }
        const cookie = await destroySession(request);
        return new Response(null, {
          status: 303,
          headers: { Location: "/", "Set-Cookie": cookie },
        });
      },
    },
  },
});
