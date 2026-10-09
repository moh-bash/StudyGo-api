import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { NotificationType } from '../../common/enums.js';
import { User } from '../../users/entities/user.entity.js';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text' })
  body!: string;

  @Index()
  @Column({ type: 'enum', enum: NotificationType, default: NotificationType.SYSTEM })
  type!: NotificationType;

  /** Optional deep-link payload, e.g. `{ "teamId": "..." }`. */
  @Column({ type: 'jsonb', nullable: true })
  data!: Record<string, unknown> | null;

  @Index()
  @Column({ type: 'boolean', default: false })
  isRead!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  readAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
