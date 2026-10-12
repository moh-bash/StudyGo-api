import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshToken } from '../auth/entities/refresh-token.entity.js';
import { AcademicProgram } from '../programs/entities/program.entity.js';
import { Subject } from '../subjects/entities/subject.entity.js';
import { SubjectManagerAssignment } from './entities/subject-manager-assignment.entity.js';
import { User } from './entities/user.entity.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      RefreshToken,
      AcademicProgram,
      Subject,
      SubjectManagerAssignment,
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
