import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../common/enums.js';
import { MessageResponseDto } from '../auth/dto/auth-response.dto.js';
import { AcademicAssignmentsDto } from './dto/academic-assignments.dto.js';
import { AssignProgramManagerDto } from './dto/assign-program-manager.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { QueryUsersDto } from './dto/query-users.dto.js';
import { SetSubjectManagersDto } from './dto/set-subject-managers.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UserResponseDto } from './dto/user-response.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get my profile' })
  @ApiOkResponse({ type: UserResponseDto })
  findMe(@CurrentUser('id') userId: string): Promise<UserResponseDto> {
    return this.usersService.findMe(userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update my profile' })
  @ApiOkResponse({ type: UserResponseDto })
  updateMe(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    return this.usersService.updateMe(userId, dto);
  }

  @Patch('me/password')
  @ApiOperation({ summary: 'Change my password' })
  @ApiOkResponse({ type: MessageResponseDto })
  changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ): Promise<MessageResponseDto> {
    return this.usersService.changePassword(userId, dto);
  }

  @Roles(UserRole.ADMIN)
  @Get()
  @ApiOperation({ summary: 'List users (admin)' })
  findAll(@Query() query: QueryUsersDto) {
    return this.usersService.findAll(query);
  }

  @Roles(UserRole.ADMIN)
  @Get(':id')
  @ApiOperation({ summary: 'Get a user by id (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: UserResponseDto })
  findOne(@Param('id', new ParseUUIDPipe()) id: string): Promise<UserResponseDto> {
    return this.usersService.findOne(id);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a user, including role/status (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: UserResponseDto })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.update(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a user (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    return this.usersService.remove(id);
  }

  @Roles(UserRole.ADMIN)
  @Get(':id/academic-assignments')
  @ApiOperation({ summary: "Inspect a user's role and academic assignments (admin)" })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AcademicAssignmentsDto })
  getAcademicAssignments(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<AcademicAssignmentsDto> {
    return this.usersService.getAcademicAssignments(id);
  }

  @Roles(UserRole.ADMIN)
  @Put(':id/academic-assignments/program-manager')
  @ApiOperation({ summary: 'Assign a Program Manager to their program (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AcademicAssignmentsDto })
  assignProgramManager(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AssignProgramManagerDto,
  ): Promise<AcademicAssignmentsDto> {
    return this.usersService.assignProgramManager(id, dto.programId);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id/academic-assignments/program-manager')
  @ApiOperation({ summary: 'Remove a Program Manager assignment (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AcademicAssignmentsDto })
  removeProgramManager(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<AcademicAssignmentsDto> {
    return this.usersService.removeProgramManager(id);
  }

  @Roles(UserRole.ADMIN)
  @Put(':id/academic-assignments/subject-manager')
  @ApiOperation({ summary: "Replace a user's Subject Manager assignments (admin)" })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AcademicAssignmentsDto })
  setSubjectManagers(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SetSubjectManagersDto,
  ): Promise<AcademicAssignmentsDto> {
    return this.usersService.setSubjectManagers(id, dto.subjectIds);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id/academic-assignments/subject-manager/:subjectId')
  @ApiOperation({ summary: 'Remove a single Subject Manager assignment (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'subjectId', format: 'uuid' })
  @ApiOkResponse({ type: AcademicAssignmentsDto })
  removeSubjectManager(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('subjectId', new ParseUUIDPipe()) subjectId: string,
  ): Promise<AcademicAssignmentsDto> {
    return this.usersService.removeSubjectManager(id, subjectId);
  }
}
