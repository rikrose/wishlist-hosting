/**
 * Bogus data for the dev-only /demo page and the README theme screenshots.
 * Not used in production.
 */
import type { ItemState, ViewerInfo, WishItem, WishlistPageData } from "#/lib/types";

function picture(emoji: string, from: string, to: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="400" height="300" fill="url(#g)"/><text x="200" y="185" font-size="120" text-anchor="middle">${emoji}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const demoItems: WishItem[] = [
  {
    id: "keyboard",
    title: "Split mechanical keyboard",
    description: "Tactile switches please. Blank keycaps are fine. I touch type… mostly.",
    url: "https://example.com/keyboard",
    imageUrl: picture("⌨️", "#ffd6a5", "#fdffb6"),
    price: "£180",
    priority: 1,
    quantity: 1,
  },
  {
    id: "socks",
    title: "Fun socks",
    description: "Any pattern. Foxes are a bonus.",
    url: null,
    imageUrl: picture("🧦", "#caffbf", "#9bf6ff"),
    price: "£8",
    priority: 3,
    quantity: 4,
  },
  {
    id: "book",
    title: "Crafting Interpreters (hardback)",
    description: "The nice printed edition.",
    url: "https://example.com/book",
    imageUrl: picture("📘", "#a0c4ff", "#bdb2ff"),
    price: "£40",
    priority: 2,
    quantity: 1,
  },
  {
    id: "espresso",
    title: "Hand-grinder for coffee",
    description: "Conical burrs, fits in a travel bag.",
    url: "https://example.com/grinder",
    imageUrl: null,
    price: "~£90",
    priority: 2,
    quantity: 1,
  },
  {
    id: "lamp",
    title: "Moon lamp",
    description: "The 3D-printed kind that changes colour.",
    url: null,
    imageUrl: null,
    price: "£25",
    priority: 3,
    quantity: 1,
  },
  {
    id: "printer",
    title: "3D printer",
    description: "Big one. Probably a group thing!",
    url: "https://example.com/printer",
    imageUrl: picture("🖨️", "#ffc6ff", "#ffadad"),
    price: "£450",
    priority: 1,
    quantity: 1,
  },
];

const none = (): ItemState => ({
  boughtCount: 0,
  boughtByYou: false,
  buyers: [],
  group: [],
  youInGroup: false,
});

export const demoStates: Record<string, ItemState> = {
  keyboard: none(),
  socks: {
    boughtCount: 2,
    boughtByYou: true,
    buyers: [
      { name: "Alex", avatarUrl: null, note: "", isYou: false },
      { name: "Jamie", avatarUrl: null, note: "the stripy ones", isYou: true },
    ],
    group: [],
    youInGroup: false,
  },
  book: {
    boughtCount: 1,
    boughtByYou: false,
    buyers: [{ name: "Priya", avatarUrl: null, note: "", isYou: false }],
    group: [],
    youInGroup: false,
  },
  espresso: none(),
  lamp: none(),
  printer: {
    boughtCount: 0,
    boughtByYou: false,
    buyers: [],
    group: [
      { name: "Morgan", avatarUrl: null, note: "£100 in, DM me", isYou: false },
      { name: "Chris", avatarUrl: null, note: "£50", isYou: false },
    ],
    youInGroup: false,
  },
};

export type DemoView = "guest" | "owner" | "anon";

export function demoPage(view: DemoView): WishlistPageData {
  const viewer: ViewerInfo | null =
    view === "anon"
      ? null
      : {
          displayName: view === "owner" ? "Sam" : "Jamie",
          avatarUrl: null,
          isOwner: view === "owner",
        };
  return {
    siteTitle: "Sam's Wishlist",
    ownerName: "Sam",
    intro: "Things I'd love. Sign in to mark something as bought, or team up on a bigger gift.",
    items: demoItems,
    states: view === "guest" ? demoStates : null,
    viewer,
    providers: ["github", "google"],
    turnstileSiteKey: "1x00000000000000000000AA",
  };
}
