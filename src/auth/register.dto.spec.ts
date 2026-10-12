import { ValidationPipe } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { RegisterDto } from './dto/register.dto.js';

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

const VALID_BODY = {
  fullName: 'Layla Haddad',
  email: 'layla@example.com',
  password: 'Str0ngPass',
};

async function transform(body: Record<string, unknown>): Promise<RegisterDto> {
  return pipe.transform(body, { type: 'body', metatype: RegisterDto }) as Promise<RegisterDto>;
}

describe('RegisterDto', () => {
  it('accepts a valid payload without a program', async () => {
    const dto = await transform(VALID_BODY);
    expect(dto.fullName).toBe(VALID_BODY.fullName);
    expect(dto.programId).toBeUndefined();
  });

  it('accepts an optional well-formed programId', async () => {
    const programId = '0ffacb93-5b0d-4ee6-9ba9-3b7b2b8c1f9a';
    const dto = await transform({ ...VALID_BODY, programId });
    expect(dto.programId).toBe(programId);
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