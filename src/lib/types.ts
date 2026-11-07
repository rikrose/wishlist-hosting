/**
 * Data shapes shared between server and UI. The UI renders only these, which
 * keeps presentation (themes, components) separate from storage.
 */

export type Priority = 1 | 2 | 3;

export interface WishItem {
  id: string;
  title: string;
  description: string;
  url: string | null;
  imageUrl: string | null;
  price: string | null;
  priority: Priority;
  quantity: number;
}

export interface AdminItem extends WishItem {
  archived: boolean;
  sortOrder: number;
}

export interface Participant {
  name: string;
  avatarUrl: string | null;
  note: string;
  isYou: boolean;
}

/** Purchase / group state for one item. Never sent to the owner. */
export interface ItemState {
  boughtCount: number;
  boughtByYou: boolean;
  buyers: Participant[];
  group: Participant[];
  youInGroup: boolean;
}

export type LoginProvider = "github" | "google";

export interface ViewerInfo {
  displayName: string;
  avatarUrl: string | null;
  isOwner: boolean;
}

export interface WishlistPageData {
  siteTitle: string;
  ownerName: string;
  intro: string;
  items: WishItem[];
  /** null when hidden: for the owner and for signed-out visitors. */
  states: Record<string, ItemState> | null;
  viewer: ViewerInfo | null;
  providers: LoginProvider[];
  /** null when Turnstile is turned off. */
  turnstileSiteKey: string | null;
}
