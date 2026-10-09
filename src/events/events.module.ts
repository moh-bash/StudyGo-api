import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicSection } from '../sections/entities/section.entity.js';
import { Semester } from '../semesters/entities/semester.entity.js';
import { Subject } from '../subjects/entities/subject.entity.js';
import { StudyTeam } from '../teams/entities/study-team.entity.js';
import { AcademicEvent } from './entities/academic-event.entity.js';
import { EventsController } from './events.controller.js';
import { EventsService } from './events.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([AcademicEvent, Subject, AcademicSection, Semester, StudyTeam])],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
