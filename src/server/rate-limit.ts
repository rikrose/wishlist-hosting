import { env } from "#/server/env";

/**
 * Per-account rate limit using the Workers Rate Limiting binding
 * (`ratelimits` → CLAIM_LIMITER in wrangler.jsonc). Always on: an extra
 * control when Turnstile is on, and the main one when it's turned off.
 *
 * Cloudflare documents these limits as approximate and per location. The
 * stricter per-account checks in src/functions/wishlist.ts still apply.
 * If the binding is missing (removed from wrangler.jsonc), this does nothing.
 */
export async function checkRateLimit(userId: string): Promise<void> {
  if (!env.CLAIM_LIMITER) return;
  const { success } = await env.CLAIM_LIMITER.limit({ key: `user:${userId}` });
  if (!success) throw new Error("Slow down a little, then try again in a minute.");
}
