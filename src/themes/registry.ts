/**
 * Theme registry: everything about *how the site looks and talks*, kept apart
 * from the wishlist data. Colours/shapes live in `themes.css` under
 * `[data-theme="<id>"]`; decorative artwork lives in `decor.tsx`.
 *
 * The theme words are: cozy, minimal, celestial, botanical, retro, and playful
 * (playful is fox themed).
 *
 * To add a theme: add an entry here, a `[data-theme="<id>"]` block in
 * themes.css, and (optionally) artwork in decor.tsx.
 */

export const THEME_IDS = ["playful", "cozy", "minimal", "celestial", "botanical", "retro"] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export interface ThemeCopy {
  /** Small text above the site title. */
  kicker: string;
  /** Button: "I'll buy this". */
  claim: string;
  /** Button: undo a claim. */
  unclaim: string;
  /** Button: join a group gift. */
  joinGroup: string;
  /** Button: leave a group gift. */
  leaveGroup: string;
  /** Badge on an item someone has bought. */
  bought: string;
  /** Heading of the group gift area on an item. */
  groupHeading: string;
  /** Shown when the list is empty. */
  empty: string;
  /** Priority labels, 1 = highest. */
  priority: [string, string, string];
}

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  description: string;
  /** Google Fonts stylesheet URL for this theme (loaded only when active). */
  fontHref: string;
  copy: ThemeCopy;
}

const gf = (families: string) => `https://fonts.googleapis.com/css2?${families}&display=swap`;

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  playful: {
    id: "playful",
    label: "Playful",
    description: "A cheeky fox, warm autumn oranges and bouncy rounded shapes.",
    fontHref: gf("family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700"),
    copy: {
      kicker: "A fox's wishlist",
      claim: "Pounce on it",
      unclaim: "Let it go",
      joinGroup: "Join the skulk",
      leaveGroup: "Leave the skulk",
      bought: "Snapped up",
      groupHeading: "Skulk (group gift)",
      empty: "The den is empty. The fox is still thinking…",
      priority: ["Tail-waggingly wanted", "Would be lovely", "Just a sniff"],
    },
  },
  cozy: {
    id: "cozy",
    label: "Cozy",
    description: "Knitwear browns, candlelight and soft serif type.",
    fontHref: gf("family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Lora:wght@400;600"),
    copy: {
      kicker: "Wrapped up warm",
      claim: "I'll wrap this up",
      unclaim: "Unwrap",
      joinGroup: "Pitch in together",
      leaveGroup: "Step out",
      bought: "Wrapped",
      groupHeading: "Pitching in together",
      empty: "Nothing here yet. Put the kettle on and check back soon.",
      priority: ["Would treasure", "Would enjoy", "A little extra"],
    },
  },
  minimal: {
    id: "minimal",
    label: "Minimal",
    description: "Black, white and one accent. Nothing extra.",
    fontHref: gf("family=Inter:wght@400;500;600;700"),
    copy: {
      kicker: "Wishlist",
      claim: "Claim",
      unclaim: "Unclaim",
      joinGroup: "Join group gift",
      leaveGroup: "Leave group",
      bought: "Claimed",
      groupHeading: "Group gift",
      empty: "No items yet.",
      priority: ["High", "Medium", "Low"],
    },
  },
  celestial: {
    id: "celestial",
    label: "Celestial",
    description: "Midnight blue, starlight gold and elegant serifs.",
    fontHref: gf("family=Cormorant+Garamond:wght@500;600;700&family=Jost:wght@400;500;600"),
    copy: {
      kicker: "Written in the stars",
      claim: "Grant this wish",
      unclaim: "Return to the sky",
      joinGroup: "Join the constellation",
      leaveGroup: "Drift away",
      bought: "Wish granted",
      groupHeading: "Constellation (group gift)",
      empty: "The sky is clear tonight. No wishes yet.",
      priority: ["Brightest star", "Shining", "Distant twinkle"],
    },
  },
  botanical: {
    id: "botanical",
    label: "Botanical",
    description: "Sage greens, pressed leaves and a gardener's notebook.",
    fontHref: gf("family=DM+Serif+Display&family=DM+Sans:wght@400;500;700"),
    copy: {
      kicker: "From the garden",
      claim: "I'll plant this",
      unclaim: "Uproot",
      joinGroup: "Grow it together",
      leaveGroup: "Leave the plot",
      bought: "Planted",
      groupHeading: "Shared plot (group gift)",
      empty: "Freshly dug soil. Nothing planted yet.",
      priority: ["In full bloom", "Budding", "A seedling"],
    },
  },
  retro: {
    id: "retro",
    label: "Retro",
    description: "Green-screen terminal, scanlines and a blinking cursor.",
    fontHref: gf("family=VT323&family=IBM+Plex+Mono:wght@400;600"),
    copy: {
      kicker: "C:\\> TYPE WISHLIST.TXT",
      claim: "> claim",
      unclaim: "> undo",
      joinGroup: "> join party",
      leaveGroup: "> leave party",
      bought: "[CLAIMED]",
      groupHeading: "PARTY (group gift)",
      empty: "0 file(s) found.",
      priority: ["PRIORITY_HIGH", "PRIORITY_MED", "PRIORITY_LOW"],
    },
  },
};

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);
}
