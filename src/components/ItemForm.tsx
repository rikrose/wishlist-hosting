import { useState } from "react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import { Textarea } from "#/components/ui/textarea";
import type { AdminItem, Priority } from "#/lib/types";
import { useTheme } from "#/themes/context";

export interface ItemFormValues {
  id?: string;
  title: string;
  description: string;
  url: string;
  imageUrl: string;
  price: string;
  priority: Priority;
  quantity: number;
  archived: boolean;
}

export function toFormValues(item?: AdminItem): ItemFormValues {
  return {
    id: item?.id,
    title: item?.title ?? "",
    description: item?.description ?? "",
    url: item?.url ?? "",
    imageUrl: item?.imageUrl ?? "",
    price: item?.price ?? "",
    priority: item?.priority ?? 2,
    quantity: item?.quantity ?? 1,
    archived: item?.archived ?? false,
  };
}

export function ItemForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: ItemFormValues;
  onSave: (values: ItemFormValues) => Promise<void>;
  onCancel?: () => void;
}) {
  const { copy } = useTheme();
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof ItemFormValues>(key: K, value: ItemFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSave(values);
      if (!values.id) setValues(initial);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          required
          maxLength={200}
          value={values.title}
          onChange={(e) => set("title", e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          maxLength={2000}
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Size, colour, model number…"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="url">Link</Label>
          <Input
            id="url"
            type="url"
            placeholder="https://"
            value={values.url}
            onChange={(e) => set("url", e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="imageUrl">Image URL</Label>
          <Input
            id="imageUrl"
            type="url"
            placeholder="https://"
            value={values.imageUrl}
            onChange={(e) => set("imageUrl", e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="price">Price</Label>
          <Input
            id="price"
            maxLength={40}
            placeholder="£25"
            value={values.price}
            onChange={(e) => set("price", e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="priority">Priority</Label>
          <Select
            value={String(values.priority)}
            onValueChange={(v) => set("priority", Number(v) as Priority)}
          >
            <SelectTrigger id="priority" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {copy.priority.map((label, i) => (
                <SelectItem key={label} value={String(i + 1)}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="quantity">How many</Label>
          <Input
            id="quantity"
            type="number"
            min={1}
            max={99}
            value={values.quantity}
            onChange={(e) => set("quantity", Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={values.archived}
          onChange={(e) => set("archived", e.target.checked)}
        />
        Hidden (keep it, but don't show it on the list)
      </label>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : values.id ? "Save changes" : "Add item"}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
