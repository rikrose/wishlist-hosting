import { env as cfEnv } from "cloudflare:workers";

/**
 * Bindings and secrets available to the Worker.
 * Bindings come from wrangler.jsonc; secrets from `wrangler secret put`
 * (production) or `.dev.vars` (local).
 */
export interface AppEnv {
  DB: D1Database;
  /** Workers Rate Limiting binding (wrangler.jsonc → ratelimits). Optional. */
  CLAIM_LIMITER?: RateLimit;
  /** base64 encoded 32 random bytes. Encrypts purchase/group state. Never change it once in use. */
  LEDGER_KEY?: string;
  /** Only needed when Turnstile is on (turnstileSiteKey is set in wishlist.config.json). */
  TURNSTILE_SECRET_KEY?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

export const env = cfEnv as unknown as AppEnv;

export class ConfigError extends Error {
  constructor(message: string) {
    super(`Site configuration problem: ${message}. See README.md → "Configuration".`);
  }
}

export function requireSecret(name: keyof Omit<AppEnv, "DB" | "CLAIM_LIMITER">): string {
  const value = env[name];
  if (!value) throw new ConfigError(`the secret ${name} is not set`);
  return value;
}
