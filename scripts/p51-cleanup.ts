/**
 * Removes ONLY the rows created by the Phase 5.1 verification run.
 *
 * Scope is deliberately narrow and marker-driven: the `P51-E2E` team named
 * exactly `P51-E2E Team Alpha`, its memberships/slots/join-requests, and the
 * `P51-E2E` creator account. Students, subjects, sections, teams and users that
 * pre-existed Phase 5.1 are never touched.
 *
 * Safe by default: pass `--apply` to actually delete. Without it the script
 * prints what it *would* delete and exits.
 *
 * Run: npx tsx scripts/p51-cleanup.ts          (dry run)
 *      npx tsx scripts/p51-cleanup.ts --apply  (delete)
 */
import 'dotenv/config';
import AppDataSource from '../src/data-source.js';

/** The single team the run created, identified by marker + exact name. */
const TEAM_NAME = 'P51-E2E Team Alpha';
/** The single account the run created, identified by marker + exact email. */
const USER_EMAIL = 'studygo.p51.creator.87e515ed@example.com';

async function main() {
  const apply = process.argv.includes('--apply');
  const ds = await AppDataSource.initialize();
  try {
    const q = <T>(sql: string, params?: unknown[]) => ds.query(sql, params) as Promise<T[]>;

    const teams = await q<{ id: string; name: string; creatorId: string }>(
      `select id, name, "creatorId" from study_teams where name = $1`,
      [TEAM_NAME],
    );
    const users = await q<{ id: string; email: string }>(
      `select id, email from users where email = $1`,
      [USER_EMAIL],
    );

    if (teams.length === 0 && users.length === 0) {
      console.log('Nothing to clean: no P51-E2E artifacts found.');
      return;
    }

    const teamIds = teams.map((t) => t.id);
    const userIds = users.map((u) => u.id);

    const plan = {
      mode: apply ? 'APPLY' : 'DRY RUN',
      teams,
      users,
      memberships: teamIds.length
        ? await q(`select id from team_memberships where "teamId" = any($1)`, [teamIds])
        : [],
      slots: teamIds.length
        ? await q(`select id from team_task_slots where "teamId" = any($1)`, [teamIds])
        : [],
      joinRequests: teamIds.length
        ? await q(`select id from team_join_requests where "teamId" = any($1)`, [teamIds])
        : [],
      enrollments: userIds.length
        ? await q(`select id from student_enrollments where "studentId" = any($1)`, [userIds])
        : [],
    };
    console.log(JSON.stringify(plan, null, 2));

    if (!apply) {
      console.log('\nDry run only. Re-run with --apply to delete the rows above.');
      return;
    }

    // Children first so no FK is ever left dangling, then the team, then the
    // account only if nothing else still points at it.
    if (teamIds.length) {
      await q(`delete from team_join_requests where "teamId" = any($1)`, [teamIds]);
      await q(`delete from team_memberships where "teamId" = any($1)`, [teamIds]);
      await q(`delete from team_task_slots where "teamId" = any($1)`, [teamIds]);
      await q(`delete from study_teams where id = any($1)`, [teamIds]);
    }
    if (userIds.length) {
      const remaining = await q<{ count: string }>(
        `select count(*)::text as count from study_teams where "creatorId" = any($1)`,
        [userIds],
      );
      if (remaining[0]?.count === '0') {
        await q(`delete from student_enrollments where "studentId" = any($1)`, [userIds]);
        await q(`delete from team_memberships where "userId" = any($1)`, [userIds]);
        await q(`delete from team_join_requests where "studentId" = any($1)`, [userIds]);
        await q(`delete from users where id = any($1)`, [userIds]);
      } else {
        console.log('Kept the P51 account: it still owns another team.');
      }
    }
    console.log('\nCleanup applied.');
  } finally {
    await ds.destroy();
  }
}

void main();
