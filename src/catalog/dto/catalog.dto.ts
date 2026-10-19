import { ApiProperty } from '@nestjs/swagger';
import { DeliveryMode, SemesterStatus, Weekday } from '../../common/enums.js';

/**
 * Read-only projections for the program-scoped catalog sync endpoint.
 *
 * Every identifier is the canonical backend UUID so a client can map its own
 * local records to server records without guessing. Fields are limited to those
 * required to reconstruct the catalog (subjects, their prerequisites, the
 * semesters they are offered in, the offering sections, the professors teaching
 * them, and the section meeting schedules).
 */

export class CatalogProgramDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Information Technology' })
  name!: string;

  @ApiProperty({ nullable: true, example: 'IT' })
  code!: string | null;
}

export class CatalogSemesterDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  programId!: string;

  @ApiProperty({ example: 'First Semester 2026' })
  name!: string;

  @ApiProperty({ example: 'S26' })
  code!: string;

  @ApiProperty({ nullable: true, example: '2026-02-01', format: 'date' })
  startDate!: string | null;

  @ApiProperty({ nullable: true, example: '2026-06-15', format: 'date' })
  endDate!: string | null;

  @ApiProperty({ enum: SemesterStatus })
  status!: SemesterStatus;
}

export class CatalogSubjectDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  /** Always the caller's program: only in-program subjects are returned. */
  @ApiProperty({ format: 'uuid' })
  programId!: string;

  @ApiProperty({ example: 'IT101' })
  code!: string;

  @ApiProperty({ example: 'Introduction to Programming' })
  nameEn!: string;

  @ApiProperty({ example: 'مقدمة في البرمجة' })
  nameAr!: string;

  @ApiProperty({ example: 3 })
  creditHours!: number;

  @ApiProperty({ example: 25 })
  projectWeight!: number;

  @ApiProperty({ example: 75 })
  examWeight!: number;

  @ApiProperty({
    type: [String],
    format: 'uuid',
    description:
      'Prerequisite subject ids (may reference a subject outside this program; such ids are not resolved here).',
  })
  prerequisiteIds!: string[];
}

export class CatalogProfessorDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Dr. Omar Nasser' })
  name!: string;

  @ApiProperty({ nullable: true, example: 'omar.nasser@svu.example' })
  email!: string | null;

  @ApiProperty({ nullable: true, example: null })
  profileImageUrl!: string | null;

  @ApiProperty({ nullable: true, example: null })
  description!: string | null;
}

export class CatalogSectionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  semesterId!: string;

  @ApiProperty({ format: 'uuid' })
  subjectId!: string;

  @ApiProperty({ nullable: true, format: 'uuid' })
  professorId!: string | null;

  @ApiProperty({ example: '01' })
  code!: string;

  @ApiProperty({ nullable: true, example: 'Building A, Room 12' })
  location!: string | null;

  @ApiProperty({ nullable: true, enum: DeliveryMode })
  deliveryMode!: DeliveryMode | null;

  @ApiProperty({ nullable: true, example: 40 })
  capacity!: number | null;
}

export class CatalogScheduleDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  sectionId!: string;

  @ApiProperty({ enum: Weekday })
  dayOfWeek!: Weekday;

  @ApiProperty({ example: '09:00:00' })
  startTime!: string;

  @ApiProperty({ example: '10:30:00' })
  endTime!: string;

  @ApiProperty({ nullable: true, example: 'Room 12' })
  room!: string | null;
}

/**
 * The complete catalog for the authenticated caller's academic program. An
 * empty catalog (no program, or a program with no active records) is a valid
 * response, expressed as `program: null` and empty arrays.
 */
export class CatalogDto {
  @ApiProperty({ type: CatalogProgramDto, nullable: true })
  program!: CatalogProgramDto | null;

  @ApiProperty({ type: [CatalogSemesterDto] })
  semesters!: CatalogSemesterDto[];

  @ApiProperty({ type: [CatalogSubjectDto] })
  subjects!: CatalogSubjectDto[];

  @ApiProperty({ type: [CatalogProfessorDto] })
  professors!: CatalogProfessorDto[];

  @ApiProperty({ type: [CatalogSectionDto] })
  sections!: CatalogSectionDto[];

  @ApiProperty({ type: [CatalogScheduleDto] })
  schedules!: CatalogScheduleDto[];
}
