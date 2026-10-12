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
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
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
import { CreateSectionDto } from './dto/create-section.dto.js';
import { CreateSectionScheduleDto } from './dto/create-section-schedule.dto.js';
import { QuerySectionsDto } from './dto/query-sections.dto.js';
import { UpdateSectionScheduleDto } from './dto/update-section-schedule.dto.js';
import { UpdateSectionDto } from './dto/update-section.dto.js';
import { AcademicSection } from './entities/section.entity.js';
import { SectionSchedule } from './entities/section-schedule.entity.js';
import { SectionsService } from './sections.service.js';

const MANAGER_ROLES = [UserRole.ADMIN, UserRole.PROGRAM_MANAGER, UserRole.SUBJECT_MANAGER];

@ApiTags('sections')
@ApiBearerAuth('access-token')
@Controller('sections')
export class SectionsController {
  constructor(
    private readonly sectionsService: SectionsService,
    private readonly scopeService: AcademicScopeService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List / filter academic sections within the caller scope' })
  @ApiOkResponse({ description: 'Paginated list of sections' })
  async findAll(@Query() query: QuerySectionsDto, @CurrentUser() user: AuthenticatedUser) {
    const scope = await this.scopeService.resolve(user);
    return this.sectionsService.findAll(query, scope);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a section with its schedules' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const scope = await this.scopeService.resolve(user);
    return this.sectionsService.findOne(id, scope);
  }

  @Roles(...MANAGER_ROLES)
  @Post()
  @ApiOperation({ summary: 'Create a section (admin, or manager within scope)' })
  @ApiCreatedResponse({ type: AcademicSection })
  async create(
    @Body() dto: CreateSectionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AcademicSection> {
    const scope = await this.scopeService.resolve(user);
    return this.sectionsService.create(dto, scope);
  }

  @Roles(...MANAGER_ROLES)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a section (admin, or manager within scope)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSectionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AcademicSection> {
    const scope = await this.scopeService.resolve(user);
    return this.sectionsService.update(id, dto, scope);
  }

  @Roles(...MANAGER_ROLES)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a section (admin, or manager within scope)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    const scope = await this.scopeService.resolve(user);
    return this.sectionsService.remove(id, scope);
  }

  @Get(':id/schedules')
  @ApiOperation({ summary: 'List section meeting schedules' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async listSchedules(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SectionSchedule[]> {
    const scope = await this.scopeService.resolve(user);
    return this.sectionsService.listSchedules(id, scope);
  }

  @Roles(...MANAGER_ROLES)
  @Post(':id/schedules')
  @ApiOperation({ summary: 'Add a meeting schedule to a section (admin or manager in scope)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: SectionSchedule })
  async addSchedule(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateSectionScheduleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SectionSchedule> {
    const scope = await this.scopeService.resolve(user);
    return this.sectionsService.addSchedule(id, dto, scope);
  }

  @Roles(...MANAGER_ROLES)
  @Patch(':id/schedules/:scheduleId')
  @ApiOperation({ summary: 'Update a section schedule (admin or manager in scope)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'scheduleId', format: 'uuid' })
  async updateSchedule(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('scheduleId', new ParseUUIDPipe()) scheduleId: string,
    @Body() dto: UpdateSectionScheduleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SectionSchedule> {
    const scope = await this.scopeService.resolve(user);
    return this.sectionsService.updateSchedule(id, scheduleId, dto, scope);
  }

  @Roles(...MANAGER_ROLES)
  @Delete(':id/schedules/:scheduleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a section schedule (admin or manager in scope)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'scheduleId', format: 'uuid' })
  @ApiNoContentResponse()
  async removeSchedule(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('scheduleId', new ParseUUIDPipe()) scheduleId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    const scope = await this.scopeService.resolve(user);
    return this.sectionsService.removeSchedule(id, scheduleId, scope);
  }
}
