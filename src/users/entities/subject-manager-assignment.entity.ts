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
import { Subject } from '../../subjects/entities/subject.entity.js';
import { User } from './user.entity.js';

/**
 * Explicit scope for a `SUBJECT_MANAGER`: the set of subjects (always within the
 * user's own academic program) that the user may manage. The row is the source
 * of truth for "which subjects" — a client-supplied subject id is never proof of
 * authorization on its own.
 *
 * Unidirectional (child → parent) to match the project's relation convention.
 * Deleting the user or the subject removes the assignment (CASCADE).
 */
@Entity('subject_manager_assignments')
@Unique('UQ_subject_manager_user_subject', ['userId', 'subjectId'])
export class SubjectManagerAssignment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('IDX_subject_manager_assignments_user_id')
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Index('IDX_subject_manager_assignments_subject_id')
  @Column({ type: 'uuid' })
  subjectId!: string;

  @ManyToOne(() => Subject, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subjectId' })
  subject!: Subject;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
