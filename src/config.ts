import raw from "../wishlist.config.json";
import { siteConfigSchema, type SiteConfig } from "#/config-schema";

export type { SiteConfig };

/** Site configuration from `wishlist.config.json` (edit by hand or with `pnpm run configure site`). */
export const siteConfig: SiteConfig = siteConfigSchema.parse(raw);

/** Cloudflare's documented always-pass test key, used by the dev server. */
export const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";

/**
 * The Turnstile site key to render, or null when Turnstile is turned off
 * (`"turnstileSiteKey": null` in wishlist.config.json).
 */
export const turnstileSiteKey: string | null =
  siteConfig.turnstileSiteKey === null
    ? null
    : import.meta.env.DEV
      ? TURNSTILE_TEST_SITE_KEY
      : siteConfig.turnstileSiteKey;
