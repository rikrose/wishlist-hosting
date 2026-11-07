import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { ItemForm, toFormValues, type ItemFormValues } from "#/components/ItemForm";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { getAdminItems, removeItem, reorderItem, saveItem } from "#/functions/admin";

export const Route = createFileRoute("/admin")({
  loader: () => getAdminItems(),
  component: Admin,
});

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5 text-card-foreground shadow-card sm:p-6">
      {children}
    </section>
  );
}

function Admin() {
  const { allowed, signedIn, items } = Route.useLoaderData();
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);

  if (!allowed) {
    return (
      <main className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="mb-4 text-3xl">Owners only</h1>
        <p className="mb-6 text-muted-foreground">
          {signedIn
            ? "You're signed in, but you're not listed in `owners` in wishlist.config.json."
            : "Sign in with the account listed in wishlist.config.json to manage the list."}
        </p>
        <Button asChild>
          <Link to="/">Back to the list</Link>
        </Button>
      </main>
    );
  }

  async function save(values: ItemFormValues) {
    await saveItem({
      data: { ...values, quantity: Number(values.quantity) },
    });
    setEditing(null);
    await router.invalidate();
  }

  async function remove(id: string, title: string) {
    if (!confirm(`Delete “${title}”? This can't be undone.`)) return;
    await removeItem({ data: { id } });
    await router.invalidate();
  }

  async function move(id: string, direction: "up" | "down") {
    await reorderItem({ data: { id, direction } });
    await router.invalidate();
  }

  return (
    <main className="mx-auto grid w-full max-w-4xl gap-8 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-4xl">Manage your list</h1>
        <Button asChild variant="outline">
          <Link to="/">View the list</Link>
        </Button>
      </div>

      <Panel>
        <h2 className="mb-4 text-2xl">Add an item</h2>
        <ItemForm initial={toFormValues()} onSave={save} />
      </Panel>

      <Panel>
        <h2 className="mb-4 text-2xl">Your items ({items.length})</h2>
        {items.length === 0 ? (
          <p className="text-muted-foreground">Nothing yet. Add your first item above.</p>
        ) : null}
        <ul className="grid divide-y">
          {items.map((item, index) => (
            <li key={item.id} className="py-4">
              {editing === item.id ? (
                <ItemForm
                  initial={toFormValues(item)}
                  onSave={save}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {item.title} {item.archived ? <Badge variant="outline">hidden</Badge> : null}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {[item.price, item.quantity > 1 ? `×${item.quantity}` : null, item.url]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Move up"
                      disabled={index === 0}
                      onClick={() => move(item.id, "up")}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Move down"
                      disabled={index === items.length - 1}
                      onClick={() => move(item.id, "down")}
                    >
                      <ArrowDown />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Edit"
                      onClick={() => setEditing(item.id)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Delete"
                      onClick={() => remove(item.id, item.title)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Panel>
    </main>
  );
}
