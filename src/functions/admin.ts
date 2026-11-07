import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import type { AdminItem } from "#/lib/types";
import { createItem, deleteItem, getItem, listItems, moveItem, updateItem } from "#/server/items";
import { getViewer } from "#/server/session";

async function requireOwner() {
  const viewer = await getViewer(getRequest());
  if (!viewer?.isOwner) throw new Error("Only the list owner can do that.");
  return viewer;
}

export const getAdminItems = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ allowed: boolean; signedIn: boolean; items: AdminItem[] }> => {
    const viewer = await getViewer(getRequest());
    if (!viewer?.isOwner) return { allowed: false, signedIn: !!viewer, items: [] };
    return { allowed: true, signedIn: true, items: await listItems(true) };
  },
);

const optionalUrl = z
  .string()
  .trim()
  .max(2000)
  .transform((v) => (v === "" ? null : v))
  .refine(
    (v) => v === null || /^https?:\/\//i.test(v),
    "Links must start with http:// or https://",
  );

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));

export const itemInputSchema = z.object({
  id: z.string().max(64).optional(),
  title: z.string().trim().min(1, "A title is required").max(200),
  description: z.string().trim().max(2000).default(""),
  url: optionalUrl,
  imageUrl: optionalUrl,
  price: optionalText(40),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  quantity: z.number().int().min(1).max(99),
  archived: z.boolean().default(false),
});

export const saveItem = createServerFn({ method: "POST" })
  .validator(itemInputSchema)
  .handler(async ({ data }) => {
    await requireOwner();
    const { id, ...input } = data;
    if (id) {
      if (!(await getItem(id))) throw new Error("Item not found.");
      await updateItem(id, input);
      return { id };
    }
    return { id: await createItem(input) };
  });

export const removeItem = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1).max(64) }))
  .handler(async ({ data }) => {
    await requireOwner();
    await deleteItem(data.id);
    return { ok: true };
  });

export const reorderItem = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1).max(64), direction: z.enum(["up", "down"]) }))
  .handler(async ({ data }) => {
    await requireOwner();
    await moveItem(data.id, data.direction);
    return { ok: true };
  });
