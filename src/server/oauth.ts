/**
 * Social login with GitHub and/or Google (via the `arctic` OAuth library).
 * A provider is enabled when both its client id and secret are set.
 */
import { GitHub, Google, decodeIdToken, generateCodeVerifier, generateState } from "arctic";
import { clearCookie, isSecure, readCookie, serializeCookie } from "#/server/cookies";
import { env } from "#/server/env";
import { createSession, upsertUser, type ProviderId, type ProviderProfile } from "#/server/session";

const STATE_COOKIE = "wl_oauth_state";
const VERIFIER_COOKIE = "wl_oauth_verifier";
const RETURN_COOKIE = "wl_oauth_return";
const TEN_MINUTES = 600;

export function enabledProviders(): ProviderId[] {
  const out: ProviderId[] = [];
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) out.push("github");
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) out.push("google");
  return out;
}

export function isProviderId(value: string): value is ProviderId {
  return value === "github" || value === "google";
}

function callbackUrl(request: Request, provider: ProviderId): string {
  return new URL(`/auth/callback/${provider}`, request.url).toString();
}

function github(request: Request) {
  return new GitHub(
    env.GITHUB_CLIENT_ID!,
    env.GITHUB_CLIENT_SECRET!,
    callbackUrl(request, "github"),
  );
}

function google(request: Request) {
  return new Google(
    env.GOOGLE_CLIENT_ID!,
    env.GOOGLE_CLIENT_SECRET!,
    callbackUrl(request, "google"),
  );
}

function safeReturnPath(value: string | null | undefined): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function redirect(location: string, cookies: string[]): Response {
  const headers = new Headers({ Location: location });
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers });
}

export function startLogin(request: Request, provider: ProviderId): Response {
  if (!enabledProviders().includes(provider)) {
    return new Response(`Login with ${provider} is not configured on this site.`, { status: 404 });
  }
  const secure = isSecure(request);
  const state = generateState();
  const returnTo = safeReturnPath(new URL(request.url).searchParams.get("returnTo"));
  const cookies = [
    serializeCookie(STATE_COOKIE, state, { secure, maxAge: TEN_MINUTES }),
    serializeCookie(RETURN_COOKIE, returnTo, { secure, maxAge: TEN_MINUTES }),
  ];

  if (provider === "github") {
    // No scopes: we only need the public profile.
    return redirect(github(request).createAuthorizationURL(state, []).toString(), cookies);
  }
  const verifier = generateCodeVerifier();
  cookies.push(serializeCookie(VERIFIER_COOKIE, verifier, { secure, maxAge: TEN_MINUTES }));
  const url = google(request).createAuthorizationURL(state, verifier, [
    "openid",
    "profile",
    "email",
  ]);
  return redirect(url.toString(), cookies);
}

async function fetchProfile(
  request: Request,
  provider: ProviderId,
  code: string,
): Promise<ProviderProfile> {
  if (provider === "github") {
    const tokens = await github(request).validateAuthorizationCode(code);
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokens.accessToken()}`,
        "User-Agent": "wishlist-holder",
        Accept: "application/vnd.github+json",
      },
    });
    if (!res.ok) throw new Error(`GitHub profile request failed (${res.status})`);
    const user = (await res.json()) as {
      id: number;
      login: string;
      name: string | null;
      avatar_url: string;
    };
    return {
      provider,
      providerUserId: String(user.id),
      login: user.login,
      displayName: user.name || user.login,
      avatarUrl: user.avatar_url,
    };
  }

  const verifier = readCookie(request, VERIFIER_COOKIE);
  if (!verifier) throw new Error("Missing PKCE verifier");
  const tokens = await google(request).validateAuthorizationCode(code, verifier);
  const claims = decodeIdToken(tokens.idToken()) as {
    sub: string;
    name?: string;
    email?: string;
    email_verified?: boolean;
    picture?: string;
  };
  // Only a verified e-mail may be used for owner matching.
  const login = claims.email && claims.email_verified ? claims.email : `unverified:${claims.sub}`;
  return {
    provider,
    providerUserId: claims.sub,
    login,
    displayName: claims.name || claims.email || "Google user",
    avatarUrl: claims.picture ?? null,
  };
}

export async function finishLogin(request: Request, provider: ProviderId): Promise<Response> {
  const secure = isSecure(request);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = readCookie(request, STATE_COOKIE);
  const cleanup = [STATE_COOKIE, VERIFIER_COOKIE, RETURN_COOKIE].map((c) => clearCookie(c, secure));

  if (!enabledProviders().includes(provider) || !code || !state || state !== expectedState) {
    return redirect("/?login=failed", cleanup);
  }
  try {
    const profile = await fetchProfile(request, provider, code);
    const userId = await upsertUser(profile);
    const sessionCookie = await createSession(request, userId);
    return redirect(safeReturnPath(readCookie(request, RETURN_COOKIE)), [
      ...cleanup,
      sessionCookie,
    ]);
  } catch (error) {
    console.error("OAuth login failed", error);
    return redirect("/?login=failed", cleanup);
  }
}
