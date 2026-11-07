/**
 * The "ledger": who bought what, and who is chipping in on a group gift.
 *
 * Goal: the site owner can open the D1 console (or run `SELECT *`) without the
 * surprise being spoiled at a glance. This is obfuscation against a casual
 * look, not protection against a determined owner, who holds every key.
 *
 * How it works
 * - Each real entry is JSON, space-padded to a multiple of BLOCK bytes, then
 *   encrypted with AES-256-GCM using LEDGER_KEY. The row id is bound in as
 *   "additional data", so rows cannot be swapped between ids.
 * - Decoy rows are random bytes with the same shape and length distribution.
 *   They fail GCM authentication (the "check"), so the reader drops them.
 * - Decoys are written when an item is created and alongside each real write,
 *   so the row count does not map to the number of claims.
 * - No item id, user id or timestamp is stored in clear text. To answer
 *   "is item X bought?" the server decrypts every row. That is fine for a
 *   personal wishlist (hundreds of rows).
 *
 * The pure functions here take a CryptoKey so they can be unit tested; the
 * D1 storage (using the Worker's LEDGER_KEY) is in ledger-store.ts.
 */
import { fromBase64, randomBytes, randomInt, toBase64Url } from "#/server/bytes";

export type EntryKind = "buy" | "group";

export interface LedgerEntry {
  itemId: string;
  userId: string;
  kind: EntryKind;
  /** Optional note shown to other gift-givers (never the owner). */
  note: string;
  createdAt: number;
}

interface WireEntry {
  v: 1;
  i: string;
  u: string;
  k: "b" | "g";
  n: string;
  t: number;
}

export const BLOCK = 160;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function importLedgerKey(base64Key: string): Promise<CryptoKey> {
  const raw = fromBase64(base64Key.trim());
  if (raw.length !== 32) {
    throw new Error(
      "LEDGER_KEY must be 32 random bytes, base64 encoded (see README.md: Set the encryption key)",
    );
  }
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function pad(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const blocks = Math.max(1, Math.ceil(bytes.length / BLOCK));
  const out = new Uint8Array(blocks * BLOCK).fill(0x20); // trailing spaces are valid JSON whitespace
  out.set(bytes);
  return out;
}

export async function sealEntry(
  key: CryptoKey,
  rowId: string,
  entry: LedgerEntry,
): Promise<string> {
  const wire: WireEntry = {
    v: 1,
    i: entry.itemId,
    u: entry.userId,
    k: entry.kind === "buy" ? "b" : "g",
    n: entry.note,
    t: entry.createdAt,
  };
  const iv = randomBytes(IV_BYTES);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(rowId) },
    key,
    pad(encoder.encode(JSON.stringify(wire))),
  );
  const out = new Uint8Array(IV_BYTES + ciphertext.byteLength);
  out.set(iv);
  out.set(new Uint8Array(ciphertext), IV_BYTES);
  return toBase64Url(out);
}

/** Returns the entry, or null for decoys / tampered / foreign rows. */
export async function openEntry(
  key: CryptoKey,
  rowId: string,
  payload: string,
): Promise<LedgerEntry | null> {
  try {
    const bytes = fromBase64(payload);
    if (bytes.length < IV_BYTES + TAG_BYTES + 1) return null;
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes.slice(0, IV_BYTES), additionalData: encoder.encode(rowId) },
      key,
      bytes.slice(IV_BYTES),
    );
    const wire = JSON.parse(decoder.decode(plain)) as Partial<WireEntry>;
    if (wire.v !== 1 || typeof wire.i !== "string" || typeof wire.u !== "string") return null;
    if (wire.k !== "b" && wire.k !== "g") return null;
    return {
      itemId: wire.i,
      userId: wire.u,
      kind: wire.k === "b" ? "buy" : "group",
      note: typeof wire.n === "string" ? wire.n : "",
      createdAt: typeof wire.t === "number" ? wire.t : 0,
    };
  } catch {
    return null; // decoy: fails the GCM authentication check
  }
}

/** Random bytes shaped like a sealed entry. Always fails `openEntry`. */
export function makeDecoy(): string {
  const roll = randomInt(1, 10);
  const blocks = roll <= 7 ? 1 : roll <= 9 ? 2 : 3;
  return toBase64Url(randomBytes(IV_BYTES + blocks * BLOCK + TAG_BYTES));
}
