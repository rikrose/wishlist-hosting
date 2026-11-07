import { describe, expect, it } from "vite-plus/test";
import {
  BLOCK,
  importLedgerKey,
  makeDecoy,
  openEntry,
  sealEntry,
  type LedgerEntry,
} from "#/server/ledger";
import { fromBase64, randomBytes, toBase64Url } from "#/server/bytes";
import { buildItemStates } from "#/server/state";

const keyB64 = btoa(String.fromCharCode(...randomBytes(32)));
const entry: LedgerEntry = {
  itemId: "item-1",
  userId: "user-1",
  kind: "buy",
  note: "blue one",
  createdAt: 1700000000000,
};

describe("ledger", () => {
  it("round-trips a sealed entry", async () => {
    const key = await importLedgerKey(keyB64);
    const sealed = await sealEntry(key, "row-1", entry);
    expect(await openEntry(key, "row-1", sealed)).toEqual(entry);
  });

  it("does not leak ids or notes in the payload", async () => {
    const key = await importLedgerKey(keyB64);
    const sealed = await sealEntry(key, "row-1", entry);
    for (const secret of ["item-1", "user-1", "blue"]) expect(sealed).not.toContain(secret);
  });

  it("rejects a row moved to another id", async () => {
    const key = await importLedgerKey(keyB64);
    const sealed = await sealEntry(key, "row-1", entry);
    expect(await openEntry(key, "row-2", sealed)).toBeNull();
  });

  it("rejects decoys, garbage, and other keys", async () => {
    const key = await importLedgerKey(keyB64);
    const otherKey = await importLedgerKey(toBase64Url(randomBytes(32)));
    for (let i = 0; i < 50; i++) expect(await openEntry(key, "row", makeDecoy())).toBeNull();
    expect(await openEntry(key, "row", "not base64 !!")).toBeNull();
    expect(await openEntry(otherKey, "row-1", await sealEntry(key, "row-1", entry))).toBeNull();
  });

  it("makes decoys the same shape as real entries", async () => {
    const key = await importLedgerKey(keyB64);
    const realLen = fromBase64(await sealEntry(key, "r", entry)).length;
    const decoyLens = new Set(Array.from({ length: 200 }, () => fromBase64(makeDecoy()).length));
    expect(decoyLens.has(realLen)).toBe(true);
    for (const len of decoyLens) expect((len - 12 - 16) % BLOCK).toBe(0);
  });

  it("refuses keys of the wrong length", async () => {
    await expect(importLedgerKey(btoa("short"))).rejects.toThrow(/32 random bytes/);
  });
});

describe("buildItemStates", () => {
  it("folds entries per item and marks the viewer", () => {
    const users = new Map([
      ["a", { displayName: "Alex", avatarUrl: null }],
      ["b", { displayName: "Bo", avatarUrl: null }],
    ]);
    const states = buildItemStates(
      ["x", "y"],
      [
        { itemId: "x", userId: "a", kind: "buy", note: "", createdAt: 2 },
        { itemId: "y", userId: "b", kind: "group", note: "£20", createdAt: 1 },
        { itemId: "y", userId: "a", kind: "group", note: "", createdAt: 3 },
        { itemId: "deleted", userId: "a", kind: "buy", note: "", createdAt: 4 },
      ],
      users,
      "a",
    );
    expect(states.x).toMatchObject({ boughtCount: 1, boughtByYou: true });
    expect(states.y!.group.map((p) => [p.name, p.isYou])).toEqual([
      ["Bo", false],
      ["Alex", true],
    ]);
    expect(states.y!.youInGroup).toBe(true);
    expect(Object.keys(states)).toEqual(["x", "y"]);
  });
});
