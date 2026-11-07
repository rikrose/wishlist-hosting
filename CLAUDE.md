<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Running Scripts

Run TypeScript and JavaScript files with `vpx <file>`, for example `vpx ./scripts/seed.ts --dry-run`. It handles enums, decorators, JSX, and tsconfig `paths`, so do not add `tsx` or `ts-node` to run scripts. `vpx --watch <file>` reruns the file when a file it uses changes, in place of `tsx watch`. `vp node <file>` runs plain Node.js.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+
release. Add a tool name to select part of the graph. For example, run
`vp toolchain vite`. Use `--global` to ignore the local `vite-plus` package. Use
`vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

# Project notes

Self-hosted wishlist: TanStack Start on Cloudflare Workers + D1, shadcn/ui, Vite+. See README.md for deployment.

- **README.md must stay accurate.** Any change to setup, config keys, secrets, scripts or deploy steps must update README.md (and `scripts/configure.ts` if it touches setup).
- **Data vs presentation:** components render only the types in `src/lib/types.ts` and use semantic theme tokens (`bg-card`, `text-primary`, `font-display`). Never hard-code colours in components; theme values live in `src/themes/` (registry.ts, themes.css, decor.tsx).
- **Owner must never receive purchase/group state.** `getWishlistPage` in `src/functions/wishlist.ts` returns `states: null` for owners and signed-out visitors. Keep it that way for any new endpoint.
- **Ledger (`sync_state` table):** encrypted entries + decoys, see `src/server/ledger.ts`. Never store item ids, user ids or timestamps in clear text there. Never rotate `LEDGER_KEY`.
- User submissions must require a signed-in non-owner viewer, pass `checkRateLimit`, and verify a Turnstile token when Turnstile is on (`turnstileSiteKey` not null). Turnstile is optional but recommended; the site must keep working with it off.
- Schema changes: add a new numbered file in `migrations/`; never edit an applied migration.
- After changing `wrangler.jsonc`, run `pnpm run cf-typegen`. After changing themes, run `pnpm run screenshots` (dev-only `/demo` page) to refresh README images.
- Validate with `vp check`, `vp test` and `vp build`.
