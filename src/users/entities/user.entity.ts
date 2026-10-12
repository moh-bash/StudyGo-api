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
import { AccountStatus, UserRole } from '../../common/enums.js';
import { AcademicProgram } from '../../programs/entities/program.entity.js';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 150 })
  fullName!: string;

  /** Normalized (lower-cased, trimmed) email. Enforced unique at the DB level. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 254 })
  email!: string;

  /** bcrypt hash. `select: false` keeps it out of default query results. */
  @Column({ type: 'varchar', select: false })
  passwordHash!: string;

  @Index()
  @Column({ type: 'enum', enum: UserRole, default: UserRole.STUDENT })
  role!: UserRole;

  @Index()
  @Column({ type: 'enum', enum: AccountStatus, default: AccountStatus.ACTIVE })
  status!: AccountStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  profileImageUrl!: string | null;

  /** University student id. Unique when present; multiple NULLs are allowed. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50, nullable: true })
  studentUniversityId!: string | null;

  /**
   * Academic program the user belongs to. Nullable so legacy/undecided
   * accounts exist without an assignment. One program per user — no join table.
   * Deleting a program sets this back to NULL (never cascades to users).
   */
  @Index('IDX_users_program_id')
  @Column({ type: 'uuid', nullable: true })
  programId!: string | null;

  @ManyToOne(() => AcademicProgram, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'programId' })
  program?: AcademicProgram | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
