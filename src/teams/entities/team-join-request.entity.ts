import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { JoinRequestStatus } from '../../common/enums.js';
import { User } from '../../users/entities/user.entity.js';
import { StudyTeam } from './study-team.entity.js';
import { TeamTaskSlot } from './team-task-slot.entity.js';

/**
 * A student's request to join a specific open task slot of a team.
 *
 * The team's subject/term are denormalized (`subjectId`, `semesterId`) so the
 * database can enforce the Phase 5 invariants directly, independent of
 * service-level checks:
 *
 * - `UQ_pending_request_student_subject_term` — at most one PENDING request per
 *   student per subject/term.
 * - `UQ_pending_request_slot` — at most one PENDING request per task slot.
 *
 * Both are partial (PENDING only), so rejected/cancelled history never blocks a
 * student. Denormalized values are always written from the team by the service.
 */
@Entity('team_join_requests')
@Index('UQ_pending_join_request', ['teamId', 'studentId'], {
  unique: true,
  where: `"status" = 'PENDING'`,
})
@Index('UQ_pending_request_student_subject_term', ['studentId', 'subjectId', 'semesterId'], {
  unique: true,
  where: `"status" = 'PENDING' AND "subjectId" IS NOT NULL AND "semesterId" IS NOT NULL`,
})
@Index('UQ_pending_request_slot', ['slotId'], {
  unique: true,
  where: `"status" = 'PENDING' AND "slotId" IS NOT NULL`,
})
export class TeamJoinRequest {
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
  studentId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'studentId' })
  student!: User;

  /** The requested task slot. Required by the subject-team flow. */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  slotId!: string | null;

  @ManyToOne(() => TeamTaskSlot, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'slotId' })
  slot!: TeamTaskSlot | null;

  /** Denormalized from the team for the subject/term uniqueness constraint. */
  @Column({ type: 'uuid', nullable: true })
  subjectId!: string | null;

  /** Denormalized from the team for the subject/term uniqueness constraint. */
  @Column({ type: 'uuid', nullable: true })
  semesterId!: string | null;

  @Column({ type: 'text', nullable: true })
  message!: string | null;

  @Index()
  @Column({ type: 'enum', enum: JoinRequestStatus, default: JoinRequestStatus.PENDING })
  status!: JoinRequestStatus;

  @Column({ type: 'uuid', nullable: true })
  reviewedById!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reviewedById' })
  reviewedBy!: User | null;

  @Column({ type: 'timestamptz', nullable: true })
  decidedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
