import type { AdminItem, Priority, WishItem } from "#/lib/types";
import { randomId } from "#/server/bytes";
import { env } from "#/server/env";
import { seedDecoysStatements } from "#/server/ledger-store";

interface ItemRow {
  id: string;
  title: string;
  description: string;
  url: string | null;
  image_url: string | null;
  price: string | null;
  priority: number;
  quantity: number;
  sort_order: number;
  archived: number;
}

function toAdminItem(row: ItemRow): AdminItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    url: row.url,
    imageUrl: row.image_url,
    price: row.price,
    priority: Math.min(3, Math.max(1, row.priority || 2)) as Priority,
    quantity: row.quantity,
    sortOrder: row.sort_order,
    archived: row.archived === 1,
  };
}

function toWishItem({ archived: _a, sortOrder: _s, ...item }: AdminItem): WishItem {
  return item;
}

export async function listItems(includeArchived: boolean): Promise<AdminItem[]> {
  const sql = includeArchived
    ? "SELECT * FROM items ORDER BY archived, sort_order, created_at"
    : "SELECT * FROM items WHERE archived = 0 ORDER BY sort_order, created_at";
  const { results } = await env.DB.prepare(sql).all<ItemRow>();
  return results.map(toAdminItem);
}

export async function listPublicItems(): Promise<WishItem[]> {
  return (await listItems(false)).map(toWishItem);
}

export async function getItem(id: string): Promise<AdminItem | null> {
  const row = await env.DB.prepare("SELECT * FROM items WHERE id = ?").bind(id).first<ItemRow>();
  return row ? toAdminItem(row) : null;
}

export interface ItemInput {
  title: string;
  description: string;
  url: string | null;
  imageUrl: string | null;
  price: string | null;
  priority: Priority;
  quantity: number;
  archived: boolean;
}

export async function createItem(input: ItemInput): Promise<string> {
  const id = randomId();
  const max = await env.DB.prepare("SELECT COALESCE(MAX(sort_order), 0) AS m FROM items").first<{
    m: number;
  }>();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO items (id, title, description, url, image_url, price, priority, quantity, sort_order, archived, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      id,
      input.title,
      input.description,
      input.url,
      input.imageUrl,
      input.price,
      input.priority,
      input.quantity,
      (max?.m ?? 0) + 10,
      input.archived ? 1 : 0,
      Date.now(),
    ),
    ...seedDecoysStatements(),
  ]);
  return id;
}

export async function updateItem(id: string, input: ItemInput): Promise<void> {
  await env.DB.prepare(
    `UPDATE items SET title = ?, description = ?, url = ?, image_url = ?, price = ?, priority = ?, quantity = ?, archived = ?
      WHERE id = ?`,
  )
    .bind(
      input.title,
      input.description,
      input.url,
      input.imageUrl,
      input.price,
      input.priority,
      input.quantity,
      input.archived ? 1 : 0,
      id,
    )
    .run();
}

/**
 * Deletes an item. Its ledger rows are left in place on purpose: once the
 * item is gone they can no longer be matched, so they become extra noise.
 */
export async function deleteItem(id: string): Promise<void> {
  await env.DB.prepare("DELETE FROM items WHERE id = ?").bind(id).run();
}

/** Moves an item one place up or down in the list. */
export async function moveItem(id: string, direction: "up" | "down"): Promise<void> {
  const items = await listItems(true);
  const index = items.findIndex((i) => i.id === id);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapWith < 0 || swapWith >= items.length) return;
  const reordered = [...items];
  [reordered[index], reordered[swapWith]] = [reordered[swapWith]!, reordered[index]!];
  const update = env.DB.prepare("UPDATE items SET sort_order = ? WHERE id = ?");
  await env.DB.batch(reordered.map((item, i) => update.bind((i + 1) * 10, item.id)));
}
