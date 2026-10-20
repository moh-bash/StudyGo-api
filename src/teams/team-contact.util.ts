/**
 * Pure validation/normalization for the Phase 5 team contact methods.
 *
 * Exactly three methods are supported (`TeamContactMethod`):
 *
 * - `WHATSAPP_PHONE` — a phone number usable as `https://wa.me/<digits>`.
 *   WhatsApp does not support arbitrary usernames for direct messages, so only
 *   a real phone number is accepted.
 * - `TELEGRAM` — a Telegram username (without the leading `@`), usable as
 *   `https://t.me/<username>`.
 * - `GROUP_LINK` — an invitation link to a WhatsApp OR Telegram group. A strict
 *   allowlist of hosts/schemes is enforced; `javascript:`, arbitrary schemes,
 *   and any other host are rejected.
 *
 * The stored value is normalized (trimmed, lower-cased where case-insensitive)
 * without silently changing the destination. No client value is ever trusted:
 * the service re-runs this validation on every create/update.
 */
import { TeamContactMethod } from '../common/enums.js';

/** Result of validating one contact method/value pair. */
export interface ContactValidationResult {
  ok: boolean;
  /** Normalized value, present only when `ok`. */
  value?: string;
  /** Human-readable reason, present only when not `ok`. */
  error?: string;
}

/**
 * Allowed group-invitation hosts. WhatsApp group links use `chat.whatsapp.com`;
 * Telegram uses `t.me`/`telegram.me` (both resolve to the same service).
 */
const GROUP_LINK_HOSTS = new Set(['chat.whatsapp.com', 't.me', 'telegram.me']);

/** `+966501234567` / `0096650123456` / `966 50 123 4567` → `966501234567`. */
export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 40) {
    return null;
  }
  // Strip an international `+` prefix and any separators; reject other content.
  const withoutPlus = trimmed.startsWith('+') ? trimmed.slice(1) : trimmed;
  const digits = withoutPlus.replace(/[\s()-]/g, '');
  if (!/^\d{6,15}$/.test(digits)) {
    return null;
  }
  // A leading `00` international prefix is normalized away.
  const normalized = digits.startsWith('00') ? digits.slice(2) : digits;
  return /^\d{6,15}$/.test(normalized) ? normalized : null;
}

/** Telegram usernames are stored lower-cased (Telegram usernames are case-insensitive). */
export function normalizeTelegramUsername(raw: string): string | null {
  const trimmed = raw.trim().replace(/^@+/, '').toLowerCase();
  if (!/^[a-z][a-z0-9_]{4,31}$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

/**
 * Parses a supported group URL and returns its canonical form. Rejects
 * non-http(s) schemes, credentials in the URL, and any host outside the
 * allowlist. The path is preserved so the destination is never altered.
 */
export function normalizeGroupLink(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 300) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return null;
  }
  if (url.username !== '' || url.password !== '') {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (!GROUP_LINK_HOSTS.has(host)) {
    return null;
  }
  // A bare host with no path is not a valid invitation target.
  if (url.pathname === '' || url.pathname === '/') {
    return null;
  }
  // Canonicalize the host to https (a group link is always served over TLS).
  return `https://${host}${url.pathname}${url.search}`;
}

/** Validates and normalizes a contact value for the given method. */
export function validateContact(
  method: TeamContactMethod,
  raw: string,
): ContactValidationResult {
  switch (method) {
    case TeamContactMethod.WHATSAPP_PHONE: {
      const value = normalizePhone(raw);
      return value
        ? { ok: true, value }
        : { ok: false, error: 'Enter a valid phone number, e.g. +966501234567' };
    }
    case TeamContactMethod.TELEGRAM: {
      const value = normalizeTelegramUsername(raw);
      return value
        ? { ok: true, value }
        : { ok: false, error: 'Enter a valid Telegram username (5–32 letters, digits or _)' };
    }
    case TeamContactMethod.GROUP_LINK: {
      const value = normalizeGroupLink(raw);
      return value
        ? { ok: true, value }
        : {
            ok: false,
            error: 'Enter a valid WhatsApp or Telegram group invitation link',
          };
    }
    default:
      return { ok: false, error: 'Unsupported contact method' };
  }
}
