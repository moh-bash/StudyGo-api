import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TeamStatus, TeamVisibility } from '../../common/enums.js';
import { AcademicSection } from '../../sections/entities/section.entity.js';
import { Subject } from '../../subjects/entities/subject.entity.js';
import { User } from '../../users/entities/user.entity.js';

@Entity('study_teams')
@Check('CHK_team_max_members', '"maxMembers" >= 2')
export class StudyTeam {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  subjectId!: string | null;

  @ManyToOne(() => Subject, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'subjectId' })
  subject!: Subject | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  sectionId!: string | null;

  @ManyToOne(() => AcademicSection, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'sectionId' })
  section!: AcademicSection | null;

  @Index()
  @Column({ type: 'uuid' })
  creatorId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'creatorId' })
  creator!: User;

  @Column({ type: 'int', default: 5 })
  maxMembers!: number;

  @Index()
  @Column({ type: 'enum', enum: TeamVisibility, default: TeamVisibility.PUBLIC })
  visibility!: TeamVisibility;

  @Index()
  @Column({ type: 'enum', enum: TeamStatus, default: TeamStatus.ACTIVE })
  status!: TeamStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
