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
import { TaskPriority, TaskStatus, TaskType } from '../../common/enums.js';
import { AcademicSection } from '../../sections/entities/section.entity.js';
import { Semester } from '../../semesters/entities/semester.entity.js';
import { Subject } from '../../subjects/entities/subject.entity.js';
import { StudyTeam } from '../../teams/entities/study-team.entity.js';
import { User } from '../../users/entities/user.entity.js';

/**
 * Personal task owned by a single user. Timestamps are `timestamptz` and stored
 * in UTC; clients should send ISO-8601 strings with an explicit offset.
 */
@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  ownerId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'ownerId' })
  owner!: User;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Index()
  @Column({ type: 'enum', enum: TaskType, default: TaskType.PERSONAL })
  type!: TaskType;

  @Column({ type: 'enum', enum: TaskPriority, default: TaskPriority.MEDIUM })
  priority!: TaskPriority;

  @Index()
  @Column({ type: 'enum', enum: TaskStatus, default: TaskStatus.TODO })
  status!: TaskStatus;

  @Column({ type: 'timestamptz', nullable: true })
  startAt!: Date | null;

  @Index()
  @Column({ type: 'timestamptz', nullable: true })
  dueAt!: Date | null;

  @Index()
  @Column({ type: 'boolean', default: false })
  isCompleted!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  subjectId!: string | null;

  @ManyToOne(() => Subject, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'subjectId' })
  subject!: Subject | null;

  @Column({ type: 'uuid', nullable: true })
  sectionId!: string | null;

  @ManyToOne(() => AcademicSection, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'sectionId' })
  section!: AcademicSection | null;

  @Column({ type: 'uuid', nullable: true })
  teamId!: string | null;

  @ManyToOne(() => StudyTeam, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'teamId' })
  team!: StudyTeam | null;

  @Column({ type: 'uuid', nullable: true })
  semesterId!: string | null;

  @ManyToOne(() => Semester, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'semesterId' })
  semester!: Semester | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
