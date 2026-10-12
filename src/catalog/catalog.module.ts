import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Professor } from '../professors/entities/professor.entity.js';
import { AcademicProgram } from '../programs/entities/program.entity.js';
import { SectionSchedule } from '../sections/entities/section-schedule.entity.js';
import { AcademicSection } from '../sections/entities/section.entity.js';
import { Semester } from '../semesters/entities/semester.entity.js';
import { Subject } from '../subjects/entities/subject.entity.js';
import { User } from '../users/entities/user.entity.js';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Subject,
      Semester,
      AcademicSection,
      Professor,
      SectionSchedule,
      AcademicProgram,
    ]),
  ],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
