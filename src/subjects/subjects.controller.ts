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
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../common/enums.js';
import { CreateSubjectDto } from './dto/create-subject.dto.js';
import { QuerySubjectsDto } from './dto/query-subjects.dto.js';
import { SetPrerequisitesDto } from './dto/set-prerequisites.dto.js';
import { UpdateSubjectDto } from './dto/update-subject.dto.js';
import { Subject } from './entities/subject.entity.js';
import { SubjectsService } from './subjects.service.js';

@ApiTags('subjects')
@ApiBearerAuth('access-token')
@Controller('subjects')
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Get()
  @ApiOperation({ summary: 'List / search subjects' })
  @ApiOkResponse({ description: 'Paginated list of subjects' })
  findAll(@Query() query: QuerySubjectsDto) {
    return this.subjectsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a subject with its prerequisites' })
  @ApiParam({ name: 'id', format: 'uuid' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string): Promise<Subject> {
    return this.subjectsService.findOne(id);
  }

  @Get(':id/prerequisites')
  @ApiOperation({ summary: 'List a subject prerequisites' })
  @ApiParam({ name: 'id', format: 'uuid' })
  getPrerequisites(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.subjectsService.getPrerequisites(id);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Create a subject (admin)' })
  @ApiCreatedResponse({ type: Subject })
  create(@Body() dto: CreateSubjectDto): Promise<Subject> {
    return this.subjectsService.create(dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a subject (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSubjectDto,
  ): Promise<Subject> {
    return this.subjectsService.update(id, dto);
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

  @Roles(UserRole.ADMIN)
  @Put(':id/prerequisites')
  @ApiOperation({ summary: 'Replace the prerequisite list of a subject (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  setPrerequisites(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SetPrerequisitesDto,
  ): Promise<Subject[]> {
    return this.subjectsService.setPrerequisites(id, dto.prerequisiteIds);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/prerequisites/:prerequisiteId')
  @ApiOperation({ summary: 'Add a single prerequisite (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'prerequisiteId', format: 'uuid' })
  addPrerequisite(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('prerequisiteId', new ParseUUIDPipe()) prerequisiteId: string,
  ): Promise<Subject[]> {
    return this.subjectsService.addPrerequisite(id, prerequisiteId);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id/prerequisites/:prerequisiteId')
  @ApiOperation({ summary: 'Remove a prerequisite (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'prerequisiteId', format: 'uuid' })
  removePrerequisite(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('prerequisiteId', new ParseUUIDPipe()) prerequisiteId: string,
  ): Promise<Subject[]> {
    return this.subjectsService.removePrerequisite(id, prerequisiteId);
  }
}
