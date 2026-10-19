import { ValidationPipe } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { RegisterDto } from './dto/register.dto.js';

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

const PROGRAM_ID = '0ffacb93-5b0d-4ee6-9ba9-3b7b2b8c1f9a';

const VALID_BODY = {
  fullName: 'Layla Haddad',
  email: 'layla@example.com',
  password: 'Str0ngPass',
  programId: PROGRAM_ID,
};

async function transform(body: Record<string, unknown>): Promise<RegisterDto> {
  return pipe.transform(body, { type: 'body', metatype: RegisterDto }) as Promise<RegisterDto>;
}

describe('RegisterDto', () => {
  it('accepts a valid payload with a program and no phone', async () => {
    const dto = await transform(VALID_BODY);
    expect(dto.fullName).toBe(VALID_BODY.fullName);
    expect(dto.programId).toBe(PROGRAM_ID);
    expect(dto.phone).toBeUndefined();
  });

  it('requires a programId (specialization is a required registration field)', async () => {
    const { programId: _omitted, ...withoutProgram } = VALID_BODY;
    await expect(transform(withoutProgram)).rejects.toThrow();
  });

  it('accepts an optional well-formed phone number', async () => {
    const dto = await transform({ ...VALID_BODY, phone: '+963 912-345.678' });
    expect(dto.phone).toBe('+963 912-345.678');
  });

  it('rejects a malformed phone number', async () => {
    await expect(transform({ ...VALID_BODY, phone: 'not-a-phone' })).rejects.toThrow();
    await expect(transform({ ...VALID_BODY, phone: '12' })).rejects.toThrow();
    await expect(transform({ ...VALID_BODY, phone: '+963 call-me' })).rejects.toThrow();
  });

  it('rejects a malformed programId', async () => {
    await expect(transform({ ...VALID_BODY, programId: 'not-a-uuid' })).rejects.toThrow();
    await expect(transform({ ...VALID_BODY, programId: '  ' })).rejects.toThrow();
  });

  it('rejects an empty password and a weak password', async () => {
    await expect(transform({ ...VALID_BODY, password: '' })).rejects.toThrow();
    await expect(transform({ ...VALID_BODY, password: 'password' })).rejects.toThrow();
  });

  it('rejects unknown fields such as role (no privilege escalation through registration)', async () => {
    await expect(transform({ ...VALID_BODY, role: 'ADMIN' })).rejects.toThrow();
  });
});
