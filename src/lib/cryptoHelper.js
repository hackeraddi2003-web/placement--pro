/**
 * Lightweight client-side obfuscation for the user's own AI API key
 * before it is stored in Supabase `profiles.ai_api_key_encrypted`.
 *
 * IMPORTANT — be honest about what this is:
 * This is NOT strong encryption. It uses the Web Crypto API (AES-GCM)
 * with a key derived from the user's Supabase user-id, so the key is
 * not stored in plaintext in the database. But since the decryption
 * happens client-side with a derivable key, anyone with direct DB
 * access and the user id could theoretically reverse it.
 *
 * For a personal single-user tool, this is a reasonable balance of
 * "don't store secrets as plaintext" vs. "don't build a KMS."
 * If you want stronger protection, route AI calls through a Netlify
 * Function / Supabase Edge Function and never store the key in the DB
 * at all (keep it in browser localStorage only, per-device).
 */

async function deriveKey(userId) {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(userId.padEnd(32, '0').slice(0, 32)),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  )
  return keyMaterial
}

export async function encryptApiKey(plainText, userId) {
  if (!plainText) return null
  const key = await deriveKey(userId)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const enc = new TextEncoder()
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plainText))
  const cipherBytes = new Uint8Array(cipherBuf)
  // Pack iv + ciphertext together, base64 encode for storage as text
  const combined = new Uint8Array(iv.length + cipherBytes.length)
  combined.set(iv, 0)
  combined.set(cipherBytes, iv.length)
  return btoa(String.fromCharCode(...combined))
}

export async function decryptApiKey(encoded, userId) {
  if (!encoded) return ''
  try {
    const key = await deriveKey(userId)
    const combined = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0))
    const iv = combined.slice(0, 12)
    const cipherBytes = combined.slice(12)
    const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBytes)
    return new TextDecoder().decode(plainBuf)
  } catch (err) {
    console.error('Failed to decrypt API key:', err)
    return ''
  }
}
