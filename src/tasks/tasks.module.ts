import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicSection } from '../sections/entities/section.entity.js';
import { Semester } from '../semesters/entities/semester.entity.js';
import { Subject } from '../subjects/entities/subject.entity.js';
import { StudyTeam } from '../teams/entities/study-team.entity.js';
import { Task } from './entities/task.entity.js';
import { TasksController } from './tasks.controller.js';
import { TasksService } from './tasks.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Task, Subject, AcademicSection, StudyTeam, Semester])],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
