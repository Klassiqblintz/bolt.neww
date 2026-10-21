/**
 * Redaction of credentials in logs and error messages.
 *
 * The server never logs a request body or a header, but a provider can echo
 * parts of a request back in an error. These helpers make sure that key
 * material never ends up in the output.
 */

const SECRET_PATTERNS: RegExp[] = [
  /* Anthropic */
  /\bsk-ant-[A-Za-z0-9_-]{8,}/g,

  /* OpenRouter */
  /\bsk-or-[A-Za-z0-9_-]{8,}/g,

  /**
   * OpenAI and most compatible endpoints. Kept broad on purpose: a key that is
   * missed here is a leaked credential, while over redacting only costs the
   * wording of a message. The word boundary keeps ordinary words such as
   * `task-manager` from being cut apart.
   */
  /\bsk-[A-Za-z0-9_-]{8,}/g,

  /* Groq */
  /\bgsk_[A-Za-z0-9]{8,}/g,

  /* Google */
  /\bAIza[A-Za-z0-9_-]{10,}/g,

  /* xAI */
  /\bxai-[A-Za-z0-9_-]{8,}/g,

  /* Hugging Face */
  /\bhf_[A-Za-z0-9]{8,}/g,
  /\bBearer\s+[A-Za-z0-9._-]{8,}/gi,
  /"?(?:api[_-]?key|authorization|x-api-key)"?\s*[:=]\s*"?[^\s",}]+/gi,
];

/**
 * Removes anything that looks like a credential from a string.
 */
export function redactSecrets(value: string): string {
  let result = value;

  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, '[redacted]');
  }

  return result;
}

/**
 * Redacts an unknown value so it can be logged safely.
 */
export function redactValue(value: unknown): string {
  if (value === undefined) {
    return 'undefined';
  }

  if (value === null) {
    return 'null';
  }

  if (typeof value === 'string') {
    return redactSecrets(value);
  }

  if (value instanceof Error) {
    return redactSecrets(`${value.name}: ${value.message}`);
  }

  try {
    return redactSecrets(JSON.stringify(value));
  } catch {
    return '[unserializable]';
  }
}
