// Real (non-mock) token generation/hashing for the admin-side invite flow,
// using the browser's Web Crypto API. Must produce the exact same encoding
// Postgres uses (encode(gen_random_bytes(20),'hex') / encode(digest(token,
// 'sha256'),'hex') — both lowercase hex) so a token minted here validates
// correctly against campaign_participants.invite_token_hash.

export function generateSecureToken(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
