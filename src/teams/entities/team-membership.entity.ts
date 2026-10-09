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

@Entity('team_memberships')
@Unique('UQ_membership_team_user', ['teamId', 'userId'])
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

  @CreateDateColumn({ type: 'timestamptz' })
  joinedAt!: Date;
}
