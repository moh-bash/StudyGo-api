import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicSection } from '../sections/entities/section.entity.js';
import { Subject } from '../subjects/entities/subject.entity.js';
import { User } from '../users/entities/user.entity.js';
import { StudyTeam } from './entities/study-team.entity.js';
import { TeamJoinRequest } from './entities/team-join-request.entity.js';
import { TeamMembership } from './entities/team-membership.entity.js';
import { TeamTaskSlot } from './entities/team-task-slot.entity.js';
import { AdminTeamsController } from './admin-teams.controller.js';
import { AdminTeamsService } from './admin-teams.service.js';
import { SubjectTeamsController } from './subject-teams.controller.js';
import { SubjectTeamsService } from './subject-teams.service.js';
import { TeamsController } from './teams.controller.js';
import { TeamsService } from './teams.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StudyTeam,
      TeamMembership,
      TeamJoinRequest,
      TeamTaskSlot,
      Subject,
      AcademicSection,
      User,
    ]),
  ],
  controllers: [SubjectTeamsController, AdminTeamsController, TeamsController],
  providers: [SubjectTeamsService, AdminTeamsService, TeamsService],
  exports: [SubjectTeamsService, AdminTeamsService, TeamsService],
})
export class TeamsModule {}
