/**
 * Encryption of API keys in the browser.
 *
 * The key is encrypted with AES-GCM. The encryption key is derived with
 * PBKDF2 from a secret that only exists in this browser profile, so the
 * stored key material is never readable in plaintext.
 *
 * @note This protects the stored credential against casual inspection of the
 * browser profile. It does not protect against scripts running on this
 * origin. The application has no account system, so the browser profile is
 * the only identity that exists.
 */

const VAULT_SECRET_KEY = 'bolt_provider_vault_secret';
const PBKDF2_ITERATIONS = 150_000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

function toBase64(bytes: Uint8Array): string {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);

  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function getVaultSecret(): Uint8Array {
  const stored = localStorage.getItem(VAULT_SECRET_KEY);

  if (stored) {
    return fromBase64(stored);
  }

  const secret = crypto.getRandomValues(new Uint8Array(32));

  localStorage.setItem(VAULT_SECRET_KEY, toBase64(secret));

  return secret;
}

async function deriveKey(secret: Uint8Array, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', secret, 'PBKDF2', false, ['deriveKey']);

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export interface EncryptedSecret {
  encryptedKey: string;
  keySalt: string;
  keyIv: string;
}

/**
 * Encrypts an API key with a fresh salt and initialisation vector.
 */
export async function encryptApiKey(apiKey: string): Promise<EncryptedSecret> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const key = await deriveKey(getVaultSecret(), salt);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    new TextEncoder().encode(apiKey),
  );

  const bundle = new Uint8Array(iv.length + ciphertext.byteLength);

  bundle.set(iv);
  bundle.set(new Uint8Array(ciphertext), iv.length);

  return {
    encryptedKey: toBase64(bundle),
    keySalt: toBase64(salt),
    keyIv: toBase64(iv),
  };
}

/**
 * Decrypts a stored API key.
 */
export async function decryptApiKey(secret: EncryptedSecret): Promise<string> {
  const salt = fromBase64(secret.keySalt);
  const iv = fromBase64(secret.keyIv);
  const bundle = fromBase64(secret.encryptedKey);

  const ciphertext = bundle.slice(iv.length);

  const key = await deriveKey(getVaultSecret(), salt);

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    ciphertext as unknown as BufferSource,
  );

  return new TextDecoder().decode(plaintext);
}
