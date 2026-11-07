import { Link } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar";
import { Button } from "#/components/ui/button";
import type { LoginProvider, ViewerInfo } from "#/lib/types";
import { useTheme } from "#/themes/context";
import { Mascot } from "#/themes/decor";

const PROVIDER_LABEL: Record<LoginProvider, string> = { github: "GitHub", google: "Google" };

export function SignInButtons({ providers, demo }: { providers: LoginProvider[]; demo?: boolean }) {
  if (providers.length === 0) {
    return <p className="text-sm text-muted-foreground">Sign-in is not configured yet.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {providers.map((p) => (
        <Button key={p} asChild size="sm" variant="outline">
          <a href={demo ? "#" : `/auth/login/${p}?returnTo=/`}>Sign in with {PROVIDER_LABEL[p]}</a>
        </Button>
      ))}
    </div>
  );
}

export function SiteHeader({
  title,
  ownerName,
  viewer,
  providers,
  demo,
}: {
  title: string;
  ownerName: string;
  viewer: ViewerInfo | null;
  providers: LoginProvider[];
  demo?: boolean;
}) {
  const theme = useTheme();
  return (
    <header className="flex flex-col gap-6 pt-10 pb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-center gap-4">
        <Mascot theme={theme.id} className="size-16 shrink-0 sm:size-20" />
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">
            {theme.copy.kicker}
          </p>
          <h1 className="site-title text-4xl leading-tight sm:text-5xl">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">for {ownerName}</p>
        </div>
      </div>
      <div className="flex flex-col items-start gap-2 sm:items-end">
        {viewer ? (
          <div className="flex items-center gap-3">
            <Avatar className="size-8">
              {viewer.avatarUrl ? <AvatarImage src={viewer.avatarUrl} alt="" /> : null}
              <AvatarFallback>{viewer.displayName.slice(0, 1)}</AvatarFallback>
            </Avatar>
            <span className="text-sm">{viewer.displayName}</span>
            {viewer.isOwner && !demo ? (
              <Button asChild size="sm" variant="secondary">
                <Link to="/admin">Manage list</Link>
              </Button>
            ) : null}
            <form method="post" action={demo ? undefined : "/auth/logout"}>
              <Button size="sm" variant="ghost" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        ) : (
          <SignInButtons providers={providers} demo={demo} />
        )}
      </div>
    </header>
  );
}
