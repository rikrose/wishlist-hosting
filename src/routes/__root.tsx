import { HeadContent, Scripts, createRootRoute, retainSearchParams } from "@tanstack/react-router";
import { z } from "zod";
import { siteConfig } from "#/config";
import { ThemeProvider } from "#/themes/context";
import { THEMES, THEME_IDS, type ThemeId } from "#/themes/registry";

import appCss from "../styles.css?url";

const rootSearch = z.object({
  /** Preview another theme without changing the config: /?theme=retro */
  theme: z.enum(THEME_IDS).optional().catch(undefined),
});

function activeTheme(search: { theme?: ThemeId }): ThemeId {
  return search.theme ?? siteConfig.theme;
}

export const Route = createRootRoute({
  validateSearch: rootSearch,
  search: { middlewares: [retainSearchParams(["theme"])] },
  head: ({ match }) => {
    const theme = THEMES[activeTheme(match.search)];
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: siteConfig.siteTitle },
        { name: "robots", content: "noindex" },
      ],
      links: [
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
        { rel: "stylesheet", href: theme.fontHref },
        { rel: "stylesheet", href: appCss },
        { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      ],
    };
  },
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  const theme = activeTheme(Route.useSearch());
  return (
    <html lang="en" data-theme={theme}>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}
