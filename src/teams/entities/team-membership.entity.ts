import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { TeamRole } from '../../common/enums.js';
import { User } from '../../users/entities/user.entity.js';
import { StudyTeam } from './study-team.entity.js';

/**
 * A real server-side membership of a user on a team, linked to the task slot
 * the member occupies. The creator's membership is created together with the
 * team and its slots; every accepted join request creates exactly one
 * membership tied to the requested slot.
 *
 * The team's subject/term are denormalized (`subjectId`, `semesterId`) so the
 * database itself enforces the "one team per subject and academic term"
 * invariant (`UQ_membership_user_subject_term`), independently of the service
 * checks and safe under concurrent requests. Values are always written from the
 * team by the service.
 */
@Entity('team_memberships')
@Unique('UQ_membership_team_user', ['teamId', 'userId'])
@Index('UQ_membership_user_subject_term', ['userId', 'subjectId', 'semesterId'], {
  unique: true,
  where: '"subjectId" IS NOT NULL AND "semesterId" IS NOT NULL',
})
export class TeamMembership {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  teamId!: string;

  @ManyToOne(() => StudyTeam, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'teamId' })
  team!: StudyTeam;

  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'enum', enum: TeamRole, default: TeamRole.MEMBER })
  role!: TeamRole;

  /** The task slot this member occupies (unique per team via a partial index). */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  slotId!: string | null;

  /** Denormalized from the team for the one-team-per-subject/term constraint. */
  @Column({ type: 'uuid', nullable: true })
  subjectId!: string | null;

  /** Denormalized from the team for the one-team-per-subject/term constraint. */
  @Column({ type: 'uuid', nullable: true })
  semesterId!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  joinedAt!: Date;
}
