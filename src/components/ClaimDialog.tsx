import { useState } from "react";
import { Turnstile } from "#/components/Turnstile";
import { Button } from "#/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { Label } from "#/components/ui/label";
import { Textarea } from "#/components/ui/textarea";
import type { WishItem } from "#/lib/types";
import { useTheme } from "#/themes/context";

export type ClaimKind = "buy" | "group";

export function ClaimDialog({
  item,
  kind,
  siteKey,
  onSubmit,
  onClose,
}: {
  item: WishItem;
  kind: ClaimKind;
  /** null when Turnstile is turned off. */
  siteKey: string | null;
  /** `token` is "" when Turnstile is off. */
  onSubmit: (note: string, token: string) => Promise<void>;
  onClose: () => void;
}) {
  const { copy } = useTheme();
  const [note, setNote] = useState("");
  const needsToken = siteKey !== null;
  const [token, setToken] = useState<string | null>(null);
  const [widgetKey, setWidgetKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (needsToken && !token) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(note, token ?? "");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      // Turnstile tokens are single use: get a new one.
      setToken(null);
      setWidgetKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle className="font-display">
              {kind === "buy" ? copy.claim : copy.joinGroup}
            </DialogTitle>
            <DialogDescription>
              {kind === "buy"
                ? `Let others know you're getting “${item.title}”. The list owner won't see this.`
                : `Join the group gift for “${item.title}”. Others who join will see your name and note so you can coordinate. The list owner won't see this.`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="claim-note">
              {kind === "buy" ? "Note (optional)" : "How to reach you / what you can chip in"}
            </Label>
            <Textarea
              id="claim-note"
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                kind === "buy"
                  ? "e.g. getting the blue one"
                  : "e.g. happy to put in £20, message me on Signal"
              }
            />
          </div>
          {siteKey ? <Turnstile key={widgetKey} siteKey={siteKey} onToken={setToken} /> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={(needsToken && !token) || busy}>
              {busy ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
