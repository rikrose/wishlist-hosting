import { defineConfig, lazyPlugins } from "vite-plus";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

import { readFileSync } from "node:fs";
import type { Plugin } from "vite-plus";
import { siteConfigSchema } from "./src/config-schema.ts";

// Unit tests are plain Node tests of pure modules; they don't need the
// Workers runtime or the app plugins.
const testing = !!process.env.VITEST;

/** Fails the build (and dev start) early if wishlist.config.json is invalid. */
function checkSiteConfig(): Plugin {
  return {
    name: "wishlist:check-site-config",
    buildStart() {
      const result = siteConfigSchema.safeParse(
        JSON.parse(readFileSync("wishlist.config.json", "utf8")),
      );
      if (!result.success) {
        const problems = result.error.issues
          .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
          .join("\n");
        throw new Error(`wishlist.config.json is invalid:\n${problems}`);
      }
    },
  };
}

const config = defineConfig({
  fmt: {
    ignorePatterns: ["src/routeTree.gen.ts", "worker-configuration.d.ts", "src/components/ui/**"],
  },
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    ignorePatterns: ["src/routeTree.gen.ts", "worker-configuration.d.ts", "src/components/ui/**"],
    options: { typeAware: true, typeCheck: true },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  resolve: { tsconfigPaths: true },
  plugins: lazyPlugins(() =>
    testing
      ? []
      : [
          checkSiteConfig(),
          cloudflare({ viteEnvironment: { name: "ssr" } }),
          tailwindcss(),
          tanstackStart(),
          viteReact(),
        ],
  ),
});

export default config;
