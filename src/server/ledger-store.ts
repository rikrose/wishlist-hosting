/**
 * D1 storage for the ledger. See ledger.ts for the design.
 */
import { randomId, randomInt } from "#/server/bytes";
import { env, requireSecret } from "#/server/env";
import {
  importLedgerKey,
  makeDecoy,
  openEntry,
  sealEntry,
  type LedgerEntry,
} from "#/server/ledger";

let cachedKey: { source: string; key: Promise<CryptoKey> } | undefined;

function workerKey(): Promise<CryptoKey> {
  const source = requireSecret("LEDGER_KEY");
  if (cachedKey?.source !== source) cachedKey = { source, key: importLedgerKey(source) };
  return cachedKey.key;
}

export interface StoredEntry extends LedgerEntry {
  rowId: string;
}

export async function readLedger(): Promise<StoredEntry[]> {
  const key = await workerKey();
  const { results } = await env.DB.prepare("SELECT id, payload FROM sync_state").all<{
    id: string;
    payload: string;
  }>();
  const opened = await Promise.all(
    results.map(async (row) => {
      const entry = await openEntry(key, row.id, row.payload);
      return entry ? { ...entry, rowId: row.id } : null;
    }),
  );
  return opened.filter((e): e is StoredEntry => e !== null);
}

function decoyStatements(count: number): D1PreparedStatement[] {
  const insert = env.DB.prepare("INSERT INTO sync_state (id, payload) VALUES (?, ?)");
  return Array.from({ length: count }, () => insert.bind(randomId(), makeDecoy()));
}

/** Adds a real entry plus 0–2 decoys, in random order, atomically. */
export async function addEntry(entry: LedgerEntry): Promise<void> {
  const key = await workerKey();
  const rowId = randomId();
  const real = env.DB.prepare("INSERT INTO sync_state (id, payload) VALUES (?, ?)").bind(
    rowId,
    await sealEntry(key, rowId, entry),
  );
  const statements = [...decoyStatements(randomInt(0, 2)), real];
  statements.sort(() => randomInt(0, 1) - 0.5);
  await env.DB.batch(statements);
}

export async function removeEntry(rowId: string): Promise<void> {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sync_state WHERE id = ?").bind(rowId),
    ...decoyStatements(randomInt(0, 1)),
  ]);
}

/** Called when the owner adds an item, so new items already have "noise". */
export function seedDecoysStatements(): D1PreparedStatement[] {
  return decoyStatements(randomInt(1, 3));
}
