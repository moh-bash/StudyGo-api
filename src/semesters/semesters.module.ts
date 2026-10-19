import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicProgram } from '../programs/entities/program.entity.js';
import { UsersModule } from '../users/users.module.js';
import { Semester } from './entities/semester.entity.js';
import { SemestersController } from './semesters.controller.js';
import { SemestersService } from './semesters.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Semester, AcademicProgram]), UsersModule],
  controllers: [SemestersController],
  providers: [SemestersService],
  exports: [SemestersService],
})
export class SemestersModule {}
