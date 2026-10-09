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
import { DeliveryMode } from '../../common/enums.js';
import { Professor } from '../../professors/entities/professor.entity.js';
import { Semester } from '../../semesters/entities/semester.entity.js';
import { Subject } from '../../subjects/entities/subject.entity.js';

/**
 * A section is a concrete offering of a subject in a semester, taught by one
 * professor. The same subject can have several sections, each with its own
 * professor, in the same semester. A section code is unique within a semester.
 */
@Entity('academic_sections')
@Unique('UQ_section_semester_code', ['semesterId', 'code'])
export class AcademicSection {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  semesterId!: string;

  @ManyToOne(() => Semester, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'semesterId' })
  semester!: Semester;

  @Index()
  @Column({ type: 'uuid' })
  subjectId!: string;

  @ManyToOne(() => Subject, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'subjectId' })
  subject!: Subject;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  professorId!: string | null;

  @ManyToOne(() => Professor, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'professorId' })
  professor!: Professor | null;

  @Column({ type: 'varchar', length: 50 })
  code!: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  location!: string | null;

  @Column({ type: 'enum', enum: DeliveryMode, nullable: true })
  deliveryMode!: DeliveryMode | null;

  @Column({ type: 'int', nullable: true })
  capacity!: number | null;

  @Index()
  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
