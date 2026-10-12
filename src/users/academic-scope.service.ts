import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../common/enums.js';
import type { AuthenticatedUser } from '../common/interfaces.js';
import type { ResolvedScope } from './academic-scope.js';
import { SubjectManagerAssignment } from './entities/subject-manager-assignment.entity.js';
import { User } from './entities/user.entity.js';

/**
 * Resolves the authoritative academic management scope for the current request.
 *
 * The scope is re-derived from the database on every call (never trusted from a
 * token, query param or body). This is what makes role / program / subject
 * revocation take effect immediately: the next request simply resolves a
 * narrower (or empty) scope. Callers pass the returned `ResolvedScope` down to
 * the subjects / sections services, which only ever evaluate permissions from it.
 */
@Injectable()
export class AcademicScopeService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(SubjectManagerAssignment)
    private readonly assignments: Repository<SubjectManagerAssignment>,
  ) {}

  async resolve(actor: AuthenticatedUser): Promise<ResolvedScope> {
    // Non-manager roles carry no academic management scope. The JWT strategy has
    // already re-read their role/status from the DB this request, so we can trust
    // it without a second lookup.
    if (actor.role === UserRole.ADMIN || actor.role === UserRole.STUDENT) {
      return { userId: actor.id, role: actor.role, programId: null, assignedSubjectIds: [] };
    }
    // Managers: read the live program and explicit subject assignments. Using the
    // freshly-read role (not `actor.role`) means a downgraded account immediately
    // loses even this lookup.
    const user = await this.users.findOne({ where: { id: actor.id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    let assignedSubjectIds: string[] = [];
    if (user.role === UserRole.SUBJECT_MANAGER) {
      const rows = await this.assignments.find({
        where: { userId: user.id },
        order: { createdAt: 'ASC' },
      });
      assignedSubjectIds = rows.map((row) => row.subjectId);
    }
    return {
      userId: user.id,
      role: user.role,
      programId: user.programId ?? null,
      assignedSubjectIds,
    };
  }

  /**
   * Auto-assign a freshly created subject to its Subject-Manager creator, so a
   * manager can immediately manage what they just created. No-op for admins and
   * program managers. Idempotent (duplicate assignments are ignored).
   */
  async autoAssignSubject(scope: ResolvedScope, subjectId: string): Promise<void> {
    if (scope.role !== UserRole.SUBJECT_MANAGER) {
      return;
    }
    await this.assignments
      .createQueryBuilder()
      .insert()
      .into(SubjectManagerAssignment)
      .values({ userId: scope.userId, subjectId })
      .orIgnore()
      .execute();
  }
}
