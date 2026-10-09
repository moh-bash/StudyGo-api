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
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../common/enums.js';
import { CreateSectionDto } from './dto/create-section.dto.js';
import { CreateSectionScheduleDto } from './dto/create-section-schedule.dto.js';
import { QuerySectionsDto } from './dto/query-sections.dto.js';
import { UpdateSectionScheduleDto } from './dto/update-section-schedule.dto.js';
import { UpdateSectionDto } from './dto/update-section.dto.js';
import { AcademicSection } from './entities/section.entity.js';
import { SectionSchedule } from './entities/section-schedule.entity.js';
import { SectionsService } from './sections.service.js';

@ApiTags('sections')
@ApiBearerAuth('access-token')
@Controller('sections')
export class SectionsController {
  constructor(private readonly sectionsService: SectionsService) {}

  @Get()
  @ApiOperation({ summary: 'List / filter academic sections' })
  @ApiOkResponse({ description: 'Paginated list of sections' })
  findAll(@Query() query: QuerySectionsDto) {
    return this.sectionsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a section with its schedules' })
  @ApiParam({ name: 'id', format: 'uuid' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.sectionsService.findOne(id);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Create a section (admin)' })
  @ApiCreatedResponse({ type: AcademicSection })
  create(@Body() dto: CreateSectionDto): Promise<AcademicSection> {
    return this.sectionsService.create(dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a section (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSectionDto,
  ): Promise<AcademicSection> {
    return this.sectionsService.update(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a section (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    return this.sectionsService.remove(id);
  }

  @Get(':id/schedules')
  @ApiOperation({ summary: 'List section meeting schedules' })
  @ApiParam({ name: 'id', format: 'uuid' })
  listSchedules(@Param('id', new ParseUUIDPipe()) id: string): Promise<SectionSchedule[]> {
    return this.sectionsService.listSchedules(id);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/schedules')
  @ApiOperation({ summary: 'Add a meeting schedule to a section (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: SectionSchedule })
  addSchedule(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateSectionScheduleDto,
  ): Promise<SectionSchedule> {
    return this.sectionsService.addSchedule(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/schedules/:scheduleId')
  @ApiOperation({ summary: 'Update a section schedule (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'scheduleId', format: 'uuid' })
  updateSchedule(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('scheduleId', new ParseUUIDPipe()) scheduleId: string,
    @Body() dto: UpdateSectionScheduleDto,
  ): Promise<SectionSchedule> {
    return this.sectionsService.updateSchedule(id, scheduleId, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id/schedules/:scheduleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a section schedule (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'scheduleId', format: 'uuid' })
  @ApiNoContentResponse()
  removeSchedule(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('scheduleId', new ParseUUIDPipe()) scheduleId: string,
  ): Promise<void> {
    return this.sectionsService.removeSchedule(id, scheduleId);
  }
}
