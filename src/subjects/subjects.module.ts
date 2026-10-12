import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicProgram } from '../programs/entities/program.entity.js';
import { UsersModule } from '../users/users.module.js';
import { Subject } from './entities/subject.entity.js';
import { SubjectsController } from './subjects.controller.js';
import { SubjectsService } from './subjects.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Subject, AcademicProgram]), UsersModule],
  controllers: [SubjectsController],
  providers: [SubjectsService],
  exports: [SubjectsService],
})
export class SubjectsModule {}
