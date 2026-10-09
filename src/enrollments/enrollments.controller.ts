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
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../common/enums.js';
import type { AuthenticatedUser } from '../common/interfaces.js';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto.js';
import { QueryEnrollmentsDto } from './dto/query-enrollments.dto.js';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto.js';
import { UpdateMarksDto } from './dto/update-marks.dto.js';
import { StudentEnrollment } from './entities/enrollment.entity.js';
import { EnrollmentsService } from './enrollments.service.js';

@ApiTags('enrollments')
@ApiBearerAuth('access-token')
@Controller('enrollments')
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Post()
  @ApiOperation({ summary: 'Enroll in a section (admin may enroll another student)' })
  @ApiCreatedResponse({ type: StudentEnrollment })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEnrollmentDto,
  ): Promise<StudentEnrollment> {
    return this.enrollmentsService.create(user, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'List my enrollments' })
  findMine(@CurrentUser('id') userId: string, @Query() query: QueryEnrollmentsDto) {
    return this.enrollmentsService.findMine(userId, query);
  }

  @Get('me/gpa')
  @ApiOperation({ summary: 'My GPA summary (credit-weighted)' })
  myGpa(@CurrentUser('id') userId: string) {
    return this.enrollmentsService.gpaForStudent(userId);
  }

  @Roles(UserRole.ADMIN)
  @Get()
  @ApiOperation({ summary: 'List / filter enrollments (admin)' })
  findAll(@Query() query: QueryEnrollmentsDto) {
    return this.enrollmentsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an enrollment (owner or admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<StudentEnrollment> {
    return this.enrollmentsService.findOne(user, id);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update enrollment status (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateEnrollmentDto,
  ): Promise<StudentEnrollment> {
    return this.enrollmentsService.update(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/marks')
  @ApiOperation({ summary: 'Record marks and recompute total (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  recordMarks(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateMarksDto,
  ): Promise<StudentEnrollment> {
    return this.enrollmentsService.recordMarks(id, dto);
  }

  @Patch(':id/drop')
  @ApiOperation({ summary: 'Drop an enrollment (owner or admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  drop(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<StudentEnrollment> {
    return this.enrollmentsService.drop(user, id);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an enrollment (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    return this.enrollmentsService.remove(id);
  }
}
