import { siteConfig } from "#/config";
import { randomBytes, randomId, sha256Hex, toBase64Url } from "#/server/bytes";
import { clearCookie, isSecure, readCookie, serializeCookie } from "#/server/cookies";
import { env } from "#/server/env";

export const SESSION_COOKIE = "wl_session";
const SESSION_DAYS = 30;

export type ProviderId = "github" | "google";

export interface Viewer {
  id: string;
  provider: ProviderId;
  login: string;
  displayName: string;
  avatarUrl: string | null;
  isOwner: boolean;
}

interface UserRow {
  id: string;
  provider: ProviderId;
  login: string;
  display_name: string;
  avatar_url: string | null;
}

/** Owners are listed in wishlist.config.json as "github:<username>" or "google:<email>". */
export function isOwner(provider: ProviderId, login: string): boolean {
  const key = `${provider}:${login}`.toLowerCase();
  return siteConfig.owners.some((owner) => owner.toLowerCase() === key);
}

export async function getViewer(request: Request): Promise<Viewer | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT u.id, u.provider, u.login, u.display_name, u.avatar_url
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND s.expires_at > ?`,
  )
    .bind(await sha256Hex(token), Date.now())
    .first<UserRow>();
  if (!row) return null;
  return {
    id: row.id,
    provider: row.provider,
    login: row.login,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    isOwner: isOwner(row.provider, row.login),
  };
}

export interface ProviderProfile {
  provider: ProviderId;
  providerUserId: string;
  login: string;
  displayName: string;
  avatarUrl: string | null;
}

export async function upsertUser(profile: ProviderProfile): Promise<string> {
  const existing = await env.DB.prepare(
    "SELECT id FROM users WHERE provider = ? AND provider_user_id = ?",
  )
    .bind(profile.provider, profile.providerUserId)
    .first<{ id: string }>();
  if (existing) {
    await env.DB.prepare(
      "UPDATE users SET login = ?, display_name = ?, avatar_url = ? WHERE id = ?",
    )
      .bind(profile.login, profile.displayName, profile.avatarUrl, existing.id)
      .run();
    return existing.id;
  }
  const id = randomId();
  await env.DB.prepare(
    `INSERT INTO users (id, provider, provider_user_id, login, display_name, avatar_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      profile.provider,
      profile.providerUserId,
      profile.login,
      profile.displayName,
      profile.avatarUrl,
      Date.now(),
    )
    .run();
  return id;
}

/** Creates a session and returns the Set-Cookie header value. */
export async function createSession(request: Request, userId: string): Promise<string> {
  const token = toBase64Url(randomBytes(32));
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(Date.now()),
    env.DB.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").bind(
      await sha256Hex(token),
      userId,
      Date.now() + maxAge * 1000,
    ),
  ]);
  return serializeCookie(SESSION_COOKIE, token, { secure: isSecure(request), maxAge });
}

/** Deletes the current session and returns the Set-Cookie header value. */
export async function destroySession(request: Request): Promise<string> {
  const token = readCookie(request, SESSION_COOKIE);
  if (token) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?")
      .bind(await sha256Hex(token))
      .run();
  }
  return clearCookie(SESSION_COOKIE, isSecure(request));
}
