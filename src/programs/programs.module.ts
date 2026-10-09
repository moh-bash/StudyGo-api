import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicProgram } from './entities/program.entity.js';
import { ProgramsController } from './programs.controller.js';
import { ProgramsService } from './programs.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([AcademicProgram])],
  controllers: [ProgramsController],
  providers: [ProgramsService],
  exports: [ProgramsService],
})
export class ProgramsModule {}
