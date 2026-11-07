import { requireSecret } from "#/server/env";

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Verifies a Turnstile token server-side. Tokens are single use and expire
 * after 5 minutes, so every user submission needs a fresh one.
 */
export async function verifyTurnstile(request: Request, token: string): Promise<boolean> {
  if (!token) return false;
  const body = new FormData();
  body.append("secret", requireSecret("TURNSTILE_SECRET_KEY"));
  body.append("response", token);
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) body.append("remoteip", ip);
  try {
    const res = await fetch(SITEVERIFY, { method: "POST", body });
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (!data.success) console.warn("Turnstile rejected a token", data["error-codes"]);
    return data.success === true;
  } catch (error) {
    console.error("Turnstile verification failed", error);
    return false;
  }
}
