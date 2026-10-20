import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { TeamTaskSlotState } from '../../common/enums.js';
import { StudyTeam } from './study-team.entity.js';

/**
 * One task slot on a subject team. The number of slots equals the team's
 * `maxMembers`, so there is exactly one slot per prospective member — including
 * the creator.
 *
 * `position` is a stable 1-based order. A slot is either OPEN (no accepted
 * member) or JOINED (`memberId` is set); the DB partial-unique index guarantees
 * a user can never occupy two slots of the same team. Task text may be edited by
 * the creator only while the slot is unoccupied.
 */
@Entity('team_task_slots')
@Unique('UQ_team_slot_position', ['teamId', 'position'])
@Index('UQ_team_slot_member', ['teamId', 'memberId'], {
  unique: true,
  where: '"memberId" IS NOT NULL',
})
export class TeamTaskSlot {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  teamId!: string;

  @ManyToOne(() => StudyTeam, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'teamId' })
  team!: StudyTeam;

  /** Stable 1-based order within the team. */
  @Column({ type: 'int' })
  position!: number;

  @Column({ type: 'varchar', length: 200 })
  taskDescription!: string;

  @Index()
  @Column({ type: 'enum', enum: TeamTaskSlotState, default: TeamTaskSlotState.OPEN })
  state!: TeamTaskSlotState;

  /**
   * The member occupying this slot, if any. Set when the creator creates the
   * team (position 1) or a join request is accepted. `null` while OPEN.
   */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  memberId!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
