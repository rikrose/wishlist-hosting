import { z } from "zod";
import { THEME_IDS } from "./themes/registry.ts";

/**
 * Shape of wishlist.config.json. Checked at build time (vite.config.ts) so a
 * typo fails the deploy instead of breaking the live site.
 */
export const siteConfigSchema = z.object({
  siteTitle: z.string().min(1),
  ownerName: z.string().min(1),
  intro: z.string().default(""),
  theme: z.enum(THEME_IDS),
  /**
   * Who may manage the list (and who must NOT see purchase state).
   * Format: "github:<username>" or "google:<email>".
   */
  owners: z
    .array(z.string().regex(/^(github|google):.+$/, 'Use "github:<username>" or "google:<email>"'))
    .min(1),
  /**
   * Public Turnstile site key, or null to turn Turnstile off. Recommended; it
   * works on a workers.dev hostname. With it off, sign-in and rate limits still
   * apply. When on, the dev server uses Cloudflare's test key instead.
   */
  turnstileSiteKey: z.string().min(1).nullable().default(null),
  /**
   * Public URL of the site, e.g. "https://wishlist.example.com". Only used by
   * the setup CLI to print OAuth callback URLs. Optional.
   */
  siteUrl: z
    .string()
    .regex(/^https?:\/\/[^/]+$/, 'Use "https://host" with no trailing slash')
    .optional(),
});

export type SiteConfig = z.infer<typeof siteConfigSchema>;
