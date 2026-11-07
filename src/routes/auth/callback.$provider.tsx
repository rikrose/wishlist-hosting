import { createFileRoute } from "@tanstack/react-router";
import { finishLogin, isProviderId } from "#/server/oauth";

/**
 * GET /auth/callback/github|google: the OAuth redirect URI.
 * Register https://<your-domain>/auth/callback/<provider> with the provider.
 */
export const Route = createFileRoute("/auth/callback/$provider")({
  server: {
    handlers: {
      GET: ({ request, params }) => {
        if (!isProviderId(params.provider))
          return new Response("Unknown provider", { status: 404 });
        return finishLogin(request, params.provider);
      },
    },
  },
});
