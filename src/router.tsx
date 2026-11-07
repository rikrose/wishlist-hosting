import { Link, createRouter as createTanStackRouter } from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { Button } from "#/components/ui/button";
import { useTheme } from "#/themes/context";
import { Mascot } from "#/themes/decor";
import { routeTree } from "./routeTree.gen";

function Message({ title, children }: { title: string; children?: React.ReactNode }) {
  const theme = useTheme();
  return (
    <main className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
      <Mascot theme={theme.id} className="size-20" />
      <h1 className="text-3xl">{title}</h1>
      {children}
      <Button asChild variant="outline">
        <Link to="/">Back to the list</Link>
      </Button>
    </main>
  );
}

function NotFound() {
  return <Message title="Nothing here" />;
}

function ErrorPage({ error }: ErrorComponentProps) {
  return (
    <Message title="Something went wrong">
      <p className="text-muted-foreground">
        {error instanceof Error ? error.message : String(error)}
      </p>
    </Message>
  );
}

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    defaultNotFoundComponent: NotFound,
    defaultErrorComponent: ErrorPage,
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
