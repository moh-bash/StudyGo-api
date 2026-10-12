import { describe, expect, it } from 'vitest';
import { AddUserProgramId1791777700607 } from './1791777700607-AddUserProgramId.js';

/**
 * Mocked (not real-database) verification of the migration SQL. A fake
 * query runner records statements so the intended schema change can be asserted
 * without connecting to any database. This does NOT execute or prove a real
 * migration run.
 */
function recordingRunner() {
  const calls: string[] = [];
  const runner = {
    query: async (sql: string) => {
      calls.push(sql);
      return [];
    },
  };
  return { runner, calls };
}

describe('AddUserProgramId migration SQL (mocked)', () => {
  it('up() adds a nullable uuid column, an index, and a SET NULL FK', async () => {
    const { runner, calls } = recordingRunner();
    await new AddUserProgramId1791777700607().up(runner as never);

    expect(calls).toHaveLength(3);

    expect(calls[0]).toMatch(/ALTER TABLE "users" ADD "programId" uuid/);
    expect(calls[0]).not.toMatch(/NOT NULL/);
    expect(calls[0]).not.toMatch(/DEFAULT/);

    expect(calls[1]).toMatch(/CREATE INDEX "IDX_users_program_id" ON "users"/);
    expect(calls[1]).toMatch(/\("programId"\)/);

    expect(calls[2]).toMatch(/ADD CONSTRAINT "FK_edaf44538bef67012ac990c5ac4"/);
    expect(calls[2]).toMatch(/FOREIGN KEY \("programId"\)/);
    expect(calls[2]).toMatch(/REFERENCES "academic_programs"\("id"\)/);
    expect(calls[2]).toMatch(/ON DELETE SET NULL/);
  });

  it('down() reverses the change in dependency-safe order', async () => {
    const { runner, calls } = recordingRunner();
    await new AddUserProgramId1791777700607().down(runner as never);

    expect(calls).toHaveLength(3);
    expect(calls[0]).toMatch(/DROP CONSTRAINT "FK_edaf44538bef67012ac990c5ac4"/);
    expect(calls[1]).toMatch(/DROP INDEX "public"\."IDX_users_program_id"/);
    expect(calls[2]).toMatch(/DROP COLUMN "programId"/);
  });

  it('uses an ON UPDATE NO ACTION clause (explicit, matches metadata)', async () => {
    const { runner, calls } = recordingRunner();
    await new AddUserProgramId1791777700607().up(runner as never);
    expect(calls[2]).toMatch(/ON UPDATE NO ACTION/);
  });
});
