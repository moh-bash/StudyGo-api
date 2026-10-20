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
import {
  TeamContactMethod,
  TeamScope,
  TeamStatus,
  TeamVisibility,
} from '../../common/enums.js';
import { Professor } from '../../professors/entities/professor.entity.js';
import { AcademicSection } from '../../sections/entities/section.entity.js';
import { Semester } from '../../semesters/entities/semester.entity.js';
import { Subject } from '../../subjects/entities/subject.entity.js';
import { User } from '../../users/entities/user.entity.js';

/**
 * A study team for one subject in one academic term.
 *
 * Phase 5 extends the original generic team with the fields the subject-team
 * feature requires: an academic term (`semesterId`), the professor the team is
 * anchored to (derived from the creator's section at creation time), an
 * eligibility scope, and an external contact method/value. All new columns are
 * nullable so pre-existing rows (created against the original generic team
 * endpoints) remain valid.
 */
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

  /**
   * Academic term the team belongs to. The originating section always belongs
   * to this semester; a team never spans two terms.
   */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  semesterId!: string | null;

  @ManyToOne(() => Semester, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'semesterId' })
  semester!: Semester | null;

  /**
   * Professor the team is anchored to. Taken from the creator's originating
   * section; visibility and eligibility compare this stable id, never a
   * professor display name.
   */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  professorId!: string | null;

  @ManyToOne(() => Professor, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'professorId' })
  professor!: Professor | null;

  @Index()
  @Column({ type: 'enum', enum: TeamScope, default: TeamScope.SECTION })
  scope!: TeamScope;

  @Index()
  @Column({ type: 'uuid' })
  creatorId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'creatorId' })
  creator!: User;

  @Column({ type: 'int', default: 5 })
  maxMembers!: number;

  @Column({ type: 'enum', enum: TeamContactMethod, nullable: true })
  contactMethod!: TeamContactMethod | null;

  /** Normalized destination value; meaning depends on `contactMethod`. */
  @Column({ type: 'varchar', length: 300, nullable: true })
  contactValue!: string | null;

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
