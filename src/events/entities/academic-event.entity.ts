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
import { AcademicEventType } from '../../common/enums.js';
import { AcademicSection } from '../../sections/entities/section.entity.js';
import { Semester } from '../../semesters/entities/semester.entity.js';
import { Subject } from '../../subjects/entities/subject.entity.js';
import { StudyTeam } from '../../teams/entities/study-team.entity.js';
import { User } from '../../users/entities/user.entity.js';

/**
 * Shared academic calendar event (created by admins). Timestamps are stored in
 * UTC as `timestamptz`; clients send ISO-8601 strings with an explicit offset.
 */
@Entity('academic_events')
export class AcademicEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Index()
  @Column({ type: 'enum', enum: AcademicEventType, default: AcademicEventType.OTHER })
  type!: AcademicEventType;

  @Index()
  @Column({ type: 'timestamptz' })
  startAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endAt!: Date | null;

  @Column({ type: 'boolean', default: false })
  allDay!: boolean;

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

  @Column({ type: 'uuid', nullable: true })
  semesterId!: string | null;

  @ManyToOne(() => Semester, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'semesterId' })
  semester!: Semester | null;

  @Column({ type: 'uuid', nullable: true })
  teamId!: string | null;

  @ManyToOne(() => StudyTeam, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'teamId' })
  team!: StudyTeam | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  createdById!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy!: User | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
