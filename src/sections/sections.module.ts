import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Professor } from '../professors/entities/professor.entity.js';
import { Semester } from '../semesters/entities/semester.entity.js';
import { Subject } from '../subjects/entities/subject.entity.js';
import { UsersModule } from '../users/users.module.js';
import { AcademicSection } from './entities/section.entity.js';
import { SectionSchedule } from './entities/section-schedule.entity.js';
import { SectionsController } from './sections.controller.js';
import { SectionsService } from './sections.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([AcademicSection, SectionSchedule, Semester, Subject, Professor]),
    UsersModule,
  ],
  controllers: [SectionsController],
  providers: [SectionsService],
  exports: [SectionsService],
})
export class SectionsModule {}
