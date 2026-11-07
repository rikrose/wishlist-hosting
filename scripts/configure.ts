/**
 * Interactive setup for your wishlist.
 *
 *   pnpm run configure              # everything, step by step
 *   pnpm run configure site         # title, name, theme          → wishlist.config.json
 *   pnpm run configure cloudflare   # D1 database, encryption key, first deploy
 *   pnpm run configure login        # sign-in providers, owners, OAuth apps
 *   pnpm run configure bot-check    # Turnstile bot check (recommended)
 *   pnpm run configure dev          # local development secrets   → .dev.vars
 *   pnpm run configure status       # show what is configured
 *
 * Every step can also be done by hand; README.md documents each one.
 * Runs on Node ≥ 22.18 (TypeScript type stripping), no extra dependencies.
 */
import { spawnSync, type StdioOptions } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";
import { THEMES, THEME_IDS } from "../src/themes/registry.ts";

const CONFIG_FILE = "wishlist.config.json";
const WRANGLER_FILE = "wrangler.jsonc";
const DEV_VARS = ".dev.vars";
const LOCAL_URL = "http://localhost:3000";
const PLACEHOLDER_DB_ID = "00000000-0000-0000-0000-000000000000";
const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";
const TURNSTILE_TEST_SECRET = "1x0000000000000000000000000000000AA";

// ---------------------------------------------------------------------------
// Terminal input. A line queue instead of rl.question(): works the same for a
// terminal and for piped answers (one answer per line on stdin).
// ---------------------------------------------------------------------------

const rl = createInterface({ input: stdin, terminal: !!stdin.isTTY });
const pending: string[] = [];
const waiting: ((line: string) => void)[] = [];
let inputClosed = false;
rl.on("line", (line) => {
  const next = waiting.shift();
  if (next) next(line);
  else pending.push(line);
});
rl.on("close", () => {
  inputClosed = true;
  while (waiting.length) waiting.shift()!("");
});

function readLine(promptText: string): Promise<string> {
  stdout.write(promptText);
  if (pending.length) return Promise.resolve(pending.shift()!);
  if (inputClosed) {
    stdout.write("\n");
    return Promise.resolve("");
  }
  return new Promise((resolve) => waiting.push(resolve));
}

const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;

async function ask(question: string, fallback = ""): Promise<string> {
  const hint = fallback ? dim(` [${fallback}]`) : "";
  const answer = (await readLine(`${question}${hint}: `)).trim();
  return answer || fallback;
}

/** Asks until `valid` accepts the answer. An empty answer is allowed when `optional`. */
async function askValid(
  question: string,
  valid: (value: string) => boolean,
  problem: string,
  opts: { fallback?: string; optional?: boolean } = {},
): Promise<string> {
  for (;;) {
    const value = await ask(question, opts.fallback);
    if ((!value && opts.optional) || (value && valid(value))) return value;
    if (!value && inputClosed) return "";
    console.log(yellow(`  ${problem}`));
  }
}

async function confirm(question: string, fallback = true): Promise<boolean> {
  const answer = (await readLine(`${question} ${dim(fallback ? "[Y/n]" : "[y/N]")}: `))
    .trim()
    .toLowerCase();
  if (!answer) return fallback;
  return answer.startsWith("y");
}

async function choose<T extends string>(
  question: string,
  options: { value: T; label: string }[],
  fallback: T,
): Promise<T> {
  options.forEach((o, i) => console.log(`  ${i + 1}. ${o.label}`));
  const index =
    Math.max(
      0,
      options.findIndex((o) => o.value === fallback),
    ) + 1;
  for (;;) {
    const pick = await ask(question, String(index));
    const byNumber = options[Number(pick) - 1];
    if (byNumber) return byNumber.value;
    const byValue = options.find((o) => o.value === pick.toLowerCase());
    if (byValue) return byValue.value;
    console.log(yellow("  Pick one of the numbers above."));
  }
}

function heading(text: string) {
  console.log(`\n${bold(`── ${text} `.padEnd(64, "─"))}\n`);
}

/** Prints numbered instructions, e.g. for creating an OAuth app. */
function steps(lines: string[]) {
  lines.forEach((line, i) => console.log(`  ${cyan(`${i + 1}.`)} ${line}`));
  console.log();
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

interface SiteConfig {
  siteTitle: string;
  ownerName: string;
  intro: string;
  theme: string;
  owners: string[];
  turnstileSiteKey: string | null;
  siteUrl?: string;
}

function readSiteConfig(): SiteConfig {
  return JSON.parse(readFileSync(CONFIG_FILE, "utf8")) as SiteConfig;
}

function writeSiteConfig(config: SiteConfig) {
  writeFileSync(CONFIG_FILE, `${JSON.stringify(config, null, 2)}\n`);
}

function parseEnvFile(path: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!existsSync(path)) return map;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match) map.set(match[1]!, match[2]!.replace(/^"(.*)"$/, "$1"));
  }
  return map;
}

function writeEnvFile(path: string, vars: Map<string, string>) {
  const body = [...vars]
    .filter(([, v]) => v !== "")
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  writeFileSync(path, `# Local secrets. Do not commit.\n${body}\n`);
}

function newLedgerKey(): string {
  return randomBytes(32).toString("base64");
}

const isUrl = (v: string) => /^https?:\/\/[^/\s]+$/.test(v);
const normaliseUrl = (v: string) => {
  const trimmed = v.trim().replace(/\/+$/, "");
  return /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
};

// ---------------------------------------------------------------------------
// Wrangler
// ---------------------------------------------------------------------------

/**
 * Runs pnpm. On Windows pnpm is a .cmd shim, which needs a shell; build one
 * quoted command line there (passing an args array with `shell` is deprecated).
 */
function pnpm(args: string[], capture: boolean) {
  const stdio: StdioOptions = capture ? ["ignore", "pipe", "pipe"] : "inherit";
  const opts = { stdio, encoding: "utf8" as const };
  const result =
    process.platform === "win32"
      ? spawnSync(
          ["pnpm", ...args]
            .map((a) => (/[\s"&|<>^]/.test(a) ? `"${a.replace(/"/g, '""')}"` : a))
            .join(" "),
          { ...opts, shell: true },
        )
      : spawnSync("pnpm", args, opts);
  return { ok: result.status === 0, out: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

function wrangler(args: string[], opts: { capture?: boolean } = {}) {
  return pnpm(["exec", "wrangler", ...args], !!opts.capture);
}

function isLoggedIn(): boolean {
  const who = wrangler(["whoami"], { capture: true });
  return who.ok && !/not authenticated|not logged in/i.test(who.out);
}

async function ensureLoggedIn(): Promise<boolean> {
  if (isLoggedIn()) return true;
  if (!(await confirm("You're not logged in to Cloudflare. Log in now (opens a browser)?"))) {
    return false;
  }
  return wrangler(["login"]).ok && isLoggedIn();
}

/** Names of the deployed Worker's secrets, or null if there is no Worker yet. */
function liveSecretNames(): string[] | null {
  const listed = wrangler(["secret", "list", "--format", "json"], { capture: true });
  if (!listed.ok) return null;
  try {
    const start = listed.out.indexOf("[");
    return (JSON.parse(listed.out.slice(start)) as { name: string }[]).map((s) => s.name);
  } catch {
    return null;
  }
}

/** Uploads secrets to the live Worker in one version. `null` deletes a secret. */
function uploadSecrets(secrets: Record<string, string | null>): boolean {
  const names = Object.keys(secrets);
  if (names.length === 0) return true;
  const dir = mkdtempSync(join(tmpdir(), "wishlist-"));
  const file = join(dir, "secrets.json");
  try {
    writeFileSync(file, JSON.stringify(secrets), { mode: 0o600 });
    const result = wrangler(["secret", "bulk", file]);
    if (result.ok) console.log(green(`✓ Updated live secrets: ${names.join(", ")}`));
    else console.log(yellow("Could not update the live secrets. See the output above."));
    return result.ok;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Logs in if needed and returns the live Worker's secret names, or null. */
async function connectToLiveWorker(): Promise<string[] | null> {
  if (!(await ensureLoggedIn())) {
    console.log(yellow("Skipping the live site: not logged in to Cloudflare."));
    return null;
  }
  const names = liveSecretNames();
  if (names === null) {
    console.log(
      yellow(
        "The Worker doesn't exist yet. Run `pnpm run configure cloudflare` first, then run this step again.",
      ),
    );
  }
  return names;
}

function buildAndDeploy(): string | undefined {
  const build = pnpm(["run", "build"], false);
  if (!build.ok) {
    console.log(yellow("Build failed; not deploying."));
    return undefined;
  }
  console.log("Deploying…");
  const deploy = wrangler(["deploy"], { capture: true });
  console.log(deploy.out);
  if (!deploy.ok) {
    console.log(yellow("Deploy failed. See the output above."));
    return undefined;
  }
  const url = /https:\/\/[a-z0-9.-]+\.workers\.dev/.exec(deploy.out)?.[0];
  console.log(green(`✓ Deployed${url ? ` to ${url}` : ""}`));
  return url;
}

// ---------------------------------------------------------------------------
// site
// ---------------------------------------------------------------------------

async function configureSite() {
  heading("Site settings (wishlist.config.json)");
  const config = readSiteConfig();

  config.ownerName = await ask("Whose wishlist is this? (shown on the page)", config.ownerName);
  config.siteTitle = await ask("Site title", config.siteTitle);
  config.intro = await ask("Intro text", config.intro);

  console.log("\nThemes (README.md → Themes has screenshots):");
  config.theme = await choose(
    "Pick a theme (number or name)",
    THEME_IDS.map((id) => ({
      value: id,
      label: `${bold(THEMES[id].label.padEnd(10))} ${dim(THEMES[id].description)}`,
    })),
    (THEME_IDS as readonly string[]).includes(config.theme)
      ? (config.theme as (typeof THEME_IDS)[number])
      : "playful",
  );

  writeSiteConfig(config);
  console.log(green(`\n✓ Saved ${CONFIG_FILE}.`));
}

// ---------------------------------------------------------------------------
// cloudflare
// ---------------------------------------------------------------------------

async function configureCloudflare(): Promise<string | undefined> {
  heading("Cloudflare (database, encryption key, first deploy)");
  if (!(await ensureLoggedIn())) {
    console.log(yellow("Run `pnpm exec wrangler login`, then `pnpm run configure cloudflare`."));
    return undefined;
  }

  let text = readFileSync(WRANGLER_FILE, "utf8");
  const workerName = await askValid(
    "Worker name (your site will be https://<name>.<your-subdomain>.workers.dev)",
    (v) => /^[a-z0-9-]{1,63}$/.test(v),
    "Use only lowercase letters, numbers and dashes.",
    { fallback: /"name"\s*:\s*"([^"]+)"/.exec(text)?.[1] ?? "wishlist" },
  );
  text = text.replace(/("name"\s*:\s*")[^"]+(")/, `$1${workerName}$2`);

  const dbId = /"database_id"\s*:\s*"([^"]+)"/.exec(text)?.[1] ?? PLACEHOLDER_DB_ID;
  if (dbId === PLACEHOLDER_DB_ID) {
    const dbName = await ask("D1 database name", workerName);
    console.log(`Creating D1 database "${dbName}"…`);
    const created = wrangler(["d1", "create", dbName], { capture: true });
    let id = /"database_id"\s*:\s*"([0-9a-f-]{36})"/.exec(created.out)?.[1];
    if (!id) {
      // It may already exist: look it up.
      const list = wrangler(["d1", "list", "--json"], { capture: true });
      try {
        const dbs = JSON.parse(list.out.slice(list.out.indexOf("["))) as {
          name: string;
          uuid: string;
        }[];
        id = dbs.find((d) => d.name === dbName)?.uuid;
      } catch {
        // fall through
      }
    }
    if (!id) {
      console.log(created.out);
      console.log(yellow("Could not create or find the database. See the output above."));
      return undefined;
    }
    text = text
      .replace(/("database_name"\s*:\s*")[^"]+(")/, `$1${dbName}$2`)
      .replace(/("database_id"\s*:\s*")[^"]+(")/, `$1${id}$2`);
    console.log(green(`✓ Database ${dbName} (${id})`));
  } else {
    console.log(`Using the database already in ${WRANGLER_FILE} (${dbId}).`);
  }
  writeFileSync(WRANGLER_FILE, text);
  console.log(green(`✓ Updated ${WRANGLER_FILE}.`));

  if (await confirm("Create/update the database tables now?")) {
    if (!wrangler(["d1", "migrations", "apply", "DB", "--remote"]).ok) {
      console.log(yellow("Migrations failed. Retry with `pnpm run db:migrate:remote`."));
    }
  }

  let url: string | undefined;
  if (
    await confirm(
      "Deploy once from this computer now? (creates the Worker, so you can add secrets and connect GitHub)",
    )
  ) {
    url = buildAndDeploy();
  }

  const names = liveSecretNames();
  if (names === null) {
    console.log(yellow("No Worker yet, so the encryption key (LEDGER_KEY) wasn't set."));
  } else if (names.includes("LEDGER_KEY")) {
    console.log(`LEDGER_KEY is already set. ${dim("Keeping it: changing it loses every claim.")}`);
  } else {
    uploadSecrets({ LEDGER_KEY: newLedgerKey() });
  }

  if (url) {
    const config = readSiteConfig();
    if (!config.siteUrl || config.siteUrl.endsWith(".workers.dev")) {
      config.siteUrl = url;
      writeSiteConfig(config);
    }
  }
  return url;
}

// ---------------------------------------------------------------------------
// login
// ---------------------------------------------------------------------------

type Provider = "github" | "google";
type Target = "live" | "local" | "both";

const SECRET_NAMES: Record<Provider, [string, string]> = {
  github: ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"],
  google: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
};

async function askSiteUrl(config: SiteConfig): Promise<string> {
  const value = await askValid(
    "Your site's address (e.g. https://wishlist.you.workers.dev or https://wishlist.example.com)",
    (v) => isUrl(normaliseUrl(v)),
    "That doesn't look like a web address.",
    { fallback: config.siteUrl },
  );
  const url = normaliseUrl(value);
  if (url !== config.siteUrl) {
    config.siteUrl = url;
    writeSiteConfig(config);
  }
  return url;
}

/** Asks for an OAuth client id + secret. Returns null when skipped. */
async function askCredentials(
  label: string,
  existingId: string | undefined,
): Promise<{ id: string; secret: string } | null> {
  const keep = existingId ? ` ${dim("(Enter keeps the current one)")}` : ` ${dim("(Enter skips)")}`;
  const id = (await readLine(`${label} Client ID${keep}: `)).trim();
  if (!id) return null;
  const secret = await askValid(
    `${label} Client secret`,
    (v) => v.length > 0,
    "The client secret is required with a client ID.",
  );
  return secret ? { id, secret } : null;
}

async function configureLogin(opts: { target?: Target } = {}) {
  heading("Sign-in (who can claim gifts, and who owns the list)");
  console.log(
    `Visitors must sign in to claim a gift or join a group gift. You choose the
providers, and which account is ${bold("you")}: owners manage the list and can never see claims.
`,
  );
  const config = readSiteConfig();
  const devVars = parseEnvFile(DEV_VARS);

  // 1. Providers
  const hadGithub = config.owners.some((o) => o.startsWith("github:"));
  const hadGoogle = config.owners.some((o) => o.startsWith("google:"));
  console.log("Which sign-in options should visitors have?");
  const choice = await choose(
    "Providers",
    [
      {
        value: "github",
        label: `GitHub ${dim("(easiest to set up; guests need a GitHub account)")}`,
      },
      { value: "google", label: `Google ${dim("(most people have one; a few more setup steps)")}` },
      { value: "both", label: "Both" },
    ],
    hadGithub && hadGoogle ? "both" : hadGoogle ? "google" : "github",
  );
  const providers: Provider[] = choice === "both" ? ["github", "google"] : [choice as Provider];

  // 2. Owners
  console.log();
  const owners: string[] = [];
  if (providers.includes("github")) {
    const current = config.owners.find((o) => o.startsWith("github:"))?.slice(7);
    const name = await askValid(
      "Your GitHub username (this makes you the owner)",
      (v) => /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(v) && v !== "your-github-username",
      "Enter your GitHub username, e.g. octocat.",
      { fallback: current === "your-github-username" ? undefined : current },
    );
    if (name) owners.push(`github:${name}`);
  }
  if (providers.includes("google")) {
    const current = config.owners.find((o) => o.startsWith("google:"))?.slice(7);
    const email = await askValid(
      "Your Google account e-mail (this makes you the owner)",
      (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v),
      "Enter an e-mail address.",
      { fallback: current },
    );
    if (email) owners.push(`google:${email.toLowerCase()}`);
  }
  const extras = config.owners.filter(
    (o) => !owners.includes(o) && providers.some((p) => o.startsWith(`${p}:`)),
  );
  const more = await ask(
    `Other owners, e.g. a partner ${dim('("github:name" or "google:email", comma separated, optional)')}`,
    extras.join(", "),
  );
  for (const o of more.split(",").map((s) => s.trim())) {
    if (/^(github|google):.+$/.test(o) && !owners.includes(o)) owners.push(o);
    else if (o) console.log(yellow(`  Ignored "${o}": use "github:name" or "google:email".`));
  }
  if (owners.length > 0) {
    config.owners = owners;
    writeSiteConfig(config);
    console.log(green(`✓ Owners: ${owners.join(", ")}`));
  } else {
    console.log(yellow("  No owner set. Run this step again before you share the site."));
  }

  // 3. Where
  console.log("\nWhere do you want sign-in to work?");
  const target =
    opts.target ??
    (await choose<Target>(
      "Set up sign-in for",
      [
        { value: "live", label: "The live site" },
        { value: "local", label: `Local development ${dim(`(${LOCAL_URL})`)}` },
        { value: "both", label: "Both" },
      ],
      "live",
    ));
  const live = target === "live" || target === "both";
  const local = target === "local" || target === "both";

  let liveNames: string[] | null = null;
  let siteUrl = config.siteUrl ?? "<your site>";
  if (live) {
    liveNames = await connectToLiveWorker();
    siteUrl = await askSiteUrl(config);
  }
  const liveSecrets: Record<string, string | null> = {};

  // 4. Provider apps
  if (providers.includes("github")) {
    heading("GitHub sign-in");
    if (live) {
      console.log(bold("Create a GitHub OAuth app for the live site:"));
      steps([
        `Open ${cyan("https://github.com/settings/applications/new")}`,
        `Application name: ${bold(config.siteTitle)}`,
        `Homepage URL: ${bold(siteUrl)}`,
        `Authorization callback URL: ${bold(`${siteUrl}/auth/callback/github`)}`,
        `Click ${bold("Register application")}, copy the ${bold("Client ID")}, then click ${bold("Generate a new client secret")}.`,
      ]);
      const creds = await askCredentials(
        "GitHub",
        liveNames?.includes("GITHUB_CLIENT_ID") ? "set" : undefined,
      );
      if (creds) {
        liveSecrets.GITHUB_CLIENT_ID = creds.id;
        liveSecrets.GITHUB_CLIENT_SECRET = creds.secret;
      }
    }
    if (local) {
      console.log(
        bold("Create a second GitHub OAuth app for local development") +
          dim(" (a GitHub app allows only one callback URL):"),
      );
      steps([
        `Open ${cyan("https://github.com/settings/applications/new")}`,
        `Application name: ${bold(`${config.siteTitle} (local)`)}`,
        `Homepage URL: ${bold(LOCAL_URL)}`,
        `Authorization callback URL: ${bold(`${LOCAL_URL}/auth/callback/github`)}`,
        "Register it, copy the Client ID and generate a client secret.",
      ]);
      const creds = await askCredentials("GitHub (local)", devVars.get("GITHUB_CLIENT_ID"));
      if (creds) {
        devVars.set("GITHUB_CLIENT_ID", creds.id);
        devVars.set("GITHUB_CLIENT_SECRET", creds.secret);
      }
    }
  }

  if (providers.includes("google")) {
    heading("Google sign-in");
    const redirects = [
      ...(live ? [`${siteUrl}/auth/callback/google`] : []),
      ...(local ? [`${LOCAL_URL}/auth/callback/google`] : []),
    ];
    console.log(
      bold("Create a Google OAuth client") + dim(" (one client can serve both live and local):"),
    );
    steps([
      `Open ${cyan("https://console.cloud.google.com/apis/credentials")} and create or pick a project.`,
      `Set up the ${bold("OAuth consent screen")} (Google Auth Platform): audience ${bold("External")}, your app name and e-mail.`,
      `Under ${bold("Audience")}, click ${bold("Publish app")}. ${dim("While it is in Testing, only listed test users can sign in.")}`,
      `${bold("Clients → Create client")}, type ${bold("Web application")}.`,
      `Authorised redirect URIs:\n${redirects.map((r) => `       ${bold(r)}`).join("\n")}`,
      "Create it and copy the Client ID and Client secret.",
    ]);
    const existing =
      (live && liveNames?.includes("GOOGLE_CLIENT_ID")) ||
      (local && devVars.get("GOOGLE_CLIENT_ID"))
        ? "set"
        : undefined;
    const creds = await askCredentials("Google", existing);
    if (creds) {
      if (live) {
        liveSecrets.GOOGLE_CLIENT_ID = creds.id;
        liveSecrets.GOOGLE_CLIENT_SECRET = creds.secret;
      }
      if (local) {
        devVars.set("GOOGLE_CLIENT_ID", creds.id);
        devVars.set("GOOGLE_CLIENT_SECRET", creds.secret);
      }
    }
  }

  // 5. Providers that were switched off
  for (const p of ["github", "google"] as Provider[]) {
    if (providers.includes(p)) continue;
    const [idName, secretName] = SECRET_NAMES[p];
    if (live && liveNames?.includes(idName)) {
      if (
        await confirm(`Turn off ${p === "github" ? "GitHub" : "Google"} sign-in on the live site?`)
      ) {
        liveSecrets[idName] = null;
        liveSecrets[secretName] = null;
      }
    }
    if (local && devVars.has(idName)) {
      devVars.delete(idName);
      devVars.delete(secretName);
    }
  }

  // 6. Save
  console.log();
  if (live) {
    if (liveNames === null && Object.keys(liveSecrets).length > 0) {
      console.log(yellow("The live site isn't reachable, so its secrets weren't saved."));
    } else if (liveNames !== null) {
      uploadSecrets(liveSecrets);
      const missing = providers.filter((p) => {
        const idName = SECRET_NAMES[p][0];
        return !liveSecrets[idName] && !liveNames!.includes(idName);
      });
      for (const p of missing) {
        console.log(yellow(`  ${p} sign-in has no credentials on the live site yet.`));
      }
    }
  }
  if (local) {
    if (!devVars.get("LEDGER_KEY")) devVars.set("LEDGER_KEY", newLedgerKey());
    writeEnvFile(DEV_VARS, devVars);
    console.log(green(`✓ Saved local sign-in to ${DEV_VARS} (git-ignored).`));
  }
  if (owners.length > 0) {
    console.log(
      dim(`Owner changes are in ${CONFIG_FILE}: they reach the live site on your next deploy.`),
    );
  }
}

// ---------------------------------------------------------------------------
// bot-check
// ---------------------------------------------------------------------------

async function configureBotCheck() {
  heading("Bot protection (Turnstile)");
  const config = readSiteConfig();
  console.log(`${bold("Turnstile")} is Cloudflare's free, privacy-friendly CAPTCHA alternative. It checks that a
person, not a script, is claiming a gift. It works on your workers.dev address; no domain needed.
${bold("Strongly recommended.")} Without it, claims are still protected by sign-in and rate limits.
Currently: Turnstile is ${config.turnstileSiteKey ? green("on") : yellow("off")}.
`);
  const enable = await confirm("Turn on Turnstile? (recommended)", true);
  if (!enable) {
    config.turnstileSiteKey = null;
    writeSiteConfig(config);
    console.log(
      yellow("Turnstile is off.") +
        " Claims are protected by sign-in and rate limits only.\n" +
        dim("Turn it on later with `pnpm run configure bot-check`."),
    );
    return;
  }

  const siteUrl = await askSiteUrl(config);
  const hostname = new URL(siteUrl).hostname;
  console.log();
  steps([
    `Open ${cyan("https://dash.cloudflare.com/?to=/:account/turnstile")} and click ${bold("Add widget")}.`,
    `Widget name: ${bold(config.siteTitle)}`,
    `Hostname: ${bold(hostname)} ${dim("(add your custom domain too, if you have one)")}`,
    `Widget mode: ${bold("Managed")}. Click ${bold("Create")}.`,
    `Copy the ${bold("Site Key")} and the ${bold("Secret Key")}.`,
  ]);

  const siteKey = await askValid(
    "Turnstile Site Key",
    (v) => v.length > 10,
    "Paste the Site Key from the widget.",
    { fallback: config.turnstileSiteKey ?? undefined },
  );
  if (!siteKey) {
    console.log(yellow("No site key entered; Turnstile is unchanged."));
    return;
  }
  if (siteKey === TURNSTILE_TEST_SITE_KEY) {
    console.log(
      yellow("  That's Cloudflare's test key; it doesn't stop bots. Use your widget's key."),
    );
  }

  const liveNames = await connectToLiveWorker();
  const hasSecret = !!liveNames?.includes("TURNSTILE_SECRET_KEY");
  const secret = (
    await readLine(
      `Turnstile Secret Key${hasSecret ? ` ${dim("(Enter keeps the current one)")}` : ""}: `,
    )
  ).trim();
  if (liveNames !== null && secret) uploadSecrets({ TURNSTILE_SECRET_KEY: secret });
  if (!hasSecret && (!secret || liveNames === null)) {
    console.log(
      yellow(
        "  The secret key isn't saved on the live site yet, so claims will fail until it is.\n" +
          "  Run this step again after `pnpm run configure cloudflare`, or run\n" +
          "  `pnpm exec wrangler secret put TURNSTILE_SECRET_KEY`.",
      ),
    );
  }

  config.turnstileSiteKey = siteKey;
  writeSiteConfig(config);
  if (existsSync(DEV_VARS)) {
    const devVars = parseEnvFile(DEV_VARS);
    devVars.set("TURNSTILE_SECRET_KEY", TURNSTILE_TEST_SECRET);
    writeEnvFile(DEV_VARS, devVars);
  }
  console.log(green(`✓ Turnstile is on. ${dim("(The dev server uses Cloudflare's test keys.)")}`));
  console.log(dim("If you add a custom domain later, add its hostname to the widget too."));
}

// ---------------------------------------------------------------------------
// dev
// ---------------------------------------------------------------------------

async function configureDev() {
  heading("Local development (.dev.vars)");
  const vars = parseEnvFile(DEV_VARS);
  if (!vars.get("LEDGER_KEY")) vars.set("LEDGER_KEY", newLedgerKey());
  vars.set("TURNSTILE_SECRET_KEY", vars.get("TURNSTILE_SECRET_KEY") || TURNSTILE_TEST_SECRET);
  writeEnvFile(DEV_VARS, vars);
  console.log(green(`✓ Wrote ${DEV_VARS} (git-ignored).`));

  const hasLogin = vars.has("GITHUB_CLIENT_ID") || vars.has("GOOGLE_CLIENT_ID");
  if (await confirm("Set up sign-in for local development now?", !hasLogin)) {
    await configureLogin({ target: "local" });
  }
  console.log(`Run ${bold("pnpm dev")} to start ${LOCAL_URL}.`);
}

// ---------------------------------------------------------------------------
// status
// ---------------------------------------------------------------------------

function configureStatus() {
  heading("Status");
  const config = readSiteConfig();
  const tick = (ok: boolean) => (ok ? green("✓") : yellow("✗"));
  const wranglerText = readFileSync(WRANGLER_FILE, "utf8");
  const dbId = /"database_id"\s*:\s*"([^"]+)"/.exec(wranglerText)?.[1];

  console.log(bold(CONFIG_FILE));
  console.log(
    `  title        ${config.siteTitle} (for ${config.ownerName}), theme ${config.theme}`,
  );
  console.log(`  owners       ${config.owners.join(", ")}`);
  console.log(`  site URL     ${config.siteUrl ?? dim("not set")}`);
  console.log(
    `  Turnstile    ${config.turnstileSiteKey ? "on" : yellow("off (recommended: pnpm run configure bot-check)")}`,
  );
  console.log(`\n${bold(WRANGLER_FILE)}`);
  console.log(`  ${tick(dbId !== PLACEHOLDER_DB_ID)} D1 database id`);

  const loggedIn = isLoggedIn();
  const live = loggedIn ? liveSecretNames() : null;
  console.log(`\n${bold("Live site secrets")}`);
  if (!loggedIn) console.log(dim("  not logged in to Cloudflare"));
  else if (live === null) console.log(dim("  no Worker deployed yet"));
  else {
    const has = (n: string) => live.includes(n);
    console.log(`  ${tick(has("LEDGER_KEY"))} LEDGER_KEY`);
    console.log(`  ${tick(has("GITHUB_CLIENT_ID") && has("GITHUB_CLIENT_SECRET"))} GitHub sign-in`);
    console.log(`  ${tick(has("GOOGLE_CLIENT_ID") && has("GOOGLE_CLIENT_SECRET"))} Google sign-in`);
    if (config.turnstileSiteKey) {
      console.log(`  ${tick(has("TURNSTILE_SECRET_KEY"))} TURNSTILE_SECRET_KEY`);
    }
  }

  const dev = parseEnvFile(DEV_VARS);
  console.log(`\n${bold(DEV_VARS)}${existsSync(DEV_VARS) ? "" : dim(" (missing)")}`);
  console.log(`  ${tick(!!dev.get("LEDGER_KEY"))} LEDGER_KEY`);
  console.log(`  ${tick(!!dev.get("GITHUB_CLIENT_ID"))} GitHub sign-in`);
  console.log(`  ${tick(!!dev.get("GOOGLE_CLIENT_ID"))} Google sign-in`);
}

// ---------------------------------------------------------------------------

function nextSteps() {
  heading("Next steps");
  console.log(`1. Commit and push ${CONFIG_FILE} and ${WRANGLER_FILE}.
2. In the Cloudflare dashboard: Workers & Pages → your Worker → Settings → Builds
   → Connect your GitHub repository. Use:
     Build command:  pnpm run build
     Deploy command: npx wrangler deploy
3. Sign in on your site with an owner account and add items at /admin.

Check what's configured at any time with ${bold("pnpm run configure status")}.
Full details: README.md → "Deploying your own".`);
  if (!readSiteConfig().turnstileSiteKey) {
    console.log(
      yellow(
        `\nTurnstile is off. It's recommended: turn it on with ${bold("pnpm run configure bot-check")}.`,
      ),
    );
  }
}

const USAGE = "Usage: pnpm run configure [site|cloudflare|login|bot-check|dev|status]";
const step = process.argv[2];
try {
  if (!existsSync(CONFIG_FILE) || !existsSync(WRANGLER_FILE)) {
    throw new Error("Run this from the repository root (where wishlist.config.json is).");
  }
  switch (step) {
    case "site":
      await configureSite();
      break;
    case "cloudflare":
      await configureCloudflare();
      break;
    case "login":
      await configureLogin();
      break;
    case "bot-check":
      await configureBotCheck();
      break;
    case "dev":
      await configureDev();
      break;
    case "status":
      configureStatus();
      break;
    case undefined: {
      console.log(bold("Wishlist setup. Press Enter to keep the value in [brackets]."));
      await configureSite();
      let deployed = false;
      if (await confirm("\nSet up Cloudflare now (database, first deploy)?")) {
        deployed = !!(await configureCloudflare());
      }
      const before = readFileSync(CONFIG_FILE, "utf8");
      await configureLogin();
      await configureBotCheck();
      if (deployed && readFileSync(CONFIG_FILE, "utf8") !== before) {
        if (await confirm("\nRedeploy now so the live site uses these settings?")) buildAndDeploy();
      }
      if (await confirm("\nSet up local development (.dev.vars)?", false)) await configureDev();
      nextSteps();
      break;
    }
    case "help":
    case "--help":
    case "-h":
      console.log(USAGE);
      break;
    default:
      console.log(USAGE);
      process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  rl.close();
}
