import { ExternalLink, Gift, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import type { ItemState, Participant, WishItem } from "#/lib/types";
import { cn } from "#/lib/utils";
import { useTheme } from "#/themes/context";
import { PriorityMark } from "#/themes/decor";
import type { ClaimKind } from "#/components/ClaimDialog";

function People({ people }: { people: Participant[] }) {
  return (
    <ul className="grid gap-1.5">
      {people.map((p, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          <Avatar className="size-5">
            {p.avatarUrl ? <AvatarImage src={p.avatarUrl} alt="" /> : null}
            <AvatarFallback className="text-[10px]">{p.name.slice(0, 1)}</AvatarFallback>
          </Avatar>
          <span>
            <span className="font-semibold">{p.isYou ? "You" : p.name}</span>
            {p.note ? <span className="text-muted-foreground"> · {p.note}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ItemCard({
  item,
  state,
  canAct,
  onClaim,
  onRelease,
}: {
  item: WishItem;
  /** undefined = state hidden (owner or signed out). */
  state: ItemState | undefined;
  canAct: boolean;
  onClaim: (kind: ClaimKind) => void;
  onRelease: (kind: ClaimKind) => void;
}) {
  const { id: themeId, copy } = useTheme();
  const fullyBought = state ? state.boughtCount >= item.quantity : false;

  return (
    <article
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-card transition-opacity",
        fullyBought && !state?.boughtByYou && "opacity-70",
      )}
    >
      {item.imageUrl ? (
        <div className="aspect-[4/3] overflow-hidden bg-muted">
          <img src={item.imageUrl} alt="" loading="lazy" className="size-full object-cover" />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={item.priority === 1 ? "default" : "secondary"} className="gap-1">
            <PriorityMark theme={themeId} className="size-3" />
            {copy.priority[item.priority - 1]}
          </Badge>
          {item.quantity > 1 ? <Badge variant="outline">wants {item.quantity}</Badge> : null}
          {state && state.boughtCount > 0 ? (
            <Badge className="bg-success text-success-foreground">
              {copy.bought}
              {item.quantity > 1 ? ` ${state.boughtCount}/${item.quantity}` : ""}
            </Badge>
          ) : null}
        </div>

        <div>
          <h2 className="text-xl leading-snug">{item.title}</h2>
          {item.price ? <p className="text-sm font-semibold text-primary">{item.price}</p> : null}
        </div>

        {item.description ? (
          <p className="text-sm whitespace-pre-line text-muted-foreground">{item.description}</p>
        ) : null}

        {state && state.buyers.length > 0 ? (
          <div className="grid gap-1">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Gift className="size-3.5" /> {copy.bought}
            </p>
            <People people={state.buyers} />
          </div>
        ) : null}

        {state && state.group.length > 0 ? (
          <div className="grid gap-1 rounded-lg bg-muted p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Users className="size-3.5" /> {copy.groupHeading}
            </p>
            <People people={state.group} />
          </div>
        ) : null}

        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          {item.url ? (
            <Button asChild variant="outline" size="sm">
              <a href={item.url} target="_blank" rel="noopener noreferrer nofollow">
                View <ExternalLink />
              </a>
            </Button>
          ) : null}
          {canAct && state ? (
            <>
              {state.boughtByYou ? (
                <Button size="sm" variant="secondary" onClick={() => onRelease("buy")}>
                  {copy.unclaim}
                </Button>
              ) : !fullyBought ? (
                <Button size="sm" onClick={() => onClaim("buy")}>
                  {copy.claim}
                </Button>
              ) : null}
              {state.youInGroup ? (
                <Button size="sm" variant="ghost" onClick={() => onRelease("group")}>
                  {copy.leaveGroup}
                </Button>
              ) : !fullyBought ? (
                <Button size="sm" variant="ghost" onClick={() => onClaim("group")}>
                  {copy.joinGroup}
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
}
