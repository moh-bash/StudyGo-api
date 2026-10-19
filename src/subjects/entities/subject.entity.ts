import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { numericTransformer } from '../../common/transformers.js';
import { AcademicProgram } from '../../programs/entities/program.entity.js';

/**
 * Weighting model: the default (and currently only) grading scheme splits the
 * final mark between a project and an exam, and the two weights must sum to 100.
 * If more schemes are needed later, add an explicit `gradingScheme` entity rather
 * than overloading these columns.
 *
 * Uniqueness: a subject code is unique within its specialization (program), not
 * globally — different specializations may reuse the same code for distinct
 * subjects. Program-less subjects (legacy/deprecated) carry no uniqueness
 * guarantee and are excluded from every catalog.
 */
@Entity('subjects')
@Index('UQ_subject_program_code', ['programId', 'code'], {
  unique: true,
  where: '"programId" IS NOT NULL',
})
@Check('CHK_subject_weights_non_negative', '"projectWeight" >= 0 AND "examWeight" >= 0')
@Check('CHK_subject_weights_total', '"projectWeight" + "examWeight" = 100')
export class Subject {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 20 })
  code!: string;

  @Column({ type: 'varchar', length: 200 })
  nameEn!: string;

  @Column({ type: 'varchar', length: 200 })
  nameAr!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'int' })
  creditHours!: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0, transformer: numericTransformer })
  projectWeight!: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 100, transformer: numericTransformer })
  examWeight!: number;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  programId!: string | null;

  @ManyToOne(() => AcademicProgram, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'programId' })
  program!: AcademicProgram | null;

  @Index()
  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  /**
   * Unidirectional self-referencing many-to-many. A subject can list other
   * subjects as prerequisites; the service rejects self-references.
   */
  @ManyToMany(() => Subject)
  @JoinTable({
    name: 'subject_prerequisites',
    joinColumn: { name: 'subjectId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'prerequisiteSubjectId', referencedColumnName: 'id' },
  })
  prerequisites!: Subject[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
