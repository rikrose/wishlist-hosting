export function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(length));
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const normalised = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalised + "===".slice((normalised.length + 3) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** 128-bit random id, base64url. */
export function randomId(): string {
  return toBase64Url(randomBytes(16));
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Uniform random integer in [min, max]. */
export function randomInt(min: number, max: number): number {
  const [n] = crypto.getRandomValues(new Uint32Array(1));
  return min + (n! % (max - min + 1));
}
