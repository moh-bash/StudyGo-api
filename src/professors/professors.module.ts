import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Professor } from './entities/professor.entity.js';
import { ProfessorsController } from './professors.controller.js';
import { ProfessorsService } from './professors.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Professor])],
  controllers: [ProfessorsController],
  providers: [ProfessorsService],
  exports: [ProfessorsService],
})
export class ProfessorsModule {}
