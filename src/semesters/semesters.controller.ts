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
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/interfaces.js';
import { AcademicScopeService } from '../users/academic-scope.service.js';
import { CreateSemesterDto } from './dto/create-semester.dto.js';
import { QuerySemestersDto } from './dto/query-semesters.dto.js';
import { UpdateSemesterDto } from './dto/update-semester.dto.js';
import { Semester } from './entities/semester.entity.js';
import { SemestersService } from './semesters.service.js';

const MANAGER_ROLES = [UserRole.ADMIN, UserRole.PROGRAM_MANAGER];

@ApiTags('semesters')
@ApiBearerAuth('access-token')
@Controller('semesters')
export class SemestersController {
  constructor(
    private readonly semestersService: SemestersService,
    private readonly scopeService: AcademicScopeService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List semesters within the caller scope' })
  @ApiOkResponse({ description: 'Paginated list of semesters' })
  async findAll(@Query() query: QuerySemestersDto, @CurrentUser() user: AuthenticatedUser) {
    const scope = await this.scopeService.resolve(user);
    return this.semestersService.findAll(query, scope);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a semester' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Semester> {
    const scope = await this.scopeService.resolve(user);
    return this.semestersService.findOne(id, scope);
  }

  @Roles(...MANAGER_ROLES)
  @Post()
  @ApiOperation({ summary: 'Create a semester (admin, or program manager within their program)' })
  @ApiCreatedResponse({ type: Semester })
  async create(
    @Body() dto: CreateSemesterDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Semester> {
    const scope = await this.scopeService.resolve(user);
    return this.semestersService.create(dto, scope);
  }

  @Roles(...MANAGER_ROLES)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a semester (admin, or program manager within their program)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSemesterDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Semester> {
    const scope = await this.scopeService.resolve(user);
    return this.semestersService.update(id, dto, scope);
  }

  @Roles(...MANAGER_ROLES)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a semester (admin, or program manager within their program)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    const scope = await this.scopeService.resolve(user);
    return this.semestersService.remove(id, scope);
  }
}
