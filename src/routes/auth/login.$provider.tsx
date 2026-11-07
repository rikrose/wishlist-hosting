import { createFileRoute } from "@tanstack/react-router";
import { isProviderId, startLogin } from "#/server/oauth";

/** GET /auth/login/github|google → redirect to the provider. */
export const Route = createFileRoute("/auth/login/$provider")({
  server: {
    handlers: {
      GET: ({ request, params }) => {
        if (!isProviderId(params.provider))
          return new Response("Unknown provider", { status: 404 });
        return startLogin(request, params.provider);
      },
    },
  },
});
