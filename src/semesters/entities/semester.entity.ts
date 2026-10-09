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
import { SemesterStatus } from '../../common/enums.js';
import { AcademicProgram } from '../../programs/entities/program.entity.js';

/** A semester code is unique within its academic program. */
@Entity('semesters')
@Unique('UQ_semester_program_code', ['programId', 'code'])
export class Semester {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  programId!: string;

  @ManyToOne(() => AcademicProgram, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'programId' })
  program!: AcademicProgram;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 20 })
  code!: string;

  @Column({ type: 'date', nullable: true })
  startDate!: string | null;

  @Column({ type: 'date', nullable: true })
  endDate!: string | null;

  @Index()
  @Column({ type: 'enum', enum: SemesterStatus, default: SemesterStatus.PLANNED })
  status!: SemesterStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
