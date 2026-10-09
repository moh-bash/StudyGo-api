import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Weekday } from '../../common/enums.js';
import { AcademicSection } from './section.entity.js';

/** Weekly recurring meeting time for a section. Times are wall-clock (no TZ). */
@Entity('section_schedules')
export class SectionSchedule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  sectionId!: string;

  @ManyToOne(() => AcademicSection, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'sectionId' })
  section!: AcademicSection;

  @Column({ type: 'enum', enum: Weekday })
  dayOfWeek!: Weekday;

  @Column({ type: 'time' })
  startTime!: string;

  @Column({ type: 'time' })
  endTime!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  room!: string | null;
}
