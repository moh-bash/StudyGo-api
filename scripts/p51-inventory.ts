/**
 * Read-only inventory of Phase 5.1 artifacts created by the Phase 5.1 run.
 *
 * Deletes nothing. It lists exactly which rows carry the `P51-E2E` marker (or
 * depend on a row that does) so cleanup can be reasoned about before it happens.
 * Run: npx tsx scripts/p51-inventory.ts
 */
import 'dotenv/config';
import AppDataSource from '../src/data-source.js';

const MARKER = 'P51-E2E';

async function main() {
  const ds = await AppDataSource.initialize();
  try {
    const q = <T>(sql: string, params?: unknown[]) => ds.query(sql, params) as Promise<T[]>;

    const users = await q<{ id: string; email: string; fullName: string; role: string }>(
      `select id, email, "fullName", role from users
        where email like $1 or "fullName" like $1 or id in (
          select "creatorId" from study_teams where name like $1
        )`,
      [`%${MARKER}%`],
    );
    const teams = await q<{ id: string; name: string; creatorId: string; status: string }>(
      `select id, name, "creatorId", status from study_teams where name like $1`,
      [`%${MARKER}%`],
    );
    const teamIds = teams.map((t) => t.id);

    const memberships = teamIds.length
      ? await q<{ id: string; teamId: string; userId: string }>(
          `select id, "teamId", "userId" from team_memberships where "teamId" = any($1)`,
          [teamIds],
        )
      : [];
    const slots = teamIds.length
      ? await q<{ id: string; teamId: string }>(
          `select id, "teamId" from team_task_slots where "teamId" = any($1)`,
          [teamIds],
        )
      : [];
    const requests = teamIds.length
      ? await q<{ id: string; teamId: string; studentId: string }>(
          `select id, "teamId", "studentId" from team_join_requests where "teamId" = any($1)`,
          [teamIds],
        )
      : [];

    const userIds = users.map((u) => u.id);
    const enrollments = userIds.length
      ? await q<{ id: string; studentId: string }>(
          `select id, "studentId" from student_enrollments where "studentId" = any($1)`,
          [userIds],
        )
      : [];
    const selections = userIds.length
      ? await q<{ rowcount?: string }>(
          `select 1 from course_selections where "studentId" = any($1) limit 1`,
          [userIds],
        ).catch(() => [])
      : [];

    console.log(
      JSON.stringify(
        {
          marker: MARKER,
          users,
          teams,
          memberships,
          slots,
          requests,
          enrollments,
          selectionsPresent: selections.length > 0,
        },
        null,
        2,
      ),
    );
  } finally {
    await ds.destroy();
  }
}

void main();
