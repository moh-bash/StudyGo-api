import {
  Check,
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
import { EnrollmentStatus } from '../../common/enums.js';
import { numericTransformer } from '../../common/transformers.js';
import { AcademicSection } from '../../sections/entities/section.entity.js';
import { User } from '../../users/entities/user.entity.js';

/**
 * A student's enrollment in a section. A student may only enroll once per
 * section. `totalMark` is a stored snapshot derived by the central grade
 * utility; it is recomputed whenever marks are updated.
 */
@Entity('student_enrollments')
@Unique('UQ_enrollment_student_section', ['studentId', 'sectionId'])
@Check(
  'CHK_enrollment_marks',
  '("projectMark" IS NULL OR ("projectMark" >= 0 AND "projectMark" <= 100)) AND ("examMark" IS NULL OR ("examMark" >= 0 AND "examMark" <= 100))',
)
export class StudentEnrollment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  studentId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'studentId' })
  student!: User;

  @Index()
  @Column({ type: 'uuid' })
  sectionId!: string;

  @ManyToOne(() => AcademicSection, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'sectionId' })
  section!: AcademicSection;

  @Index()
  @Column({ type: 'enum', enum: EnrollmentStatus, default: EnrollmentStatus.ENROLLED })
  status!: EnrollmentStatus;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true, transformer: numericTransformer })
  projectMark!: number | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true, transformer: numericTransformer })
  examMark!: number | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true, transformer: numericTransformer })
  totalMark!: number | null;

  /** true when marks were entered/confirmed by an administrator. */
  @Column({ type: 'boolean', default: false })
  isVerified!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
