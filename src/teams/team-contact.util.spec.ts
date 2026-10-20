import { describe, expect, it } from 'vitest';
import { TeamContactMethod } from '../common/enums.js';
import {
  normalizeGroupLink,
  normalizePhone,
  normalizeTelegramUsername,
  validateContact,
} from './team-contact.util.js';

describe('normalizePhone', () => {
  it('accepts an international number with a + prefix', () => {
    expect(normalizePhone('+966501234567')).toBe('966501234567');
  });

  it('normalizes a 00 international prefix', () => {
    expect(normalizePhone('00966501234567')).toBe('966501234567');
  });

  it('strips spaces, dashes and parentheses', () => {
    expect(normalizePhone('966 50 123 4567')).toBe('966501234567');
    expect(normalizePhone('+966-50-123-4567')).toBe('966501234567');
    expect(normalizePhone('(966) 501234567')).toBe('966501234567');
  });

  it('rejects empty input, letters and too-short/long values', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('   ')).toBeNull();
    expect(normalizePhone('not-a-phone')).toBeNull();
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('1'.repeat(16))).toBeNull();
  });

  it('rejects embedded scheme-looking content', () => {
    expect(normalizePhone('tel:+966501234567')).toBeNull();
    expect(normalizePhone('javascript:alert(1)')).toBeNull();
  });
});

describe('normalizeTelegramUsername', () => {
  it('accepts a plain username', () => {
    expect(normalizeTelegramUsername('studygroup')).toBe('studygroup');
  });

  it('strips any number of leading @ characters', () => {
    expect(normalizeTelegramUsername('@studygroup')).toBe('studygroup');
    expect(normalizeTelegramUsername('@@studygroup')).toBe('studygroup');
  });

  it('lower-cases the value (Telegram usernames are case-insensitive)', () => {
    expect(normalizeTelegramUsername('StudyGroup')).toBe('studygroup');
  });

  it('allows digits and underscores after the first letter', () => {
    expect(normalizeTelegramUsername('a_1_b')).toBe('a_1_b');
  });

  it('rejects values that are too short, start with a digit, or contain odd characters', () => {
    expect(normalizeTelegramUsername('abcd')).toBeNull();
    expect(normalizeTelegramUsername('1studygroup')).toBeNull();
    expect(normalizeTelegramUsername('study-group')).toBeNull();
    expect(normalizeTelegramUsername('study group')).toBeNull();
    expect(normalizeTelegramUsername('a'.repeat(33))).toBeNull();
  });

  it('rejects a full URL masquerading as a username', () => {
    expect(normalizeTelegramUsername('https://t.me/studygroup')).toBeNull();
  });
});

describe('normalizeGroupLink', () => {
  it('accepts a WhatsApp group invitation link and canonicalizes the scheme', () => {
    expect(normalizeGroupLink('https://chat.whatsapp.com/ABC123')).toBe(
      'https://chat.whatsapp.com/ABC123',
    );
    expect(normalizeGroupLink('http://chat.whatsapp.com/ABC123')).toBe(
      'https://chat.whatsapp.com/ABC123',
    );
  });

  it('accepts Telegram group links on both supported hosts', () => {
    expect(normalizeGroupLink('https://t.me/mygroup')).toBe('https://t.me/mygroup');
    expect(normalizeGroupLink('https://telegram.me/mygroup')).toBe(
      'https://telegram.me/mygroup',
    );
  });

  it('normalizes a host with different casing', () => {
    expect(normalizeGroupLink('https://CHAT.WHATSAPP.COM/ABC')).toBe(
      'https://chat.whatsapp.com/ABC',
    );
  });

  it('preserves the query string so the destination is never silently changed', () => {
    expect(normalizeGroupLink('https://t.me/joinchat/ABC?invite=xyz')).toBe(
      'https://t.me/joinchat/ABC?invite=xyz',
    );
  });

  it('rejects non-http(s) schemes such as javascript:', () => {
    expect(normalizeGroupLink('javascript:alert(1)')).toBeNull();
    expect(normalizeGroupLink('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(normalizeGroupLink('ftp://t.me/group')).toBeNull();
    expect(normalizeGroupLink('tg://resolve?domain=group')).toBeNull();
  });

  it('rejects a host outside the allowlist, including look-alikes', () => {
    expect(normalizeGroupLink('https://evil.example.com/group')).toBeNull();
    expect(normalizeGroupLink('https://t.me.evil.example.com/group')).toBeNull();
    expect(normalizeGroupLink('https://evilt.me/group')).toBeNull();
    expect(normalizeGroupLink('https://wa.me/966501234567')).toBeNull();
  });

  it('rejects credentials embedded in the URL', () => {
    expect(normalizeGroupLink('https://user:pass@t.me/group')).toBeNull();
  });

  it('rejects a bare host with no invitation path', () => {
    expect(normalizeGroupLink('https://t.me')).toBeNull();
    expect(normalizeGroupLink('https://t.me/')).toBeNull();
  });

  it('rejects non-URL strings and empty input', () => {
    expect(normalizeGroupLink('')).toBeNull();
    expect(normalizeGroupLink('not a url')).toBeNull();
    expect(normalizeGroupLink('chat.whatsapp.com/ABC')).toBeNull();
  });
});

describe('validateContact', () => {
  it('routes WHATSAPP_PHONE through phone normalization', () => {
    expect(validateContact(TeamContactMethod.WHATSAPP_PHONE, '+966501234567')).toEqual({
      ok: true,
      value: '966501234567',
    });
    expect(validateContact(TeamContactMethod.WHATSAPP_PHONE, 'abc').ok).toBe(false);
  });

  it('routes TELEGRAM through username normalization', () => {
    expect(validateContact(TeamContactMethod.TELEGRAM, '@StudyGroup')).toEqual({
      ok: true,
      value: 'studygroup',
    });
    expect(validateContact(TeamContactMethod.TELEGRAM, 'x').ok).toBe(false);
  });

  it('routes GROUP_LINK through URL allowlisting', () => {
    expect(validateContact(TeamContactMethod.GROUP_LINK, 'https://t.me/group')).toEqual({
      ok: true,
      value: 'https://t.me/group',
    });
    expect(validateContact(TeamContactMethod.GROUP_LINK, 'javascript:alert(1)').ok).toBe(false);
  });

  it('gives every rejection a human-readable error and no value', () => {
    const result = validateContact(TeamContactMethod.GROUP_LINK, 'nope');
    expect(result.ok).toBe(false);
    expect(result.value).toBeUndefined();
    expect(result.error).toBeTruthy();
  });

  it('rejects an unsupported method string', () => {
    const result = validateContact('PLAIN_PHONE' as TeamContactMethod, '+966501234567');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Unsupported/);
  });
});
