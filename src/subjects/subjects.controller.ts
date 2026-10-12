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
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../common/enums.js';
import type { AuthenticatedUser } from '../common/interfaces.js';
import { AcademicScopeService } from '../users/academic-scope.service.js';
import { CreateSubjectDto } from './dto/create-subject.dto.js';
import { QuerySubjectsDto } from './dto/query-subjects.dto.js';
import { SetPrerequisitesDto } from './dto/set-prerequisites.dto.js';
import { UpdateSubjectDto } from './dto/update-subject.dto.js';
import { Subject } from './entities/subject.entity.js';
import { SubjectsService } from './subjects.service.js';

const MANAGER_ROLES = [UserRole.ADMIN, UserRole.PROGRAM_MANAGER, UserRole.SUBJECT_MANAGER];

@ApiTags('subjects')
@ApiBearerAuth('access-token')
@Controller('subjects')
export class SubjectsController {
  constructor(
    private readonly subjectsService: SubjectsService,
    private readonly scopeService: AcademicScopeService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List / search subjects within the caller scope' })
  @ApiOkResponse({ description: 'Paginated list of subjects' })
  async findAll(@Query() query: QuerySubjectsDto, @CurrentUser() user: AuthenticatedUser) {
    const scope = await this.scopeService.resolve(user);
    return this.subjectsService.findAll(query, scope);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a subject with its prerequisites' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Subject> {
    const scope = await this.scopeService.resolve(user);
    return this.subjectsService.findOne(id, scope);
  }

  @Get(':id/prerequisites')
  @ApiOperation({ summary: 'List a subject prerequisites' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async getPrerequisites(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const scope = await this.scopeService.resolve(user);
    return this.subjectsService.getPrerequisites(id, scope);
  }

  @Roles(...MANAGER_ROLES)
  @Post()
  @ApiOperation({ summary: 'Create a subject (admin, or manager within their program)' })
  @ApiCreatedResponse({ type: Subject })
  @ApiForbiddenResponse({ description: 'Managers may only create subjects in their program' })
  async create(
    @Body() dto: CreateSubjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Subject> {
    const scope = await this.scopeService.resolve(user);
    const subject = await this.subjectsService.create(dto, scope);
    // A subject created by a Subject Manager is automatically added to their
    // explicit scope so they can manage it immediately.
    await this.scopeService.autoAssignSubject(scope, subject.id);
    return subject;
  }

  @Roles(...MANAGER_ROLES)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a subject (admin, or manager within scope)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSubjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Subject> {
    const scope = await this.scopeService.resolve(user);
    return this.subjectsService.update(id, dto, scope);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a subject (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    return this.subjectsService.remove(id);
  }

  @Roles(...MANAGER_ROLES)
  @Put(':id/prerequisites')
  @ApiOperation({ summary: 'Replace the prerequisite list of a subject (admin or manager in scope)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async setPrerequisites(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SetPrerequisitesDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Subject[]> {
    const scope = await this.scopeService.resolve(user);
    return this.subjectsService.setPrerequisites(id, dto.prerequisiteIds, scope);
  }

  @Roles(...MANAGER_ROLES)
  @Post(':id/prerequisites/:prerequisiteId')
  @ApiOperation({ summary: 'Add a single prerequisite (admin or manager in scope)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'prerequisiteId', format: 'uuid' })
  async addPrerequisite(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('prerequisiteId', new ParseUUIDPipe()) prerequisiteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Subject[]> {
    const scope = await this.scopeService.resolve(user);
    return this.subjectsService.addPrerequisite(id, prerequisiteId, scope);
  }

  @Roles(...MANAGER_ROLES)
  @Delete(':id/prerequisites/:prerequisiteId')
  @ApiOperation({ summary: 'Remove a prerequisite (admin or manager in scope)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'prerequisiteId', format: 'uuid' })
  async removePrerequisite(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('prerequisiteId', new ParseUUIDPipe()) prerequisiteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Subject[]> {
    const scope = await this.scopeService.resolve(user);
    return this.subjectsService.removePrerequisite(id, prerequisiteId, scope);
  }
}
