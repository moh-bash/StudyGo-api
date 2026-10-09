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

/**
 * A student may have at most one PENDING request per team, enforced by a
 * partial unique index (other statuses are historical and unrestricted).
 */
@Entity('team_join_requests')
@Index('UQ_pending_join_request', ['teamId', 'studentId'], {
  unique: true,
  where: `"status" = 'PENDING'`,
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
